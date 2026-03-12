import {
  test,
  assert,
  clearStore,
  newMockEvent,
  createMockedFunction
} from "matchstick-as/assembly/index"
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts"

import { handleVaultCreated, handleDeposit, handleWithdraw, handleTransfer } from "../src/mappings"
import { VaultCreated } from "../../generated/VaultFactory/VaultFactory"
import { Deposit, Withdraw, Transfer } from "../../generated/templates/VaultTemplate/Vault"

function createVaultCreatedEvent(
  factory: Address,
  vaultId: BigInt,
  vault: Address,
  asset: Address,
  name: string,
  symbol: string,
  owner: Address,
  treasury: Address
): VaultCreated {
  const ev = changetype<VaultCreated>(newMockEvent())
  ev.address = factory
  ev.parameters = []
  ev.parameters.push(new ethereum.EventParam("vaultId", ethereum.Value.fromUnsignedBigInt(vaultId)))
  ev.parameters.push(new ethereum.EventParam("vault", ethereum.Value.fromAddress(vault)))
  ev.parameters.push(new ethereum.EventParam("asset", ethereum.Value.fromAddress(asset)))
  ev.parameters.push(new ethereum.EventParam("name", ethereum.Value.fromString(name)))
  ev.parameters.push(new ethereum.EventParam("symbol", ethereum.Value.fromString(symbol)))
  ev.parameters.push(new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner)))
  ev.parameters.push(new ethereum.EventParam("treasury", ethereum.Value.fromAddress(treasury)))
  ev.parameters.push(new ethereum.EventParam("bufferManager", ethereum.Value.fromAddress(Address.zero())))
  ev.parameters.push(new ethereum.EventParam("router", ethereum.Value.fromAddress(Address.zero())))
  ev.parameters.push(new ethereum.EventParam("incentives", ethereum.Value.fromAddress(Address.zero())))
  return ev
}

function createDepositEvent(vault: Address, caller: Address, owner: Address, assets: BigInt, shares: BigInt): Deposit {
  const ev = changetype<Deposit>(newMockEvent())
  ev.address = vault
  ev.parameters = []
  ev.parameters.push(new ethereum.EventParam("caller", ethereum.Value.fromAddress(caller)))
  ev.parameters.push(new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner)))
  ev.parameters.push(new ethereum.EventParam("assets", ethereum.Value.fromUnsignedBigInt(assets)))
  ev.parameters.push(new ethereum.EventParam("shares", ethereum.Value.fromUnsignedBigInt(shares)))
  return ev
}

function createWithdrawEvent(
  vault: Address,
  caller: Address,
  receiver: Address,
  owner: Address,
  assets: BigInt,
  shares: BigInt
): Withdraw {
  const ev = changetype<Withdraw>(newMockEvent())
  ev.address = vault
  ev.parameters = []
  ev.parameters.push(new ethereum.EventParam("caller", ethereum.Value.fromAddress(caller)))
  ev.parameters.push(new ethereum.EventParam("receiver", ethereum.Value.fromAddress(receiver)))
  ev.parameters.push(new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner)))
  ev.parameters.push(new ethereum.EventParam("assets", ethereum.Value.fromUnsignedBigInt(assets)))
  ev.parameters.push(new ethereum.EventParam("shares", ethereum.Value.fromUnsignedBigInt(shares)))
  return ev
}

function createTransferEvent(vault: Address, from: Address, to: Address, value: BigInt): Transfer {
  const ev = changetype<Transfer>(newMockEvent())
  ev.address = vault
  ev.parameters = []
  ev.parameters.push(new ethereum.EventParam("from", ethereum.Value.fromAddress(from)))
  ev.parameters.push(new ethereum.EventParam("to", ethereum.Value.fromAddress(to)))
  ev.parameters.push(new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value)))
  return ev
}

