**NOT AUDITED, JUST A PERSONAL PROJECT**

# Stablecoin
A basic imlementation of a decentralized Collateralized Debt Position (CDP) based stablecoin heavily based on Single-Collateral Dai.

CDPs are called Vaults here, the term being stolen from Multi-Collateral Dai.

# Deployments

## Ropsten
Uses the ropsten Chainlink ETH/USD price oracle aggergator

App: [stablecoin-ropsten.netlify.com](https://stablecoin-ropsten.netlify.com)

Stablecoin contract: [0x447F788dD70A3de40296B3548d78aE3FaA0ed504](https://ropsten.etherscan.io/address/0x447F788dD70A3de40296B3548d78aE3FaA0ed504)

# Local development
```
npm run start:dev
```
Restarting is required for contract changes.

# Building

## Contracts
```
npm run build:contracts
```

## App
First set the following environment variables:
- NODE_ENV=production
- CONTRACT_ADDRESS={primary Stablecoin contract address}
- NETWORK={network name (e.g. mainnet, ropsten, kovan)}
- MINIMUM_COLLATERAL_PERCENTAGE={minimum collateral to debt ratio in percent (excluding the '%'), typically 150}
- TOKEN_SYMBOL={the ticker symbol for the token}
- TARGET_SYMBOL={the ticker symbol for the pegged asset (typically USD)}

Then run:
```
npm run build:app
```

## All
```
npm run build
```
The same environment variables need to be set as when just building the app.