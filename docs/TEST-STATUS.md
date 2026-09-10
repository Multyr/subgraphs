# Subgraph Tests — Status

**Status:** ✅ all 57 tests pass locally (19 per network); coverage reports generate
for all three networks. Matchstick is pinned to 0.6.0 so CI does not depend on the
GitHub "latest release" API.

## How it runs

- `npm run test:all` — codegen is *not* required first, but `npm run codegen:all`
  must have produced `*/generated/` (CI does both).
- `scripts/link-node-modules.mjs` (invoked by the `test:*` scripts) symlinks
  `<network>/node_modules -> ../node_modules` because Matchstick resolves its
  AssemblyScript lib from the network directory.
- CI: `.github/workflows/subgraph.yml` runs `sync:check` → `codegen:all` →
  `build:all` → `test:all` → `test:coverage:all` on every PR touching schema /
  mappings / abis / tests, then uploads the coverage output.

## Coverage

`arbitrum/tests/` (synced verbatim to `base/` and `ethereum/` by `npm run sync`):

| File | Tests | Covers |
|---|---|---|
| `mappings.test.ts` | 9 | creation/deposit/withdraw/transfer, hourly data (SG-7), FIFO lot preservation and compaction (SG-16), epoch linkage/close timing, loss-inclusive and net APY |
| `sgWorkOrder.test.ts` | 2 | `UpkeepAction.opType`/`upkeepKind` decode (SG-3), `VaultPauseEvent` open→close→`durationSeconds` (SG-9) |
| `vaultUpkeep.test.ts` | 4 | `handleUpkeepPerformed` → `UpkeepAction` (raw `op`, success/failure, unique ids) |
| `requirements.test.ts` | 4 | missing-price/null propagation, dynamic middleware feed registration and daily price history (SG-4/SG-14), `StrategyDayData` (SG-8), `AdapterHealthSnapshot` (SG-13) |

**Total: 19 tests × 3 networks = 57.**

## External acceptance

- A green protected-branch check requires the workflow to run in the remote
  repository; local files cannot configure repository branch protection.
- Live query/reconciliation acceptance requires a deployed, indexed endpoint.
