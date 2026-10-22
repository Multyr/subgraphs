import { Address, BigInt, Value, ethereum } from "@graphprotocol/graph-ts"
import { CurrentScoringSnapshot, StrategyDeployment } from "../../generated/schema"
import { Strategy } from "../../generated/templates/StrategyTemplate/Strategy"
import { AdapterRates } from "../../generated/templates/StrategyTemplate/AdapterRates"

// Snapshot getter outputs; do not reconstruct decision scores or use keeper-only
// computeInputsForPlan(), which cannot be called from an indexer identity.
export function refreshCurrentScoring(sd: StrategyDeployment, event: ethereum.Event, trigger: string): void {
  let strategy = Strategy.bind(Address.fromBytes(sd.strategyAddress))
  let count = strategy.try_adapterCount()
  if (count.reverted) return
  let inputs = strategy.try_computeRebalanceInputs()
  for (let i = 0; i < count.value.toI32(); i++) {
    let address = strategy.try_adapters(BigInt.fromI32(i))
    if (address.reverted) continue
    let adapter = address.value
    let id = sd.id + "-" + adapter.toHexString().toLowerCase()
    // Replace all nullable readings each time, so old successes do not masquerade
    // as fresh data when a later read fails or an adapter is no longer eligible.
    let snap = new CurrentScoringSnapshot(id)
    let optionalFields = ["enabled", "currentAPYBps", "effectiveAPYBps", "allocatorAPYBps", "targetAlloc", "positionAssets", "riskScoreBps", "stabilityEMA", "cachedLiquidityBps"]
    for (let k = 0; k < optionalFields.length; k++) snap.set(optionalFields[k], Value.fromNull())
    snap.chainId = sd.chainId
    snap.strategy = sd.id
    snap.adapter = adapter
    snap.source = "RPC_END_OF_BLOCK"
    snap.trigger = trigger
    snap.blockNumber = event.block.number
    snap.timestamp = event.block.timestamp
    snap.txHash = event.transaction.hash
    snap.allocatorReadSucceeded = !inputs.reverted
    let rates = AdapterRates.bind(adapter)
    let current = rates.try_currentAPYBps()
    if (!current.reverted) snap.currentAPYBps = current.value
    let effective = rates.try_effectiveAPYBps()
    if (!effective.reverted) snap.effectiveAPYBps = effective.value
    let enabled = strategy.try_enabled(adapter)
    if (!enabled.reverted) snap.enabled = enabled.value
    let position = strategy.try_positionAssets(adapter)
    if (!position.reverted) snap.positionAssets = position.value
    let risk = strategy.try_riskScoreBps(adapter)
    if (!risk.reverted) snap.riskScoreBps = risk.value
    let stability = strategy.try_stabilityEMA(adapter)
    if (!stability.reverted) snap.stabilityEMA = stability.value
    let liquidity = strategy.try_cachedLiquidityBps(adapter)
    if (!liquidity.reverted) snap.cachedLiquidityBps = liquidity.value
    if (!inputs.reverted) {
      let values = inputs.value
      for (let j = 0; j < values.value1.length; j++) {
        if (values.value1[j].equals(adapter)) {
          if (j < values.value0.length) snap.allocatorAPYBps = values.value0[j]
          if (j < values.value2.length) snap.targetAlloc = values.value2[j]
        }
      }
    }
    snap.save()
  }
}
