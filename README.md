# Multyr Vault Subgraph

Subgraph for indexing Multyr vaults across Arbitrum, Base, and Ethereum.

**Studio**: https://thegraph.com/studio/subgraph/multyr-subgraph
**Slug**: `multyr-subgraph`
**Last documented Studio release**: v3.1.0 (the current worktree is not published)

## Features

- **ERC-4626 tracking**: Deposits, Withdrawals, Transfers, ForceWithdraw
- **Epoched exits**: request, cancel, close, fund attempts/shortfalls, funding, and claims
- **APY**: canonical sharePrice (decimals-aware), loss-inclusive gross and net 1d/7d/30d averages
- **FIFO Cost Basis**: position lots, realized/unrealized P&L
- **USD Pricing**: Chainlink feed registry, staleness tracking, and nullable missing-price semantics
- **Ops Dashboard**: ProtocolDeployment, VaultDeployment, StrategyDeployment wiring
- **Automation**: VaultUpkeep, StrategyUpkeep, FeeCollectorUpkeep events + bindings
- **Vault Lifecycle**: VaultFactory v2 with deprecateVault, setVaultStatus, removeVault
- **Multi-chain**: identical schema, per-chain datasource config

## Directory Structure

```
├── README.md
├── schema.graphql              # Shared schema (all chains)
├── shared/                     # Shared TypeScript helpers
│   ├── constants.ts
│   ├── entities.ts
│   ├── fifo.ts
│   └── pricing.ts
├── arbitrum/
│   ├── subgraph.yaml           # Arbitrum config (production addresses)
│   ├── src/
│   │   ├── mappings.ts         # Event handlers
│   │   └── helpers/
│   │       ├── entities.ts     # Entity helpers (canonical)
│   │       ├── constants.ts
│   │       ├── fifo.ts
│   │       └── pricing.ts
│   └── abis/                   # Contract ABIs
├── base/                       # Same structure, placeholder addresses
├── ethereum/                   # Same structure, placeholder addresses
└── docs/
    ├── DEPLOYMENT.md
    ├── IMPLEMENTATION_GUIDE.md
    ├── SUBGRAPH_MULTI_FACTORY_SPEC.md
    ├── TEST-STATUS.md
    ├── assemblyscript-compiler-gotchas.md
    ├── bootstrap-registry.md   # Non-recoverable deploy-time wiring
    └── bootstrap-manifest.json # Canonical values for ops console fallback
```

## Active Arbitrum Deployment (EMA-first, 23 Oct 2026)

| Component | Address | Start block / indexing |
|-----------|---------|------------------------|
| VaultFactory | `0xfDE16c52e89ba078E9F71Cc64C2256c8E66CbB01` | `513029843` |
| CoreVault | `0x5e0cdb76487BD96Ff069Ef7F78eaDF5b5909C8cb` | dynamic template from factory registration `513029918` |
| GlobalConfig | `0x5680E4948759569DCB9D2eAB6a5504d733c83B2A` | `513029857` |
| VaultUpkeep | `0xCD31634F472Fcc1D0b64FAE3ed72Bb7C0792B55f` | `513030022` |
| ClaimSettlementUpkeep | `0x4e845762e66518f34641326C7f77fAf4B81c1260` | `513035932` |
| StrategyRouter | `0x37847D2e12892e3298DEE695e7E971fba0Ca3e24` | dynamic template from vault wiring |
| USDC strategy | `0x2AD722B6241605481829E4B251AE8A4Ba8Be86cE` | dynamic template from completed router registration |
| StrategyUpkeep | `0xAB30b7D1ADe850b6b122bcfF29F389CF1D051D44` | `517356765` |

This core uses the economic-exit withdrawal model: a withdrawal request burns the net shares and fixes `assetsOwed`, and the epoch is only a settlement bucket. The subgraph books the exit at request (or in the instant/force-exit tx), and a claim only pays it out. The rewards/referral periphery, incentives engine, and FeeCollectorUpkeep are not deployed in this phase and remain dormant in the Arbitrum manifest. The complete address and exact-block inventory is in `deployments/arbitrum/`.

Base and Ethereum use placeholder addresses (not yet deployed).

## Quick Start

```bash
# Install
npm install

# Build Arbitrum
npx graph codegen arbitrum/subgraph.yaml --output-dir arbitrum/generated
npx graph build arbitrum/subgraph.yaml

# Deploy to Studio
npx graph auth --studio <DEPLOY_KEY>
npx graph deploy multyr-subgraph arbitrum/subgraph.yaml --studio --version-label v3.1.0
```

## Key Entities

