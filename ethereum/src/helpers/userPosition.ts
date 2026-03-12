import { BigInt, BigDecimal, Address } from "@graphprotocol/graph-ts"
import { UserPosition, UserPositionDayData, Vault } from "../../../generated/schema"

export function getOrCreateUserPosition(
  user: Address,
  vault: Vault
): UserPosition {
  let id = user.toHexString() + "-" + vault.id
  let position = UserPosition.load(id)

  if (position == null) {
    position = new UserPosition(id)
    position.user = user
    position.vault = vault.id
    position.shares = BigInt.zero()
    position.depositedAssets = BigInt.zero()
    position.withdrawnAssets = BigInt.zero()
    position.realizedProfit = BigInt.zero()
    position.costBasis = BigInt.zero()
    position.createdAt = BigInt.zero()
    position.updatedAt = BigInt.zero()
  }

  return position
}

export function getOrCreateUserPositionDayData(
  position: UserPosition,
  timestamp: BigInt
): UserPositionDayData {
  let dayId = timestamp.toI32() / 86400
  let id = position.id + "-" + dayId.toString()

  let dayData = UserPositionDayData.load(id)

  if (dayData == null) {
    dayData = new UserPositionDayData(id)
    dayData.position = position.id
    dayData.vault = position.vault
    dayData.user = position.user
    dayData.date = dayId
    dayData.shares = BigInt.zero()
    dayData.sharePrice = BigInt.zero()
    dayData.depositedAssetsCumulative = BigInt.zero()
    dayData.withdrawnAssetsCumulative = BigInt.zero()
  }

  // Update with current state
  dayData.shares = position.shares
  dayData.depositedAssetsCumulative = position.depositedAssets
  dayData.withdrawnAssetsCumulative = position.withdrawnAssets

  return dayData
}

/**
 * Calculate realized profit using FIFO cost basis
 * When user withdraws, we realize profit based on their average cost basis
 */
export function updateRealizedProfit(
  position: UserPosition,
  assetsWithdrawn: BigInt,
  sharesRedeemed: BigInt
): void {
  if (position.shares.equals(BigInt.zero())) {
    // Position fully exited
    position.costBasis = BigInt.zero()
    return
  }

  // Calculate proportion of position being withdrawn
  let totalSharesBefore = position.shares.plus(sharesRedeemed)

  if (totalSharesBefore.equals(BigInt.zero())) {
    return
  }

  // FIFO cost basis: calculate cost of shares being redeemed
  let costOfSharesRedeemed = position.costBasis
    .times(sharesRedeemed)
    .div(totalSharesBefore)

  // Realized P&L = assets received - cost basis of those shares
  let realizedPL = assetsWithdrawn.minus(costOfSharesRedeemed)

  position.realizedProfit = position.realizedProfit.plus(realizedPL)

  // Update remaining cost basis
  position.costBasis = position.costBasis.minus(costOfSharesRedeemed)
}

/**
 * Update cost basis when user deposits
 */
export function updateCostBasisOnDeposit(
  position: UserPosition,
  assetsDeposited: BigInt
): void {
  position.costBasis = position.costBasis.plus(assetsDeposited)
}
