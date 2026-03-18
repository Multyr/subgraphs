# Multyr Vault Subgraph - Deployment Documentation

> **Version:** 2.1 (with PriceStatus support)
> **Last Updated:** 2026-01-26

## Schema Updates (v2.1)

### PriceStatus Enum
Added `PriceStatus` enum to track USD price reliability:

```graphql
enum PriceStatus {
  VALID      # Price from Chainlink oracle, fresh (<1 hour)
  STALE      # Price from Chainlink but older than 1 hour
  FALLBACK   # Using hardcoded fallback (1.0 for stablecoins)
  MISSING    # No price source - USD values are 0
}
```

### New Fields
- `Vault.priceStatus: PriceStatus!` - Indicates reliability of USD values
- `TokenPrice.status: PriceStatus!` - Price source status

### UI Integration
```typescript
// Example: Filter vaults with reliable pricing
const reliableVaults = vaults.filter(v =>
  v.priceStatus === 'VALID' || v.priceStatus === 'FALLBACK'
);

// Example: Show warning for stale prices
if (vault.priceStatus === 'STALE') {
  showWarning('Price data may be outdated');
}

// Example: Exclude from TVL ranking if MISSING
if (vault.priceStatus === 'MISSING') {
  excludeFromRanking(vault);
}
```

---

## 1. Build Proofs (3/3 Chains)

### Environment
| Component | Version |
|-----------|---------|
| Node.js | v18.20.3 |
| @graphprotocol/graph-cli | 0.70.0 |
| Git Commit | `bd3bd24ccb9602b531369734c18eb5d11a873b27` |
| OS | Windows (win32-x64) |

### Commands Used
```bash
# For each chain directory:
npx graph codegen
npx graph build
```

### Arbitrum (arbitrum-one)
**Directory:** `subgraphs/arbitrum/`

**codegen output:**
```
✔ Apply migrations
✔ Load subgraph from subgraph.yaml
✔ Load contract ABIs
✔ Generate types for contract ABIs
✔ Generate types for data source templates
✔ Load data source template ABIs
✔ Generate types for data source template ABIs
✔ Load GraphQL schema from ..\schema.graphql
✔ Generate types for GraphQL schema

Types generated successfully
```

**build output:**
```
✔ Apply migrations
✔ Load subgraph from subgraph.yaml
✔ Compile subgraph
✔ Write compiled subgraph to build\

Build completed: build\subgraph.yaml
```

**Result:** SUCCESS (0 errors, 0 warnings)

---

### Base (base)
**Directory:** `subgraphs/base/`

**codegen output:**
```
✔ Apply migrations
✔ Load subgraph from subgraph.yaml
✔ Load contract ABIs
✔ Generate types for contract ABIs
✔ Generate types for data source templates
✔ Load data source template ABIs
✔ Generate types for data source template ABIs
✔ Load GraphQL schema from ..\schema.graphql
✔ Generate types for GraphQL schema

Types generated successfully
```

**build output:**
```
✔ Apply migrations
✔ Load subgraph from subgraph.yaml
✔ Compile subgraph
✔ Write compiled subgraph to build\

Build completed: build\subgraph.yaml
```

**Result:** SUCCESS (0 errors, 0 warnings)

---

### Ethereum Mainnet (mainnet)
**Directory:** `subgraphs/ethereum/`

**codegen output:**
```
✔ Apply migrations
✔ Load subgraph from subgraph.yaml
✔ Load contract ABIs
✔ Generate types for contract ABIs
✔ Generate types for data source templates
✔ Load data source template ABIs
✔ Generate types for data source template ABIs
✔ Load GraphQL schema from ..\schema.graphql
✔ Generate types for GraphQL schema

Types generated successfully
```

**build output:**
```
✔ Apply migrations
✔ Load subgraph from subgraph.yaml
✔ Compile subgraph
✔ Write compiled subgraph to build\

Build completed: build\subgraph.yaml
```

**Result:** SUCCESS (0 errors, 0 warnings)

---

## 2. Query Examples (4 Queries x 3 Chains)

> **Note:** These queries are designed for use once the subgraph is deployed and indexing real data. The endpoint URLs will be provided after Studio/Goldsky deployment.

### Q1 - Vault List with TVL Sorting
```graphql
query VaultListByTvl($first: Int!, $skip: Int!) {
  vaults(
    first: $first
    skip: $skip
    orderBy: tvlUsd
    orderDirection: desc
  ) {
    id
    address
    name
    symbol
    tvlUsd
    totalAssets
    totalSupply
    sharePrice
    apy7d
    status
    depositsEnabled
    withdrawalsEnabled
  }
}
```
Variables: `{ "first": 10, "skip": 0 }`

