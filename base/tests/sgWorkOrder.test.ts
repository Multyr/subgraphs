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

import {
  handleVaultCreated,
  handleStrategyUpkeepPerformed,
  handleAllPaused,
  handleAllUnpaused
} from "../src/mappings"
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
