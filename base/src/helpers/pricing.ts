import { Address, BigInt, BigDecimal, ethereum, dataSource } from "@graphprotocol/graph-ts"
import { TokenPrice, ChainlinkFeed, TokenPriceDayData } from "../../generated/schema"
import { ChainlinkAggregator } from "../../generated/templates/VaultTemplate/ChainlinkAggregator"
import {
  ZERO_BI,
  ZERO_BD,
  ONE_E18_BD,
  DEFAULT_USDC_PRICE,
  CHAINLINK_USDC_USD_ARBITRUM,
  CHAINLINK_USDC_USD_ETHEREUM,
  CHAINLINK_USDC_USD_BASE,
  USDC_ARBITRUM,
  USDC_ETHEREUM,
  USDC_BASE,
  SECONDS_PER_DAY,
  getChainIdFromNetwork,
  safeDiv
} from "./constants"

// =============================================================================
// PRICE RESULT CLASS
// =============================================================================

export class PriceResult {
  price: BigDecimal | null = null
  status: string = "MISSING"  // VALID, STALE, FALLBACK, MISSING
  stalenessSeconds: BigInt = BigInt.zero()
}

// Staleness threshold: 24 hours — aligned with the Chainlink USDC/USD heartbeat.
const STALENESS_THRESHOLD = BigInt.fromI32(86400)

// =============================================================================
// SG-4 — ChainlinkFeed registry (replaces hardcoded per-chain resolution)
// =============================================================================

function feedId(token: Address, chainId: i32): string {
  return token.toHexString().toLowerCase() + "-" + chainId.toString()
}

function isUSDC(token: Address, network: string): boolean {
  if (network == "arbitrum-one") return token.equals(USDC_ARBITRUM)
  if (network == "mainnet") return token.equals(USDC_ETHEREUM)
  if (network == "base") return token.equals(USDC_BASE)
  return false
}

function usdcFeedAddress(network: string): Address {
  if (network == "arbitrum-one") return CHAINLINK_USDC_USD_ARBITRUM
  if (network == "mainnet") return CHAINLINK_USDC_USD_ETHEREUM
  if (network == "base") return CHAINLINK_USDC_USD_BASE
  return Address.zero()
}

/**
 * Upsert a ChainlinkFeed registry entry. Reads decimals/description from the
 * aggregator when reachable. Exported so event handlers can register feeds as
 * oracle config changes are observed on-chain.
 */
export function registerChainlinkFeed(
  token: Address,
  chainId: i32,
  feedAddress: Address,
  block: ethereum.Block
): ChainlinkFeed {
  let id = feedId(token, chainId)
  let feed = ChainlinkFeed.load(id)
  if (feed == null) {
    feed = new ChainlinkFeed(id)
    feed.token = token
    feed.chainId = chainId
    feed.decimals = 8
    feed.description = ""
    feed.isActive = true
  }
  feed.feedAddress = feedAddress

  let agg = ChainlinkAggregator.bind(feedAddress)
  let decRes = agg.try_decimals()
  if (!decRes.reverted) feed.decimals = decRes.value
  let descRes = agg.try_description()
  if (!descRes.reverted) feed.description = descRes.value

  feed.updatedAt = block.timestamp
  feed.save()
  return feed
}

/**
 * Resolve token -> ChainlinkFeed from the registry. USDC is seeded lazily from
 * the hardcoded per-chain constants the old code used, so behaviour is
 * unchanged for USDC vaults while non-USDC assets now resolve to null (and
 * therefore MISSING) instead of a silent zero.
 */
function resolveFeed(token: Address, chainId: i32, block: ethereum.Block): ChainlinkFeed | null {
  let feed = ChainlinkFeed.load(feedId(token, chainId))
  if (feed !== null) return feed

  let network = dataSource.network()
  if (isUSDC(token, network)) {
    let addr = usdcFeedAddress(network)
    if (!addr.equals(Address.zero())) {
      return registerChainlinkFeed(token, chainId, addr, block)
    }
  }
  return null
}

// =============================================================================
// CHAINLINK PRICE FETCHING
// =============================================================================

