import { GasEmaUpdated } from "../generated/templates/StrategyTemplate/Strategy"
import {
  test,
  assert,
  clearStore,
  newMockEvent,
  createMockedFunction,
  dataSourceMock,
  beforeEach
} from "matchstick-as/assembly/index"
import { Address, BigInt, Bytes, ValueKind, ethereum } from "@graphprotocol/graph-ts"

import {
  handleVaultCreated,
  handleStrategyToggled,
  handleWeightsSet,
  handleUpkeepStrategyAdded,
  handleUpkeepStrategyRemoved,
  handleGasEmaUpdated,
  handleStrategyUpkeepPerformed,
  handleAllPaused,
  handleStrategyAssetsChanged,
  handleRouterStrategyAssetsChanged,
  handleAllUnpaused
} from "../src/mappings"
import { GasEmaSnapshot, Vault, CurrentScoringSnapshot, VaultStrategy } from "../generated/schema"
import { refreshLiabilityState, getOrCreateStrategyDeployment, refreshStrategyDeploymentAssets } from "../src/helpers/entities"
import { VaultCreated } from "../generated/VaultFactory/VaultFactory"
import { UpkeepPerformed as StrategyUpkeepPerformed } from "../generated/StrategyUpkeep/StrategyUpkeep"
import { AllPaused, AllUnpaused } from "../generated/templates/VaultTemplate/Vault"

const FACTORY = Address.fromString("0x1000000000000000000000000000000000000001")
const VAULT = Address.fromString("0x2000000000000000000000000000000000000002")
const ASSET = Address.fromString("0x3000000000000000000000000000000000000003")
const OWNER = Address.fromString("0x4000000000000000000000000000000000000004")
const UPKEEP = Address.fromString("0x9000000000000000000000000000000000000009")
const vaultId = VAULT.toHexString().toLowerCase() + "-42161"

function seedVault(): void {
  createMockedFunction(VAULT, "name", "name():(string)").returns([ethereum.Value.fromString("V")])
  createMockedFunction(VAULT, "symbol", "symbol():(string)").returns([ethereum.Value.fromString("V")])
  createMockedFunction(VAULT, "decimals", "decimals():(uint8)").returns([ethereum.Value.fromI32(18)])
  createMockedFunction(VAULT, "asset", "asset():(address)").returns([ethereum.Value.fromAddress(ASSET)])
  createMockedFunction(ASSET, "symbol", "symbol():(string)").returns([ethereum.Value.fromString("USDC")])
  createMockedFunction(ASSET, "decimals", "decimals():(uint8)").returns([ethereum.Value.fromI32(6)])
  createMockedFunction(VAULT, "totalAssets", "totalAssets():(uint256)").returns([ethereum.Value.fromUnsignedBigInt(BigInt.zero())])
  createMockedFunction(VAULT, "totalSupply", "totalSupply():(uint256)").returns([ethereum.Value.fromUnsignedBigInt(BigInt.zero())])

  let ev = changetype<VaultCreated>(newMockEvent())
  ev.address = FACTORY
  ev.parameters = []
  ev.parameters.push(new ethereum.EventParam("vault", ethereum.Value.fromAddress(VAULT)))
  ev.parameters.push(new ethereum.EventParam("asset", ethereum.Value.fromAddress(ASSET)))
  ev.parameters.push(new ethereum.EventParam("owner", ethereum.Value.fromAddress(OWNER)))
  ev.parameters.push(new ethereum.EventParam("feeCollector", ethereum.Value.fromAddress(OWNER)))
  ev.parameters.push(new ethereum.EventParam("name", ethereum.Value.fromString("V")))
  ev.parameters.push(new ethereum.EventParam("symbol", ethereum.Value.fromString("V")))
  handleVaultCreated(ev)
}

beforeEach(() => {
  clearStore()
  for (let i = 0; i < 2; i++) {
    let selector = i == 0 ? "0xeacdc5ff" : "0x4e49acac"
    createMockedFunction(VAULT, "moduleOf", "moduleOf(bytes4):(address)")
      .withArgs([ethereum.Value.fromFixedBytes(Bytes.fromHexString(selector))]).reverts()
  }
  createMockedFunction(VAULT, "params", "params():(address)").reverts()
  createMockedFunction(VAULT, "grossAssets", "grossAssets():(uint256)").reverts()
  createMockedFunction(VAULT, "totalOwed", "totalOwed():(uint256)").reverts()
  createMockedFunction(VAULT, "liabilityIndex", "liabilityIndex():(uint256)").reverts()
  createMockedFunction(VAULT, "isInsolvent", "isInsolvent():(bool)").reverts()
  dataSourceMock.setNetwork("arbitrum-one")
})

