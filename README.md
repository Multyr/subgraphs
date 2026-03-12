# Multyr Vault Subgraph v2.0

Complete subgraph implementation for indexing Multyr vaults across Ethereum, Arbitrum, and Base.

## Features

- **Full ERC-4626 tracking**: Deposits, Withdrawals, Transfers
- **FIFO Cost Basis**: Accurate P&L tracking with position lots
- **USD Pricing**: Chainlink integration with fallback
- **Daily Snapshots**: Historical APY and TVL tracking
- **Claim Queue**: Full claim lifecycle tracking
- **Multi-chain**: Identical schema across all networks

## Directory Structure

```
subgraphs/
├── schema.graphql           # Shared schema (all chains)
├── shared/                  # Shared TypeScript helpers
│   ├── constants.ts         # Chain IDs, addresses, numeric constants
│   ├── entities.ts          # Entity creation/update functions
│   ├── fifo.ts              # FIFO cost basis tracking
│   └── pricing.ts           # Chainlink USD pricing
├── arbitrum/
│   ├── subgraph.yaml        # Arbitrum config
│   ├── src/mappings.ts      # Event handlers
│   └── abis/                # Contract ABIs
├── base/
│   ├── subgraph.yaml        # Base config
│   ├── src/mappings.ts      # Event handlers
│   └── abis/
└── ethereum/
    ├── subgraph.yaml        # Ethereum config
    ├── src/mappings.ts      # Event handlers
    └── abis/
```

## Quick Start

### Prerequisites

```bash
npm install -g @graphprotocol/graph-cli
```

### Build & Deploy (Arbitrum example)

```bash
cd subgraphs/arbitrum

# 1. Update subgraph.yaml with actual factory address and startBlock

# 2. Generate TypeScript types from schema and ABIs
npm run codegen
# or: graph codegen

# 3. Build WASM
npm run build
# or: graph build

# 4. Deploy to The Graph hosted service
graph auth --product hosted-service <ACCESS_TOKEN>
graph deploy --product hosted-service <GITHUB_USER>/multyr-arbitrum
```

### Local Development

```bash
# Start local Graph node (requires Docker)
docker-compose up

# Create local subgraph
graph create --node http://localhost:8020/ multyr-local

# Deploy locally
graph deploy --node http://localhost:8020/ --ipfs http://localhost:5001 multyr-local
```

## Configuration

### Factory Addresses (TODO: Update before deploy)

| Chain | Factory Address | Start Block |
|-------|-----------------|-------------|
| Arbitrum | `0x...` | TBD |
| Base | `0x...` | TBD |
| Ethereum | `0x...` | TBD |

### Chainlink Price Feeds

| Chain | USDC/USD Feed |
|-------|---------------|
| Arbitrum | `0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3` |
| Base | `0x7e860098F58bBFC8648a4311b374B1D669a2bc6B` |
| Ethereum | `0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6` |

---

# GraphQL Query Reference

## 1. GetVaults - Vault List

```graphql
query GetVaults(
  $chainId: Int!
  $first: Int = 20
  $skip: Int = 0
  $orderBy: Vault_orderBy = tvlUsd
  $orderDirection: OrderDirection = desc
  $where: Vault_filter
) {
  vaults(
    first: $first
    skip: $skip
    orderBy: $orderBy
    orderDirection: $orderDirection
    where: { chainId: $chainId, isActive: true }
  ) {
    id
    address
    chainId
    name
    symbol
    decimals
    asset
    assetSymbol
    assetDecimals

    # State
    totalAssets
    totalSupply
    sharePrice
    tvlUsd
    assetPriceUsd

    # Performance
    apy1d
    apy7d
    apy30d

    # Fees
    depositFeeBps
    withdrawFeeBps

    # Status
    status
    isActive
    depositsEnabled
    withdrawalsEnabled

    # Stats
    totalUsers
    transactionCount

    # Metadata
    createdAt
    updatedAt
  }
}
```

**Variables:**
```json
{
  "chainId": 42161,
  "first": 20,
  "skip": 0,
  "orderBy": "tvlUsd",
  "orderDirection": "desc"
}
```

