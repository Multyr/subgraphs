import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts"
import { AdapterBinding, AdapterHealthSnapshot } from "../../generated/schema"
import { SECONDS_PER_DAY } from "./constants"

// =============================================================================
// SG-13 — AdapterHealthSnapshot (daily)
// =============================================================================
// riskScore / stabilityEMA are RPC-only; this entity captures what the event
// stream can see so an adapter's degradation is visible *before* quarantine.

function snapshotId(vaultId: string, adapter: Bytes, dayId: i32): string {
  return vaultId + "-" + adapter.toHexString().toLowerCase() + "-" + dayId.toString()
}

/** Upsert today's snapshot from the live AdapterBinding row. */
export function snapshotAdapterHealth(binding: AdapterBinding, block: ethereum.Block): AdapterHealthSnapshot | null {
  let vaultId = binding.vault
  if (vaultId.length == 0) return null
  let dayId = block.timestamp.toI32() / SECONDS_PER_DAY
  let id = snapshotId(vaultId, binding.adapter, dayId)

  let s = AdapterHealthSnapshot.load(id)
  if (s == null) {
    s = new AdapterHealthSnapshot(id)
    s.dayId = dayId
    s.vault = vaultId
    s.adapter = binding.adapter
    s.chainId = binding.chainId
    s.failuresToday = 0
    s.apyBps = null
    s.incentiveApyBps = null
    s.totalAssets = null
    s.lastHarvestAt = null
  }
  s.enabled = binding.enabled
  s.quarantined = binding.quarantined
  s.flagged = binding.flagged
  s.consecutiveFailures = binding.consecutiveFailures
  s.save()
  return s
}

/** Record a failure in today's snapshot (called from adapter failure handlers). */
export function recordAdapterFailure(binding: AdapterBinding, block: ethereum.Block): void {
  let s = snapshotAdapterHealth(binding, block)
  if (s == null) return
  s.failuresToday = s.failuresToday + 1
  s.save()
}

/** Attach APY telemetry from ScoringComputed to today's snapshot. */
export function recordAdapterApy(
  binding: AdapterBinding,
  block: ethereum.Block,
  apyBps: i32,
  incentiveApyBps: i32
): void {
  let s = snapshotAdapterHealth(binding, block)
  if (s == null) return
  s.apyBps = apyBps
  s.incentiveApyBps = incentiveApyBps
  s.save()
}