test("handleVaultCreated creates Vault and Factory", () => {
  clearStore()
  const factory = Address.fromString("0x1000000000000000000000000000000000000001")
  const vault = Address.fromString("0x2000000000000000000000000000000000000002")
  const asset = Address.fromString("0x3000000000000000000000000000000000000003")
  const owner = Address.fromString("0x4000000000000000000000000000000000000004")
  const treasury = Address.fromString("0x5000000000000000000000000000000000000005")

  const ev = createVaultCreatedEvent(factory, BigInt.fromI32(0), vault, asset, "Vault", "v", owner, treasury)
  handleVaultCreated(ev)

  // Vault entity exists
  const vid = vault.toHexString().toLowerCase()
  assert.entityCount("Vault", 1)
  assert.fieldEquals("Vault", vid, "address", vault.toHexString())

  // Factory updated
  const fid = factory.toHexString().toLowerCase()
  assert.entityCount("VaultFactory", 1)
  assert.fieldEquals("VaultFactory", fid, "vaultCount", "1")
})

test("handleDeposit updates position and creates transaction", () => {
  clearStore()
  const factory = Address.fromString("0x1000000000000000000000000000000000000001")
  const vault = Address.fromString("0x2000000000000000000000000000000000000002")
  const user = Address.fromString("0x6000000000000000000000000000000000000006")

  // Seed: create vault via event
  const created = createVaultCreatedEvent(factory, BigInt.fromI32(0), vault, Address.zero(), "Vault", "v", user, user)
  handleVaultCreated(created)

  // Mock vault totals for refreshVaultState
  createMockedFunction(vault, "totalAssets", "totalAssets():(uint256)")
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1_000))])
  createMockedFunction(vault, "totalSupply", "totalSupply():(uint256)")
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100))])

  // Deposit
  const dep = createDepositEvent(vault, user, user, BigInt.fromI32(500), BigInt.fromI32(50))
  handleDeposit(dep)

  const pid = user.toHexString() + "-" + vault.toHexString().toLowerCase()
  assert.entityCount("UserPosition", 1)
  assert.fieldEquals("UserPosition", pid, "shares", "50")
  assert.fieldEquals("UserPosition", pid, "depositedAssets", "500")

  assert.entityCount("Transaction", 1)
})

test("handleWithdraw updates position and creates transaction", () => {
  clearStore()
  const factory = Address.fromString("0x1000000000000000000000000000000000000001")
  const vault = Address.fromString("0x2000000000000000000000000000000000000002")
  const user = Address.fromString("0x6000000000000000000000000000000000000006")

  handleVaultCreated(createVaultCreatedEvent(factory, BigInt.fromI32(0), vault, Address.zero(), "Vault", "v", user, user))

  // Ensure some state
  createMockedFunction(vault, "totalAssets", "totalAssets():(uint256)")
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1_000))])
  createMockedFunction(vault, "totalSupply", "totalSupply():(uint256)")
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100))])

  handleDeposit(createDepositEvent(vault, user, user, BigInt.fromI32(500), BigInt.fromI32(50)))

  const w = createWithdrawEvent(vault, user, user, user, BigInt.fromI32(200), BigInt.fromI32(20))
  handleWithdraw(w)

  const pid = user.toHexString() + "-" + vault.toHexString().toLowerCase()
  assert.fieldEquals("UserPosition", pid, "withdrawnAssets", "200")
  assert.entityCount("Transaction", 2)
})

