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
  handleEpochAssetsClaimed,
  handleEpochRecoveryCrystallized,
  handleInstantExit,
  handleForceExit,
  handleInsolvencyEntered,
  handleInsolvencyExited,
  handleInstantWithdrawalPaused,
  handleInstantWithdrawalUnpaused,
  handleClaimUpkeepPerformed,
  handleClaimSettlementFailed
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
  EpochAssetsClaimed,
  EpochRecoveryCrystallized,
  InstantExit,
  ForceExit,
  InsolvencyEntered,
  InsolvencyExited,
  InstantWithdrawalPaused,
  InstantWithdrawalUnpaused
} from "../generated/templates/VaultTemplate/Vault"
import {
  UpkeepPerformed as ClaimUpkeepPerformed,
  ClaimSettlementFailed
} from "../generated/ClaimSettlementUpkeep/ClaimSettlementUpkeep"

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
const CLAIM_UPKEEP = Address.fromString("0x8000000000000000000000000000000000000008")

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
  mockLiabilityReads(totalAssets, 0, false)
}

function mockLiabilityReads(gross: i32, owed: i32, insolvent: boolean): void {
  createMockedFunction(VAULT, "grossAssets", "grossAssets():(uint256)")
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(gross))])
  createMockedFunction(VAULT, "totalOwed", "totalOwed():(uint256)")
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(owed))])
  createMockedFunction(VAULT, "liabilityIndex", "liabilityIndex():(uint256)")
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromString("1000000000000000000"))])
  createMockedFunction(VAULT, "isInsolvent", "isInsolvent():(bool)")
    .returns([ethereum.Value.fromBoolean(insolvent)])
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
  ev.parameters.push(new ethereum.EventParam("assetsOwed", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(90))))
  return ev
}

function epochClosedEvent(epochId: i32, ts: i32): EpochClosed {
  let ev = changetype<EpochClosed>(newMockEvent())
  ev.address = VAULT
  ev.block.timestamp = BigInt.fromI32(ts)
  ev.logIndex = nextLog()
  ev.parameters = []
  ev.parameters.push(new ethereum.EventParam("epochId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(epochId))))
  ev.parameters.push(new ethereum.EventParam("totalNetShares", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(9))))
  ev.parameters.push(new ethereum.EventParam("totalAssetsOwed", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(90))))
  ev.parameters.push(new ethereum.EventParam("totalFeeShares", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))))
  return ev
}

