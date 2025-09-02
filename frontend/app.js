// Contract ABI - This is a simplified ABI with only the functions we need
const contractABI = [
    // Read functions
    "function rigs(uint256) view returns (uint256 totalShares, uint256 pricePerShareWei, uint256 maxPerWallet, uint256 rewardPerShare, bool active)",
    "function balanceOf(address account, uint256 id) view returns (uint256)",
    "function claimable(address user, uint256 rigId) view returns (uint256)",
    "function totalSupply(uint256 id) view returns (uint256)",
    
    // Write functions
    "function buyShares(uint256 rigId, uint256 amount) payable",
    "function claimRewards(uint256 rigId)",
    
    // Events
    "event SharesPurchased(uint256 indexed rigId, address indexed buyer, uint256 amount, uint256 paidWei)",
    "event RewardsClaimed(uint256 indexed rigId, address indexed user, uint256 amountWei)"
];

// Replace with your deployed contract address
const contractAddress = "0x0000000000000000000000000000000000000000"; // Update after deployment

// Global variables
let provider;
let signer;
let contract;
let userAddress;
let rigs = [];

// DOM Elements
const connectWalletBtn = document.getElementById('connect-wallet');
const connectionStatus = document.getElementById('connection-status');
const walletAddress = document.getElementById('wallet-address');
const addressText = document.getElementById('address-text');
const rigsContainer = document.getElementById('rigs-container');
const mySharesContainer = document.getElementById('my-shares-container');
const noShares = document.getElementById('no-shares');
const loadingRigs = document.getElementById('loading-rigs');

// Modal elements
const buySharesModal = new bootstrap.Modal(document.getElementById('buySharesModal'));
const claimRewardsModal = new bootstrap.Modal(document.getElementById('claimRewardsModal'));
const rigInfo = document.getElementById('rig-info');
const rigId = document.getElementById('rig-id');
const sharePrice = document.getElementById('share-price');
const sharesAmount = document.getElementById('shares-amount');
const totalCost = document.getElementById('total-cost');
const confirmBuy = document.getElementById('confirm-buy');
const claimRigInfo = document.getElementById('claim-rig-info');
const claimRigId = document.getElementById('claim-rig-id');
const claimableAmount = document.getElementById('claimable-amount');
const confirmClaim = document.getElementById('confirm-claim');

// Initialize the app
async function init() {
    connectWalletBtn.addEventListener('click', connectWallet);
    sharesAmount.addEventListener('input', updateTotalCost);
    confirmBuy.addEventListener('click', buyShares);
    confirmClaim.addEventListener('click', claimRewards);
    
    // Check if MetaMask is installed
    if (window.ethereum) {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        
        // Check if already connected
        try {
            const accounts = await provider.listAccounts();
            if (accounts.length > 0) {
                await connectWallet();
            }
        } catch (error) {
            console.error("Error checking connection:", error);
        }
    } else {
        connectionStatus.textContent = "MetaMask not installed";
        connectWalletBtn.textContent = "Install MetaMask";
        connectWalletBtn.addEventListener('click', () => {
            window.open("https://metamask.io/download.html", "_blank");
        });
    }
}

// Connect wallet function
async function connectWallet() {
    try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
        userAddress = await signer.getAddress();
        
        // Update UI
        connectionStatus.textContent = "Connected";
        walletAddress.classList.remove('d-none');
        addressText.textContent = `${userAddress.substring(0, 6)}...${userAddress.substring(userAddress.length - 4)}`;
        
        // Initialize contract
        contract = new ethers.Contract(contractAddress, contractABI, signer);
        
        // Load data
        await loadRigs();
        await loadUserShares();
        
        // Setup event listeners for network changes
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', () => window.location.reload());
        
        connectWalletBtn.textContent = "Wallet Connected";
        connectWalletBtn.disabled = true;
    } catch (error) {
        showNotification("Error connecting wallet: " + error.message, "danger");
        console.error("Error connecting wallet:", error);
    }
}

