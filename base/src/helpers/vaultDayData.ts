import { BigInt, BigDecimal } from "@graphprotocol/graph-ts"
import { Vault, VaultDayData } from "../../../generated/schema"

const SECONDS_PER_DAY = 86400
const DAYS_PER_YEAR = BigDecimal.fromString("365")

export function getDayId(timestamp: BigInt): i32 {
  return timestamp.toI32() / SECONDS_PER_DAY
}

export function getOrCreateVaultDayData(
  vault: Vault,
  timestamp: BigInt
): VaultDayData {
  let dayId = getDayId(timestamp)
  let id = vault.id + "-" + dayId.toString()

  let vaultDayData = VaultDayData.load(id)

  if (vaultDayData == null) {
    vaultDayData = new VaultDayData(id)
    vaultDayData.vault = vault.id
    vaultDayData.date = dayId
    vaultDayData.totalAssets = BigInt.zero()
    vaultDayData.totalSupply = BigInt.zero()
    vaultDayData.sharePrice = BigInt.zero()
    vaultDayData.apy = BigDecimal.zero()
  }

  // Update with current vault state
  vaultDayData.totalAssets = vault.totalAssets
  vaultDayData.totalSupply = vault.totalSupply
  vaultDayData.sharePrice = vault.sharePrice

  return vaultDayData
}

export function loadPreviousVaultDayData(
  current: VaultDayData
): VaultDayData | null {
  let prevDayId = current.date - 1
  let prevId = current.vault + "-" + prevDayId.toString()
  return VaultDayData.load(prevId)
}

export function updateVaultDayDataApy(
  current: VaultDayData,
  previous: VaultDayData | null
): void {
  if (previous == null || previous.sharePrice.equals(BigInt.zero())) {
    current.apy = BigDecimal.zero()
    return
  }

  // Daily return = (current_price - prev_price) / prev_price
  let priceDiff = current.sharePrice.minus(previous.sharePrice)
  let dailyReturn = priceDiff.toBigDecimal().div(previous.sharePrice.toBigDecimal())

  // Annualized APY = daily_return * 365 * 100
  current.apy = dailyReturn.times(DAYS_PER_YEAR).times(BigDecimal.fromString("100"))
}