test("SG-3 — StrategyUpkeep op decodes to opType (HARVEST=1)", () => {
  let ev = changetype<StrategyUpkeepPerformed>(newMockEvent())
  ev.address = UPKEEP
  ev.logIndex = BigInt.fromI32(0)
  ev.block.timestamp = BigInt.fromI32(1000)
  ev.parameters = []
  ev.parameters.push(new ethereum.EventParam("op", ethereum.Value.fromI32(1)))
  ev.parameters.push(new ethereum.EventParam("strategy", ethereum.Value.fromAddress(VAULT)))
  ev.parameters.push(new ethereum.EventParam("timestamp", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000))))
  handleStrategyUpkeepPerformed(ev)

  let id = ev.transaction.hash.toHex() + "-0"
  assert.fieldEquals("UpkeepAction", id, "op", "1")
  assert.fieldEquals("UpkeepAction", id, "opType", "HARVEST")
  assert.fieldEquals("UpkeepAction", id, "upkeepKind", "STRATEGY")
})

test("SG-9 — AllPaused then AllUnpaused records a VaultPauseEvent with duration", () => {
  seedVault()

  let p = changetype<AllPaused>(newMockEvent())
  p.address = VAULT
  p.block.timestamp = BigInt.fromI32(1000)
  p.parameters = []
  handleAllPaused(p)

  assert.entityCount("VaultPauseEvent", 1)
  assert.fieldEquals("Vault", vaultId, "activeAllPause", vaultId + "-ALL-" + p.transaction.hash.toHex())

  let u = changetype<AllUnpaused>(newMockEvent())
  u.address = VAULT
  u.block.timestamp = BigInt.fromI32(1600)
  u.parameters = []
  handleAllUnpaused(u)

  let pauseId = vaultId + "-ALL-" + p.transaction.hash.toHex()
  assert.fieldEquals("VaultPauseEvent", pauseId, "active", "false")
  assert.fieldEquals("VaultPauseEvent", pauseId, "durationSeconds", "600")
})


// Regression: no setup event is required to discover deployed routing.
test("deployment wiring bootstraps from contract reads", () => {
  createMockedFunction(VAULT, "moduleOf", "moduleOf(bytes4):(address)")
    .withArgs([ethereum.Value.fromFixedBytes(Bytes.fromHexString("0xeacdc5ff"))])
    .returns([ethereum.Value.fromAddress(FACTORY)])
  createMockedFunction(VAULT, "moduleOf", "moduleOf(bytes4):(address)")
    .withArgs([ethereum.Value.fromFixedBytes(Bytes.fromHexString("0x4e49acac"))])
    .returns([ethereum.Value.fromAddress(OWNER)])
  createMockedFunction(VAULT, "params", "params():(address)")
    .returns([ethereum.Value.fromAddress(ASSET)])
  seedVault()
  assert.fieldEquals("VaultDeployment", vaultId, "queueModule", FACTORY.toHexString())
  assert.fieldEquals("VaultDeployment", vaultId, "adminModule", OWNER.toHexString())
  assert.fieldEquals("VaultDeployment", vaultId, "paramsProvider", ASSET.toHexString())
})


test("liability refresh advances net and gross NAV together", () => {
  seedVault()
  createMockedFunction(STRATEGY, "adapterCount", "adapterCount():(uint256)").reverts()
  let vault = Vault.load(vaultId)!
  vault.totalAssets = BigInt.fromI32(997)
  vault.grossAssets = BigInt.fromI32(995)
  createMockedFunction(VAULT, "totalAssets", "totalAssets():(uint256)")
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000))])
  createMockedFunction(VAULT, "grossAssets", "grossAssets():(uint256)")
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000))])
  createMockedFunction(VAULT, "totalOwed", "totalOwed():(uint256)")
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.zero())])
  refreshLiabilityState(vault)
  vault.save()
  assert.fieldEquals("Vault", vaultId, "totalAssets", "1000")
  assert.fieldEquals("Vault", vaultId, "grossAssets", "1000")
  assert.fieldEquals("Vault", vaultId, "totalOwed", "0")
})

