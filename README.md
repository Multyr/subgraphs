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

## Active Arbitrum Test Deployment

| Component | Address | Start block / indexing |
|-----------|---------|------------------------|
| VaultFactory | `0x27b5B83E77044817310c14CF62D96be606f79436` | `503229720` |
| CoreVault | `0x4575Ec0dD1ED08FD4F426665E5B56442594189bb` | dynamic template from factory registration `503229777` |
| GlobalConfig | `0x8fE1cbc7fC2A469B5b5904EA5e5C4D09c583eDD6` | `503229727` |
| VaultUpkeep | `0x8672921E03c9995AE1Dbe234A7a08C327163883e` | `503229824` |
| StrategyRouter | `0x8EeF3Cb022B0d70Fe70a4CA6759C977e5718b8e7` | dynamic template from vault wiring |
| USDC strategy | `0x2ca30120C828Fc136d348234f7e68116572DD83E` | dynamic template from router registration |
| StrategyUpkeep | `0xd32a464df8e90D8aa9Bc290C4635eCE8D5362550` | `503230946` |

The rewards/referral periphery, incentives engine, and FeeCollectorUpkeep are not deployed in this phase and remain dormant in the Arbitrum manifest. The complete address and exact-block inventory is in `deployments/arbitrum/`.

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
