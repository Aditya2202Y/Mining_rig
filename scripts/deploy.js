// Deployment script for MiningRigOwnership contract
const hre = require("hardhat");

async function main() {
  // Get the network name
  const network = await hre.ethers.provider.getNetwork();
  console.log(`Deploying MiningRigOwnership contract to ${network.name} (chainId: ${network.chainId})`);

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);
  
  // Display deployer balance
  const balance = await deployer.getBalance();
  console.log(`Account balance: ${hre.ethers.utils.formatEther(balance)} ETH`);

  // Get the contract factory
  const MiningRigOwnership = await hre.ethers.getContractFactory("MiningRigOwnership");
  
  console.log("Starting deployment...");
  
  // Deploy the contract
  const miningRigOwnership = await MiningRigOwnership.deploy();

  // Wait for deployment to complete
  await miningRigOwnership.deployed();
  
  const deployedAddress = miningRigOwnership.address;
  console.log(`MiningRigOwnership deployed to: ${deployedAddress}`);
  
  // Log transaction hash for reference
  console.log(`Deployment transaction: ${miningRigOwnership.deployTransaction.hash}`);
  
  // Display verification command
  console.log(`\nTo verify on Arbiscan:\nnpx hardhat verify --network ${hre.network.name} ${deployedAddress}`);
  
  // Optional: Register initial mining rigs
  // Uncomment and modify the following code to register rigs during deployment
  /*
  console.log("\nRegistering initial mining rigs...");
  
  // Example rig parameters
  const rigParams = [
    {
      rigId: 1,
      name: "Bitcoin Mining Rig",
      totalShares: 100,
      pricePerShareWei: hre.ethers.utils.parseEther("0.01"),
      maxPerWallet: 10
    },
    {
      rigId: 2,
      name: "Ethereum Mining Rig",
      totalShares: 50,
      pricePerShareWei: hre.ethers.utils.parseEther("0.02"),
      maxPerWallet: 5
    }
  ];
  
  for (const rig of rigParams) {
    console.log(`Registering rig ${rig.rigId}: ${rig.name}`);
    const tx = await miningRigOwnership.registerRig(
      rig.rigId,
      rig.name,
      rig.totalShares,
      rig.pricePerShareWei,
      rig.maxPerWallet
    );
    await tx.wait();
    console.log(`Rig ${rig.rigId} registered successfully`);
  }
  */
}

// Execute the deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });