import { BigDecimal } from "@graphprotocol/graph-ts"

// Missing price data is represented as null, never as a numeric zero. These
// helpers make that state contagious through every USD aggregate.
export function addUsd(
  left: BigDecimal | null,
  right: BigDecimal | null
): BigDecimal | null {
  if (left === null || right === null) return null
  return left.plus(right)
}

export function subtractUsd(
  left: BigDecimal | null,
  right: BigDecimal | null
): BigDecimal | null {
  if (left === null || right === null) return null
  return left.minus(right)
}