const STRATEGY = Address.fromString("0x8000000000000000000000000000000000000008")
const sdId = STRATEGY.toHexString() + "-" + vaultId

function seedStrategyAssets(): void {
  seedVault()
  createMockedFunction(STRATEGY, "adapterCount", "adapterCount():(uint256)").reverts()
  let vault = Vault.load(vaultId)!
  let block = newMockEvent().block
  block.number = BigInt.fromI32(100)
  block.timestamp = BigInt.fromI32(1000)
  let sd = getOrCreateStrategyDeployment(vault, STRATEGY, block)
  sd.save()
  createMockedFunction(STRATEGY, "core", "core():(address)")
    .returns([ethereum.Value.fromAddress(VAULT)])
  createMockedFunction(STRATEGY, "totalAssets", "totalAssets():(uint256)")
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(21122935))])
  refreshStrategyDeploymentAssets(sd, block)
}

test("Strategy deployment reads funded balance and refreshes after router cash flow", () => {
  seedStrategyAssets()
  assert.fieldEquals("StrategyDeployment", sdId, "totalAssets", "21122935")
  createMockedFunction(STRATEGY, "totalAssets", "totalAssets():(uint256)")
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(22122935))])
  let ev = newMockEvent()
  ev.address = OWNER // Router emitter is not the strategy being read.
  ev.block.number = BigInt.fromI32(101)
  ev.parameters = [new ethereum.EventParam("strat", ethereum.Value.fromAddress(STRATEGY))]
  handleRouterStrategyAssetsChanged(ev)
  assert.fieldEquals("StrategyDeployment", sdId, "totalAssets", "22122935")
  assert.fieldEquals("StrategyDeployment", sdId, "updatedAtBlock", "101")
})

test("Strategy asset refresh preserves last good balance on revert and accepts real zero", () => {
  seedStrategyAssets()
  createMockedFunction(STRATEGY, "totalAssets", "totalAssets():(uint256)").reverts()
  let ev = newMockEvent()
  ev.address = STRATEGY
  ev.block.number = BigInt.fromI32(102)
  handleStrategyAssetsChanged(ev)
  assert.fieldEquals("StrategyDeployment", sdId, "totalAssets", "21122935")
  assert.fieldEquals("StrategyDeployment", sdId, "updatedAtBlock", "100")
  createMockedFunction(STRATEGY, "totalAssets", "totalAssets():(uint256)")
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.zero())])
  handleStrategyAssetsChanged(ev)
  assert.fieldEquals("StrategyDeployment", sdId, "totalAssets", "0")
  assert.fieldEquals("StrategyDeployment", sdId, "updatedAtBlock", "102")
})

const ADAPTER = Address.fromString("0x7000000000000000000000000000000000000007")

function mockCurrentScoringReads(): void {
  createMockedFunction(STRATEGY, "adapterCount", "adapterCount():(uint256)")
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))])
  createMockedFunction(STRATEGY, "adapters", "adapters(uint256):(address)")
    .withArgs([ethereum.Value.fromUnsignedBigInt(BigInt.zero())])
    .returns([ethereum.Value.fromAddress(ADAPTER)])
  createMockedFunction(STRATEGY, "computeRebalanceInputs", "computeRebalanceInputs():(uint16[],address[],uint256[],uint256,uint256,uint256[])")
    .returns([ethereum.Value.fromI32Array([520]), ethereum.Value.fromAddressArray([ADAPTER]),
      ethereum.Value.fromUnsignedBigIntArray([BigInt.fromI32(2830000)]),
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(21122935)),
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000000)),
      ethereum.Value.fromUnsignedBigIntArray([BigInt.zero()])])
  createMockedFunction(ADAPTER, "currentAPYBps", "currentAPYBps():(uint16)")
    .returns([ethereum.Value.fromI32(520)])
  createMockedFunction(ADAPTER, "effectiveAPYBps", "effectiveAPYBps():(uint16)")
    .returns([ethereum.Value.fromI32(0)])
  createMockedFunction(STRATEGY, "enabled", "enabled(address):(bool)")
    .withArgs([ethereum.Value.fromAddress(ADAPTER)]).returns([ethereum.Value.fromBoolean(true)])
  createMockedFunction(STRATEGY, "positionAssets", "positionAssets(address):(uint256)")
    .withArgs([ethereum.Value.fromAddress(ADAPTER)]).returns([ethereum.Value.fromUnsignedBigInt(BigInt.zero())])
  createMockedFunction(STRATEGY, "riskScoreBps", "riskScoreBps(address):(uint16)")
    .withArgs([ethereum.Value.fromAddress(ADAPTER)]).returns([ethereum.Value.fromI32(0)])
  createMockedFunction(STRATEGY, "stabilityEMA", "stabilityEMA(address):(uint256)")
    .withArgs([ethereum.Value.fromAddress(ADAPTER)]).returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(7000))])
  createMockedFunction(STRATEGY, "cachedLiquidityBps", "cachedLiquidityBps(address):(uint16)")
    .withArgs([ethereum.Value.fromAddress(ADAPTER)]).returns([ethereum.Value.fromI32(10000)])
}