// Handle account changes
async function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        // User disconnected their wallet
        window.location.reload();
    } else if (accounts[0] !== userAddress) {
        // User switched accounts
        window.location.reload();
    }
}

// Load available rigs
async function loadRigs() {
    try {
        // In a real app, you would query events or have an API to get all rig IDs
        // For this demo, we'll assume rigs with IDs 1, 2, and 3 exist
        const rigIds = [1, 2, 3];
        rigs = [];
        
        for (const id of rigIds) {
            try {
                const rigData = await contract.rigs(id);
                if (rigData.totalShares.gt(0)) { // Only show rigs that exist
                    rigs.push({
                        id: id,
                        totalShares: rigData.totalShares.toString(),
                        pricePerShareWei: rigData.pricePerShareWei,
                        maxPerWallet: rigData.maxPerWallet.toString(),
                        active: rigData.active
                    });
                }
            } catch (error) {
                console.error(`Error loading rig ${id}:`, error);
            }
        }
        
        displayRigs();
    } catch (error) {
        showNotification("Error loading rigs: " + error.message, "danger");
        console.error("Error loading rigs:", error);
    }
}

// Display rigs in the UI
function displayRigs() {
    loadingRigs.style.display = 'none';
    rigsContainer.innerHTML = '';
    
    if (rigs.length === 0) {
        rigsContainer.innerHTML = '<p class="text-muted">No mining rigs available</p>';
        return;
    }
    
    rigs.forEach(rig => {
        const available = rig.active ? 'Available' : 'Not Available';
        const availableClass = rig.active ? 'text-success' : 'text-danger';
        const priceInEth = ethers.utils.formatEther(rig.pricePerShareWei);
        
        const rigCard = document.createElement('div');
        rigCard.className = 'col-md-4 mb-3';
        rigCard.innerHTML = `
            <div class="card rig-card h-100">
                <div class="card-body">
                    <h5 class="card-title">Mining Rig #${rig.id}</h5>
                    <p class="card-text">Total Shares: ${rig.totalShares}</p>
                    <p class="card-text">Price per Share: ${priceInEth} ETH</p>
                    <p class="card-text">Max per Wallet: ${rig.maxPerWallet === '0' ? 'No Limit' : rig.maxPerWallet}</p>
                    <p class="card-text">Status: <span class="${availableClass}">${available}</span></p>
                </div>
                <div class="card-footer">
                    <button class="btn btn-primary buy-btn" data-rig-id="${rig.id}" ${!rig.active ? 'disabled' : ''}>Buy Shares</button>
                </div>
            </div>
        `;
        
        rigsContainer.appendChild(rigCard);
    });
    
    // Add event listeners to buy buttons
    document.querySelectorAll('.buy-btn').forEach(btn => {
        btn.addEventListener('click', openBuyModal);
    });
}

// Load user's shares
async function loadUserShares() {
    if (!contract || !userAddress) return;
    
    try {
        mySharesContainer.innerHTML = '<p>Loading your shares...</p>';
        let hasShares = false;
        
        const userShares = [];
        
        for (const rig of rigs) {
            const balance = await contract.balanceOf(userAddress, rig.id);
            if (balance.gt(0)) {
                const claimableRewards = await contract.claimable(userAddress, rig.id);
                userShares.push({
                    rigId: rig.id,
                    shares: balance.toString(),
                    claimable: claimableRewards
                });
                hasShares = true;
            }
        }
        
        displayUserShares(userShares, hasShares);
    } catch (error) {
        showNotification("Error loading your shares: " + error.message, "danger");
        console.error("Error loading user shares:", error);
    }
}

