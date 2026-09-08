import { BigInt, BigDecimal, ethereum } from "@graphprotocol/graph-ts"
import { Vault, VaultHourData } from "../../generated/schema"
import {
  ZERO_BI,
  ZERO_BD,
  HUNDRED_BD,
  ONE_E18_BD,
  SECONDS_PER_HOUR,
  safeDiv
} from "./constants"

// =============================================================================
// SG-7 — VaultHourData (intraday time series)
// =============================================================================
// Mirrors the VaultDayData volume-accumulation + return logic in entities.ts so
// "last 24h" is no longer a single daily point. Kept as a parallel helper (not a
// refactor of snapshotVaultDayData) to avoid touching the canonical APY path.

export function getHourId(timestamp: BigInt): i32 {
  return timestamp.toI32() / SECONDS_PER_HOUR
}

export function getOrCreateVaultHourData(vault: Vault, timestamp: BigInt): VaultHourData {
  let hourId = timestamp.toI32() / SECONDS_PER_HOUR
  let id = vault.id + "-" + hourId.toString()

  let d = VaultHourData.load(id)
  if (d == null) {
    d = new VaultHourData(id)
    d.vault = vault.id
    d.chainId = vault.chainId
    d.hourId = hourId
    d.periodStartUnix = hourId * SECONDS_PER_HOUR

    d.depositsAssets = ZERO_BI
    d.depositsUsd = ZERO_BD
    d.withdrawalsAssets = ZERO_BI
    d.withdrawalsUsd = ZERO_BD
    d.netFlowAssets = ZERO_BI
    d.netFlowUsd = ZERO_BD

    d.depositCount = 0
    d.withdrawCount = 0
    d.uniqueUsers = 0
    d.hourlyReturn = ZERO_BD
  }

  // Always refresh state snapshot
  d.totalAssets = vault.totalAssets
  d.totalSupply = vault.totalSupply
  d.sharePrice = vault.sharePrice
  d.tvlUsd = vault.tvlUsd
  d.assetPriceUsd = vault.assetPriceUsd

  return d
}

/** Return since the most recent prior hour with a non-zero sharePrice (look back 7d). */
export function updateVaultHourDataReturn(d: VaultHourData): void {
  let currentPrice = d.sharePrice.toBigDecimal().div(ONE_E18_BD)
  if (currentPrice.le(ZERO_BD)) {
    d.hourlyReturn = ZERO_BD
    return
  }

  let prevPrice = ZERO_BD
  let hoursDelta = 0
  for (let i: i32 = 1; i <= 168; i++) {
    let prev = VaultHourData.load(d.vault + "-" + (d.hourId - i).toString())
    if (prev !== null && prev.sharePrice.gt(ZERO_BI)) {
      prevPrice = prev.sharePrice.toBigDecimal().div(ONE_E18_BD)
      hoursDelta = i
      break
    }
  }

  if (prevPrice.le(ZERO_BD) || hoursDelta == 0) {
    d.hourlyReturn = ZERO_BD
    return
  }

  let totalReturn = currentPrice.minus(prevPrice).div(prevPrice)
  let hourlyReturn = safeDiv(totalReturn, BigDecimal.fromString(hoursDelta.toString()))
  d.hourlyReturn = hourlyReturn.times(HUNDRED_BD)
}

/** State-only snapshot (no volume delta) — call alongside snapshotVaultDayData. */
export function snapshotVaultHourData(vault: Vault, block: ethereum.Block): void {
  let d = getOrCreateVaultHourData(vault, block.timestamp)
  updateVaultHourDataReturn(d)
  d.save()
}

/** Deposit volume delta for the current hour bucket. */
export function recordHourlyDeposit(
  vault: Vault,
  timestamp: BigInt,
  assets: BigInt,
  assetsUsd: BigDecimal,
  isNewUser: boolean
): void {
  let d = getOrCreateVaultHourData(vault, timestamp)
  d.depositsAssets = d.depositsAssets.plus(assets)
  d.depositsUsd = d.depositsUsd.plus(assetsUsd)
  d.netFlowAssets = d.depositsAssets.minus(d.withdrawalsAssets)
  d.netFlowUsd = d.depositsUsd.minus(d.withdrawalsUsd)
  d.depositCount = d.depositCount + 1
  if (isNewUser) d.uniqueUsers = d.uniqueUsers + 1
  updateVaultHourDataReturn(d)
  d.save()
}

/** Withdraw volume delta for the current hour bucket. */
export function recordHourlyWithdraw(
  vault: Vault,
  timestamp: BigInt,
  assets: BigInt,
  assetsUsd: BigDecimal
): void {
  let d = getOrCreateVaultHourData(vault, timestamp)
  d.withdrawalsAssets = d.withdrawalsAssets.plus(assets)
  d.withdrawalsUsd = d.withdrawalsUsd.plus(assetsUsd)
  d.netFlowAssets = d.depositsAssets.minus(d.withdrawalsAssets)
  d.netFlowUsd = d.depositsUsd.minus(d.withdrawalsUsd)
  d.withdrawCount = d.withdrawCount + 1
  updateVaultHourDataReturn(d)
  d.save()
}
