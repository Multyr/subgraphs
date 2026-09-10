import { BigInt, BigDecimal, Bytes, ethereum } from "@graphprotocol/graph-ts"
import { UserVaultPosition, PositionLot } from "../../generated/schema"
import { ZERO_BI, ZERO_BD, ONE_E18, safeDiv } from "./constants"
import { addUsd } from "./nullableUsd"

// =============================================================================
// FIFO COST BASIS TRACKING  (SG-16 hardened)
// =============================================================================
// Changes vs the original:
//  1. Lot index comes from a dedicated persistent `position.lotCounter`, never
//     from `depositCount` (which drifts as soon as transfers create lots).
//  2. Transfers preserve individual lots: the receiver gets one lot per consumed
//     sender lot, carrying the original acquisition timestamp / price.
//  3. `position.firstActiveLotIndex` is a compaction cursor so consume / cost-
//     basis loops skip fully-consumed lots instead of scanning from 0.

// ---------------------------------------------------------------------------

/** Allocate the next lot index and advance the counter (caller saves position). */
function nextLotIndex(position: UserVaultPosition): i32 {
  let idx = position.lotCounter
  position.lotCounter = position.lotCounter + 1
  return idx
}

/** Advance firstActiveLotIndex past any leading fully-consumed lots. */
function compact(position: UserVaultPosition): void {
  let i = position.firstActiveLotIndex
  while (i < position.lotCounter) {
    let lot = PositionLot.load(position.id + "-" + i.toString())
    if (lot == null) { i++; continue }
    if (!lot.isFullyConsumed && lot.sharesRemaining.gt(ZERO_BI)) break
    i++
  }
  position.firstActiveLotIndex = i
}

// ---------------------------------------------------------------------------

/** Create a new position lot on deposit. */
export function createPositionLot(
  position: UserVaultPosition,
  shares: BigInt,
  assets: BigInt,
  assetsUsd: BigDecimal | null,
  sharePrice: BigInt,
  assetPriceUsd: BigDecimal | null,
  txHash: Bytes,
  block: ethereum.Block
): PositionLot {
  let lotIndex = nextLotIndex(position)
  let lot = new PositionLot(position.id + "-" + lotIndex.toString())

  lot.position = position.id
  lot.lotIndex = lotIndex

  lot.timestamp = block.timestamp
  lot.blockNumber = block.number
  lot.txHash = txHash

  lot.sharesBought = shares
  lot.assetsCost = assets
  lot.usdCost = assetsUsd
  lot.sharePriceAtBuy = sharePrice
  lot.assetPriceUsdAtBuy = assetPriceUsd

  lot.sharesRemaining = shares
  lot.isFullyConsumed = false

  lot.save()
  return lot
}

/** Consume shares from lots in FIFO order; returns realized P&L. */
export function consumeSharesFIFO(
  position: UserVaultPosition,
  sharesToConsume: BigInt,
  currentAssetValue: BigInt,
  currentAssetPriceUsd: BigDecimal | null
): FIFOResult {
  let result = new FIFOResult()
  result.realizedPnlAssets = ZERO_BI
  result.realizedPnlUsd = ZERO_BD
  result.costBasisConsumedAssets = ZERO_BI
  result.costBasisConsumedUsd = ZERO_BD

  if (sharesToConsume.equals(ZERO_BI)) return result

  let remainingShares = sharesToConsume

  // Value per share being withdrawn (shares before withdrawal in the denominator)
  let totalShares = position.shares.plus(sharesToConsume)
  let valuePerShare = ZERO_BI
  if (totalShares.gt(ZERO_BI)) {
    valuePerShare = currentAssetValue.times(ONE_E18).div(totalShares)
  }

  let lotIndex = position.firstActiveLotIndex
  while (remainingShares.gt(ZERO_BI) && lotIndex < position.lotCounter) {
    let lot = PositionLot.load(position.id + "-" + lotIndex.toString())

    if (lot != null && !lot.isFullyConsumed && lot.sharesRemaining.gt(ZERO_BI)) {
      let sharesToTake = remainingShares.lt(lot.sharesRemaining)
        ? remainingShares
        : lot.sharesRemaining

      let costBasisPortion = ZERO_BI
      let costBasisUsdPortion: BigDecimal | null = ZERO_BD
      let lotUsdCost = lot.usdCost
      if (lot.sharesBought.gt(ZERO_BI)) {
        costBasisPortion = lot.assetsCost.times(sharesToTake).div(lot.sharesBought)
        costBasisUsdPortion = lotUsdCost === null
          ? null
          : lotUsdCost.times(sharesToTake.toBigDecimal()).div(lot.sharesBought.toBigDecimal())
      }

      let valueOfShares = sharesToTake.times(valuePerShare).div(ONE_E18)
      let valueOfSharesUsd: BigDecimal | null = currentAssetPriceUsd === null
        ? null
        : valueOfShares.toBigDecimal().times(currentAssetPriceUsd)

      result.realizedPnlAssets = result.realizedPnlAssets.plus(valueOfShares.minus(costBasisPortion))
      result.realizedPnlUsd = valueOfSharesUsd === null || costBasisUsdPortion === null
        ? null
        : addUsd(result.realizedPnlUsd, valueOfSharesUsd.minus(costBasisUsdPortion))
      result.costBasisConsumedAssets = result.costBasisConsumedAssets.plus(costBasisPortion)
      result.costBasisConsumedUsd = addUsd(result.costBasisConsumedUsd, costBasisUsdPortion)

      lot.sharesRemaining = lot.sharesRemaining.minus(sharesToTake)
      lot.isFullyConsumed = lot.sharesRemaining.equals(ZERO_BI)
      lot.save()

      remainingShares = remainingShares.minus(sharesToTake)
    }

    lotIndex++
  }

  compact(position)
  return result
}