function epochFundedEvent(epochId: i32, ts: i32, reserved: i32 = 90): EpochFunded {
  let ev = changetype<EpochFunded>(newMockEvent())
  ev.address = VAULT
  ev.block.timestamp = BigInt.fromI32(ts)
  ev.logIndex = nextLog()
  ev.parameters = []
  ev.parameters.push(new ethereum.EventParam("epochId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(epochId))))
  ev.parameters.push(new ethereum.EventParam("totalAssetsOwed", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(reserved))))
  return ev
}

function epochClaimedEvent(epochId: i32, claimId: i32, ts: i32, paid: i32 = 90): EpochAssetsClaimed {
  let ev = changetype<EpochAssetsClaimed>(newMockEvent())
  ev.address = VAULT
  ev.block.timestamp = BigInt.fromI32(ts)
  ev.logIndex = nextLog()
  ev.parameters = []
  ev.parameters.push(new ethereum.EventParam("epochId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(epochId))))
  ev.parameters.push(new ethereum.EventParam("claimId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(claimId))))
  ev.parameters.push(new ethereum.EventParam("user", ethereum.Value.fromAddress(USER_A)))
  ev.parameters.push(new ethereum.EventParam("assets", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(paid))))
  ev.parameters.push(new ethereum.EventParam("assetsOwed", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(90))))
  return ev
}

function uint(name: string, value: i32): ethereum.EventParam {
  return new ethereum.EventParam(name, ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(value)))
}

function vaultEvent<T>(ts: i32): T {
  let ev = changetype<ethereum.Event>(newMockEvent())
  ev.address = VAULT
  ev.block.timestamp = BigInt.fromI32(ts)
  ev.logIndex = nextLog()
  ev.parameters = []
  return changetype<T>(ev)
}

/** Claim payout Withdraw: EpochedQueueModule emits it with sender == vault. */
function claimPayoutWithdrawEvent(owner: Address, assets: i32, shares: i32, ts: i32): Withdraw {
  let ev = withdrawEvent(owner, assets, shares, ts)
  ev.parameters[0] = new ethereum.EventParam("sender", ethereum.Value.fromAddress(VAULT))
  return ev
}

function recoveryEvent(epochId: i32, index: string, unclaimed: i32, recovered: i32, writeOff: i32, ts: i32): EpochRecoveryCrystallized {
  let ev = vaultEvent<EpochRecoveryCrystallized>(ts)
  ev.parameters.push(uint("epochId", epochId))
  ev.parameters.push(new ethereum.EventParam("recoveryIndex", ethereum.Value.fromUnsignedBigInt(BigInt.fromString(index))))
  ev.parameters.push(uint("unclaimed", unclaimed))
  ev.parameters.push(uint("recovered", recovered))
  ev.parameters.push(uint("writeOff", writeOff))
  return ev
}

function instantExitEvent(user: Address, shares: i32, netAssets: i32, feeShares: i32, ts: i32): InstantExit {
  let ev = vaultEvent<InstantExit>(ts)
  ev.parameters.push(new ethereum.EventParam("user", ethereum.Value.fromAddress(user)))
  ev.parameters.push(uint("shares", shares))
  ev.parameters.push(uint("netAssets", netAssets))
  ev.parameters.push(uint("feeShares", feeShares))
  return ev
}

function forceExitEvent(user: Address, shares: i32, netAssets: i32, feeShares: i32, ts: i32): ForceExit {
  let ev = vaultEvent<ForceExit>(ts)
  ev.parameters.push(new ethereum.EventParam("user", ethereum.Value.fromAddress(user)))
  ev.parameters.push(uint("shares", shares))
  ev.parameters.push(uint("netAssets", netAssets))
  ev.parameters.push(uint("feeShares", feeShares))
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

test("Epoched withdrawal: exit booked at request, claim only pays out", () => {
  mockVaultReads(1000, 100)
  handleVaultCreated(vaultCreatedEvent())
  handleDeposit(depositEvent(USER_A, 500, 50, 500))

  handleEpochOpened(epochOpenedEvent(1, 1_000))
  // request: 1 fee share to the FeeCollector, 9 net shares burned, 90 owed
  handleTransfer(transferEvent(USER_A, FEE_COLLECTOR, 1, 1_100))
  handleTransfer(transferEvent(USER_A, Address.zero(), 9, 1_100))
  handleEpochWithdrawalRequested(epochRequestEvent(1, 7, 1_100))

  let pid = positionId(USER_A)
  assert.fieldEquals("UserVaultPosition", pid, "shares", "40")
  assert.fieldEquals("UserVaultPosition", pid, "totalWithdrawnAssets", "90")

  handleEpochClosed(epochClosedEvent(1, 2_000))
  handleQueueEpochFunded(epochFundedEvent(1, 2_100))
  handleEpochAssetsClaimed(epochClaimedEvent(1, 7, 2_200))
  handleWithdraw(claimPayoutWithdrawEvent(USER_A, 90, 10, 2_200))

  let epochId = vaultId + "-epoch-1"
  let claimId = epochId + "-claim-7"
  assert.entityCount("WithdrawalEpoch", 1)
  assert.entityCount("WithdrawalEpochEvent", 5)
  assert.fieldEquals("WithdrawalEpoch", epochId, "state", "FUNDED")
  assert.fieldEquals("WithdrawalEpoch", epochId, "epochDuration", "86400")
  assert.fieldEquals("WithdrawalEpoch", epochId, "epochClosesAt", "87400")
  assert.fieldEquals("WithdrawalEpoch", epochId, "totalAssetsOwed", "90")
  assert.fieldEquals("WithdrawalEpoch", epochId, "totalNetAssets", "90")
  assert.fieldEquals("WithdrawalEpoch", epochId, "reservedAssets", "90")
  assert.fieldEquals("WithdrawalEpoch", epochId, "claimedAssets", "90")
  assert.fieldEquals("ClaimRequest", claimId, "epochId", "1")
  assert.fieldEquals("ClaimRequest", claimId, "grossShares", "10")
  assert.fieldEquals("ClaimRequest", claimId, "netShares", "9")
  assert.fieldEquals("ClaimRequest", claimId, "feeShares", "1")
  assert.fieldEquals("ClaimRequest", claimId, "assetsOwed", "90")
  assert.fieldEquals("ClaimRequest", claimId, "assetsReceived", "90")
  assert.fieldEquals("ClaimRequest", claimId, "recoveryLoss", "0")
  assert.fieldEquals("ClaimRequest", claimId, "status", "SETTLED")

  // the payout Withdraw must not burn the shares a second time
  assert.fieldEquals("UserVaultPosition", pid, "shares", "40")
  assert.fieldEquals("UserVaultPosition", pid, "totalWithdrawnAssets", "90")
  assert.fieldEquals("UserVaultPosition", pid, "withdrawCount", "1")
})

test("Recovered epoch pays the haircut and books it as a realized loss", () => {
  mockVaultReads(1000, 100)
  handleVaultCreated(vaultCreatedEvent())
  handleDeposit(depositEvent(USER_A, 500, 50, 500))

  handleEpochOpened(epochOpenedEvent(1, 1_000))
  handleEpochWithdrawalRequested(epochRequestEvent(1, 7, 1_100))
  handleEpochClosed(epochClosedEvent(1, 2_000))
  handleEpochRecoveryCrystallized(recoveryEvent(1, "900000000000000000", 90, 81, 9, 2_100))
  handleQueueEpochFunded(epochFundedEvent(1, 2_100, 81))
  handleEpochAssetsClaimed(epochClaimedEvent(1, 7, 2_200, 81))

  let epochId = vaultId + "-epoch-1"
  let claimId = epochId + "-claim-7"
  let pid = positionId(USER_A)
  assert.fieldEquals("WithdrawalEpoch", epochId, "recoveryIndex", "900000000000000000")
  assert.fieldEquals("WithdrawalEpoch", epochId, "writeOffAssets", "9")
  assert.fieldEquals("WithdrawalEpoch", epochId, "reservedAssets", "81")
  assert.fieldEquals("ClaimRequest", claimId, "assetsReceived", "81")
  assert.fieldEquals("ClaimRequest", claimId, "recoveryLoss", "9")
  assert.fieldEquals("UserVaultPosition", pid, "totalWithdrawnAssets", "81")
  // 9 shares at cost 10 each = 90 cost, 90 owed (0 PnL), then 9 haircut
  assert.fieldEquals("UserVaultPosition", pid, "realizedPnlAssets", "-9")
})

test("Instant and force exits record the burned net shares", () => {
  mockVaultReads(1000, 100)
  handleVaultCreated(vaultCreatedEvent())
  handleDeposit(depositEvent(USER_A, 500, 50, 500))

  handleInstantExit(instantExitEvent(USER_A, 10, 95, 1, 1_000))
  handleForceExit(forceExitEvent(USER_A, 5, 40, 1, 1_100))

  let pid = positionId(USER_A)
  assert.fieldEquals("UserVaultPosition", pid, "shares", "37")
  assert.fieldEquals("UserVaultPosition", pid, "totalWithdrawnAssets", "135")
  assert.fieldEquals("Vault", vaultId, "totalWithdrawals", "135")
  assert.entityCount("Transaction", 3)
})

test("Insolvency events toggle the vault liability state", () => {
  mockVaultReads(1000, 100)
  handleVaultCreated(vaultCreatedEvent())
  assert.fieldEquals("Vault", vaultId, "isInsolvent", "false")

  let entered = vaultEvent<InsolvencyEntered>(1_000)
  entered.parameters.push(uint("grossAssets", 80))
  entered.parameters.push(uint("totalOwed", 100))
  entered.parameters.push(new ethereum.EventParam("liabilityIndex", ethereum.Value.fromUnsignedBigInt(BigInt.fromString("800000000000000000"))))
  handleInsolvencyEntered(entered)
  assert.fieldEquals("Vault", vaultId, "isInsolvent", "true")
  assert.fieldEquals("Vault", vaultId, "totalOwed", "100")
  assert.fieldEquals("Vault", vaultId, "liabilityIndex", "800000000000000000")

  let exited = vaultEvent<InsolvencyExited>(2_000)
  exited.parameters.push(uint("grossAssets", 120))
  exited.parameters.push(uint("totalOwed", 100))
  handleInsolvencyExited(exited)
  assert.fieldEquals("Vault", vaultId, "isInsolvent", "false")
  assert.entityCount("VaultSolvencyEvent", 2)
})

test("Granular breaker pauses open and close their own scope", () => {
  mockVaultReads(1000, 100)
  handleVaultCreated(vaultCreatedEvent())

  handleInstantWithdrawalPaused(vaultEvent<InstantWithdrawalPaused>(1_000))
  assert.fieldEquals("Vault", vaultId, "withdrawalsEnabled", "true")
  assert.entityCount("VaultPauseEvent", 1)

  handleInstantWithdrawalUnpaused(vaultEvent<InstantWithdrawalUnpaused>(1_600))
  let vault = Vault.load(vaultId) as Vault
  assert.assertNull(vault.activeInstantWithdrawalsPause)
  assert.entityCount("VaultPauseEvent", 1)
})

test("ClaimSettlementUpkeep runs and failures are recorded", () => {
  let performed = changetype<ClaimUpkeepPerformed>(newMockEvent())
  performed.address = CLAIM_UPKEEP
  performed.logIndex = nextLog()
  performed.parameters = []
  performed.parameters.push(uint("epochId", 3))
  performed.parameters.push(uint("claimCount", 4))
  performed.parameters.push(uint("totalSettled", 400))
  performed.parameters.push(new ethereum.EventParam("success", ethereum.Value.fromBoolean(true)))
  handleClaimUpkeepPerformed(performed)

  let failed = changetype<ClaimSettlementFailed>(newMockEvent())
  failed.address = CLAIM_UPKEEP
  failed.logIndex = nextLog()
  failed.parameters = []
  failed.parameters.push(uint("epochId", 3))
  failed.parameters.push(uint("claimId", 2))
  failed.parameters.push(uint("retryAt", 9_999))
  handleClaimSettlementFailed(failed)

  assert.entityCount("ClaimSettlementUpkeepEvent", 2)
  assert.entityCount("UpkeepAction", 1)
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
