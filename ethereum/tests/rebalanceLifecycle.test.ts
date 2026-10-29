import { test, assert, clearStore, newMockEvent, createMockedFunction, dataSourceMock, beforeEach } from "matchstick-as/assembly/index"
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts"
import { RebalancePlanCreated, RebalanceStepExecuted, RebalancePlanCancelled, RebalancePlanInvalidated } from "../generated/templates/StrategyTemplate/Strategy"
import { handleRebalancePlanCreated, handleRebalanceStepExecuted, handleRebalancePlanCancelled, handleRebalancePlanInvalidated } from "../src/mappings"
const STRATEGY = Address.fromString("0x2ad722b6241605481829e4b251ae8a4ba8be86ce")
const VAULT = Address.fromString("0x5e0cdb76487bd96ff069ef7f78eadf5b5909c8cb")
const TX = "0x1d3159bc1e8a2137b4bd490287483244bafe214820f04bdc1dd4eeeac7c57ebe"
const TX2 = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
function base(hash: string, index: i32): ethereum.Event {
 let e = newMockEvent(); e.address = STRATEGY; e.transaction.hash = Bytes.fromHexString(hash); e.logIndex = BigInt.fromI32(index); e.block.number = BigInt.fromI32(519080550); return e
}
function create(count: i32 = 2, hash: string = TX): void {
 let e = changetype<RebalancePlanCreated>(base(hash,41)); e.parameters = [new ethereum.EventParam("actionCount",ethereum.Value.fromI32(count)),new ethereum.EventParam("totalMoved",ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(233489396))),new ethereum.EventParam("tvlSnapshot",ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(116753127)))]; handleRebalancePlanCreated(e)
}
function step(from: i32, to: i32, hash: string = TX, index: i32 = 65): void {
 let e = changetype<RebalanceStepExecuted>(base(hash,index)); e.parameters = [new ethereum.EventParam("fromAction",ethereum.Value.fromI32(from)),new ethereum.EventParam("toAction",ethereum.Value.fromI32(to))]; handleRebalanceStepExecuted(e)
}
beforeEach(() => { clearStore(); dataSourceMock.setNetwork("arbitrum-one"); createMockedFunction(STRATEGY,"core","core():(address)").returns([ethereum.Value.fromAddress(VAULT)]) })
test("09 same-transaction plan links its real step and completes",()=>{ create(); step(0,2); assert.entityCount("RebalancePlan",1); assert.fieldEquals("RebalanceStep",TX+"-65","plan",TX+"-41"); assert.fieldEquals("RebalancePlan",TX+"-41","status","EXECUTED"); assert.fieldEquals("RebalancePlan",TX+"-41","totalMoved","233489396"); assert.fieldEquals("RebalancePlan",TX+"-41","settledAtBlock","519080550"); assert.entityCount("ActiveRebalancePlan",0) })
test("partial and final steps across transactions share one plan",()=>{ create(4); step(0,2); assert.fieldEquals("RebalancePlan",TX+"-41","status","CREATED"); step(2,4,TX2); assert.fieldEquals("RebalanceStep",TX2+"-65","plan",TX+"-41"); assert.fieldEquals("RebalancePlan",TX+"-41","status","EXECUTED"); assert.entityCount("RebalancePlan",1) })
test("cross-transaction cancellation clears cursor",()=>{ create(); handleRebalancePlanCancelled(changetype<RebalancePlanCancelled>(base(TX2,2))); assert.fieldEquals("RebalancePlan",TX+"-41","status","CANCELLED"); assert.entityCount("ActiveRebalancePlan",0) })
test("invalidation preserves amounts and clears cursor",()=>{ create(); let e=changetype<RebalancePlanInvalidated>(base(TX2,3)); e.parameters=[new ethereum.EventParam("planTvl",ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100))),new ethereum.EventParam("currentTvl",ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(200)))]; handleRebalancePlanInvalidated(e); assert.fieldEquals("RebalancePlan",TX+"-41","status","INVALIDATED"); assert.fieldEquals("RebalancePlan",TX+"-41","invalidationCurrentTvl","200"); assert.entityCount("ActiveRebalancePlan",0) })
test("missing creation is explicit and never fabricates a plan",()=>{ step(0,2); assert.entityCount("RebalancePlan",0); assert.entityCount("RebalanceStep",0); assert.fieldEquals("RebalanceLifecycleIssue",TX+"-65","kind","STEP_WITHOUT_ACTIVE_PLAN") })
test("new plan after completion does not reuse previous plan",()=>{ create(); step(0,2); create(2,TX2); step(0,2,TX2); assert.entityCount("RebalancePlan",2); assert.fieldEquals("RebalanceStep",TX2+"-65","plan",TX2+"-41") })
