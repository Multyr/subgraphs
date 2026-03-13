import { Address, BigInt, BigDecimal, ethereum, dataSource } from "@graphprotocol/graph-ts"
import { TokenPrice, ChainlinkFeed } from "../../generated/schema"
import { ChainlinkAggregator } from "../../generated/templates/VaultTemplate/ChainlinkAggregator"
import {
  ZERO_BI,
  ZERO_BD,
  ONE_E8_BD,
  ONE_E18_BD,
  DEFAULT_USDC_PRICE,
  CHAINLINK_USDC_USD_ARBITRUM,
  CHAINLINK_USDC_USD_ETHEREUM,
  CHAINLINK_USDC_USD_BASE,
  USDC_ARBITRUM,
  USDC_ETHEREUM,
  USDC_BASE,
  getChainIdFromNetwork,
  safeDiv
} from "./constants"

// =============================================================================
// PRICE RESULT CLASS
// =============================================================================

export class PriceResult {
  price: BigDecimal = BigDecimal.zero()
  status: string = "MISSING"  // VALID, STALE, FALLBACK, MISSING
}

// Staleness threshold: 24 hours (86400 seconds)
// Aligned with Chainlink USDC/USD heartbeat on Arbitrum
const STALENESS_THRESHOLD = BigInt.fromI32(86400)

// =============================================================================
// CHAINLINK PRICE FETCHING
// =============================================================================

/**
 * Check if token has a Chainlink feed on current chain
 */
export function hasChainlinkFeed(token: Address): boolean {
  let network = dataSource.network()

  if (network == "arbitrum-one" && token.equals(USDC_ARBITRUM)) {
    return true
  }
  if (network == "mainnet" && token.equals(USDC_ETHEREUM)) {
    return true
  }
  if (network == "base" && token.equals(USDC_BASE)) {
    return true
  }
  return false
}

/**
 * Get Chainlink feed address for a token on current chain
 */
export function getChainlinkFeedForToken(token: Address): Address {
  let network = dataSource.network()

  // Check if token is USDC on this network
  if (network == "arbitrum-one" && token.equals(USDC_ARBITRUM)) {
    return CHAINLINK_USDC_USD_ARBITRUM
  }
  if (network == "mainnet" && token.equals(USDC_ETHEREUM)) {
    return CHAINLINK_USDC_USD_ETHEREUM
  }
  if (network == "base" && token.equals(USDC_BASE)) {
    return CHAINLINK_USDC_USD_BASE
  }

  return Address.zero()
}

/**
 * Fetch price from Chainlink oracle with staleness check
 * Returns PriceResult with price and status
 */
export function fetchChainlinkPriceWithStatus(feedAddress: Address, currentTimestamp: BigInt): PriceResult {
  let result = new PriceResult()
  let contract = ChainlinkAggregator.bind(feedAddress)

  let latestRoundResult = contract.try_latestRoundData()
  if (latestRoundResult.reverted) {
    result.status = "MISSING"
    return result
  }

  let answer = latestRoundResult.value.value1 // answer is at index 1
  let updatedAt = latestRoundResult.value.value3 // updatedAt is at index 3

  if (answer.le(ZERO_BI)) {
    result.status = "MISSING"
    return result
  }

  // Check staleness (1 hour threshold)
  let age = currentTimestamp.minus(updatedAt)
  if (age.gt(STALENESS_THRESHOLD)) {
    result.price = answer.toBigDecimal().div(ONE_E8_BD)
    result.status = "STALE"
    return result
  }

  // Valid price
  result.price = answer.toBigDecimal().div(ONE_E8_BD)
  result.status = "VALID"
  return result
}

/**
 * Fetch price from Chainlink oracle (legacy, for backward compatibility)
 * Returns price in USD with 8 decimals (Chainlink standard)
 */
export function fetchChainlinkPrice(feedAddress: Address): BigDecimal {
  let contract = ChainlinkAggregator.bind(feedAddress)

  let latestRoundResult = contract.try_latestRoundData()
  if (latestRoundResult.reverted) {
    return ZERO_BD
  }

  let answer = latestRoundResult.value.value1 // answer is at index 1
  if (answer.le(ZERO_BI)) {
    return ZERO_BD
  }

  // Chainlink returns 8 decimals for USD pairs
  return answer.toBigDecimal().div(ONE_E8_BD)
}

// =============================================================================
// TOKEN PRICE MANAGEMENT
// =============================================================================

/**
 * Get or create TokenPrice entity
 */
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
    tokenPrice.priceUsd = ZERO_BD
    tokenPrice.source = "NONE"
    tokenPrice.status = "MISSING"
    tokenPrice.updatedAt = ZERO_BI
    tokenPrice.updatedAtBlock = ZERO_BI
  }

  return tokenPrice
}