test("Deposit event snapshots distinguish current, effective and allocator APY; failed reads clear stale values", () => {
  seedStrategyAssets()
  mockCurrentScoringReads()
  let ev = newMockEvent()
  ev.address = OWNER
  ev.block.number = BigInt.fromI32(103)
  ev.parameters = [new ethereum.EventParam("strat", ethereum.Value.fromAddress(STRATEGY)),
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000000)))]
  handleRouterStrategyAssetsChanged(ev)
  let id = sdId + "-" + ADAPTER.toHexString()
  assert.fieldEquals("CurrentScoringSnapshot", id, "currentAPYBps", "520")
  assert.fieldEquals("CurrentScoringSnapshot", id, "effectiveAPYBps", "0")
  assert.fieldEquals("CurrentScoringSnapshot", id, "allocatorAPYBps", "520")
  assert.fieldEquals("CurrentScoringSnapshot", id, "targetAlloc", "2830000")
  assert.fieldEquals("CurrentScoringSnapshot", id, "blockNumber", "103")
  assert.entityCount("ScoringSnapshot", 0)
  createMockedFunction(ADAPTER, "currentAPYBps", "currentAPYBps():(uint16)").reverts()
  createMockedFunction(STRATEGY, "computeRebalanceInputs", "computeRebalanceInputs():(uint16[],address[],uint256[],uint256,uint256,uint256[])").reverts()
  ev.block.number = BigInt.fromI32(104)
  handleRouterStrategyAssetsChanged(ev)
  let snap = CurrentScoringSnapshot.load(id)!
  assert.i32Equals(snap.get("currentAPYBps")!.kind, ValueKind.NULL)
  assert.i32Equals(snap.get("targetAlloc")!.kind, ValueKind.NULL)
  assert.i32Equals(snap.get("allocatorAPYBps")!.kind, ValueKind.NULL)
  assert.fieldEquals("CurrentScoringSnapshot", id, "allocatorReadSucceeded", "false")
  assert.fieldEquals("CurrentScoringSnapshot", id, "blockNumber", "104")
})


test("EMA provenance comes from execution observations and clears for legacy unsupported reads", () => {
  let event = changetype<GasEmaUpdated>(newMockEvent())
  event.address = STRATEGY
  event.parameters = [new ethereum.EventParam("adapter", ethereum.Value.fromAddress(ADAPTER)),
    new ethereum.EventParam("emaGas", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(305025))),
    new ethereum.EventParam("isDeposit", ethereum.Value.fromBoolean(true))]
  createMockedFunction(STRATEGY, "depositGasObservation", "depositGasObservation(address):(uint32,uint64)")
    .withArgs([ethereum.Value.fromAddress(ADAPTER)])
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(3)), ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(12345))])
  handleGasEmaUpdated(event)
  let id = STRATEGY.toHexString() + "-" + ADAPTER.toHexString() + "-deposit-42161"
  assert.fieldEquals("GasEmaSnapshot", id, "emaGas", "305025")
  assert.fieldEquals("GasEmaSnapshot", id, "observationCount", "3")
  assert.fieldEquals("GasEmaSnapshot", id, "observationUpdatedAt", "12345")
  createMockedFunction(STRATEGY, "depositGasObservation", "depositGasObservation(address):(uint32,uint64)")
    .withArgs([ethereum.Value.fromAddress(ADAPTER)]).reverts()
  handleGasEmaUpdated(event)
  let snap = GasEmaSnapshot.load(id)!
  assert.i32Equals(snap.get("observationCount")!.kind, ValueKind.NULL)
  assert.i32Equals(snap.get("observationUpdatedAt")!.kind, ValueKind.NULL)
})

