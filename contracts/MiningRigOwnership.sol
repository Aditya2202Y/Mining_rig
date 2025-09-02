// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * MiningRigOwnership (ERC-1155, cumulative rewards)
 * - Each rig is a tokenId; each share = 1 unit of that token.
 * - Owner registers rigs and sets totalShares, price, and per-wallet cap.
 * - Users buy shares (mint), with oversell prevention and wallet cap.
 * - Owner deposits ETH rewards; holders claim proportionally since their last snapshot,
 *   using a cumulative reward-per-share (RPS) accumulator (fair to early & late buyers).
 * - Rewards are settled on buy, transfer, and claim to keep accounting correct.
 * - Added tracking: totalSalesETH (ETH collected from share sales)
 *                   totalRewardETH (ETH deposited for rewards)
 */

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

contract MiningRigOwnership is ERC1155Supply, Ownable, ReentrancyGuard {
    // Precision used for reward-per-share math
    uint256 private constant ACC_PRECISION = 1e18;

    struct Rig {
        string name;
        uint256 totalShares;       // maximum shares that can ever be minted for this rig
        uint256 pricePerShareWei;  // price per share in wei
        uint256 maxPerWallet;      // 0 = no cap; otherwise cap per address
        uint256 rewardPerShare;    // cumulative rewards per share * ACC_PRECISION
        bool active;               // if false, buying/deposits are disabled
    }

    // rigId => Rig config/state
    mapping(uint256 => Rig) public rigs;

    // Per-account reward accounting:
    // Tracks each user's last observed rewardPerShare to compute deltas.
    // user => rigId => last paid RPS
    mapping(address => mapping(uint256 => uint256)) public userRewardPerSharePaid;

    // Accumulated but unclaimed ETH for each user/rig
    // user => rigId => pending amount (wei)
    mapping(address => mapping(uint256 => uint256)) public pending;

    // Total ETH collected from sales (for owner tracking)
    uint256 public totalSalesETH;

    // Total ETH deposited as rewards (for owner tracking)
    uint256 public totalRewardETH;

    // Events
    event RigRegistered(
        uint256 indexed rigId,
        string name,
        uint256 totalShares,
        uint256 pricePerShareWei,
        uint256 maxPerWallet
    );
    event SharesPurchased(uint256 indexed rigId, address indexed buyer, uint256 amount, uint256 paidWei);
    event RewardsDeposited(uint256 indexed rigId, uint256 amountWei, uint256 newRewardPerShare);
    event RewardsClaimed(uint256 indexed rigId, address indexed user, uint256 amountWei);
    event SalesWithdrawn(address indexed to, uint256 amount);

    // Minimal constructor: no metadata URI needed; pass empty string.
    constructor() ERC1155("") Ownable(msg.sender) {}



    // ---------------------------
    // Rig management (owner-only)
    // ---------------------------

    /**
     * @notice Register a new rig. After registration, params are fixed.
     * @param rigId          tokenId for this rig
     * @param name           human-friendly name
     * @param totalShares    max supply (cannot be exceeded)
     * @param pricePerShareWei price per share in wei
     * @param maxPerWallet   per-wallet cap (0 = no cap)
     */
    function registerRig(
        uint256 rigId,
        string calldata name,
        uint256 totalShares,
        uint256 pricePerShareWei,
        uint256 maxPerWallet
    ) external onlyOwner {
        require(totalShares > 0, "totalShares=0");
        require(pricePerShareWei > 0, "price=0");
        Rig storage r = rigs[rigId];
        require(r.totalShares == 0 && !r.active, "rig exists");

        rigs[rigId] = Rig({
            name: name,
            totalShares: totalShares,
            pricePerShareWei: pricePerShareWei,
            maxPerWallet: maxPerWallet,
            rewardPerShare: 0,
            active: true
        });

        emit RigRegistered(rigId, name, totalShares, pricePerShareWei, maxPerWallet);
    }

    // ---------------------------
    // Buying shares
    // ---------------------------

    /**
     * @notice Buy `amount` shares of `rigId`. Mints ERC-1155 tokens to buyer.
     * Uses exact ETH = pricePerShareWei * amount.
     */
    function buyShares(uint256 rigId, uint256 amount) external payable nonReentrant {
        require(amount > 0, "amount=0");
        Rig storage r = rigs[rigId];
        require(r.active, "rig inactive");
        require(r.totalShares > 0, "rig not found");

        uint256 cost = r.pricePerShareWei * amount;
        require(msg.value == cost, "wrong ETH sent");

        // Oversell prevention vs cap
        require(totalSupply(rigId) + amount <= r.totalShares, "exceeds total shares");

        // Per-wallet cap
        if (r.maxPerWallet > 0) {
            require(balanceOf(msg.sender, rigId) + amount <= r.maxPerWallet, "wallet cap exceeded");
        }

        // Settle rewards for buyer before balance changes
        _settleAccount(msg.sender, rigId);

        // Mint shares
        _mint(msg.sender, rigId, amount, "");

        // Track total sales for owner reference
        totalSalesETH += cost;

        emit SharesPurchased(rigId, msg.sender, amount, cost);
    }

    // ---------------------------
    // Rewards (ETH)
    // ---------------------------

    /**
     * @notice Deposit ETH rewards to a rig. Fair distribution via accumulator.
     * @dev Uses circulating supply (minted shares) so unsold shares don't get rewards.
     */
    function depositRewards(uint256 rigId) external payable onlyOwner nonReentrant {
        uint256 amount = msg.value;
        require(amount > 0, "no ETH sent");
        Rig storage r = rigs[rigId];
        require(r.active, "rig inactive");
        require(r.totalShares > 0, "rig not found");

        uint256 circulating = totalSupply(rigId);
        require(circulating > 0, "no holders yet");

        // Increase cumulative reward-per-share
        r.rewardPerShare += (amount * ACC_PRECISION) / circulating;

        // Track total reward deposited
        totalRewardETH += amount;

        emit RewardsDeposited(rigId, amount, r.rewardPerShare);
    }

    /**
     * @notice Claim all pending rewards for a given rig.
     */
    function claimRewards(uint256 rigId) external nonReentrant {
        _settleAccount(msg.sender, rigId);

        uint256 amount = pending[msg.sender][rigId];
        require(amount > 0, "nothing to claim");
        pending[msg.sender][rigId] = 0;

        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "ETH transfer failed");

        emit RewardsClaimed(rigId, msg.sender, amount);
    }

    /**
     * @notice View helper: total claimable (pending + fresh) for a user/rig.
     */
    function claimable(address user, uint256 rigId) external view returns (uint256) {
        Rig storage r = rigs[rigId];
        if (r.totalShares == 0) return 0;

        uint256 bal = balanceOf(user, rigId);
        uint256 accrued = 0;
        if (r.rewardPerShare > userRewardPerSharePaid[user][rigId] && bal > 0) {
            accrued =
                (bal * (r.rewardPerShare - userRewardPerSharePaid[user][rigId])) /
                ACC_PRECISION;
        }
        return pending[user][rigId] + accrued;
    }

    // ---------------------------
    // Admin withdrawals
    // ---------------------------
    function withdrawSales(address payable to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "zero addr");
        require(amount <= totalSalesETH, "exceeds sales");
        totalSalesETH -= amount;

        (bool ok, ) = to.call{value: amount}("");
        require(ok, "withdraw failed");

        emit SalesWithdrawn(to, amount);
    }

    // ---------------------------
    // Internal reward settling
    // ---------------------------

    /**
     * @dev Settle pending rewards for `user` on `rigId` to keep accounting correct
     *      before any balance change (buy, transfer, burn) or on claim.
     */
    function _settleAccount(address user, uint256 rigId) internal {
        if (user == address(0)) return;
        Rig storage r = rigs[rigId];
        if (r.totalShares == 0) return;

        uint256 last = userRewardPerSharePaid[user][rigId];
        uint256 current = r.rewardPerShare;

        if (current > last) {
            uint256 bal = balanceOf(user, rigId);
            if (bal > 0) {
                uint256 delta = (bal * (current - last)) / ACC_PRECISION;
                if (delta > 0) {
                    pending[user][rigId] += delta;
                }
            }
            userRewardPerSharePaid[user][rigId] = current;
        }
    }

    /**
     * @dev Hook for ERC1155Supply (OpenZeppelin v5): settle rewards for from/to
     *      before the balances actually move so rewards stay correct across transfers.
     */
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts
    ) internal override{
        // Settle for all involved tokenIds before moving balances
        for (uint256 i = 0; i < ids.length; i++) {
            _settleAccount(from, ids[i]);
            _settleAccount(to, ids[i]);
        }
        super._update(from, to, ids, amounts);
    }
}