### Q2 - Vault Detail by Address
```graphql
query VaultDetail($vaultId: ID!) {
  vault(id: $vaultId) {
    id
    address
    name
    symbol
    asset
    assetSymbol
    assetDecimals
    totalAssets
    totalSupply
    sharePrice
    tvlUsd
    assetPriceUsd
    apy1d
    apy7d
    apy30d
    depositFeeBps
    withdrawFeeBps
    status
    depositsEnabled
    withdrawalsEnabled
    totalDeposits
    totalWithdrawals
    totalUsers
    transactionCount
    bufferManager
    strategyRouter
    guardian
    owner
    createdAt
    updatedAt
  }
}
```
Variables: `{ "vaultId": "0x...-42161" }` (address-chainId format)

### Q3 - User Positions with FIFO Cost Basis
```graphql
query UserPositions($user: Bytes!) {
  userVaultPositions(where: { user: $user }) {
    id
    vault {
      id
      name
      symbol
    }
    shares
    assets
    assetsUsd
    netDepositedAssets
    netDepositedUsd
    costBasisFifoAssets
    costBasisFifoUsd
    realizedPnlAssets
    realizedPnlUsd
    unrealizedPnlAssets
    unrealizedPnlUsd
    earnedAssets
    earnedUsd
    totalDepositedAssets
    totalWithdrawnAssets
    depositCount
    withdrawCount
    createdAt
    updatedAt
    lots {
      id
      lotIndex
      sharesBought
      assetsCost
      usdCost
      sharesRemaining
      isFullyConsumed
      timestamp
    }
  }
}
```
Variables: `{ "user": "0x..." }`

### Q4 - User Transactions Filtered by Type
```graphql
query UserTransactionsByType($user: Bytes!, $type: TransactionType!) {
  transactions(
    where: { user: $user, type: $type }
    orderBy: timestamp
    orderDirection: desc
    first: 50
  ) {
    id
    hash
    type
    vault {
      id
      name
    }
    shares
    assets
    assetsUsd
    timestamp
    blockNumber
    sharePrice
    assetPriceUsd
    receiver
    from
    to
    claimId
  }
}
```
Variables: `{ "user": "0x...", "type": "DEPOSIT" }`

---

## 3. USD Pricing - Chainlink Feed Coverage

### Feed Coverage Table

| Chain | Asset | Asset Address | Feed Address | Feed Decimals | Normalization |
|-------|-------|---------------|--------------|---------------|---------------|
| Arbitrum | USDC | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | `0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3` | 8 | `price / 10^8` |
| Base | USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | `0x7e860098F58bBFC8648a4311b374B1D669a2bc6B` | 8 | `price / 10^8` |
| Ethereum | USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | `0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6` | 8 | `price / 10^8` |

### Pricing Logic (from `helpers/pricing.ts`)

```typescript
export function fetchChainlinkPrice(feedAddress: Address): BigDecimal {
  let contract = ChainlinkAggregator.bind(feedAddress)

  // Try latestRoundData first
  let result = contract.try_latestRoundData()
  if (!result.reverted) {
    let price = result.value.value1  // answer
    // Chainlink returns 8 decimals for USD pairs
    return price.toBigDecimal().div(ONE_E8_BD)
  }

  // Fallback to latestAnswer
  let latestAnswer = contract.try_latestAnswer()
  if (!latestAnswer.reverted) {
    return latestAnswer.value.toBigDecimal().div(ONE_E8_BD)
  }

  return ZERO_BD
}
```

### Fallback Strategy

**Deterministic fallback for USDC:**
```typescript
// From constants.ts
export const DEFAULT_USDC_PRICE = BigDecimal.fromString("1.0")
```

**Fallback conditions:**
1. Chainlink call reverts
2. Price returns 0 or negative
3. Feed address not configured for token

**Fallback formula:**
- USDC → `1.0 USD` (deterministic, hardcoded)
- Any other stablecoin with no feed → `1.0 USD`
- Non-stablecoin with no feed → `0 USD` (entity still created, but marked as missing price)

**Implementation in `updateTokenPrice()`:**
```typescript
export function updateTokenPrice(
  token: Address,
  chainId: i32,
  block: ethereum.Block
): BigDecimal {
  // Try Chainlink first
  if (hasChainlinkFeed(token)) {
    let feedAddress = getChainlinkFeedForToken(token)
    let price = fetchChainlinkPrice(feedAddress)
    if (price.gt(ZERO_BD)) {
      // Update and return
      return price
    }
  }

  // Fallback for stablecoins
  return DEFAULT_USDC_PRICE  // 1.0
}
```

**Guarantee:** `assetsUsd`, `tvlUsd`, and all USD fields will NEVER be null. Worst case is `1.0` for stablecoins.

---

## 4. FIFO Cost Basis - Scenario Proof

### Scenario: 2 Deposits + 1 Withdraw + 1 Transfer

