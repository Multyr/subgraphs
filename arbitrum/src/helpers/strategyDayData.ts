import { Address, BigInt, BigDecimal, Bytes } from "@graphprotocol/graph-ts"
import { StrategyDayData, Vault, VaultStrategy } from "../../generated/schema"
import { ZERO_BI, ZERO_BD, HUNDRED_BD, SECONDS_PER_DAY, safeDiv } from "./constants"

// =============================================================================
// SG-8 — StrategyDayData: allocation + harvest history per strategy per day
// =============================================================================
// VaultStrategy.totalAssets is overwritten on every event (current state only).
// This gives the dashboard "allocation per adapter over the last 30 days" and
// "revenue per strategy" without backfilling from StrategyRoute/RebalanceEvent.

function dayIdOf(timestamp: BigInt): i32 {
  return timestamp.toI32() / SECONDS_PER_DAY
}

/** Resolve the VaultStrategy row for a (vault, strategy) if the router is known. */
function findVaultStrategy(vault: Vault, strategy: Bytes): VaultStrategy | null {
  let router = vault.strategyRouter
  if (router === null) return null
  let routerHex = router.toHexString().toLowerCase()
  let id =
    routerHex +
    "-" + vault.chainId.toString() +
    "-" + strategy.toHexString().toLowerCase()
  return VaultStrategy.load(id)
}

export function getOrCreateStrategyDayData(
  vault: Vault,
  strategy: Bytes,
  timestamp: BigInt
): StrategyDayData {
  let dayId = dayIdOf(timestamp)
  let id = vault.id + "-" + strategy.toHexString().toLowerCase() + "-" + dayId.toString()

  let d = StrategyDayData.load(id)
  if (d == null) {
    d = new StrategyDayData(id)
    d.dayId = dayId
    d.vault = vault.id
    d.strategy = strategy
    d.chainId = vault.chainId
    d.periodStartUnix = dayId * SECONDS_PER_DAY

    d.totalAssets = ZERO_BI
    d.totalAssetsUsd = ZERO_BD
    d.weightBps = 0
    d.allocationPct = ZERO_BD

    d.harvestCount = 0
    d.harvestPnl = ZERO_BI
    d.harvestRealized = ZERO_BI
    d.harvestFailures = 0

    d.routedIn = ZERO_BI
    d.routedOut = ZERO_BI
    d.idleCash = ZERO_BI

    d.enabled = true
    d.quarantined = false
  }

  // Hydrate allocation snapshot from the live VaultStrategy row when resolvable
  let vs = findVaultStrategy(vault, strategy)
  if (vs !== null) {
    d.vaultStrategy = vs.id
    d.totalAssets = vs.totalAssets
    d.weightBps = vs.weightBps
    d.enabled = vs.enabled

    let vaultTotal = vault.totalAssets
    if (vaultTotal.gt(ZERO_BI)) {
      d.allocationPct = safeDiv(
        vs.totalAssets.toBigDecimal(),
        vaultTotal.toBigDecimal()
      ).times(HUNDRED_BD)
    }

    let price = vault.assetPriceUsd
    if (price.gt(ZERO_BD)) {
      let scale = BigDecimal.fromString("1")
      let decimals = vault.assetDecimals
      for (let i: i32 = 0; i < decimals; i++) {
        scale = scale.times(BigDecimal.fromString("10"))
      }
      d.totalAssetsUsd = vs.totalAssets.toBigDecimal().div(scale).times(price)
    }
  }

  return d
}

export function recordStrategyHarvest(
  vault: Vault,
  strategy: Bytes,
  timestamp: BigInt,
  pnl: BigInt,
  realized: BigInt,
  success: boolean
): void {
  let d = getOrCreateStrategyDayData(vault, strategy, timestamp)
  if (success) {
    d.harvestCount = d.harvestCount + 1
    d.harvestPnl = d.harvestPnl.plus(pnl)
    d.harvestRealized = d.harvestRealized.plus(realized)
  } else {
    d.harvestFailures = d.harvestFailures + 1
  }
  d.save()
}

export function recordStrategyRouted(
  vault: Vault,
  strategy: Bytes,
  timestamp: BigInt,
  amount: BigInt,
  cashAfter: BigInt
): void {
  let d = getOrCreateStrategyDayData(vault, strategy, timestamp)
  d.routedIn = d.routedIn.plus(amount)
  d.idleCash = cashAfter
  d.save()
}

export function recordStrategyRebalance(
  vault: Vault,
  fromStrategy: Bytes,
  toStrategy: Bytes,
  timestamp: BigInt,
  amount: BigInt
): void {
  let out = getOrCreateStrategyDayData(vault, fromStrategy, timestamp)
  out.routedOut = out.routedOut.plus(amount)
  out.save()
  let inn = getOrCreateStrategyDayData(vault, toStrategy, timestamp)
  inn.routedIn = inn.routedIn.plus(amount)
  inn.save()
}

export function markStrategyQuarantined(
  vault: Vault,
  strategy: Bytes,
  timestamp: BigInt,
  quarantined: boolean
): void {
  let d = getOrCreateStrategyDayData(vault, strategy, timestamp)
  d.quarantined = quarantined
  d.save()
}
