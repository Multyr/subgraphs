import {
  test,
  assert,
  clearStore,
  newMockEvent
} from "matchstick-as/assembly/index"
import { Address, BigInt, ethereum, Bytes } from "@graphprotocol/graph-ts"

import { handleUpkeepPerformed } from "../src/mappings"
import { UpkeepPerformed } from "../generated/VaultUpkeep/VaultUpkeep"
import { UpkeepAction } from "../generated/schema"

// Op enum values from VaultUpkeep contract
const OP_NONE: i32 = 0
const OP_SETTLE: i32 = 1
const OP_CRYSTALLIZE: i32 = 2
const OP_REBALANCE: i32 = 3
const OP_REALIZE: i32 = 4

function createUpkeepPerformedEvent(
  upkeep: Address,
  op: i32,
  arg: BigInt,
  success: boolean,
  txHash: Bytes,
  logIndex: BigInt,
  timestamp: BigInt,
  blockNumber: BigInt
): UpkeepPerformed {
  const ev = changetype<UpkeepPerformed>(newMockEvent())
  ev.address = upkeep
  ev.transaction.hash = txHash
  ev.logIndex = logIndex
  ev.block.timestamp = timestamp
  ev.block.number = blockNumber
  ev.parameters = []
  ev.parameters.push(new ethereum.EventParam("op", ethereum.Value.fromI32(op)))
  ev.parameters.push(new ethereum.EventParam("arg", ethereum.Value.fromUnsignedBigInt(arg)))
  ev.parameters.push(new ethereum.EventParam("success", ethereum.Value.fromBoolean(success)))
  return ev
}

test("handleUpkeepPerformed creates UpkeepAction with success=true", () => {
  clearStore()

  const upkeep = Address.fromString("0x1000000000000000000000000000000000000001")
  const txHash = Bytes.fromHexString("0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890")
  const logIndex = BigInt.fromI32(0)
  const timestamp = BigInt.fromI32(1700000000)
  const blockNumber = BigInt.fromI32(12345678)
  const arg = BigInt.fromI32(25) // maxClaims for SETTLE

  const ev = createUpkeepPerformedEvent(
    upkeep,
    OP_SETTLE,
    arg,
    true, // success
    txHash,
    logIndex,
    timestamp,
    blockNumber
  )
  handleUpkeepPerformed(ev)

  const id = txHash.toHex() + "-" + logIndex.toString()
  assert.entityCount("UpkeepAction", 1)
  assert.fieldEquals("UpkeepAction", id, "op", OP_SETTLE.toString())
  assert.fieldEquals("UpkeepAction", id, "arg", arg.toString())
  assert.fieldEquals("UpkeepAction", id, "success", "true")
  assert.fieldEquals("UpkeepAction", id, "timestamp", timestamp.toString())
  assert.fieldEquals("UpkeepAction", id, "blockNumber", blockNumber.toString())
  assert.fieldEquals("UpkeepAction", id, "upkeep", upkeep.toHexString())
})

test("handleUpkeepPerformed creates UpkeepAction with success=false (REBALANCE failure)", () => {
  clearStore()

  const upkeep = Address.fromString("0x1000000000000000000000000000000000000001")
  const txHash = Bytes.fromHexString("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef")
  const logIndex = BigInt.fromI32(1)
  const timestamp = BigInt.fromI32(1700001000)
  const blockNumber = BigInt.fromI32(12345700)
  const arg = BigInt.fromI32(0) // no arg for REBALANCE

  const ev = createUpkeepPerformedEvent(
    upkeep,
    OP_REBALANCE,
    arg,
    false, // success = false (rebalance failed)
    txHash,
    logIndex,
    timestamp,
    blockNumber
  )
  handleUpkeepPerformed(ev)

  const id = txHash.toHex() + "-" + logIndex.toString()
  assert.entityCount("UpkeepAction", 1)
  assert.fieldEquals("UpkeepAction", id, "op", OP_REBALANCE.toString())
  assert.fieldEquals("UpkeepAction", id, "arg", "0")
  assert.fieldEquals("UpkeepAction", id, "success", "false")
})

