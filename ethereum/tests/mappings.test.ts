import {
  test,
  assert,
  clearStore,
  newMockEvent,
  createMockedFunction,
  dataSourceMock,
  beforeEach
} from "matchstick-as/assembly/index"
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts"
import { Vault } from "../generated/schema"
import {
  getOrCreateVaultDayData,
  updateVaultApyMetrics
} from "../src/helpers/entities"

import {
  handleVaultCreated,
  handleDeposit,
  handleWithdraw,
  handleTransfer,
  handleEpochOpened,
  handleEpochWithdrawalRequested,
  handleEpochClosed,
  handleQueueEpochFunded,
  handleEpochAssetsClaimed
} from "../src/mappings"
import { VaultCreated } from "../generated/VaultFactory/VaultFactory"
import {
  Deposit,
  Withdraw,
  Transfer,
  EpochOpened,
  EpochWithdrawalRequested,
  EpochClosed,
  EpochFunded,
  EpochAssetsClaimed
} from "../generated/templates/VaultTemplate/Vault"

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

const FACTORY = Address.fromString("0x1000000000000000000000000000000000000001")
const VAULT = Address.fromString("0x2000000000000000000000000000000000000002")
const ASSET = Address.fromString("0x3000000000000000000000000000000000000003")
const OWNER = Address.fromString("0x4000000000000000000000000000000000000004")
const FEE_COLLECTOR = Address.fromString("0x5000000000000000000000000000000000000005")
const USER_A = Address.fromString("0x6000000000000000000000000000000000000006")
const USER_B = Address.fromString("0x7000000000000000000000000000000000000007")

const CHAIN_SUFFIX = "-42161"
const vaultId = VAULT.toHexString().toLowerCase() + CHAIN_SUFFIX

function mockVaultReads(totalAssets: i32, totalSupply: i32): void {
  createMockedFunction(VAULT, "name", "name():(string)").returns([ethereum.Value.fromString("Test Vault")])
  createMockedFunction(VAULT, "symbol", "symbol():(string)").returns([ethereum.Value.fromString("tVLT")])
  createMockedFunction(VAULT, "decimals", "decimals():(uint8)").returns([ethereum.Value.fromI32(18)])
  createMockedFunction(VAULT, "asset", "asset():(address)").returns([ethereum.Value.fromAddress(ASSET)])
  createMockedFunction(ASSET, "symbol", "symbol():(string)").returns([ethereum.Value.fromString("USDC")])
  createMockedFunction(ASSET, "decimals", "decimals():(uint8)").returns([ethereum.Value.fromI32(6)])
  createMockedFunction(VAULT, "totalAssets", "totalAssets():(uint256)")
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(totalAssets))])
  createMockedFunction(VAULT, "totalSupply", "totalSupply():(uint256)")
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(totalSupply))])
}

function vaultCreatedEvent(): VaultCreated {
  let ev = changetype<VaultCreated>(newMockEvent())
  ev.address = FACTORY
  ev.parameters = []
  ev.parameters.push(new ethereum.EventParam("vault", ethereum.Value.fromAddress(VAULT)))
  ev.parameters.push(new ethereum.EventParam("asset", ethereum.Value.fromAddress(ASSET)))
  ev.parameters.push(new ethereum.EventParam("owner", ethereum.Value.fromAddress(OWNER)))
  ev.parameters.push(new ethereum.EventParam("feeCollector", ethereum.Value.fromAddress(FEE_COLLECTOR)))
  ev.parameters.push(new ethereum.EventParam("name", ethereum.Value.fromString("Test Vault")))
  ev.parameters.push(new ethereum.EventParam("symbol", ethereum.Value.fromString("tVLT")))
  return ev
}

let LOG_IX: i32 = 0
function nextLog(): BigInt {
  LOG_IX = LOG_IX + 1
  return BigInt.fromI32(LOG_IX)
}

function depositEvent(owner: Address, assets: i32, shares: i32, ts: i32): Deposit {
  let ev = changetype<Deposit>(newMockEvent())
  ev.address = VAULT
  ev.block.timestamp = BigInt.fromI32(ts)
  ev.logIndex = nextLog()
  ev.parameters = []
  ev.parameters.push(new ethereum.EventParam("sender", ethereum.Value.fromAddress(owner)))
  ev.parameters.push(new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner)))
  ev.parameters.push(new ethereum.EventParam("assets", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(assets))))
  ev.parameters.push(new ethereum.EventParam("shares", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(shares))))
  return ev
}