## 2. GetVaultByAddress - Vault Detail

```graphql
query GetVaultByAddress($address: Bytes!, $chainId: Int!) {
  vaults(where: { address: $address, chainId: $chainId }) {
    id
    address
    chainId
    name
    symbol
    decimals
    asset
    assetSymbol
    assetDecimals

    # State
    totalAssets
    totalSupply
    sharePrice
    tvlUsd
    assetPriceUsd

    # Performance
    apy1d
    apy7d
    apy30d

    # Fees
    depositFeeBps
    withdrawFeeBps

    # Status
    status
    isActive
    depositsEnabled
    withdrawalsEnabled

    # Components
    bufferManager
    strategyRouter
    incentives
    feeCollector
    guardian
    owner

    # Stats
    totalDeposits
    totalWithdrawals
    totalUsers
    transactionCount

    # Metadata
    createdAt
    createdAtBlock
    createdTxHash
    creator
    updatedAt
  }
}
```

## 3. GetUserVaultPositions - User Positions

```graphql
query GetUserVaultPositions(
  $user: Bytes!
  $chainId: Int!
  $first: Int = 20
  $skip: Int = 0
) {
  userVaultPositions(
    first: $first
    skip: $skip
    orderBy: assetsUsd
    orderDirection: desc
    where: { user: $user, chainId: $chainId, shares_gt: 0 }
  ) {
    id
    user
    chainId

    vault {
      id
      address
      name
      symbol
      sharePrice
      assetSymbol
      assetDecimals
      apy7d
    }

    # Holdings
    shares
    assets
    assetsUsd

    # Cost Basis (FIFO)
    netDepositedAssets
    netDepositedUsd
    costBasisFifoAssets
    costBasisFifoUsd

    # P&L
    realizedPnlAssets
    realizedPnlUsd
    unrealizedPnlAssets
    unrealizedPnlUsd

    # Earned
    earnedAssets
    earnedUsd

    # Cumulative
    totalDepositedAssets
    totalDepositedUsd
    totalWithdrawnAssets
    totalWithdrawnUsd

    # Activity
    depositCount
    withdrawCount
    lastDepositAt
    lastWithdrawAt
    createdAt
    updatedAt
  }
}
```

## 4. GetUserVaultTransactions - Transaction History

```graphql
query GetUserVaultTransactions(
  $user: Bytes!
  $chainId: Int!
  $first: Int = 50
  $skip: Int = 0
  $type: TransactionType
) {
  transactions(
    first: $first
    skip: $skip
    orderBy: timestamp
    orderDirection: desc
    where: { user: $user, chainId: $chainId, type: $type }
  ) {
    id
    hash
    logIndex
    chainId
    type

    vault {
      id
      address
      name
      symbol
      assetSymbol
    }

    # Amounts
    shares
    assets
    assetsUsd

    # Transfer details
    from
    to
    receiver

    # Claim details
    claimId

    # Context
    sharePrice
    assetPriceUsd
    timestamp
    blockNumber
  }
}
```

**Filter by type:**
```json
{
  "user": "0x...",
  "chainId": 42161,
  "type": "DEPOSIT"
}
```

## 5. GetVaultDayData - Historical Performance

```graphql
query GetVaultDayData(
  $vault: String!
  $chainId: Int!
  $first: Int = 30
  $skip: Int = 0
) {
  vaultDayDatas(
    first: $first
    skip: $skip
    orderBy: date
    orderDirection: desc
    where: { vault: $vault, chainId: $chainId }
  ) {
    id
    date
    dateTimestamp
    chainId

    # State
    totalAssets
    totalSupply
    sharePrice
    tvlUsd
    assetPriceUsd

    # Performance
    dailyReturn
    apy

    # Volume
    depositsAssets
    depositsUsd
    withdrawalsAssets
    withdrawalsUsd
    netFlowAssets
    netFlowUsd

    # Counts
    depositCount
    withdrawCount
    uniqueUsers
  }
}
```

## 6. GetProtocolStats - Global Stats

```graphql
query GetProtocolStats($chainId: Int!) {
  protocols(where: { chainId: $chainId }) {
    id
    chainId
    factoryAddress
    totalVaults
    totalTvlUsd
    totalUsers
    updatedAt
  }
}
```

## 7. GetUserPositionLots - FIFO Lots Detail

```graphql
query GetUserPositionLots($positionId: String!) {
  positionLots(
    where: { position: $positionId, isFullyConsumed: false }
    orderBy: lotIndex
    orderDirection: asc
  ) {
    id
    lotIndex
    timestamp
    txHash

    sharesBought
    assetsCost
    usdCost
    sharePriceAtBuy
    assetPriceUsdAtBuy

    sharesRemaining
    isFullyConsumed
  }
}
```

## 8. GetClaimRequests - Pending Claims

```graphql
query GetClaimRequests(
  $user: Bytes!
  $chainId: Int!
  $status: String
) {
  claimRequests(
    where: { user: $user, chainId: $chainId, status: $status }
    orderBy: requestedAt
    orderDirection: desc
  ) {
    id
    claimId
    chainId

    vault {
      id
      address
      name
    }

    shares
    assetsEstimated
    isImmediate
    status

    requestedAt
    requestTxHash

    settledAt
    settleTxHash
    assetsReceived

    cancelledAt
    cancelTxHash
  }
}
```

---

# UI Mapping Table

| DApp Feature | Morpho API | Our Query | Key Fields |
|--------------|------------|-----------|------------|
| Vault List | `vaults` | `GetVaults` | tvlUsd, apy7d, totalAssets |
| Vault Detail | `vault(id)` | `GetVaultByAddress` | All vault fields |
| My Positions | `vaultPositions` | `GetUserVaultPositions` | shares, assets, earnedUsd |
| Position P&L | `position.earned` | `GetUserVaultPositions` | realizedPnlUsd, unrealizedPnlUsd |
| Cost Basis | N/A (manual) | `GetUserPositionLots` | FIFO lots with costBasis |
| Tx History | `transactions` | `GetUserVaultTransactions` | type, assets, assetsUsd |
| Historical APY | `vaultDayDatas` | `GetVaultDayData` | apy, dailyReturn |
| TVL Chart | `vaultDayDatas` | `GetVaultDayData` | tvlUsd, dateTimestamp |
| Protocol Stats | `protocol` | `GetProtocolStats` | totalTvlUsd, totalVaults |

---

# Field Mapping: Morpho -> Multyr

| Morpho Field | Multyr Field | Notes |
|--------------|--------------|-------|
| `vault.totalAssets` | `vault.totalAssets` | Identical (BigInt wei) |
| `vault.totalSupply` | `vault.totalSupply` | Identical (BigInt wei) |
| `vault.sharePrice` | `vault.sharePrice` | 1e18 scaled |
| `vault.netApy` | `vault.apy7d` | 7-day average |
| `vault.dailyApy` | `vault.apy1d` | 1-day |
| `vault.monthlyApy` | `vault.apy30d` | 30-day average |
| `position.assets` | `userVaultPosition.assets` | Current value |
| `position.assetsUsd` | `userVaultPosition.assetsUsd` | USD value |
| `position.netDeposited` | `userVaultPosition.netDepositedAssets` | deposits - withdrawals |
| `position.earned` | `userVaultPosition.earnedAssets` | Total gains |
| `position.earnedUsd` | `userVaultPosition.earnedUsd` | USD gains |
| N/A | `userVaultPosition.realizedPnlAssets` | **NEW**: FIFO realized |
| N/A | `userVaultPosition.unrealizedPnlAssets` | **NEW**: Unrealized |
| N/A | `userVaultPosition.costBasisFifoAssets` | **NEW**: FIFO cost |

---

# Testing Checklist

## Indexing Tests

- [ ] Factory `VaultDeployed` creates Vault entity
- [ ] Factory `VaultCreated` (legacy) creates Vault entity
- [ ] `Deposit` updates vault.totalAssets, vault.totalSupply
- [ ] `Deposit` creates PositionLot with correct cost basis
- [ ] `Withdraw` consumes lots in FIFO order
- [ ] `Withdraw` calculates realized P&L correctly
- [ ] `Transfer` moves lots proportionally
- [ ] VaultDayData created/updated on each tx
- [ ] APY calculated from day-over-day sharePrice change
- [ ] USD prices fetched from Chainlink

## Sanity Checks

- [ ] `vault.sharePrice = totalAssets * 1e18 / totalSupply`
- [ ] `position.assets = shares * vault.totalAssets / vault.totalSupply`
- [ ] `position.earnedAssets = assets + totalWithdrawn - totalDeposited`
- [ ] `sum(position.shares) <= vault.totalSupply`
- [ ] `sum(lot.sharesRemaining) == position.shares`
- [ ] No division by zero when totalSupply = 0

## Query Tests

- [ ] GetVaults returns sorted by TVL
- [ ] GetVaultByAddress returns single vault
- [ ] GetUserVaultPositions returns only non-zero positions
- [ ] GetUserVaultTransactions filters by type correctly
- [ ] GetVaultDayData returns chronological snapshots

---

# Deployment Commands

## Arbitrum

```bash
cd subgraphs/arbitrum

# Update factory address in subgraph.yaml first!

graph codegen
graph build
graph auth --product hosted-service $GRAPH_ACCESS_TOKEN
graph deploy --product hosted-service $GITHUB_USER/multyr-arbitrum
```

## Base

```bash
cd subgraphs/base
graph codegen
graph build
graph deploy --product hosted-service $GITHUB_USER/multyr-base
```

## Ethereum

```bash
cd subgraphs/ethereum
graph codegen
graph build
graph deploy --product hosted-service $GITHUB_USER/multyr-ethereum
```

## Subgraph Studio (Decentralized)

```bash
# Create subgraph in Subgraph Studio first
graph auth --studio $DEPLOY_KEY
graph deploy --studio multyr-arbitrum
```

---

# Endpoints

After deployment, endpoints will be:

| Chain | Hosted Service URL |
|-------|-------------------|
| Arbitrum | `https://api.thegraph.com/subgraphs/name/<USER>/multyr-arbitrum` |
| Base | `https://api.thegraph.com/subgraphs/name/<USER>/multyr-base` |
| Ethereum | `https://api.thegraph.com/subgraphs/name/<USER>/multyr-ethereum` |

---

# Troubleshooting

## "Cannot find module 'generated/...'"

Run `graph codegen` to generate TypeScript types from schema and ABIs.

## "Entity not found"

Ensure the factory address and startBlock are correct in `subgraph.yaml`.

## Stale USD prices

Check Chainlink feed addresses. USDC defaults to $1.00 if oracle fails.

## Missing transactions

Verify event signatures in `subgraph.yaml` match contract events exactly.

---

# Technical Notes

## FIFO Cost Basis Implementation

Each deposit creates a `PositionLot`:
```typescript
PositionLot {
  sharesBought: 1000e18
  assetsCost: 1000e6      // USDC
  usdCost: 1000.00
  sharesRemaining: 1000e18
}
```

On withdrawal, lots are consumed FIFO:
```typescript
// User withdraws 500 shares
// Lot 0 has 400 remaining, Lot 1 has 600 remaining

// 1. Consume all 400 from Lot 0
costBasis0 = 400 * (lot0.assetsCost / lot0.sharesBought)
lot0.sharesRemaining = 0, lot0.isFullyConsumed = true

// 2. Consume 100 from Lot 1
costBasis1 = 100 * (lot1.assetsCost / lot1.sharesBought)
lot1.sharesRemaining = 500

// Realized P&L
realizedPnl = assetsReceived - (costBasis0 + costBasis1)
```

## USD Pricing

1. **Primary**: Chainlink USDC/USD feed
2. **Fallback**: USDC = $1.00 (stablecoin assumption)
3. **Staleness**: Prices refreshed if >5 min old

## APY Calculation

```typescript
// Daily return from share price change
dailyReturn = (todayPrice - yesterdayPrice) / yesterdayPrice

// Annualized (simple, not compounded)
apy = dailyReturn * 365 * 100  // percentage

// 7-day average
apy7d = avg(apy[day-1], apy[day-2], ..., apy[day-7])
```

---

# License

MIT
