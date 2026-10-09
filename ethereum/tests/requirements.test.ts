import {
  test,
  assert,
  clearStore,
  createMockedFunction,
  newMockEvent,
  dataSourceMock,
  beforeEach
} from "matchstick-as/assembly/index"
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts"
import {
  AdapterBinding,
  StrategyDayData,
  TokenPrice,
  TokenPriceDayData,
  Vault
} from "../generated/schema"
import {
  getOrCreateTokenPrice,
  updateTokenPriceWithStatus
} from "../src/helpers/pricing"
import { getOrCreateStrategyDayData } from "../src/helpers/strategyDayData"
import { handleAssetOracleConfigSet } from "../src/mappings"
import { AssetOracleConfigSet } from "../generated/GlobalConfig/GlobalConfig"
import {
  recordAdapterApy,
  recordAdapterFailure,
  snapshotAdapterHealth
} from "../src/helpers/adapterHealth"

const TOKEN = Address.fromString("0x1111111111111111111111111111111111111111")
const ADAPTER = Address.fromString("0x2222222222222222222222222222222222222222")
const STRATEGY = Address.fromString("0x3333333333333333333333333333333333333333")
const GLOBAL_CONFIG = Address.fromString("0x4444444444444444444444444444444444444444")
const MIDDLEWARE = Address.fromString("0x5555555555555555555555555555555555555555")
const FEED = Address.fromString("0x6666666666666666666666666666666666666666")

beforeEach(() => {
  clearStore()
  dataSourceMock.setNetwork("arbitrum-one")
})

test("SG-4/SG-14 — missing feed stores null USD and a MISSING daily sample", () => {
  let ev = newMockEvent()
  ev.block.timestamp = BigInt.fromI32(86_400)
  ev.block.number = BigInt.fromI32(123)

  let price = getOrCreateTokenPrice(TOKEN, 42161, "UNKNOWN", 18)
  price.save()

  let result = updateTokenPriceWithStatus(TOKEN, 42161, ev.block)
  assert.assertTrue(result.price === null)

  let id = TOKEN.toHexString().toLowerCase() + "-42161"
  let stored = TokenPrice.load(id)
  assert.assertNotNull(stored)
  assert.assertTrue((stored as TokenPrice).priceUsd === null)
  assert.fieldEquals("TokenPrice", id, "status", "MISSING")
  assert.fieldEquals("TokenPrice", id, "source", "NONE")

  let day = TokenPriceDayData.load(id + "-1")
  assert.assertNotNull(day)
  assert.assertTrue((day as TokenPriceDayData).priceUsd === null)
  assert.fieldEquals("TokenPriceDayData", id + "-1", "status", "MISSING")
  assert.fieldEquals("TokenPriceDayData", id + "-1", "samples", "1")
})

test("SG-4 — GlobalConfig asset oracle events register the middleware feed", () => {
  createMockedFunction(MIDDLEWARE, "getFeed", "getFeed(address):(address)")
    .withArgs([ethereum.Value.fromAddress(TOKEN)])
    .returns([ethereum.Value.fromAddress(FEED)])
  createMockedFunction(FEED, "decimals", "decimals():(uint8)")
    .returns([ethereum.Value.fromI32(8)])
  createMockedFunction(FEED, "description", "description():(string)")
    .returns([ethereum.Value.fromString("TOKEN / USD")])

  let ev = changetype<AssetOracleConfigSet>(newMockEvent())
  ev.address = GLOBAL_CONFIG
  ev.block.timestamp = BigInt.fromI32(1000)
  ev.block.number = BigInt.fromI32(123)
  ev.parameters = []
  ev.parameters.push(new ethereum.EventParam("asset", ethereum.Value.fromAddress(TOKEN)))
  ev.parameters.push(new ethereum.EventParam("oracle", ethereum.Value.fromAddress(MIDDLEWARE)))
  ev.parameters.push(new ethereum.EventParam(
    "maxStaleness",
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(3600))
  ))

  handleAssetOracleConfigSet(ev)

  let id = TOKEN.toHexString().toLowerCase() + "-42161"
  assert.fieldEquals("ChainlinkFeed", id, "feedAddress", FEED.toHexString())
  assert.fieldEquals("ChainlinkFeed", id, "decimals", "8")
  assert.fieldEquals("ChainlinkFeed", id, "description", "TOKEN / USD")
})

test("SG-8 — strategy day data propagates missing asset pricing", () => {
  let ev = newMockEvent()
  ev.block.timestamp = BigInt.fromI32(172_800)

  let vault = new Vault("vault-42161")
  vault.chainId = 42161
  vault.strategyRouter = null
  vault.assetPriceUsd = null
  vault.priceStatus = "MISSING"
  vault.totalAssets = BigInt.fromI32(1_000_000)
  vault.assetDecimals = 6

  let data = getOrCreateStrategyDayData(vault, STRATEGY, ev.block.timestamp)
  data.save()

  let id = "vault-42161-" + STRATEGY.toHexString().toLowerCase() + "-2"
  assert.fieldEquals("StrategyDayData", id, "priceStatus", "MISSING")
  let stored = StrategyDayData.load(id)
  assert.assertNotNull(stored)
  assert.assertTrue((stored as StrategyDayData).totalAssetsUsd === null)
})

test("SG-13 — adapter health snapshots accumulate failures and APY", () => {
  let ev = newMockEvent()
  ev.block.timestamp = BigInt.fromI32(259_200)

  let binding = new AdapterBinding("binding")
  binding.chainId = 42161
  binding.strategy = "strategy-42161"
  binding.vault = "vault-42161"
  binding.adapter = ADAPTER
  binding.enabled = true
  binding.flagged = true
  binding.consecutiveFailures = 2
  binding.quarantined = false
  binding.createdAtBlock = BigInt.fromI32(1)
  binding.updatedAtBlock = BigInt.fromI32(2)
  binding.save()

  snapshotAdapterHealth(binding, ev.block)
  recordAdapterFailure(binding, ev.block)
  recordAdapterApy(binding, ev.block, 450, 25)

  let id = "vault-42161-" + ADAPTER.toHexString().toLowerCase() + "-3"
  assert.fieldEquals("AdapterHealthSnapshot", id, "failuresToday", "1")
  assert.fieldEquals("AdapterHealthSnapshot", id, "consecutiveFailures", "2")
  assert.fieldEquals("AdapterHealthSnapshot", id, "flagged", "true")
  assert.fieldEquals("AdapterHealthSnapshot", id, "apyBps", "450")
  assert.fieldEquals("AdapterHealthSnapshot", id, "incentiveApyBps", "25")
})
