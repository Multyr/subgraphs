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
// CHAINLINK PRICE FETCHING
// =============================================================================

/**
 * Get Chainlink feed address for a token on current chain
 */
export function getChainlinkFeedForToken(token: Address): Address | null {
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

  return null
}

/**
 * Fetch price from Chainlink oracle
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
    tokenPrice.updatedAt = ZERO_BI
    tokenPrice.updatedAtBlock = ZERO_BI
  }

  return tokenPrice
}

/**
 * Update token price from all available sources
 * Priority: Chainlink > Config > Default
 */
export function updateTokenPrice(
  token: Address,
  chainId: i32,
  block: ethereum.Block
): BigDecimal {
  let network = dataSource.network()

  // Try Chainlink first
  let feedAddress = getChainlinkFeedForToken(token)
  if (feedAddress != null) {
    let price = fetchChainlinkPrice(feedAddress)
    if (price.gt(ZERO_BD)) {
      // Update TokenPrice entity
      let tokenPrice = TokenPrice.load(token.toHexString().toLowerCase() + "-" + chainId.toString())
      if (tokenPrice != null) {
        tokenPrice.priceUsd = price
        tokenPrice.source = "CHAINLINK"
        tokenPrice.updatedAt = block.timestamp
        tokenPrice.updatedAtBlock = block.number
        tokenPrice.save()
      }
      return price
    }
  }

  // Fallback: USDC is always $1.00
  if (isUSDC(token, network)) {
    return DEFAULT_USDC_PRICE
  }

  // No price available
  return ZERO_BD
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