function withdrawEvent(owner: Address, assets: i32, shares: i32, ts: i32): Withdraw {
  let ev = changetype<Withdraw>(newMockEvent())
  ev.address = VAULT
  ev.block.timestamp = BigInt.fromI32(ts)
  ev.logIndex = nextLog()
  ev.parameters = []
  ev.parameters.push(new ethereum.EventParam("sender", ethereum.Value.fromAddress(owner)))
  ev.parameters.push(new ethereum.EventParam("receiver", ethereum.Value.fromAddress(owner)))
  ev.parameters.push(new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner)))
  ev.parameters.push(new ethereum.EventParam("assets", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(assets))))
  ev.parameters.push(new ethereum.EventParam("shares", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(shares))))
  return ev
}

function transferEvent(from: Address, to: Address, value: i32, ts: i32): Transfer {
  let ev = changetype<Transfer>(newMockEvent())
  ev.address = VAULT
  ev.block.timestamp = BigInt.fromI32(ts)
  ev.logIndex = nextLog()
  ev.parameters = []
  ev.parameters.push(new ethereum.EventParam("from", ethereum.Value.fromAddress(from)))
  ev.parameters.push(new ethereum.EventParam("to", ethereum.Value.fromAddress(to)))
  ev.parameters.push(new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(value))))
  return ev
}

function epochOpenedEvent(epochId: i32, ts: i32): EpochOpened {
  let ev = changetype<EpochOpened>(newMockEvent())
  ev.address = VAULT
  ev.block.timestamp = BigInt.fromI32(ts)
  ev.logIndex = nextLog()
  ev.parameters = []
  ev.parameters.push(new ethereum.EventParam("epochId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(epochId))))
  ev.parameters.push(new ethereum.EventParam("openedAt", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(ts))))
  return ev
}

function epochRequestEvent(epochId: i32, claimId: i32, ts: i32): EpochWithdrawalRequested {
  let ev = changetype<EpochWithdrawalRequested>(newMockEvent())
  ev.address = VAULT
  ev.block.timestamp = BigInt.fromI32(ts)
  ev.logIndex = nextLog()
  ev.parameters = []
  ev.parameters.push(new ethereum.EventParam("epochId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(epochId))))
  ev.parameters.push(new ethereum.EventParam("claimId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(claimId))))
  ev.parameters.push(new ethereum.EventParam("user", ethereum.Value.fromAddress(USER_A)))
  ev.parameters.push(new ethereum.EventParam("grossShares", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(10))))
  ev.parameters.push(new ethereum.EventParam("netShares", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(9))))
  ev.parameters.push(new ethereum.EventParam("feeShares", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))))
  return ev
}

function epochClosedEvent(epochId: i32, ts: i32): EpochClosed {
  let ev = changetype<EpochClosed>(newMockEvent())
  ev.address = VAULT
  ev.block.timestamp = BigInt.fromI32(ts)
  ev.logIndex = nextLog()
  ev.parameters = []
  ev.parameters.push(new ethereum.EventParam("epochId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(epochId))))
  ev.parameters.push(new ethereum.EventParam("ppsAtClose", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(10))))
  ev.parameters.push(new ethereum.EventParam("totalNetShares", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(9))))
  ev.parameters.push(new ethereum.EventParam("totalNetAssets", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(90))))
  ev.parameters.push(new ethereum.EventParam("totalFeeShares", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))))
  return ev
}

