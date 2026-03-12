import { BigInt, BigDecimal, Bytes, ethereum } from "@graphprotocol/graph-ts"
import { UserVaultPosition, PositionLot } from "../../generated/schema"
import { ZERO_BI, ZERO_BD, ONE_E18, safeDiv } from "./constants"

// =============================================================================
// FIFO COST BASIS TRACKING
// =============================================================================

/**
 * Create a new position lot on deposit
 * Each deposit creates a new FIFO lot for accurate cost basis tracking
 */
export function createPositionLot(
  position: UserVaultPosition,
  shares: BigInt,
  assets: BigInt,
  assetsUsd: BigDecimal,
  sharePrice: BigInt,
  assetPriceUsd: BigDecimal,
  txHash: Bytes,
  block: ethereum.Block
): PositionLot {
  // Get next lot index
  let lotIndex = getNextLotIndex(position)

  let id = position.id + "-" + lotIndex.toString()
  let lot = new PositionLot(id)

  lot.position = position.id
  lot.lotIndex = lotIndex

  // Original deposit info
  lot.timestamp = block.timestamp
  lot.blockNumber = block.number
  lot.txHash = txHash

  lot.sharesBought = shares
  lot.assetsCost = assets
  lot.usdCost = assetsUsd
  lot.sharePriceAtBuy = sharePrice
  lot.assetPriceUsdAtBuy = assetPriceUsd

  // Current state - initially all shares remain
  lot.sharesRemaining = shares
  lot.isFullyConsumed = false

  lot.save()

  return lot
}

/**
 * Get next lot index for a position
 * Counts existing lots to determine next index
 */
function getNextLotIndex(position: UserVaultPosition): i32 {
  // Simple approach: increment depositCount as proxy for lot count
  return position.depositCount
}

/**
 * Consume shares from lots using FIFO order
 * Returns realized P&L from consuming these shares
 */
export function consumeSharesFIFO(
  position: UserVaultPosition,
  sharesToConsume: BigInt,
  currentAssetValue: BigInt,
  currentAssetPriceUsd: BigDecimal
): FIFOResult {
  let result = new FIFOResult()
  result.realizedPnlAssets = ZERO_BI
  result.realizedPnlUsd = ZERO_BD
  result.costBasisConsumedAssets = ZERO_BI
  result.costBasisConsumedUsd = ZERO_BD

  if (sharesToConsume.equals(ZERO_BI)) {
    return result
  }

  let remainingShares = sharesToConsume

  // Calculate value per share being withdrawn
  let totalShares = position.shares.plus(sharesToConsume) // shares before withdrawal
  let valuePerShare = ZERO_BI
  if (totalShares.gt(ZERO_BI)) {
    valuePerShare = currentAssetValue.times(ONE_E18).div(totalShares)
  }

  // Iterate through lots in FIFO order (by lotIndex)
  let lotIndex = 0
  while (remainingShares.gt(ZERO_BI) && lotIndex < position.depositCount) {
    let lotId = position.id + "-" + lotIndex.toString()
    let lot = PositionLot.load(lotId)

    if (lot != null && !lot.isFullyConsumed && lot.sharesRemaining.gt(ZERO_BI)) {
      // Calculate how many shares to take from this lot
      let sharesToTake = remainingShares.lt(lot.sharesRemaining)
        ? remainingShares
        : lot.sharesRemaining

      // Calculate proportional cost basis
      let costBasisPortion = ZERO_BI
      let costBasisUsdPortion = ZERO_BD

      if (lot.sharesBought.gt(ZERO_BI)) {
        // Proportional cost = (shares taken / shares bought) * total cost
        costBasisPortion = lot.assetsCost.times(sharesToTake).div(lot.sharesBought)
        costBasisUsdPortion = lot.usdCost.times(sharesToTake.toBigDecimal()).div(lot.sharesBought.toBigDecimal())
      }

      // Calculate value of shares being sold
      let valueOfShares = sharesToTake.times(valuePerShare).div(ONE_E18)
      let valueOfSharesUsd = valueOfShares.toBigDecimal().times(currentAssetPriceUsd)

      // Realized P&L = value received - cost basis
      let realizedPnl = valueOfShares.minus(costBasisPortion)
      let realizedPnlUsd = valueOfSharesUsd.minus(costBasisUsdPortion)

      // Accumulate
      result.realizedPnlAssets = result.realizedPnlAssets.plus(realizedPnl)
      result.realizedPnlUsd = result.realizedPnlUsd.plus(realizedPnlUsd)
      result.costBasisConsumedAssets = result.costBasisConsumedAssets.plus(costBasisPortion)
      result.costBasisConsumedUsd = result.costBasisConsumedUsd.plus(costBasisUsdPortion)

      // Update lot
      lot.sharesRemaining = lot.sharesRemaining.minus(sharesToTake)
      lot.isFullyConsumed = lot.sharesRemaining.equals(ZERO_BI)
      lot.save()

      remainingShares = remainingShares.minus(sharesToTake)
    }

    lotIndex++
  }

  return result
}

