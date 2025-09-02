# Mining Rig Ownership Frontend

## Overview

This is a simple frontend interface for interacting with the MiningRigOwnership smart contract. It allows users to:

- Connect their Ethereum wallet (MetaMask)
- View available mining rigs
- Buy shares of mining rigs
- View owned shares
- Claim mining rewards

## Setup

### Prerequisites

- The MiningRigOwnership contract deployed to Arbitrum Sepolia
- Web3 compatible browser with MetaMask installed

### Configuration

1. Update the contract address in `app.js`:

```javascript
// Replace with your deployed contract address
const contractAddress = "YOUR_DEPLOYED_CONTRACT_ADDRESS";
```

### Deployment

You can deploy this frontend using any static web hosting service:

1. **Local Development**:
   - Simply open `index.html` in a browser
   - Or use a local server: `npx serve`

2. **Production Deployment**:
   - Deploy to GitHub Pages, Netlify, Vercel, or any static hosting service

## Usage

1. Connect your wallet using the "Connect Wallet" button
2. Browse available mining rigs
3. Click "Buy Shares" on a rig to purchase shares
4. View your owned shares in the "My Shares" section
5. Click "Claim" to claim available rewards

## Notes

- Make sure your MetaMask is connected to Arbitrum Sepolia network
- You'll need some Sepolia ETH to pay for transactions
- The frontend will automatically detect and display your owned shares