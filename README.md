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

## Active Arbitrum Deployment (25 Sep 2026)

| Component | Address | Start block / indexing |
|-----------|---------|------------------------|
| VaultFactory | `0xa762B044C216c699A0bB1d0B7eA169a1716EB62d` | `508771925` |
| CoreVault | `0x70c8F05fC599e96D1BB9ce6e9dc3e1d72A9A3d01` | dynamic template from factory registration `508772034` |
| GlobalConfig | `0x04BA2Be680710B3Fae236bbFe18A5890A3829f98` | `508771938` |
| VaultUpkeep | `0x0196b1fd654fcC5A61fe6E9431b39Be88BB32FFE` | `508772145` |
| ClaimSettlementUpkeep | `0xD8CE7eA661A7E818337ad87E7bb87b56871da14E` | `508775680` |
| StrategyRouter | `0x9E3C383092bd98Ce6b821Db5dD51fC5A9ccb231E` | dynamic template from vault wiring |
| USDC strategy | `0xCC4A4A4CbB5e041ffE6CAc44D6F7F84B6F6cAEf1` | dynamic template from router registration (pending allowlist) |
| StrategyUpkeep | `0xA01Aa76C782569691Aaf6A0790124Bd3E5Ff3ee6` | `508775176` |

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