// Display user's shares in the UI
function displayUserShares(userShares, hasShares) {
    mySharesContainer.innerHTML = '';
    
    if (!hasShares) {
        mySharesContainer.innerHTML = '<p class="text-muted">You don\'t own any shares yet</p>';
        return;
    }
    
    const table = document.createElement('table');
    table.className = 'table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>Rig ID</th>
                <th>Shares Owned</th>
                <th>Claimable Rewards</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody id="shares-table-body"></tbody>
    `;
    
    mySharesContainer.appendChild(table);
    const tableBody = document.getElementById('shares-table-body');
    
    userShares.forEach(share => {
        const claimableEth = ethers.utils.formatEther(share.claimable);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>Mining Rig #${share.rigId}</td>
            <td>${share.shares}</td>
            <td>${claimableEth} ETH</td>
            <td>
                <button class="btn btn-success btn-sm claim-btn" data-rig-id="${share.rigId}" ${share.claimable.eq(0) ? 'disabled' : ''}>Claim</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
    
    // Add event listeners to claim buttons
    document.querySelectorAll('.claim-btn').forEach(btn => {
        btn.addEventListener('click', openClaimModal);
    });
}

// Open buy shares modal
function openBuyModal(event) {
    const rigIdValue = event.target.getAttribute('data-rig-id');
    const rig = rigs.find(r => r.id == rigIdValue);
    
    rigInfo.value = `Mining Rig #${rig.id}`;
    rigId.value = rig.id;
    sharePrice.value = `${ethers.utils.formatEther(rig.pricePerShareWei)} ETH`;
    sharesAmount.value = 1;
    updateTotalCost();
    
    buySharesModal.show();
}

// Update total cost when shares amount changes
function updateTotalCost() {
    const rig = rigs.find(r => r.id == rigId.value);
    const amount = parseInt(sharesAmount.value) || 0;
    const cost = rig.pricePerShareWei.mul(amount);
    totalCost.value = `${ethers.utils.formatEther(cost)} ETH`;
}

// Buy shares function
async function buyShares() {
    try {
        const rigIdValue = parseInt(rigId.value);
        const amount = parseInt(sharesAmount.value);
        const rig = rigs.find(r => r.id == rigIdValue);
        
        if (!amount || amount <= 0) {
            showNotification("Please enter a valid amount", "warning");
            return;
        }
        
        const cost = rig.pricePerShareWei.mul(amount);
        
        // Execute transaction
        const tx = await contract.buyShares(rigIdValue, amount, { value: cost });
        buySharesModal.hide();
        showNotification("Transaction submitted. Waiting for confirmation...", "info");
        
        // Wait for transaction to be mined
        await tx.wait();
        showNotification(`Successfully purchased ${amount} shares of Mining Rig #${rigIdValue}!`, "success");
        
        // Reload data
        await loadRigs();
        await loadUserShares();
    } catch (error) {
        showNotification("Error buying shares: " + error.message, "danger");
        console.error("Error buying shares:", error);
    }
}

// Open claim rewards modal
function openClaimModal(event) {
    const rigIdValue = event.target.getAttribute('data-rig-id');
    claimRigId.value = rigIdValue;
    claimRigInfo.value = `Mining Rig #${rigIdValue}`;
    
    // Get claimable amount
    contract.claimable(userAddress, rigIdValue).then(amount => {
        claimableAmount.value = `${ethers.utils.formatEther(amount)} ETH`;
        claimRewardsModal.show();
    }).catch(error => {
        showNotification("Error getting claimable rewards: " + error.message, "danger");
        console.error("Error getting claimable rewards:", error);
    });
}

// Claim rewards function
async function claimRewards() {
    try {
        const rigIdValue = parseInt(claimRigId.value);
        
        // Execute transaction
        const tx = await contract.claimRewards(rigIdValue);
        claimRewardsModal.hide();
        showNotification("Transaction submitted. Waiting for confirmation...", "info");
        
        // Wait for transaction to be mined
        await tx.wait();
        showNotification(`Successfully claimed rewards from Mining Rig #${rigIdValue}!`, "success");
        
        // Reload user shares
        await loadUserShares();
    } catch (error) {
        showNotification("Error claiming rewards: " + error.message, "danger");
        console.error("Error claiming rewards:", error);
    }
}

// Show notification
function showNotification(message, type) {
    const notification = document.getElementById('notification');
    notification.className = `alert alert-${type}`;
    notification.textContent = message;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 5000);
}

// Initialize the app when the page loads
window.addEventListener('load', init);