test("handleUpkeepPerformed handles all Op types", () => {
  clearStore()

  const upkeep = Address.fromString("0x1000000000000000000000000000000000000001")
  const baseTimestamp = BigInt.fromI32(1700000000)
  const baseBlock = BigInt.fromI32(12345678)

  // SETTLE
  let ev = createUpkeepPerformedEvent(
    upkeep,
    OP_SETTLE,
    BigInt.fromI32(25),
    true,
    Bytes.fromHexString("0x0000000000000000000000000000000000000000000000000000000000000001"),
    BigInt.fromI32(0),
    baseTimestamp,
    baseBlock
  )
  handleUpkeepPerformed(ev)

  // CRYSTALLIZE
  ev = createUpkeepPerformedEvent(
    upkeep,
    OP_CRYSTALLIZE,
    BigInt.fromI32(0),
    true,
    Bytes.fromHexString("0x0000000000000000000000000000000000000000000000000000000000000002"),
    BigInt.fromI32(0),
    baseTimestamp.plus(BigInt.fromI32(100)),
    baseBlock.plus(BigInt.fromI32(1))
  )
  handleUpkeepPerformed(ev)

  // REBALANCE
  ev = createUpkeepPerformedEvent(
    upkeep,
    OP_REBALANCE,
    BigInt.fromI32(0),
    true,
    Bytes.fromHexString("0x0000000000000000000000000000000000000000000000000000000000000003"),
    BigInt.fromI32(0),
    baseTimestamp.plus(BigInt.fromI32(200)),
    baseBlock.plus(BigInt.fromI32(2))
  )
  handleUpkeepPerformed(ev)

  // REALIZE
  ev = createUpkeepPerformedEvent(
    upkeep,
    OP_REALIZE,
    BigInt.fromString("1000000000000"), // max amount
    true,
    Bytes.fromHexString("0x0000000000000000000000000000000000000000000000000000000000000004"),
    BigInt.fromI32(0),
    baseTimestamp.plus(BigInt.fromI32(300)),
    baseBlock.plus(BigInt.fromI32(3))
  )
  handleUpkeepPerformed(ev)

  assert.entityCount("UpkeepAction", 4)

  // Verify each op type was recorded correctly
  assert.fieldEquals(
    "UpkeepAction",
    "0x0000000000000000000000000000000000000000000000000000000000000001-0",
    "op",
    OP_SETTLE.toString()
  )
  assert.fieldEquals(
    "UpkeepAction",
    "0x0000000000000000000000000000000000000000000000000000000000000002-0",
    "op",
    OP_CRYSTALLIZE.toString()
  )
  assert.fieldEquals(
    "UpkeepAction",
    "0x0000000000000000000000000000000000000000000000000000000000000003-0",
    "op",
    OP_REBALANCE.toString()
  )
  assert.fieldEquals(
    "UpkeepAction",
    "0x0000000000000000000000000000000000000000000000000000000000000004-0",
    "op",
    OP_REALIZE.toString()
  )
})

test("Multiple UpkeepPerformed events in same tx have unique IDs", () => {
  clearStore()

  const upkeep = Address.fromString("0x1000000000000000000000000000000000000001")
  const txHash = Bytes.fromHexString("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
  const timestamp = BigInt.fromI32(1700000000)
  const blockNumber = BigInt.fromI32(12345678)

  // First event in tx (logIndex = 0)
  let ev1 = createUpkeepPerformedEvent(
    upkeep,
    OP_REBALANCE,
    BigInt.fromI32(0),
    true,
    txHash,
    BigInt.fromI32(0),
    timestamp,
    blockNumber
  )
  handleUpkeepPerformed(ev1)

  // Second event in same tx (logIndex = 1)
  let ev2 = createUpkeepPerformedEvent(
    upkeep,
    OP_SETTLE,
    BigInt.fromI32(50),
    true,
    txHash,
    BigInt.fromI32(1),
    timestamp,
    blockNumber
  )
  handleUpkeepPerformed(ev2)

  assert.entityCount("UpkeepAction", 2)

  // Verify both have unique IDs based on logIndex
  const id1 = txHash.toHex() + "-0"
  const id2 = txHash.toHex() + "-1"
  assert.fieldEquals("UpkeepAction", id1, "op", OP_REBALANCE.toString())
  assert.fieldEquals("UpkeepAction", id2, "op", OP_SETTLE.toString())
})
