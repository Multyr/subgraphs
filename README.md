# Multyr Vault Subgraph v3.1

Subgraph for indexing Multyr vaults across Arbitrum, Base, and Ethereum.

**Studio**: https://thegraph.com/studio/subgraph/multyr-subgraph
**Slug**: `multyr-subgraph`
**Current deploy**: v3.1.0

## Features

- **ERC-4626 tracking**: Deposits, Withdrawals, Transfers, ForceWithdraw
- **APY**: canonical sharePrice (decimals-aware), 30-day lookback, 1d/7d/30d averages
- **FIFO Cost Basis**: position lots, realized/unrealized P&L
- **USD Pricing**: Chainlink with staleness tracking
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

## Production Addresses (Arbitrum)

| Datasource | Address | Status |
|-----------|---------|--------|
| VaultFactory v2 | `0x4201311F1333843fb92a30c687B9C3824E53CA1d` | Active |
| VaultUpkeep | `0xe5c2ba17bf294b70c21498fcc74975c86d380c9d` | Active |
| GlobalConfig | `0x4A6a4E1D3120Bd016C96cf035d3FAB99D4a0c6Ce` | Active |
| StrategyUpkeep v4 | `0x9D2c6AF78F57fEAe4322e86E5952Da4e414ada82` | Active |
| FeeCollectorUpkeep | `0x5D4e0b9AA48234bC2Cb10b0A2f97430A4a9a8EA8` | Active |
| OpsCollector | `0x78Db3575A3477adfEd19F74142b7ed1a592f80D1` | Active |
| FeeDistributor | `0x855018a8BCe730ed528b426E78e9A5b28fAb457E` | Active |
| EpochPayout | `0x15F5619256db081c1694f6966e25d1B234D2D897` | Active |
| ReferralBinding | `0x864281D1A7b0E7d0071ea6AEC43b0fE0D7106b1b` | Active |
| PartnerRegistry | `0xe66f441835c9Fa8833E5Fd0a67eB42Ef0a83a9e7` | Active |
| DepositRouter | `0x6f051953f2f9b1bb4fe1b6ad537877af01a2e369` | Active |

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

For vault v4 on Arbitrum, `queueModule` and `adminModule` are not recoverable from the subgraph (deploy-time event emitted before template creation). See [docs/bootstrap-registry.md](docs/bootstrap-registry.md) and [docs/bootstrap-manifest.json](docs/bootstrap-manifest.json).

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