export function fetchChainlinkPriceWithStatus(
  feedAddress: Address,
  currentTimestamp: BigInt
): PriceResult {
  let result = new PriceResult()
  let contract = ChainlinkAggregator.bind(feedAddress)

  let latestRoundResult = contract.try_latestRoundData()
  if (latestRoundResult.reverted) {
    result.status = "MISSING"
    return result
  }

  let answer = latestRoundResult.value.value1
  let updatedAt = latestRoundResult.value.value3

  if (answer.le(ZERO_BI)) {
    result.status = "MISSING"
    return result
  }

  let age = currentTimestamp.minus(updatedAt)
  if (age.lt(ZERO_BI)) age = ZERO_BI
  result.stalenessSeconds = age
  let decimalsResult = contract.try_decimals()
  let feedDecimals = decimalsResult.reverted ? 8 : decimalsResult.value
  let scale = BigDecimal.fromString("1")
  for (let i: i32 = 0; i < feedDecimals; i++) {
    scale = scale.times(BigDecimal.fromString("10"))
  }
  result.price = answer.toBigDecimal().div(scale)
  result.status = age.gt(STALENESS_THRESHOLD) ? "STALE" : "VALID"
  return result
}

/** Legacy: raw price with no status. */
export function fetchChainlinkPrice(feedAddress: Address): BigDecimal {
  let contract = ChainlinkAggregator.bind(feedAddress)
  let latestRoundResult = contract.try_latestRoundData()
  if (latestRoundResult.reverted) return ZERO_BD
  let answer = latestRoundResult.value.value1
  if (answer.le(ZERO_BI)) return ZERO_BD
  let decimalsResult = contract.try_decimals()
  let feedDecimals = decimalsResult.reverted ? 8 : decimalsResult.value
  let scale = BigDecimal.fromString("1")
  for (let i: i32 = 0; i < feedDecimals; i++) {
    scale = scale.times(BigDecimal.fromString("10"))
  }
  return answer.toBigDecimal().div(scale)
}

// =============================================================================
// TOKEN PRICE MANAGEMENT
// =============================================================================

export function getOrCreateTokenPrice(
  token: Address,
  chainId: i32,
  symbol: string,
  decimals: i32
): TokenPrice {
  let id = token.toHexString().toLowerCase() + "-" + chainId.toString()
  let tokenPrice = TokenPrice.load(id)
  if (tokenPrice == null) {
    tokenPrice = new TokenPrice(id)
    tokenPrice.token = token
    tokenPrice.chainId = chainId
    tokenPrice.symbol = symbol
    tokenPrice.decimals = decimals
    tokenPrice.priceUsd = null
    tokenPrice.source = "NONE"
    tokenPrice.status = "MISSING"
    tokenPrice.feed = null
    tokenPrice.stalenessSeconds = ZERO_BI
    tokenPrice.updatedAt = ZERO_BI
    tokenPrice.updatedAtBlock = ZERO_BI
  }
  return tokenPrice
}

/**
 * Update the TokenPrice entity from the feed registry.
 * Priority: registry feed -> USDC $1 fallback -> MISSING (never a silent zero).
 */
export function updateTokenPriceWithStatus(
  token: Address,
  chainId: i32,
  block: ethereum.Block
): PriceResult {
  let id = token.toHexString().toLowerCase() + "-" + chainId.toString()
  let result = new PriceResult()

  let feed = resolveFeed(token, chainId, block)
  if (feed !== null) {
    let chainlinkResult = fetchChainlinkPriceWithStatus(
      Address.fromBytes(feed.feedAddress),
      block.timestamp
    )
    let chainlinkPrice = chainlinkResult.price
    if (chainlinkPrice !== null && chainlinkPrice.gt(ZERO_BD)) {
      writeTokenPrice(id, chainlinkPrice, "CHAINLINK", chainlinkResult.status, feed.id, chainlinkResult.stalenessSeconds, block)
      snapshotTokenPriceDayData(id, token, chainId, chainlinkPrice, chainlinkResult.status, "CHAINLINK", block)
      return chainlinkResult
    }
  }

  // USDC fallback: $1.00
  if (isUSDC(token, dataSource.network())) {
    result.price = DEFAULT_USDC_PRICE
    result.status = "FALLBACK"
    writeTokenPrice(id, DEFAULT_USDC_PRICE, "FALLBACK", "FALLBACK", null, ZERO_BI, block)
    snapshotTokenPriceDayData(id, token, chainId, DEFAULT_USDC_PRICE, "FALLBACK", "FALLBACK", block)
    return result
  }

  // No feed resolvable and not USDC -> MISSING, propagate "unknown" not zero.
  result.price = null
  result.status = "MISSING"
  writeTokenPrice(id, null, "NONE", "MISSING", null, ZERO_BI, block)
  snapshotTokenPriceDayData(id, token, chainId, null, "MISSING", "NONE", block)
  return result
}