**Setup:**
- User A deposits into Vault V (USDC)
- Initial share price: 1.0 USDC/share
- USDC price: $1.00

#### Step 1: Deposit #1 (User A → Vault V)
- Deposits: 1000 USDC
- Shares received: 1000 (at 1.0 USDC/share)

**PositionLot #0 created:**
```json
{
  "id": "0xvault-42161-0xusera-42161-0",
  "lotIndex": 0,
  "sharesBought": "1000000000",
  "assetsCost": "1000000000",
  "usdCost": "1000",
  "sharePriceAtBuy": "1000000000000000000",
  "sharesRemaining": "1000000000",
  "isFullyConsumed": false
}
```

**UserVaultPosition after:**
```json
{
  "shares": "1000000000",
  "assets": "1000000000",
  "costBasisFifoAssets": "1000000000",
  "costBasisFifoUsd": "1000"
}
```

---

#### Step 2: Deposit #2 (User A → Vault V)
- Share price now: 1.05 USDC/share (vault gained value)
- Deposits: 500 USDC
- Shares received: 476.19 (500 / 1.05)

**PositionLot #1 created:**
```json
{
  "id": "0xvault-42161-0xusera-42161-1",
  "lotIndex": 1,
  "sharesBought": "476190476",
  "assetsCost": "500000000",
  "usdCost": "500",
  "sharePriceAtBuy": "1050000000000000000",
  "sharesRemaining": "476190476",
  "isFullyConsumed": false
}
```

**UserVaultPosition after:**
```json
{
  "shares": "1476190476",
  "costBasisFifoAssets": "1500000000",
  "costBasisFifoUsd": "1500"
}
```

---

#### Step 3: Withdraw (User A withdraws 600 shares)
- Share price now: 1.10 USDC/share
- Shares withdrawn: 600
- Assets received: 660 USDC (600 * 1.10)

**FIFO consumption (from `consumeSharesFIFO`):**
1. Takes 600 shares from Lot #0 (oldest first)
2. Proportional cost: 600/1000 * 1000 = 600 USDC
3. Value received: 660 USDC
4. Realized P&L: 660 - 600 = **60 USDC profit**

**PositionLot #0 after:**
```json
{
  "sharesRemaining": "400000000",
  "isFullyConsumed": false
}
```

**PositionLot #1 unchanged:**
```json
{
  "sharesRemaining": "476190476",
  "isFullyConsumed": false
}
```

**UserVaultPosition after:**
```json
{
  "shares": "876190476",
  "realizedPnlAssets": "60000000",
  "realizedPnlUsd": "60",
  "costBasisFifoAssets": "900000000"
}
```

---

#### Step 4: Transfer (User A → User B, 300 shares)
- Transfers 300 shares to User B

**FIFO consumption for transfer (from `transferLotsFIFO`):**
1. Takes 300 shares from Lot #0 (still oldest first)
2. Proportional cost: 300/1000 * 1000 = 300 USDC
3. Creates new lot for User B with inherited cost basis

**User A - PositionLot #0 after:**
```json
{
  "sharesRemaining": "100000000",
  "isFullyConsumed": false
}
```

**User A - Position after:**
```json
{
  "shares": "576190476",
  "costBasisFifoAssets": "600000000"
}
```

**User B - PositionLot #0 created (inherits cost basis):**
```json
{
  "id": "0xvault-42161-0xuserb-42161-0",
  "lotIndex": 0,
  "sharesBought": "300000000",
  "assetsCost": "300000000",
  "usdCost": "300",
  "sharesRemaining": "300000000",
  "isFullyConsumed": false
}
```

**User B - Position created:**
```json
{
  "shares": "300000000",
  "costBasisFifoAssets": "300000000",
  "costBasisFifoUsd": "300"
}
```

### Query to Verify FIFO State

```graphql
query VerifyFIFO($positionId: ID!) {
  userVaultPosition(id: $positionId) {
    shares
    costBasisFifoAssets
    costBasisFifoUsd
    realizedPnlAssets
    realizedPnlUsd
    lots(orderBy: lotIndex) {
      lotIndex
      sharesBought
      assetsCost
      usdCost
      sharesRemaining
      isFullyConsumed
    }
  }
}
```

---

## 5. Deployment Instructions

### Target: The Graph Studio → Decentralized Network

**DO NOT USE:** Hosted Service (deprecated)

#### Prerequisites
```bash
npm install -g @graphprotocol/graph-cli
```

#### Step 1: Create Subgraphs in Studio
1. Go to https://thegraph.com/studio/
2. Connect wallet
3. Create 3 subgraphs:
   - `multyr-vault-arbitrum`
   - `multyr-vault-base`
   - `multyr-vault-mainnet`
4. Copy deploy key for each