/**
 * Transfer lots proportionally when shares are transferred
 * Creates new lots for receiver, reduces sender lots
 */
export function transferLotsFIFO(
  fromPosition: UserVaultPosition,
  toPosition: UserVaultPosition,
  sharesToTransfer: BigInt,
  sharePrice: BigInt,
  assetPriceUsd: BigDecimal,
  txHash: Bytes,
  block: ethereum.Block
): void {
  if (sharesToTransfer.equals(ZERO_BI)) {
    return
  }

  let remainingShares = sharesToTransfer
  let totalCostTransferred = ZERO_BI
  let totalUsdCostTransferred = ZERO_BD

  // Consume from sender's lots FIFO
  let lotIndex = 0
  while (remainingShares.gt(ZERO_BI) && lotIndex < fromPosition.depositCount) {
    let lotId = fromPosition.id + "-" + lotIndex.toString()
    let lot = PositionLot.load(lotId)

    if (lot != null && !lot.isFullyConsumed && lot.sharesRemaining.gt(ZERO_BI)) {
      let sharesToTake = remainingShares.lt(lot.sharesRemaining)
        ? remainingShares
        : lot.sharesRemaining

      // Calculate proportional cost to transfer
      let costPortion = ZERO_BI
      let costUsdPortion = ZERO_BD

      if (lot.sharesBought.gt(ZERO_BI)) {
        costPortion = lot.assetsCost.times(sharesToTake).div(lot.sharesBought)
        costUsdPortion = lot.usdCost.times(sharesToTake.toBigDecimal()).div(lot.sharesBought.toBigDecimal())
      }

      totalCostTransferred = totalCostTransferred.plus(costPortion)
      totalUsdCostTransferred = totalUsdCostTransferred.plus(costUsdPortion)

      // Update sender's lot
      lot.sharesRemaining = lot.sharesRemaining.minus(sharesToTake)
      lot.isFullyConsumed = lot.sharesRemaining.equals(ZERO_BI)
      lot.save()

      remainingShares = remainingShares.minus(sharesToTake)
    }

    lotIndex++
  }

  // Create a single new lot for receiver with the transferred cost basis
  if (sharesToTransfer.gt(ZERO_BI)) {
    let newLotIndex = toPosition.depositCount
    let newLotId = toPosition.id + "-" + newLotIndex.toString()
    let newLot = new PositionLot(newLotId)

    newLot.position = toPosition.id
    newLot.lotIndex = newLotIndex
    newLot.timestamp = block.timestamp
    newLot.blockNumber = block.number
    newLot.txHash = txHash
    newLot.sharesBought = sharesToTransfer
    newLot.assetsCost = totalCostTransferred
    newLot.usdCost = totalUsdCostTransferred
    newLot.sharePriceAtBuy = sharePrice
    newLot.assetPriceUsdAtBuy = assetPriceUsd
    newLot.sharesRemaining = sharesToTransfer
    newLot.isFullyConsumed = false
    newLot.save()
  }
}

/**
 * Calculate total remaining cost basis across all lots
 */
export function calculateTotalCostBasis(position: UserVaultPosition): CostBasisResult {
  let result = new CostBasisResult()
  result.totalCostAssets = ZERO_BI
  result.totalCostUsd = ZERO_BD

  for (let i = 0; i < position.depositCount; i++) {
    let lotId = position.id + "-" + i.toString()
    let lot = PositionLot.load(lotId)

    if (lot != null && lot.sharesRemaining.gt(ZERO_BI)) {
      // Calculate remaining cost portion
      if (lot.sharesBought.gt(ZERO_BI)) {
        let costRemaining = lot.assetsCost.times(lot.sharesRemaining).div(lot.sharesBought)
        let costUsdRemaining = lot.usdCost.times(lot.sharesRemaining.toBigDecimal()).div(lot.sharesBought.toBigDecimal())

        result.totalCostAssets = result.totalCostAssets.plus(costRemaining)
        result.totalCostUsd = result.totalCostUsd.plus(costUsdRemaining)
      }
    }
  }

  return result
}

// =============================================================================
// RESULT CLASSES
// =============================================================================

export class FIFOResult {
  realizedPnlAssets: BigInt
  realizedPnlUsd: BigDecimal
  costBasisConsumedAssets: BigInt
  costBasisConsumedUsd: BigDecimal
}

export class CostBasisResult {
  totalCostAssets: BigInt
  totalCostUsd: BigDecimal
}
