# subgraphs

> The Graph subgraphs for the [Multyr Protocol](https://github.com/Multyr) — a
> non-custodial ERC-4626 vault platform on Arbitrum. Indexes vault factory,
> vaults, user positions, fees, claims, and governance across chains.

[![License: BUSL-1.1](https://img.shields.io/badge/license-BUSL--1.1-blue.svg)](./LICENSE)
[![Network: Arbitrum One](https://img.shields.io/badge/network-Arbitrum%20One-28a0f0.svg)]()

## Overview

This repository contains the canonical subgraph definitions for the Multyr
Protocol. A single shared `schema.graphql` is indexed identically across every
supported network, with per-chain `subgraph.yaml` manifests and mappings.

- **Full ERC-4626 tracking** — deposits, withdrawals, transfers, share accounting
- **FIFO cost basis** — accurate per-user P&L via position lots
- **USD pricing** — Chainlink feeds with fallback
- **Daily snapshots** — historical TVL and APY (`VaultDayData`, `UserPositionDayData`)
- **Claim queue lifecycle** — async withdrawal requests, settlements, force-withdraws
- **Fees & crystallization** — performance/management fee events, perf-fee mints
- **Governance & lifecycle** — module changes, role changes, seal events, timelocks

## Supported networks

| Network | Status | VaultFactory |
|---|---|---|
| Arbitrum One (`arbitrum-one`, chainId 42161) | Live | `0x1E5d3b7a88776Bbea48a81A4E8f195195EdCDc38` |
| Base | Template | — |
| Ethereum | Template | — |

Arbitrum One is the production deployment. Base and Ethereum manifests share the
same schema and mappings and are provided as templates for future deployments.

## Repository structure

```
schema.graphql            # Shared entity schema (all chains)
shared/                   # Shared AssemblyScript helpers (constants, entities, fifo, pricing)
arbitrum/
  subgraph.yaml           # Arbitrum One manifest (VaultFactory, VaultUpkeep, GlobalConfig, IncentivesEngine)
  src/mappings.ts         # Event handlers
  abis/                   # Contract ABIs
base/                     # Base manifest + mappings (template)
ethereum/                 # Ethereum manifest + mappings (template)
```

## Indexed entities

Core: `Protocol`, `VaultFactory`, `Vault`, `VaultStrategy`, `StrategyRoute`.
Users & positions: `User`, `UserVaultPosition`, `PositionLot`, `UserPositionDayData`.
Activity: `Transaction`, `ClaimRequest`, `ClaimQueueEvent`, `ForceWithdrawEvent`,
`EpochEvent`, `UpkeepAction`, `UpkeepBackoffEvent`, `QueueSettleFailureEvent`.
Economics: `FeeEvent`, `Crystallization`, `PerfFeeMint`, `VaultRealization`,
`ReserveRestore`, `TokenPrice`, `ChainlinkFeed`, `VaultDayData`.
Governance: `ModuleChange`, `RoleChange`, `SealEvent`, `ComponentTimelockEvent`,
`SharesFreezeEvent`.

See [`schema.graphql`](./schema.graphql) for the full definitions.

## Quick start

Prerequisites: Node.js 18+, a The Graph Studio account (or a self-hosted Graph node).

```bash
npm install

# Generate AssemblyScript types (explicit --output-dir required for AS 0.19.x)
npx graph codegen arbitrum/subgraph.yaml --output-dir arbitrum/generated

# Build
npx graph build arbitrum/subgraph.yaml

# Deploy to The Graph Studio
npx graph deploy --studio <subgraph-slug>
```

When modifying the Arbitrum mappings, mirror the changes into `base/` and
`ethereum/` (the schema is identical across chains).

## Related repositories

- Core protocol: [Multyr/multyr-core](https://github.com/Multyr/multyr-core)
- Periphery: [Multyr/multyr-periphery](https://github.com/Multyr/multyr-periphery)
- Strategies: [Multyr/multyr-strategies](https://github.com/Multyr/multyr-strategies)

## License

[BUSL-1.1](./LICENSE) — Business Source License 1.1. Change Date: four years from
publication; Change License: GPL-2.0-or-later.

## Security

Please report vulnerabilities responsibly to **security@multyr.fi**. See
[SECURITY.md](./SECURITY.md). Do not open public issues for security reports.