function writeTokenPrice(
  id: string,
  price: BigDecimal | null,
  source: string,
  status: string,
  feedId: string | null,
  stalenessSeconds: BigInt,
  block: ethereum.Block
): void {
  let tp = TokenPrice.load(id)
  if (tp == null) return
  tp.priceUsd = price
  tp.source = source
  tp.status = status
  tp.feed = feedId
  tp.stalenessSeconds = stalenessSeconds
  tp.updatedAt = block.timestamp
  tp.updatedAtBlock = block.number
  tp.save()
}

// =============================================================================
// SG-14 — TokenPriceDayData
// =============================================================================

function snapshotTokenPriceDayData(
  tokenPriceId: string,
  token: Address,
  chainId: i32,
  price: BigDecimal | null,
  status: string,
  source: string,
  block: ethereum.Block
): void {
  let dayId = block.timestamp.toI32() / SECONDS_PER_DAY
  let id = token.toHexString().toLowerCase() + "-" + chainId.toString() + "-" + dayId.toString()

  let d = TokenPriceDayData.load(id)
  if (d == null) {
    d = new TokenPriceDayData(id)
    d.dayId = dayId
    d.token = token
    d.chainId = chainId
    d.tokenPrice = tokenPriceId
    d.samples = 0
    d.minPriceUsd = price
    d.maxPriceUsd = price
  }

  d.priceUsd = price
  d.status = status
  d.source = source
  d.samples = d.samples + 1
  if (price !== null) {
    let minPrice = d.minPriceUsd
    let maxPrice = d.maxPriceUsd
    if (minPrice === null || price.lt(minPrice)) d.minPriceUsd = price
    if (maxPrice === null || price.gt(maxPrice)) d.maxPriceUsd = price
  }
  d.save()
}

// =============================================================================
// LEGACY / CONVENIENCE
// =============================================================================

export function updateTokenPrice(token: Address, chainId: i32, block: ethereum.Block): BigDecimal | null {
  return updateTokenPriceWithStatus(token, chainId, block).price
}

export function getTokenPriceUsd(token: Address, chainId: i32, block: ethereum.Block): BigDecimal | null {
  let id = token.toHexString().toLowerCase() + "-" + chainId.toString()
  let tokenPrice = TokenPrice.load(id)
  let staleness = BigInt.fromI32(300) // 5 minutes
  if (tokenPrice != null && block.timestamp.minus(tokenPrice.updatedAt).lt(staleness)) {
    return tokenPrice.priceUsd
  }
  return updateTokenPrice(token, chainId, block)
}

export function convertToUsd(
  amount: BigInt,
  assetDecimals: i32,
  priceUsd: BigDecimal | null
): BigDecimal | null {
  if (priceUsd === null) return null
  if (amount.equals(ZERO_BI) || priceUsd.equals(ZERO_BD)) {
    return ZERO_BD
  }
  let decimalsScale = BigDecimal.fromString("1")
  for (let i = 0; i < assetDecimals; i++) {
    decimalsScale = decimalsScale.times(BigDecimal.fromString("10"))
  }
  return amount.toBigDecimal().div(decimalsScale).times(priceUsd)
}

/** Legacy no-op-safe helper retained for callers; now delegates to the registry. */
export function initializeChainlinkFeed(
  token: Address,
  chainId: i32,
  feedAddress: Address,
  decimals: i32,
  description: string
): void {
  let id = feedId(token, chainId)
  let feed = ChainlinkFeed.load(id)
  if (feed == null) {
    feed = new ChainlinkFeed(id)
    feed.token = token
    feed.chainId = chainId
    feed.feedAddress = feedAddress
    feed.decimals = decimals
    feed.description = description
    feed.isActive = true
    feed.updatedAt = ZERO_BI
    feed.save()
  }
}

export function hasChainlinkFeed(token: Address): boolean {
  return isUSDC(token, dataSource.network())
}