function epochFundedEvent(epochId: i32, ts: i32): EpochFunded {
  let ev = changetype<EpochFunded>(newMockEvent())
  ev.address = VAULT
  ev.block.timestamp = BigInt.fromI32(ts)
  ev.logIndex = nextLog()
  ev.parameters = []
  ev.parameters.push(new ethereum.EventParam("epochId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(epochId))))
  ev.parameters.push(new ethereum.EventParam("totalNetAssets", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(90))))
  return ev
}

function epochClaimedEvent(epochId: i32, claimId: i32, ts: i32): EpochAssetsClaimed {
  let ev = changetype<EpochAssetsClaimed>(newMockEvent())
  ev.address = VAULT
  ev.block.timestamp = BigInt.fromI32(ts)
  ev.logIndex = nextLog()
  ev.parameters = []
  ev.parameters.push(new ethereum.EventParam("epochId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(epochId))))
  ev.parameters.push(new ethereum.EventParam("claimId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(claimId))))
  ev.parameters.push(new ethereum.EventParam("user", ethereum.Value.fromAddress(USER_A)))
  ev.parameters.push(new ethereum.EventParam("assets", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(90))))
  ev.parameters.push(new ethereum.EventParam("netShares", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(9))))
  return ev
}

function positionId(user: Address): string {
  return vaultId + "-" + user.toHexString().toLowerCase()
}

beforeEach(() => {
  clearStore()
  dataSourceMock.setNetwork("arbitrum-one")
})

// ---------------------------------------------------------------------------
// tests
// ---------------------------------------------------------------------------

test("handleVaultCreated creates Protocol, Factory and Vault", () => {
  mockVaultReads(0, 0)
  handleVaultCreated(vaultCreatedEvent())

  assert.entityCount("Vault", 1)
  assert.entityCount("VaultFactory", 1)
  assert.fieldEquals("Vault", vaultId, "assetSymbol", "USDC")
  assert.fieldEquals("Vault", vaultId, "assetDecimals", "6")
  assert.fieldEquals("VaultFactory", FACTORY.toHexString().toLowerCase() + CHAIN_SUFFIX, "vaultCount", "1")
})

test("handleDeposit creates UserVaultPosition, PositionLot and Transaction", () => {
  mockVaultReads(1000, 100)
  handleVaultCreated(vaultCreatedEvent())
  handleDeposit(depositEvent(USER_A, 500, 50, 1_000))

  let pid = positionId(USER_A)
  assert.entityCount("UserVaultPosition", 1)
  assert.fieldEquals("UserVaultPosition", pid, "shares", "50")
  assert.fieldEquals("UserVaultPosition", pid, "totalDepositedAssets", "500")
  assert.fieldEquals("UserVaultPosition", pid, "lotCounter", "1")
  assert.fieldEquals("UserVaultPosition", pid, "depositCount", "1")
  assert.entityCount("PositionLot", 1)
  assert.fieldEquals("PositionLot", pid + "-0", "sharesRemaining", "50")
  assert.entityCount("Transaction", 1)
})

test("handleDeposit writes a VaultHourData bucket (SG-7)", () => {
  mockVaultReads(1000, 100)
  handleVaultCreated(vaultCreatedEvent())
  handleDeposit(depositEvent(USER_A, 500, 50, 7_200)) // hourId = 2

  assert.entityCount("VaultHourData", 1)
  assert.fieldEquals("VaultHourData", vaultId + "-2", "depositCount", "1")
  assert.fieldEquals("VaultHourData", vaultId + "-2", "depositsAssets", "500")
})

test("handleWithdraw reduces shares and consumes FIFO lots", () => {
  mockVaultReads(1000, 100)
  handleVaultCreated(vaultCreatedEvent())
  handleDeposit(depositEvent(USER_A, 500, 50, 1_000))
  handleWithdraw(withdrawEvent(USER_A, 200, 20, 2_000))

  let pid = positionId(USER_A)
  assert.fieldEquals("UserVaultPosition", pid, "shares", "30")
  assert.fieldEquals("UserVaultPosition", pid, "totalWithdrawnAssets", "200")
  assert.fieldEquals("PositionLot", pid + "-0", "sharesRemaining", "30")
  assert.entityCount("Transaction", 2)
})

test("fully consumed FIFO lots advance the compaction cursor", () => {
  mockVaultReads(1000, 100)
  handleVaultCreated(vaultCreatedEvent())
  handleDeposit(depositEvent(USER_A, 500, 50, 1_000))
  handleWithdraw(withdrawEvent(USER_A, 500, 50, 2_000))

  let pid = positionId(USER_A)
  assert.fieldEquals("PositionLot", pid + "-0", "isFullyConsumed", "true")
  assert.fieldEquals("UserVaultPosition", pid, "firstActiveLotIndex", "1")
})

test("handleTransfer preserves individual lots on the receiver (SG-16)", () => {
  mockVaultReads(1000, 100)
  handleVaultCreated(vaultCreatedEvent())
  handleDeposit(depositEvent(USER_A, 200, 20, 1_000))
  handleDeposit(depositEvent(USER_A, 300, 30, 2_000)) // second lot
  handleTransfer(transferEvent(USER_A, USER_B, 25, 3_000)) // spans lot 0 (20) + lot 1 (5)

  let toPid = positionId(USER_B)
  // receiver should get TWO lots, not one aggregated lot
  assert.fieldEquals("UserVaultPosition", toPid, "lotCounter", "2")
  assert.fieldEquals("UserVaultPosition", toPid, "shares", "25")
  assert.fieldEquals("PositionLot", toPid + "-0", "sharesRemaining", "20")
  assert.fieldEquals("PositionLot", toPid + "-1", "sharesRemaining", "5")
})

test("Transfer to/from zero address is ignored (mint/burn)", () => {
  mockVaultReads(1000, 100)
  handleVaultCreated(vaultCreatedEvent())
  handleDeposit(depositEvent(USER_A, 500, 50, 1_000))

  handleTransfer(transferEvent(Address.zero(), USER_A, 5, 2_000))
  handleTransfer(transferEvent(USER_A, Address.zero(), 5, 2_000))

  assert.entityCount("Transaction", 1) // only the deposit
})

test("Epoched withdrawal request, close, fund and claim remain linked", () => {
  mockVaultReads(1000, 100)
  handleVaultCreated(vaultCreatedEvent())

  handleEpochOpened(epochOpenedEvent(1, 1_000))
  handleEpochWithdrawalRequested(epochRequestEvent(1, 7, 1_100))
  handleEpochClosed(epochClosedEvent(1, 2_000))
  handleQueueEpochFunded(epochFundedEvent(1, 2_100))
  handleEpochAssetsClaimed(epochClaimedEvent(1, 7, 2_200))

  let epochId = vaultId + "-epoch-1"
  let claimId = epochId + "-claim-7"
  assert.entityCount("WithdrawalEpoch", 1)
  assert.entityCount("WithdrawalEpochEvent", 5)
  assert.fieldEquals("WithdrawalEpoch", epochId, "state", "FUNDED")
  assert.fieldEquals("WithdrawalEpoch", epochId, "epochDuration", "86400")
  assert.fieldEquals("WithdrawalEpoch", epochId, "epochClosesAt", "87400")
  assert.fieldEquals("WithdrawalEpoch", epochId, "totalNetAssets", "90")
  assert.fieldEquals("WithdrawalEpoch", epochId, "claimedAssets", "90")
  assert.fieldEquals("ClaimRequest", claimId, "epochId", "1")
  assert.fieldEquals("ClaimRequest", claimId, "grossShares", "10")
  assert.fieldEquals("ClaimRequest", claimId, "netShares", "9")
  assert.fieldEquals("ClaimRequest", claimId, "feeShares", "1")
  assert.fieldEquals("ClaimRequest", claimId, "assetsReceived", "90")
  assert.fieldEquals("ClaimRequest", claimId, "status", "SETTLED")
})

test("APY aggregation keeps losses and net APY applies the WAD performance rate", () => {
  mockVaultReads(0, 0)
  handleVaultCreated(vaultCreatedEvent())

  let vault = Vault.load(vaultId) as Vault
  vault.perfRateX = BigInt.fromString("200000000000000000") // 20%

  let day0 = getOrCreateVaultDayData(vault, BigInt.fromI32(0))
  day0.apy = BigInt.fromI32(-10).toBigDecimal()
  day0.save()

  let day1 = getOrCreateVaultDayData(vault, BigInt.fromI32(86_400))
  day1.apy = BigInt.fromI32(20).toBigDecimal()
  day1.save()

  updateVaultApyMetrics(vault, 1)
  vault.save()

  assert.fieldEquals("Vault", vaultId, "apy1d", "20")
  assert.fieldEquals("Vault", vaultId, "apy7d", "5")
  assert.fieldEquals("Vault", vaultId, "apy30d", "5")
  assert.fieldEquals("Vault", vaultId, "netApy1d", "16")
  assert.fieldEquals("Vault", vaultId, "netApy7d", "4")
  assert.fieldEquals("Vault", vaultId, "netApy", "4")
})