/**
 * Transfer lots FIFO — the receiver gets one lot per consumed sender lot so its
 * true acquisition timeline (and therefore FIFO cost basis on a later withdraw)
 * is preserved.
 */
export function transferLotsFIFO(
  fromPosition: UserVaultPosition,
  toPosition: UserVaultPosition,
  sharesToTransfer: BigInt,
  sharePrice: BigInt,
  assetPriceUsd: BigDecimal | null,
  txHash: Bytes,
  block: ethereum.Block
): void {
  if (sharesToTransfer.equals(ZERO_BI)) return

  let remainingShares = sharesToTransfer
  let lotIndex = fromPosition.firstActiveLotIndex

  while (remainingShares.gt(ZERO_BI) && lotIndex < fromPosition.lotCounter) {
    let lot = PositionLot.load(fromPosition.id + "-" + lotIndex.toString())

    if (lot != null && !lot.isFullyConsumed && lot.sharesRemaining.gt(ZERO_BI)) {
      let sharesToTake = remainingShares.lt(lot.sharesRemaining)
        ? remainingShares
        : lot.sharesRemaining

      let costPortion = ZERO_BI
      let costUsdPortion: BigDecimal | null = ZERO_BD
      let lotUsdCost = lot.usdCost
      if (lot.sharesBought.gt(ZERO_BI)) {
        costPortion = lot.assetsCost.times(sharesToTake).div(lot.sharesBought)
        costUsdPortion = lotUsdCost === null
          ? null
          : lotUsdCost.times(sharesToTake.toBigDecimal()).div(lot.sharesBought.toBigDecimal())
      }

      // Receiver lot mirrors the sender lot's original acquisition data
      let newIdx = nextLotIndex(toPosition)
      let newLot = new PositionLot(toPosition.id + "-" + newIdx.toString())
      newLot.position = toPosition.id
      newLot.lotIndex = newIdx
      newLot.timestamp = lot.timestamp
      newLot.blockNumber = lot.blockNumber
      newLot.txHash = txHash
      newLot.sharesBought = sharesToTake
      newLot.assetsCost = costPortion
      newLot.usdCost = costUsdPortion
      newLot.sharePriceAtBuy = lot.sharePriceAtBuy
      newLot.assetPriceUsdAtBuy = lot.assetPriceUsdAtBuy
      newLot.sharesRemaining = sharesToTake
      newLot.isFullyConsumed = false
      newLot.save()

      // Reduce sender lot
      lot.sharesRemaining = lot.sharesRemaining.minus(sharesToTake)
      lot.isFullyConsumed = lot.sharesRemaining.equals(ZERO_BI)
      lot.save()

      remainingShares = remainingShares.minus(sharesToTake)
    }

    lotIndex++
  }

  compact(fromPosition)
}

/** Total remaining cost basis across active lots. */
export function calculateTotalCostBasis(position: UserVaultPosition): CostBasisResult {
  let result = new CostBasisResult()
  result.totalCostAssets = ZERO_BI
  result.totalCostUsd = ZERO_BD

  for (let i = position.firstActiveLotIndex; i < position.lotCounter; i++) {
    let lot = PositionLot.load(position.id + "-" + i.toString())
    if (lot != null && lot.sharesRemaining.gt(ZERO_BI) && lot.sharesBought.gt(ZERO_BI)) {
      let costRemaining = lot.assetsCost.times(lot.sharesRemaining).div(lot.sharesBought)
      let lotUsdCost = lot.usdCost
      let costUsdRemaining: BigDecimal | null = lotUsdCost === null
        ? null
        : lotUsdCost.times(lot.sharesRemaining.toBigDecimal()).div(lot.sharesBought.toBigDecimal())
      result.totalCostAssets = result.totalCostAssets.plus(costRemaining)
      result.totalCostUsd = addUsd(result.totalCostUsd, costUsdRemaining)
    }
  }

  return result
}

// =============================================================================
// RESULT CLASSES
// =============================================================================

export class FIFOResult {
  realizedPnlAssets: BigInt = BigInt.zero()
  realizedPnlUsd: BigDecimal | null = BigDecimal.zero()
  costBasisConsumedAssets: BigInt = BigInt.zero()
  costBasisConsumedUsd: BigDecimal | null = BigDecimal.zero()
}

export class CostBasisResult {
  totalCostAssets: BigInt = BigInt.zero()
  totalCostUsd: BigDecimal | null = BigDecimal.zero()
}