/**
 * Update token price from all available sources
 * Priority: Chainlink > Config > Default
 * Returns PriceResult with price and status
 */
export function updateTokenPriceWithStatus(
  token: Address,
  chainId: i32,
  block: ethereum.Block
): PriceResult {
  let network = dataSource.network()
  let result = new PriceResult()

  // Try Chainlink first
  if (hasChainlinkFeed(token)) {
    let feedAddress = getChainlinkFeedForToken(token)
    let chainlinkResult = fetchChainlinkPriceWithStatus(feedAddress, block.timestamp)

    if (chainlinkResult.price.gt(ZERO_BD)) {
      // Update TokenPrice entity
      let tokenPrice = TokenPrice.load(token.toHexString().toLowerCase() + "-" + chainId.toString())
      if (tokenPrice != null) {
        tokenPrice.priceUsd = chainlinkResult.price
        tokenPrice.source = "CHAINLINK"
        tokenPrice.status = chainlinkResult.status
        tokenPrice.updatedAt = block.timestamp
        tokenPrice.updatedAtBlock = block.number
        tokenPrice.save()
      }
      return chainlinkResult
    }
  }

  // Fallback: USDC is always $1.00
  if (isUSDC(token, network)) {
    result.price = DEFAULT_USDC_PRICE
    result.status = "FALLBACK"

    // Update TokenPrice entity with fallback
    let tokenPrice = TokenPrice.load(token.toHexString().toLowerCase() + "-" + chainId.toString())
    if (tokenPrice != null) {
      tokenPrice.priceUsd = DEFAULT_USDC_PRICE
      tokenPrice.source = "FALLBACK"
      tokenPrice.status = "FALLBACK"
      tokenPrice.updatedAt = block.timestamp
      tokenPrice.updatedAtBlock = block.number
      tokenPrice.save()
    }
    return result
  }

  // No price available - mark as MISSING
  result.price = ZERO_BD
  result.status = "MISSING"

  let tokenPrice = TokenPrice.load(token.toHexString().toLowerCase() + "-" + chainId.toString())
  if (tokenPrice != null) {
    tokenPrice.status = "MISSING"
    tokenPrice.save()
  }

  return result
}

/**
 * Update token price from all available sources (legacy)
 * Priority: Chainlink > Config > Default
 */
export function updateTokenPrice(
  token: Address,
  chainId: i32,
  block: ethereum.Block
): BigDecimal {
  let result = updateTokenPriceWithStatus(token, chainId, block)
  return result.price
}

/**
 * Check if token is USDC on current network
 */
function isUSDC(token: Address, network: string): boolean {
  if (network == "arbitrum-one") return token.equals(USDC_ARBITRUM)
  if (network == "mainnet") return token.equals(USDC_ETHEREUM)
  if (network == "base") return token.equals(USDC_BASE)
  return false
}

/**
 * Get current USD price for a token
 * First checks cache, then fetches if stale (>5 min)
 */
export function getTokenPriceUsd(
  token: Address,
  chainId: i32,
  block: ethereum.Block
): BigDecimal {
  let id = token.toHexString().toLowerCase() + "-" + chainId.toString()
  let tokenPrice = TokenPrice.load(id)

  // Check if we have a recent price (less than 5 minutes old)
  let staleness = BigInt.fromI32(300) // 5 minutes
  if (tokenPrice != null && block.timestamp.minus(tokenPrice.updatedAt).lt(staleness)) {
    return tokenPrice.priceUsd
  }

  // Fetch fresh price
  return updateTokenPrice(token, chainId, block)
}

/**
 * Convert asset amount to USD value
 */
export function convertToUsd(
  amount: BigInt,
  assetDecimals: i32,
  priceUsd: BigDecimal
): BigDecimal {
  if (amount.equals(ZERO_BI) || priceUsd.equals(ZERO_BD)) {
    return ZERO_BD
  }

  let decimalsScale = BigDecimal.fromString("1")
  for (let i = 0; i < assetDecimals; i++) {
    decimalsScale = decimalsScale.times(BigDecimal.fromString("10"))
  }

  return amount.toBigDecimal().div(decimalsScale).times(priceUsd)
}

// =============================================================================
// CHAINLINK FEED CONFIGURATION
// =============================================================================

/**
 * Initialize Chainlink feed configuration for a token
 */
export function initializeChainlinkFeed(
  token: Address,
  chainId: i32,
  feedAddress: Address,
  decimals: i32,
  description: string
): void {
  let id = token.toHexString().toLowerCase() + "-" + chainId.toString()
  let feed = ChainlinkFeed.load(id)

  if (feed == null) {
    feed = new ChainlinkFeed(id)
    feed.token = token
    feed.chainId = chainId
    feed.feedAddress = feedAddress
    feed.decimals = decimals
    feed.description = description
    feed.isActive = true
    feed.save()
  }
}