import { StrategyAdded, StrategyRemoved } from "../generated/StrategyUpkeep/StrategyUpkeep"
import { StrategyToggled, WeightsSet } from "../generated/templates/StrategyRouterTemplate/StrategyRouter"
const ROUTER = Address.fromString("0x7000000000000000000000000000000000000007")

function upkeepAdded(upkeep: Address): void {
  let ev = changetype<StrategyAdded>(newMockEvent())
  ev.address = upkeep
  ev.parameters = [new ethereum.EventParam("strategy", ethereum.Value.fromAddress(STRATEGY))]
  handleUpkeepStrategyAdded(ev)
}
function upkeepRemoved(upkeep: Address): void {
  let ev = changetype<StrategyRemoved>(newMockEvent())
  ev.address = upkeep
  ev.parameters = [new ethereum.EventParam("strategy", ethereum.Value.fromAddress(STRATEGY))]
  handleUpkeepStrategyRemoved(ev)
}

test("Upkeep added before registration is linked when the deployment is created", () => {
  seedVault()
  createMockedFunction(STRATEGY, "core", "core():(address)").returns([ethereum.Value.fromAddress(VAULT)])
  upkeepAdded(UPKEEP)
  assert.entityCount("StrategyDeployment", 0)
  let sd = getOrCreateStrategyDeployment(Vault.load(vaultId)!, STRATEGY, newMockEvent().block)
  sd.save()
  assert.fieldEquals("StrategyDeployment", sdId, "strategyUpkeep", UPKEEP.toHexString())
})

test("Upkeep replacement links existing deployment and stale removal preserves replacement", () => {
  seedStrategyAssets()
  upkeepAdded(UPKEEP)
  upkeepAdded(OWNER)
  upkeepRemoved(UPKEEP)
  assert.fieldEquals("StrategyDeployment", sdId, "strategyUpkeep", OWNER.toHexString())
  upkeepRemoved(OWNER)
  assert.fieldEquals("StrategyDeployment", sdId, "strategyUpkeep", "null")
  assert.entityCount("StrategyUpkeepLookup", 0)
})

test("Router toggle and weights keep deployment metadata consistent", () => {
  seedStrategyAssets()
  let vs = new VaultStrategy(ROUTER.toHexString() + "-42161-" + STRATEGY.toHexString())
  vs.router = ROUTER.toHexString() + "-42161"
  vs.strategy = STRATEGY
  vs.chainId = 42161
  vs.vault = vaultId
  vs.priority = 0
  vs.weightBps = 10000
  vs.enabled = true
  vs.totalAssets = BigInt.zero()
  vs.totalHarvestCount = BigInt.zero()
  vs.totalHarvestFailCount = BigInt.zero()
  vs.lastHarvestFailed = false
  vs.createdAt = BigInt.zero()
  vs.updatedAt = BigInt.zero()
  vs.save()
  let ev = changetype<StrategyToggled>(newMockEvent())
  ev.address = ROUTER
  ev.parameters = [new ethereum.EventParam("strat", ethereum.Value.fromAddress(STRATEGY)), new ethereum.EventParam("enabled", ethereum.Value.fromBoolean(false))]
  handleStrategyToggled(ev)
  assert.fieldEquals("StrategyDeployment", sdId, "enabled", "false")
  let weights = changetype<WeightsSet>(newMockEvent())
  weights.address = ROUTER
  weights.logIndex = BigInt.fromI32(1)
  weights.parameters = [new ethereum.EventParam("strats", ethereum.Value.fromAddressArray([STRATEGY])), new ethereum.EventParam("weights", ethereum.Value.fromI32Array([0]))]
  handleWeightsSet(weights)
  assert.fieldEquals("StrategyDeployment", sdId, "weightBps", "0")
})
