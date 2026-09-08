# Subgraph Tests — Status

**Status:** ✅ executing (macOS + CI). The old "blocked on Windows" note is resolved —
Matchstick has no Windows binary, but it runs fine on Linux/macOS, and CI runs it now.

## How it runs

- `npm run test:all` — codegen is *not* required first, but `npm run codegen:all`
  must have produced `*/generated/` (CI does both).
- `scripts/link-node-modules.mjs` (invoked by the `test:*` scripts) symlinks
  `<network>/node_modules -> ../node_modules` because Matchstick resolves its
  AssemblyScript lib from the network directory.
- CI: `.github/workflows/subgraph.yml` runs `sync:check` → `codegen:all` →
  `build:all` → `test:all` on every PR touching schema / mappings / abis / tests.

## Coverage

`arbitrum/tests/` (synced verbatim to `base/` and `ethereum/` by `npm run sync`):

| File | Tests | Covers |
|---|---|---|
| `mappings.test.ts` | 6 | `handleVaultCreated`, `handleDeposit` (position + FIFO lot + `lotCounter` + Transaction), `VaultHourData` bucket (SG-7), `handleWithdraw` FIFO consume, `handleTransfer` lot preservation (SG-16), mint/burn filtering |
| `sgWorkOrder.test.ts` | 2 | `UpkeepAction.opType`/`upkeepKind` decode (SG-3), `VaultPauseEvent` open→close→`durationSeconds` (SG-9) |
| `vaultUpkeep.test.ts` | 4 | `handleUpkeepPerformed` → `UpkeepAction` (raw `op`, success/failure, unique ids) |

**Total: 12 tests × 3 networks = 36.**

## Gaps / follow-ups

- No coverage yet for `pricing.ts` MISSING-vs-zero path (SG-4), `StrategyDayData`
  (SG-8), `AdapterHealthSnapshot` (SG-13), `TokenPriceDayData` (SG-14), the
  FIFO compaction cursor edge cases, or APY math.
- `graph test -c` coverage report not wired into CI yet.
