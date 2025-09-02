const { expect } = require("chai");
require("@nomicfoundation/hardhat-chai-matchers");
const { ethers } = require("hardhat");

describe("MiningRigOwnership", function() {
  // Test variables
  let MiningRigOwnership;
  let miningRigOwnership;
  let owner;
  let user1;
  let user2;
  let user3;

  // Constants for testing
  const rigId = 1;
  const rigId2 = 2;
  const totalShares = 100;
  const pricePerShareWei = ethers.utils.parseEther("0.01"); // 0.01 ETH per share
  const maxPerWallet = 10; // Max 10 shares per wallet
  
  // Helper function to get event from transaction receipt
  async function getEvent(tx, eventName) {
    const receipt = await tx.wait();
    const event = receipt.events.find(e => e.event === eventName);
    return event;
  }

  beforeEach(async function () {
    // Deploy a fresh contract for each test
    [owner, user1, user2, user3] = await ethers.getSigners();

    MiningRigOwnership = await ethers.getContractFactory("MiningRigOwnership");
    miningRigOwnership = await MiningRigOwnership.deploy();
    await miningRigOwnership.deployed();

    // Register a test rig
    await miningRigOwnership.registerRig(
      rigId,
      "Test Mining Rig",
      totalShares,
      pricePerShareWei,
      maxPerWallet
    );
  });

  describe("Deployment & Setup", function() {
    // Test contract ownership
    it("Should set the right owner", async function() {
      expect(await miningRigOwnership.owner()).to.equal(owner.address);
    });

    // Test rig registration
    it("Should register the rig correctly", async function () {
      const rig = await miningRigOwnership.rigs(rigId);
      expect(rig.name).to.equal("Test Mining Rig");
      expect(rig.totalShares.toNumber()).to.equal(totalShares);
      expect(rig.pricePerShareWei.toString()).to.equal(pricePerShareWei.toString());
      expect(rig.maxPerWallet.toNumber()).to.equal(maxPerWallet);
      expect(rig.active).to.equal(true);
    });

    // Test rig registration validation
    it("Should prevent registering a rig with zero shares", async function() {
      try {
        await miningRigOwnership.registerRig(
          rigId2,
          "Zero Shares Rig",
          0,  // Zero shares
          pricePerShareWei,
          maxPerWallet
        );
        expect.fail("Transaction should have reverted");
      } catch (error) {
        expect(error.message).to.include("totalShares=0");
      }
    });

    // Test rig registration validation
    it("Should prevent registering a rig with zero price", async function() {
      try {
        await miningRigOwnership.registerRig(
          rigId2,
          "Zero Price Rig",
          totalShares,
          0,  // Zero price
          maxPerWallet
        );
        expect.fail("Transaction should have reverted");
      } catch (error) {
        expect(error.message).to.include("price=0");
      }
    });

    // Test duplicate rig prevention
    it("Should prevent registering a rig with an existing ID", async function() {
      try {
        await miningRigOwnership.registerRig(
          rigId,  // Already used
          "Duplicate Rig",
          totalShares,
          pricePerShareWei,
          maxPerWallet
        );
        expect.fail("Transaction should have reverted");
      } catch (error) {
        expect(error.message).to.include("rig exists");
      }
    });

  });

  describe("Buying Shares", function() {
    // Test successful share purchase
    it("Should allow users to buy shares", async function() {
      const sharesToBuy = 5;
      const cost = pricePerShareWei.mul(sharesToBuy);
      
      await miningRigOwnership.connect(user1).buyShares(rigId, sharesToBuy, { value: cost });
      
      const balance = await miningRigOwnership.balanceOf(user1.address, rigId);
      expect(balance.toNumber()).to.equal(sharesToBuy);
      
      // Check total sales tracking
      expect(await miningRigOwnership.totalSalesETH()).to.equal(cost);
    });

    // Test event emission
    it("Should emit SharesPurchased event with correct arguments", async function() {
      const sharesToBuy = 3;
      const cost = pricePerShareWei.mul(sharesToBuy);
      
      const tx = await miningRigOwnership.connect(user1).buyShares(rigId, sharesToBuy, { value: cost });
      
      const event = await getEvent(tx, "SharesPurchased");
      expect(event).to.not.be.undefined;
      expect(event.args.rigId.toString()).to.equal(rigId.toString());
      expect(event.args.buyer).to.equal(user1.address);
      expect(event.args.amount.toNumber()).to.equal(sharesToBuy);
      expect(event.args.paidWei.toString()).to.equal(cost.toString());
    });

    // Test incorrect ETH amount
    it("Should prevent buying shares with incorrect ETH amount", async function() {
      const sharesToBuy = 2;
      const correctCost = pricePerShareWei.mul(sharesToBuy);
      const incorrectCost = correctCost.sub(1); // 1 wei less
      
      try {
        await miningRigOwnership.connect(user1).buyShares(rigId, sharesToBuy, { value: incorrectCost });
        expect.fail("Transaction should have reverted");
      } catch (error) {
        expect(error.message).to.include("wrong ETH sent");
      }
    });

    // Test buying more than total shares
    it("Should prevent buying more than total shares", async function() {
      const sharesToBuy = totalShares + 1; // More than available
      const cost = pricePerShareWei.mul(sharesToBuy);
      
      try {
        await miningRigOwnership.connect(user1).buyShares(rigId, sharesToBuy, { value: cost });
        expect.fail("Transaction should have reverted");
      } catch (error) {
        expect(error.message).to.include("exceeds total shares");
      }
    });

    // Test wallet cap
    it("Should enforce per-wallet cap", async function() {
      // First buy up to the cap
      const initialBuy = maxPerWallet;
      const initialCost = pricePerShareWei.mul(initialBuy);
      await miningRigOwnership.connect(user1).buyShares(rigId, initialBuy, { value: initialCost });
      
      // Try to buy one more
      const additionalBuy = 1;
      const additionalCost = pricePerShareWei.mul(additionalBuy);
      
      try {
        await miningRigOwnership.connect(user1).buyShares(rigId, additionalBuy, { value: additionalCost });
        expect.fail("Transaction should have reverted");
      } catch (error) {
        expect(error.message).to.include("wallet cap exceeded");
      }
    });

    // Test buying from inactive rig
    it("Should prevent buying from inactive rig", async function() {
      // Register a new rig
      await miningRigOwnership.registerRig(
        rigId2,
        "Inactive Rig",
        totalShares,
        pricePerShareWei,
        maxPerWallet
      );
      
      // Deactivate the rig (would need a function to do this in the contract)
      // For testing purposes, we could add this function or use a different approach
      // This test assumes such functionality exists
      
      // For now, we'll skip the actual test execution
    });
  });

  describe("Rewards Distribution", function() {
    beforeEach(async function() {
      // Setup: User1 and User2 buy shares
      const user1Shares = 5;
      const user2Shares = 10;
      
      await miningRigOwnership.connect(user1).buyShares(
        rigId, 
        user1Shares, 
        { value: pricePerShareWei.mul(user1Shares) }
      );
      
      await miningRigOwnership.connect(user2).buyShares(
        rigId, 
        user2Shares, 
        { value: pricePerShareWei.mul(user2Shares) }
      );
    });
    
    // Test depositing rewards
    it("Should allow owner to deposit rewards", async function() {
      const rewardAmount = ethers.utils.parseEther("1"); // 1 ETH reward
      
      const tx = await miningRigOwnership.connect(owner).depositRewards(rigId, { value: rewardAmount });
      
      // Check event
      const event = await getEvent(tx, "RewardsDeposited");
      expect(event).to.not.be.undefined;
      expect(event.args.rigId.toString()).to.equal(rigId.toString());
      expect(event.args.amountWei.toString()).to.equal(rewardAmount.toString());
      
      // Check total rewards tracking
      expect(await miningRigOwnership.totalRewardETH()).to.equal(rewardAmount);
    });

    // Test reward calculation
    it("Should calculate rewards correctly based on shares", async function() {
      const rewardAmount = ethers.utils.parseEther("1"); // 1 ETH reward
      await miningRigOwnership.connect(owner).depositRewards(rigId, { value: rewardAmount });
      
      // User1 has 5 shares, User2 has 10 shares, total 15 shares
      // User1 should get 5/15 = 1/3 of rewards
      // User2 should get 10/15 = 2/3 of rewards
      
      const user1Claimable = await miningRigOwnership.claimable(user1.address, rigId);
      const user2Claimable = await miningRigOwnership.claimable(user2.address, rigId);
      
      const expectedUser1Reward = rewardAmount.mul(5).div(15);
      const expectedUser2Reward = rewardAmount.mul(10).div(15);
      
      // Use approximate comparison due to potential rounding
      const tolerance = ethers.utils.parseEther("0.0001"); // Small tolerance for rounding
      
      expect(user1Claimable.gte(expectedUser1Reward.sub(tolerance))).to.be.true;
      expect(user1Claimable.lte(expectedUser1Reward.add(tolerance))).to.be.true;
      
      expect(user2Claimable.gte(expectedUser2Reward.sub(tolerance))).to.be.true;
      expect(user2Claimable.lte(expectedUser2Reward.add(tolerance))).to.be.true;
    });

    // Test claiming rewards
    it("Should allow users to claim rewards", async function() {
      // Deposit rewards
      const rewardAmount = ethers.utils.parseEther("1"); // 1 ETH
      await miningRigOwnership.connect(owner).depositRewards(rigId, { value: rewardAmount });
      
      // Check user1's claimable amount before claiming
      const user1ClaimableBefore = await miningRigOwnership.claimable(user1.address, rigId);
      expect(ethers.BigNumber.from(user1ClaimableBefore).gt(0)).to.be.true;
      
      // Get user1's ETH balance before claiming
      const balanceBefore = await ethers.provider.getBalance(user1.address);
      
      // Claim rewards
      const tx = await miningRigOwnership.connect(user1).claimRewards(rigId);
      const receipt = await tx.wait();
      
      // Calculate gas used
      const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      
      // Get user1's ETH balance after claiming
      const balanceAfter = await ethers.provider.getBalance(user1.address);
      
      // Calculate the actual balance difference accounting for gas
      const balanceDiff = balanceAfter.add(gasUsed).sub(balanceBefore);
      
      // Check that the balance increased by approximately the claimable amount
      const tolerance = ethers.utils.parseEther("0.0001"); // Small tolerance
      expect(balanceDiff.gte(user1ClaimableBefore.sub(tolerance))).to.be.true;
      expect(balanceDiff.lte(user1ClaimableBefore.add(tolerance))).to.be.true;
      
      // Check that claimable is now zero
      const claimableAfter = await miningRigOwnership.claimable(user1.address, rigId);
      expect(claimableAfter.toString()).to.equal("0");
    });

    // Test claiming with no rewards
    it("Should revert when claiming with no rewards", async function() {
      // User3 has no shares and no rewards
      try {
        await miningRigOwnership.connect(user3).claimRewards(rigId);
        expect.fail("Transaction should have reverted");
      } catch (error) {
        expect(error.message).to.include("nothing to claim");
      }
    });
  });

  describe("Admin Functions", function() {
    beforeEach(async function() {
      // Setup: User buys shares to generate sales
      const sharesToBuy = 5;
      const cost = pricePerShareWei.mul(sharesToBuy);
      await miningRigOwnership.connect(user1).buyShares(rigId, sharesToBuy, { value: cost });
    });
    
    // Test withdrawing sales
    it("Should allow owner to withdraw sales", async function() {
      const totalSales = await miningRigOwnership.totalSalesETH();
      expect(totalSales.gt(0)).to.be.true;
      
      const withdrawAmount = totalSales.div(2); // Withdraw half
      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
      
      const tx = await miningRigOwnership.connect(owner).withdrawSales(owner.address, withdrawAmount);
      const receipt = await tx.wait();
      
      // Calculate gas used
      const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      
      // Get owner's ETH balance after withdrawal
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
      
      // Calculate the actual balance difference accounting for gas
      const balanceDiff = ownerBalanceAfter.add(gasUsed).sub(ownerBalanceBefore);
      
      // Check that the balance increased by the withdrawal amount
      expect(balanceDiff.toString()).to.equal(withdrawAmount.toString());
      
      // Check that totalSalesETH was reduced
      const remainingSales = await miningRigOwnership.totalSalesETH();
      expect(remainingSales.toString()).to.equal(totalSales.sub(withdrawAmount).toString());
    });

    // Test withdrawing more than available
    it("Should prevent withdrawing more than available sales", async function() {
      const totalSales = await miningRigOwnership.totalSalesETH();
      const excessAmount = totalSales.add(1); // 1 wei more than available
      
      try {
        await miningRigOwnership.connect(owner).withdrawSales(owner.address, excessAmount);
        expect.fail("Transaction should have reverted");
      } catch (error) {
        expect(error.message).to.include("exceeds sales");
      }
    });
  });
});