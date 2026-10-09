# Event and entity catalog

Use the canonical queries in [`docs/DASHBOARD-QUERIES.graphql`](../docs/DASHBOARD-QUERIES.graphql).

| Product surface | Indexed entities | Canonical query |
|---|---|---|
| Vault fleet and APY | `Protocol`, `Vault`, `VaultDayData`, `VaultHourData`, `VaultPpsSnapshot` | `FleetOverview`, `VaultDailySeries`, `VaultHourlySeries`, `PpsSnapshots` |
| User activity and FIFO PnL | `User`, `UserVaultPosition`, `PositionLot`, `Transaction`, `UserPositionDayData` | `UserVaultTransactions` |
| Withdrawal queue | `WithdrawalEpoch`, `ClaimRequest`, `WithdrawalEpochEvent` | `WithdrawalEpochs`, `ClaimLatency`, `PendingClaims` |
| Strategy allocation and harvests | `VaultStrategy`, `StrategyDayData`, `StrategyHarvestEvent`, `HarvestBatch` | `StrategyState`, `StrategyDailySeries`, `HarvestHistory` |
| Adapter health | `Adapter`, `AdapterHealthSnapshot` | `AdapterHealth` |
| Automation | `UpkeepAction` | `UpkeepHistory` |
| Governance and incidents | `OwnershipEvent`, `ModuleChange`, `ModuleAuthorizationEvent`, `DeadDepositEvent`, `VaultPauseEvent`, `SealEvent` | `GovernanceTimeline` |
| Oracle configuration and prices | `OracleRegistryEvent`, `ChainlinkFeed`, `TokenPrice`, `TokenPriceDayData` | `OracleConfigTimeline`, `TokenPrices`, `TokenPriceHistory` |
| Referral/partner activity | `ReferralBoundEvent`, `DepositWithReferralEvent`, `PartnerEvent` | `ReferralActivity` |

Important field corrections relative to the old dashboard handoff:

- Query `strategyHarvestEvents`; the payload fields are `pnl` and `realized`.
- `PartnerEvent` uses `bps`, not `commissionBps`.
- `ReferralBoundEvent` and `DepositWithReferralEvent` use `user`, not `depositor`.
- A missing price is `priceStatus: MISSING` with nullable USD values.
- Epoch close timing is explicit in `epochDuration` and `epochClosesAt`.