test("handleTransfer moves shares between positions and creates transaction", () => {
  clearStore()
  const factory = Address.fromString("0x1000000000000000000000000000000000000001")
  const vault = Address.fromString("0x2000000000000000000000000000000000000002")
  const from = Address.fromString("0x6000000000000000000000000000000000000006")
  const to = Address.fromString("0x7000000000000000000000000000000000000007")

  handleVaultCreated(createVaultCreatedEvent(factory, BigInt.fromI32(0), vault, Address.zero(), "Vault", "v", from, from))

  // Seed position for sender
  createMockedFunction(vault, "totalAssets", "totalAssets():(uint256)")
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1_000))])
  createMockedFunction(vault, "totalSupply", "totalSupply():(uint256)")
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100))])
  handleDeposit(createDepositEvent(vault, from, from, BigInt.fromI32(500), BigInt.fromI32(50)))

  const t = createTransferEvent(vault, from, to, BigInt.fromI32(10))
  handleTransfer(t)

  const pidFrom = from.toHexString() + "-" + vault.toHexString().toLowerCase()
  const pidTo = to.toHexString() + "-" + vault.toHexString().toLowerCase()
  assert.fieldEquals("UserPosition", pidFrom, "shares", "40")
  assert.fieldEquals("UserPosition", pidTo, "shares", "10")
  assert.entityCount("Transaction", 2) // deposit + transfer
})

test("VaultDayData.apy updates across days and UserPositionDayData.sharePrice mirrors vault", () => {
  clearStore()
  const factory = Address.fromString("0x1000000000000000000000000000000000000001")
  const vault = Address.fromString("0x2000000000000000000000000000000000000002")
  const user = Address.fromString("0x6000000000000000000000000000000000000006")

  handleVaultCreated(createVaultCreatedEvent(factory, BigInt.fromI32(0), vault, Address.zero(), "Vault", "v", user, user))

  // Day 1
  createMockedFunction(vault, "totalAssets", "totalAssets():(uint256)")
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1_000))])
  createMockedFunction(vault, "totalSupply", "totalSupply():(uint256)")
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100))])
  const dep1 = createDepositEvent(vault, user, user, BigInt.fromI32(100), BigInt.fromI32(10))
  dep1.block.timestamp = BigInt.fromI32(86400) // dayId = 1
  handleDeposit(dep1)

  // Day 2 (sharePrice up by 10%)
  createMockedFunction(vault, "totalAssets", "totalAssets():(uint256)")
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1_100))])
  createMockedFunction(vault, "totalSupply", "totalSupply():(uint256)")
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100))])
  const dep2 = createDepositEvent(vault, user, user, BigInt.fromI32(100), BigInt.fromI32(10))
  dep2.block.timestamp = BigInt.fromI32(86400 * 2)
  handleDeposit(dep2)

  const vid = vault.toHexString().toLowerCase()
  const day2Id = vid + "-" + (2).toString()
  assert.fieldEquals("VaultDayData", day2Id, "apy", "3650") // 10% daily -> 3650% annualized

  const pid = user.toHexString() + "-" + vid
  const posDay2Id = pid + "-" + (2).toString()
  // sharePrice should equal (totalAssets * 1e18 / totalSupply) = 11 * 1e18
  assert.fieldEquals("UserPositionDayData", posDay2Id, "sharePrice", "11000000000000000000")
})

test("Transfer with mint/burn (from/to zero) is ignored", () => {
  clearStore()
  const factory = Address.fromString("0x1000000000000000000000000000000000000001")
  const vault = Address.fromString("0x2000000000000000000000000000000000000002")
  const user = Address.fromString("0x6000000000000000000000000000000000000006")

  handleVaultCreated(createVaultCreatedEvent(factory, BigInt.fromI32(0), vault, Address.zero(), "Vault", "v", user, user))

  createMockedFunction(vault, "totalAssets", "totalAssets():(uint256)")
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1_000))])
  createMockedFunction(vault, "totalSupply", "totalSupply():(uint256)")
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100))])
  handleDeposit(createDepositEvent(vault, user, user, BigInt.fromI32(500), BigInt.fromI32(50)))

  const mint = createTransferEvent(vault, Address.zero(), user, BigInt.fromI32(5))
  handleTransfer(mint)
  const burn = createTransferEvent(vault, user, Address.zero(), BigInt.fromI32(5))
  handleTransfer(burn)

  // Still only the deposit transaction exists
  assert.entityCount("Transaction", 1)
})