### Core
| Entity | Description |
|--------|-------------|
| `Vault` | ERC-4626 vault state, APY, fees, status, components |
| `VaultDayData` | Daily snapshots: TVL, sharePrice, APY, volume |
| `UserVaultPosition` | User holdings with FIFO cost basis and P&L |
| `Transaction` | Deposit/Withdraw/Transfer with USD values |
| `ClaimRequest` | Claim queue lifecycle |

### Ops Dashboard
| Entity | Description |
|--------|-------------|
| `ProtocolDeployment` | Chain-level shared components (factory, globalConfig, priceOracle, periphery) |
| `VaultDeployment` | Per-vault wiring (BM, router, health, fee, modules, governance, sealed) |
| `StrategyDeployment` | Per-strategy wiring (enabled, priority, weight, upkeep) |
| `VaultUpkeepBinding` | Binding: VaultUpkeep → Vault |
| `StrategyUpkeepBinding` | Binding: StrategyUpkeep → Strategy (with upkeepKind) |

### Periphery
| Entity | Description |
|--------|-------------|
| `UpkeepAction` | VaultUpkeep + StrategyUpkeep + FeeCollectorUpkeep events |
| `OpsSplitEvent` | OpsCollector fee split |
| `FeeDistributorRedeemEvent` | Share redemption for USDC |
| `EpochRootPublishedEvent` | Merkle root for epoch claims |

## Bootstrap Registry

Older vault v4 deployments may need a bootstrap fallback when wiring events predate template creation. See [docs/bootstrap-registry.md](docs/bootstrap-registry.md) and [docs/bootstrap-manifest.json](docs/bootstrap-manifest.json). The active EOA test deployment registers the vault before wiring, so its wiring events are indexable normally.

The ops console should:
1. Read `VaultDeployment` from subgraph (primary source)
2. If `queueModule`/`adminModule` are null → complete from bootstrap manifest
3. Never use bootstrap for fields the subgraph can populate

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v3.1.0 | 2026-03-18 | priceOracle in ProtocolDeployment, gap analysis |
| v3.0.0 | 2026-03-18 | APY fix, crash patterns, ops dashboard, upkeep datasources, multi-chain parity |
| v2.0.0 | 2026-03-18 | VaultFactory v2 (deprecate, remove, setVaultStatus) |
| v1.3.0 | 2026-03-17 | VaultUpkeep + DepositRouter v4 addresses |
| v1.2.0 | 2026-03-16 | GlobalConfig v2 address |

## Documentation

- [Deployment Guide](docs/DEPLOYMENT.md)
- [Implementation Guide](docs/IMPLEMENTATION_GUIDE.md)
- [Multi-Factory Spec](docs/SUBGRAPH_MULTI_FACTORY_SPEC.md)
- [Test Status](docs/TEST-STATUS.md)
- [AssemblyScript Gotchas](docs/assemblyscript-compiler-gotchas.md)
- [Bootstrap Registry](docs/bootstrap-registry.md)

### Current scoring observations

`currentScoringSnapshots` stores the latest end-of-block RPC observation per
strategy/adapter. It refreshes at strategy registration, successful router deposits
and redemptions, strategy harvest/recall/liquidity events, idle deployment, rebalance
steps, and the keeper's `ExternalTVLPoked` event. A deposit therefore refreshes the
snapshot even when it leaves cash idle. No separate keeper transaction is needed.

These are **not historical allocation decisions**: `scoringSnapshots` remains
reserved for the `ScoringComputed` event. Same-block transactions share the final
block state. `positionAssets` is strategy bookkeeping, not live adapter NAV; risk,
stability and liquidity fields are raw getter values before scoring fallbacks.
`allocatorAPYBps` and `targetAlloc` come from `computeRebalanceInputs()`, not from a
locally reconstructed scoring formula. Raw/normalized decision scores are not
available through that unrestricted getter and are deliberately not fabricated.

Failed optional reads are null, while genuine zero APY remains zero. A failed
allocator call sets `allocatorReadSucceeded: false` and clears prior targets. If
adapter enumeration itself fails, existing snapshots retain their old block/time.
Check `blockNumber` and `timestamp` for freshness; this is event-driven, not polling.

```graphql
{
  currentScoringSnapshots(where: {
    chainId: 42161
    adapter: "0x36ad387092ede0ccb8ca663dc216d0320d19b677"
  }) {
    adapter
    currentAPYBps
    effectiveAPYBps
    allocatorAPYBps
    targetAlloc
    positionAssets
    riskScoreBps
    stabilityEMA
    cachedLiquidityBps
    allocatorReadSucceeded
    source
    trigger
    blockNumber
    timestamp
  }
}
```

APY fields are basis points (`520` = `5.20%`); USDC amounts have six decimals.
Deploy a new version and reindex to populate observations from past events.
