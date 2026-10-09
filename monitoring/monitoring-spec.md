# Subgraph monitoring specification

The executable query contract is [`docs/DASHBOARD-QUERIES.graphql`](../docs/DASHBOARD-QUERIES.graphql).
It supersedes field names in the dashboard handoff documents. All collection
queries use `id_gt` cursor pagination; callers start with `lastId = ""`, request
at most 1,000 rows, and continue with the final returned `id`.

## Required checks

| Check | Query/data | Alert condition |
|---|---|---|
| Indexer freshness | `SubgraphMeta` | `hasIndexingErrors`, or indexed block age exceeds the environment SLO |
| Vault reconciliation | `VaultStateForReconciliation` plus pinned-block RPC reads | absolute relative delta in `totalAssets` or `totalSupply` exceeds 0.1% |
| Missing price | `FleetOverview`, `TokenPrices` | `priceStatus == MISSING`; nullable USD fields must display as unavailable, never `$0` |
| Stale price | `TokenPrices` | `status == STALE` or staleness exceeds the configured feed heartbeat |
| Epoch overdue | `WithdrawalEpochs` | state is `OPEN` and current time exceeds `epochClosesAt` |
| Queue latency | `ClaimLatency` | backend computes `settledAt - requestedAt` and evaluates p50/p95/max against the product SLO |
| Strategy failures | `HarvestHistory`, `AdapterHealth` | failed harvest, quarantined adapter, or consecutive failures above policy |
| Pause duration | `GovernanceTimeline` | active pause or duration above the incident threshold |

## Derived metrics

- Gross APY: `Vault.apy` (canonical 30-day value) plus the explicit 1d/7d/30d fields.
- Net APY: `Vault.netApy` (canonical 30-day value) plus 1d/7d/30d fields;
  positive gross APY is reduced by `perfRateX`, while negative APY is unchanged.
- Epoch time remaining: `max(epochClosesAt - now, 0)`.
- Queue settlement latency: `settledAt - requestedAt` for settled claims.
- Strategy allocation: `StrategyDayData.allocationPct`; null USD values are
  accompanied by `priceStatus`.

## Reconciliation procedure

1. Read `_meta.block.number`.
2. Query subgraph vault state.
3. Read `totalAssets()` and `totalSupply()` over RPC at that same block.
4. Compare integer values, record both sources, block number, endpoint, and timestamp.

No canonical hosted endpoint is embedded in this repository. The deployer must
provide one endpoint per chain and set it in the dashboard environment after a
successful indexing deployment.
