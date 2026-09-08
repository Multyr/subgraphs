import { BigInt, ethereum } from "@graphprotocol/graph-ts"
import { UpkeepAction, StrategyHarvestEvent } from "../../generated/schema"

// =============================================================================
// SG-3 — decode raw on-chain upkeep op enums into a self-describing GraphQL enum
// =============================================================================
// Unrecognised values map to "UNKNOWN" — never silently dropped.

/** multyr-core/src/automation/VaultUpkeep.sol `enum Op` */
export function mapVaultUpkeepOp(op: i32): string {
  if (op == 0) return "NONE"
  if (op == 1) return "EPOCH_CLOSE"
  if (op == 2) return "EPOCH_FUND"
  if (op == 3) return "CRYSTALLIZE"
  if (op == 4) return "REBALANCE"
  if (op == 5) return "DEPLOY"
  if (op == 6) return "REALIZE"
  if (op == 7) return "RECONCILE"
  if (op == 8) return "STRATEGY_REBALANCE"
  return "UNKNOWN"
}

/** multyr-strategies/.../automation/LendingStrategyUpkeep.sol `OP_*` constants */
export function mapStrategyUpkeepOp(op: i32): string {
  if (op == 1) return "HARVEST"
  if (op == 2) return "REBALANCE"
  if (op == 3) return "POKE_APY"
  if (op == 4) return "DEPLOY_IDLE"
  if (op == 5) return "PREPARE_REBALANCE"
  if (op == 6) return "EXECUTE_REBALANCE_STEP"
  return "UNKNOWN"
}

/** PeripheryUpkeepAdapter `PeripheryOp` (1=SPLIT, 2=REDEEM, 3=FUND) */
export function mapPeripheryUpkeepOp(op: i32): string {
  if (op == 1) return "PERIPHERY_SPLIT"
  if (op == 2) return "PERIPHERY_REDEEM"
  if (op == 3) return "PERIPHERY_FUND"
  return "UNKNOWN"
}

// =============================================================================
// SG-2 — automation cost from the transaction receipt
// =============================================================================
// `event.receipt` is only populated when the handler declares `receipt: true`
// in subgraph.yaml. Guard for null so builds without it still index.

export function setUpkeepGas(action: UpkeepAction, event: ethereum.Event): void {
  let receipt = event.receipt
  if (receipt == null) return
  let gasUsed = receipt.gasUsed
  let gasPrice = event.transaction.gasPrice
  action.gasUsed = gasUsed
  action.gasPrice = gasPrice
  action.txFeeWei = gasUsed.times(gasPrice)
}

export function setHarvestGas(harvest: StrategyHarvestEvent, event: ethereum.Event): void {
  let receipt = event.receipt
  if (receipt == null) return
  let gasUsed = receipt.gasUsed
  let gasPrice = event.transaction.gasPrice
  harvest.gasUsed = gasUsed
  harvest.gasPrice = gasPrice
  harvest.txFeeWei = gasUsed.times(gasPrice)
}
