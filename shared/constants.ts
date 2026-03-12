import { BigInt, BigDecimal, Address } from "@graphprotocol/graph-ts"

// =============================================================================
// NUMERIC CONSTANTS
// =============================================================================

export const ZERO_BI = BigInt.zero()
export const ONE_BI = BigInt.fromI32(1)
export const TEN_BI = BigInt.fromI32(10)

export const ZERO_BD = BigDecimal.zero()
export const ONE_BD = BigDecimal.fromString("1")
export const HUNDRED_BD = BigDecimal.fromString("100")

// Scaling factors
export const ONE_E6 = BigInt.fromI32(10).pow(6)        // USDC decimals
export const ONE_E8 = BigInt.fromI32(10).pow(8)        // Chainlink decimals
export const ONE_E18 = BigInt.fromI32(10).pow(18)      // Share price scaling
export const ONE_E27 = BigInt.fromI32(10).pow(27)      // Ray (Aave)

export const ONE_E6_BD = BigDecimal.fromString("1000000")
export const ONE_E8_BD = BigDecimal.fromString("100000000")
export const ONE_E18_BD = BigDecimal.fromString("1000000000000000000")

// Time constants
export const SECONDS_PER_DAY = 86400
export const SECONDS_PER_YEAR = 31536000
export const DAYS_PER_YEAR_BD = BigDecimal.fromString("365")

// Basis points
export const BPS_DIVISOR = BigInt.fromI32(10000)
export const BPS_DIVISOR_BD = BigDecimal.fromString("10000")

// =============================================================================
// CHAIN IDs
// =============================================================================

export const CHAIN_ID_ETHEREUM = 1
export const CHAIN_ID_ARBITRUM = 42161
export const CHAIN_ID_BASE = 8453

// =============================================================================
// ADDRESS CONSTANTS
// =============================================================================

export const ZERO_ADDRESS = Address.zero()
export const ZERO_ADDRESS_STRING = "0x0000000000000000000000000000000000000000"

// =============================================================================
// CHAINLINK FEED ADDRESSES BY CHAIN
// =============================================================================

// Arbitrum USDC/USD Chainlink Feed
export const CHAINLINK_USDC_USD_ARBITRUM = Address.fromString(
  "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3"
)

// Ethereum USDC/USD Chainlink Feed
export const CHAINLINK_USDC_USD_ETHEREUM = Address.fromString(
  "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6"
)

// Base USDC/USD Chainlink Feed
export const CHAINLINK_USDC_USD_BASE = Address.fromString(
  "0x7e860098F58bBFC8648a4311b374B1D669a2bc6B"
)

// =============================================================================
// USDC ADDRESSES BY CHAIN
// =============================================================================

export const USDC_ARBITRUM = Address.fromString(
  "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
)

export const USDC_ETHEREUM = Address.fromString(
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
)

export const USDC_BASE = Address.fromString(
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
)

// =============================================================================
// DEFAULT STABLECOIN PRICE (fallback)
// =============================================================================

// USDC is assumed to be $1.00 when oracle is unavailable
export const DEFAULT_USDC_PRICE = BigDecimal.fromString("1.0")

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function getChainIdFromNetwork(network: string): i32 {
  if (network == "mainnet") return CHAIN_ID_ETHEREUM
  if (network == "arbitrum-one") return CHAIN_ID_ARBITRUM
  if (network == "base") return CHAIN_ID_BASE
  return 0 // Unknown
}

export function exponentToBigDecimal(decimals: i32): BigDecimal {
  let bd = ONE_BD
  for (let i = 0; i < decimals; i++) {
    bd = bd.times(BigDecimal.fromString("10"))
  }
  return bd
}

export function convertTokenToDecimal(amount: BigInt, decimals: i32): BigDecimal {
  if (decimals == 0) {
    return amount.toBigDecimal()
  }
  return amount.toBigDecimal().div(exponentToBigDecimal(decimals))
}

export function safeDiv(a: BigDecimal, b: BigDecimal): BigDecimal {
  if (b.equals(ZERO_BD)) {
    return ZERO_BD
  }
  return a.div(b)
}
