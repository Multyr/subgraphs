import { BigInt, ethereum, Address, Bytes } from "@graphprotocol/graph-ts"
import { Transaction } from "../../../generated/schema"

export enum TransactionType {
  DEPOSIT,
  WITHDRAW,
  TRANSFER,
  CLAIM
}

export function createTransaction(
  hash: Bytes,
  type: string,
  vault: string,
  user: Address,
  assets: BigInt,
  shares: BigInt,
  block: ethereum.Block,
  from: Address | null,
  to: Address | null
): Transaction {
  let id = hash.toHexString() + "-" + block.logIndex.toString()
  let tx = new Transaction(id)

  tx.hash = hash
  tx.type = type
  tx.vault = vault
  tx.user = user
  tx.assets = assets
  tx.shares = shares
  tx.timestamp = block.timestamp
  tx.blockNumber = block.number
  tx.logIndex = BigInt.fromI32(block.logIndex.toI32())
  if (from) { tx.from = from }
  if (to) { tx.to = to }

  tx.save()
  return tx
}
