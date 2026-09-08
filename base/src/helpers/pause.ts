import { BigInt, ethereum, dataSource, log } from "@graphprotocol/graph-ts"
import { Vault, VaultPauseEvent } from "../../generated/schema"
import { getChainIdFromNetwork } from "./constants"

// =============================================================================
// SG-9 — vault pause history with duration
// =============================================================================
// The core emits DepositsPaused/Unpaused, WithdrawalsPaused/Unpaused,
// AllPaused/Unpaused and GuardianPauseActivated. The mappings previously only
// mutated current Vault flags. This tracks an open/close record per (vault,
// scope) so "how many times and for how long has this vault been paused" is
// answerable.
//
// Vault carries a pointer to the currently-open record per scope
// (activeAllPause / activeDepositsPause / activeWithdrawalsPause).

function activePtr(vault: Vault, scope: string): string | null {
  if (scope == "ALL") return vault.activeAllPause
  if (scope == "DEPOSITS") return vault.activeDepositsPause
  return vault.activeWithdrawalsPause
}

function setActivePtr(vault: Vault, scope: string, id: string | null): void {
  if (scope == "ALL") vault.activeAllPause = id
  else if (scope == "DEPOSITS") vault.activeDepositsPause = id
  else vault.activeWithdrawalsPause = id
}

/** Open a pause record for (vault, scope). No-op if one is already open. */
export function openPause(
  vault: Vault,
  scope: string,
  event: ethereum.Event,
  guardianTriggered: boolean
): void {
  if (activePtr(vault, scope) != null) return // already paused for this scope

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = vault.id + "-" + scope + "-" + event.transaction.hash.toHex()

  let rec = new VaultPauseEvent(id)
  rec.vault = vault.id
  rec.chainId = chainId
  rec.scope = scope
  rec.pausedAt = event.block.timestamp
  rec.pausedAtBlock = event.block.number
  rec.pausedTxHash = event.transaction.hash
  rec.pausedBy = event.transaction.from
  rec.active = true
  rec.guardianTriggered = guardianTriggered
  rec.anomalous = false
  rec.save()

  setActivePtr(vault, scope, id)
}

/** Close the open pause record for (vault, scope), computing duration.
 *  If no record is open, create a closed record flagged anomalous. */
export function closePause(vault: Vault, scope: string, event: ethereum.Event): void {
  let openId = activePtr(vault, scope)
  let chainId = getChainIdFromNetwork(dataSource.network())

  if (openId == null) {
    let id = vault.id + "-" + scope + "-" + event.transaction.hash.toHex() + "-orphan"
    let rec = new VaultPauseEvent(id)
    rec.vault = vault.id
    rec.chainId = chainId
    rec.scope = scope
    rec.pausedAt = event.block.timestamp
    rec.pausedAtBlock = event.block.number
    rec.pausedTxHash = event.transaction.hash
    rec.pausedBy = event.transaction.from
    rec.unpausedAt = event.block.timestamp
    rec.unpausedAtBlock = event.block.number
    rec.unpausedTxHash = event.transaction.hash
    rec.unpausedBy = event.transaction.from
    rec.durationSeconds = BigInt.zero()
    rec.active = false
    rec.guardianTriggered = false
    rec.anomalous = true
    rec.save()
    log.warning("SG-9: unpause with no open record for {} scope {}", [vault.id, scope])
    return
  }

  let rec = VaultPauseEvent.load(openId as string)
  if (rec == null) { setActivePtr(vault, scope, null); return }
  rec.unpausedAt = event.block.timestamp
  rec.unpausedAtBlock = event.block.number
  rec.unpausedTxHash = event.transaction.hash
  rec.unpausedBy = event.transaction.from
  rec.durationSeconds = event.block.timestamp.minus(rec.pausedAt)
  rec.active = false
  rec.save()

  setActivePtr(vault, scope, null)
}
