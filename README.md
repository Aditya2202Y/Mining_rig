# Mining Rig Ownership - Fractional Ownership Smart Contract

This project implements a smart contract for fractional ownership of mining rigs on Arbitrum Sepolia. It allows users to buy shares of mining rigs as ERC-1155 tokens and receive proportional rewards from mining operations.

## Features

- **Fractional Ownership**: Each mining rig is represented as an ERC-1155 token with multiple shares
- **Reward Distribution**: Automatic proportional distribution of ETH rewards to shareholders
- **Oversell Prevention**: Cannot sell more shares than the total supply
- **Per-Wallet Cap**: Optional limit on shares per wallet
- **Transferable Shares**: Shares can be freely transferred using ERC-1155 standard functions
- **Security**: Protected against reentrancy attacks using OpenZeppelin's ReentrancyGuard

## Project Structure

```
├── contracts/
│   └── MiningRigOwnership.sol  # Main contract
├── scripts/
│   └── deploy.js               # Deployment script
├── test/
│   └── MiningRigOwnership.test.js  # Comprehensive tests
├── .env                        # Environment variables
├── .npmrc                      # NPM configuration for dependency resolution
├── hardhat.config.js           # Hardhat configuration
└── package.json                # Project dependencies
```

## Deployment to Arbitrum Sepolia

### Prerequisites

1. Node.js and npm installed
2. `.env` file with the following variables:
   ```
   PRIVATE_KEY=your_wallet_private_key
   ARBITRUM_SEPOLIA_RPC_URL=your_arbitrum_sepolia_rpc_url
   ARBISCAN_API_KEY=your_arbiscan_api_key
   ```

### Deployment Steps

1. Install dependencies:
   ```
   npm install
   ```

2. Compile the contract:
   ```
   npx hardhat compile
   ```

3. Deploy to Arbitrum Sepolia:
   ```
   npx hardhat run scripts/deploy.js --network arbitrumSepolia
   ```

4. Verify the contract on Arbiscan:
   ```
   npx hardhat verify --network arbitrumSepolia DEPLOYED_CONTRACT_ADDRESS
   ```

## Technical Approach

### Fractional Ownership Implementation

The contract uses the ERC-1155 token standard to represent fractional ownership of mining rigs:

- Each mining rig is assigned a unique `rigId` (token ID in ERC-1155)
- Each share of ownership is represented as 1 unit of the corresponding ERC-1155 token
- The contract owner registers rigs with a total number of shares and price per share
- Users can buy shares by sending ETH to the contract
- Shares can be transferred between users using the standard ERC-1155 transfer functions

### Reward Distribution Mechanism

The contract uses an accumulator-based reward distribution system:

1. **Reward Accumulation**: When rewards are deposited, they're distributed to all shares via a global accumulator (`rewardPerShare`)
2. **User Accounting**: Each user has a snapshot of the last accumulator value they've been paid from (`userRewardPerSharePaid`)
3. **Reward Settlement**: When a user's balance changes (buy, transfer, etc.), their rewards are calculated and stored in `pending`
4. **Reward Claiming**: Users can claim their pending rewards at any time

This approach ensures:
- Gas-efficient reward distribution (O(1) cost regardless of number of shareholders)
- Accurate proportional distribution based on share ownership
- Rewards are preserved during transfers (settled before balance changes)

### Security Considerations

- **Reentrancy Protection**: Uses OpenZeppelin's ReentrancyGuard for functions that transfer ETH
- **Ownership Control**: Uses OpenZeppelin's Ownable for admin functions
- **Overflow Protection**: Uses Solidity 0.8.x built-in overflow checking
- **Supply Tracking**: Uses ERC1155Supply to track total supply of each token

## Setup and Deployment

### Prerequisites

- Node.js and npm installed
- An Ethereum wallet with private key
- Some ETH on Arbitrum Sepolia for deployment and testing

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

   Note: The project uses ethers v5 for compatibility with Hardhat plugins. A `.npmrc` file with `legacy-peer-deps=true` is included to resolve dependency conflicts.

3. Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
# Edit .env with your private key and RPC URL
```

### Testing

Run the test suite to verify all functionality:

```bash
npm test
```

### Deployment to Arbitrum Sepolia

Deploy the contract to Arbitrum Sepolia testnet:

```bash
npm run deploy:sepolia
```

The script will output the deployed contract address and verification instructions.

## Contract Usage

### For Contract Owner

1. **Register a Mining Rig**:
   ```solidity
   function registerRig(
       uint256 rigId,
       uint256 totalShares,
       uint256 pricePerShareWei,
       uint256 maxPerWallet
   ) external onlyOwner
   ```


2. **Deposit Rewards**:
   ```solidity
   function depositRewards(uint256 rigId) external payable onlyOwner
   ```

3. **Withdraw Sales Proceeds**:
   ```solidity
   function withdrawSales(address payable to, uint256 amount) external onlyOwner
   ```

### For Users

1. **Buy Shares**:
   ```solidity
   function buyShares(uint256 rigId, uint256 amount) external payable
   ```

2. **Claim Rewards**:
   ```solidity
   function claimRewards(uint256 rigId) external
   ```

3. **Check Claimable Rewards**:
   ```solidity
   function claimable(address user, uint256 rigId) external view returns (uint256)
   ```

4. **Transfer Shares**:
   ```solidity
   // Standard ERC-1155 transfer function
   function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes memory data) public
   ```

## Test Results

The contract has been thoroughly tested with the following scenarios:

- Deployment and rig registration
- Share purchasing with proper ETH payment
- Oversell prevention and per-wallet cap enforcement
- Reward distribution proportional to share ownership
- Reward claiming and ETH transfer
- Share transfers with reward settlement
- Admin functions for rig management

All tests pass successfully, demonstrating the contract's functionality and security.

## License

MIT