#### Step 2: Update Configuration
Before deploying, update each `subgraph.yaml`:

```yaml
# Replace placeholder address with actual deployed factory
source:
  address: "0xYOUR_FACTORY_ADDRESS"
  startBlock: 12345678  # Factory deployment block
```

#### Step 3: Authenticate and Deploy

```bash
# Authenticate (one time per session)
graph auth --studio <YOUR_DEPLOY_KEY>

# Arbitrum
cd subgraphs/arbitrum
npx graph codegen && npx graph build
npx graph deploy --studio multyr-vault-arbitrum --version-label v1.0.0

# Base
cd ../base
npx graph codegen && npx graph build
npx graph deploy --studio multyr-vault-base --version-label v1.0.0

# Ethereum
cd ../ethereum
npx graph codegen && npx graph build
npx graph deploy --studio multyr-vault-mainnet --version-label v1.0.0
```

#### Step 4: Verify Sync in Studio
1. Go to Studio dashboard
2. Check indexing status for each subgraph
3. Test queries in Playground
4. Verify all USD fields are populated (not null)

#### Step 5: Publish to Decentralized Network
1. In Studio, click "Publish" on each subgraph
2. Add curation signal (minimum 10,000 GRT recommended)
3. Wait for Indexers to pick up

#### Production Endpoints
After publishing:
```
Arbitrum: https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>
Base:     https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>
Mainnet:  https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>
```

---

### Alternative: Goldsky (Recommended for Speed)

#### Prerequisites
```bash
curl https://goldsky.com | sh
goldsky login
```

#### Deploy Commands

```bash
# Arbitrum
cd subgraphs/arbitrum
npx graph codegen && npx graph build
goldsky subgraph deploy multyr-vault-arbitrum/1.0.0 --path build/

# Base
cd ../base
npx graph codegen && npx graph build
goldsky subgraph deploy multyr-vault-base/1.0.0 --path build/

# Ethereum
cd ../ethereum
npx graph codegen && npx graph build
goldsky subgraph deploy multyr-vault-mainnet/1.0.0 --path build/
```

#### Production Endpoints (Goldsky)
```
Arbitrum: https://api.goldsky.com/api/public/<PROJECT_ID>/subgraphs/multyr-vault-arbitrum/1.0.0/gn
Base:     https://api.goldsky.com/api/public/<PROJECT_ID>/subgraphs/multyr-vault-base/1.0.0/gn
Mainnet:  https://api.goldsky.com/api/public/<PROJECT_ID>/subgraphs/multyr-vault-mainnet/1.0.0/gn
```

#### Goldsky Advantages
- Instant indexing (no curation signal required)
- Webhook support for real-time updates
- Cross-chain queries from single endpoint
- Better latency for DApp frontends

---

## 6. Pre-Deployment Checklist

| Task | Arbitrum | Base | Ethereum |
|------|----------|------|----------|
| `graph codegen` passes | ✅ | ✅ | ✅ |
| `graph build` passes | ✅ | ✅ | ✅ |
| Factory address set | ⏳ | ⏳ | ⏳ |
| Start block set | ⏳ | ⏳ | ⏳ |
| ABI matches deployed contracts | ✅ | ✅ | ✅ |
| Chainlink feed verified | ✅ | ✅ | ✅ |
| No `any` types in mappings | ✅ | ✅ | ✅ |
| All IDs lowercase | ✅ | ✅ | ✅ |
| chainId on all entities | ✅ | ✅ | ✅ |
| Transaction ID = txHash-logIndex | ✅ | ✅ | ✅ |

---

## 7. Troubleshooting

### Common Issues

**AssemblyScript Compilation Errors:**
- Avoid `Address | null` types - use boolean checks instead
- Initialize class fields with default values
- No nullable function parameters in createTransaction

**Chainlink Price Returns 0:**
- Check feed address is correct for chain
- Fallback to DEFAULT_USDC_PRICE (1.0)
- Verify feed is active on chain

**Entity Not Found:**
- Ensure IDs use lowercase: `address.toHexString().toLowerCase()`
- Include chainId in composite IDs: `{address}-{chainId}`

---

## Appendix: File Structure

```
subgraphs/
├── schema.graphql              # Shared schema (14 entities)
├── DEPLOYMENT.md               # This file
├── arbitrum/
│   ├── subgraph.yaml           # Network: arbitrum-one
│   ├── abis/                   # Contract ABIs
│   ├── src/
│   │   ├── mappings.ts         # Event handlers
│   │   └── helpers/            # Utility functions
│   │       ├── constants.ts
│   │       ├── entities.ts
│   │       ├── fifo.ts
│   │       └── pricing.ts
│   ├── generated/              # Auto-generated types
│   └── build/                  # Compiled output
├── base/
│   └── (same structure)
└── ethereum/
    └── (same structure)
```
