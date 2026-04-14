import { Address, BigInt, BigDecimal, dataSource, ethereum, Bytes } from "@graphprotocol/graph-ts"

// Factory Events (from VaultFactory.json ABI)
import {
  VaultDeployed as VaultDeployedEvent,
  VaultCreated as VaultCreatedEvent,
  VaultProductionReady as VaultProductionReadyEvent,
  VaultDeprecated as VaultDeprecatedEvent,
  VaultStatusChanged as VaultStatusChangedEvent
} from "../generated/VaultFactory/VaultFactory"

// Core Events (from Vault.json ABI via VaultTemplate)
// Note: Vault.json is a merged ABI (CoreVault + QueueModule + AdminModule)
// because modules are called via delegatecall and emit events from CoreVault address
import {
  Deposit as DepositEvent,
  Withdraw as WithdrawEvent,
  Transfer as TransferEvent,
  // Claim events
  ClaimRequested as ClaimRequestedEvent,
  ClaimCancelled as ClaimCancelledEvent,
  ClaimSettled as ClaimSettledEvent,
  ClaimQueued as ClaimQueuedEvent,
  ClaimDequeued as ClaimDequeuedEvent,
  SharesFrozen as SharesFrozenEvent,
  SharesUnfrozen as SharesUnfrozenEvent,
  // Pause events
  AllPaused as AllPausedEvent,
  AllUnpaused as AllUnpausedEvent,
  DepositsPaused as DepositsPausedEvent,
  DepositsUnpaused as DepositsUnpausedEvent,
  WithdrawalsPaused as WithdrawalsPausedEvent,
  WithdrawalsUnpaused as WithdrawalsUnpausedEvent,
  GuardianPauseActivated as GuardianPauseActivatedEvent,
  GuardianUpdated as GuardianUpdatedEvent,
  // Fee events
  DepositFeeParamsSet as DepositFeeParamsSetEvent,
  DepositFeeTaken as DepositFeeTakenEvent,
  WithdrawFeeTaken as WithdrawFeeTakenEvent,
  ImmediateExitPenaltyApplied as ImmediateExitPenaltyAppliedEvent,
  ImmediateExitPenaltyUpdated as ImmediateExitPenaltyUpdatedEvent,
  ForceExitPenaltyApplied as ForceExitPenaltyAppliedEvent,
  ForceExitPenaltyUpdated as ForceExitPenaltyUpdatedEvent,
  ForceWithdrawExecuted as ForceWithdrawExecutedEvent,
  Crystallized as CrystallizedEvent,
  PerfFeeMinted as PerfFeeMintedEvent,
  FeeParamsSubmitted as FeeParamsSubmittedEvent,
  FeeParamsAccepted as FeeParamsAcceptedEvent,
  FeeParamsRevoked as FeeParamsRevokedEvent,
  PerfParamsSubmitted as PerfParamsSubmittedEvent,
  PerfParamsAccepted as PerfParamsAcceptedEvent,
  PerfParamsRevoked as PerfParamsRevokedEvent,
  PerfParamsSet as PerfParamsSetEvent,
  FeeParamsUpdated as FeeParamsUpdatedEvent,
  PerfParamsUpdated as PerfParamsUpdatedEvent,
  // Ops reserve target timelock
  OpsReserveTargetSubmitted as OpsReserveTargetSubmittedEvent,
  OpsReserveTargetAccepted as OpsReserveTargetAcceptedEvent,
  OpsReserveTargetRevoked as OpsReserveTargetRevokedEvent,
  // Withdrawal rate limiting
  MaxWithdrawalPerBlockUpdated as MaxWithdrawalPerBlockUpdatedEvent,
  MaxWithdrawalPerTxUpdated as MaxWithdrawalPerTxUpdatedEvent,
  MinClaimAmountUpdated as MinClaimAmountUpdatedEvent,
  CapPerEpochBpsUpdated as CapPerEpochBpsUpdatedEvent,
  // Dynamic caps
  DynamicCapConfigured as DynamicCapConfiguredEvent,
  // Queue anti-spam
  QueueAntiSpamConfigured as QueueAntiSpamConfiguredEvent,
  // Circuit breaker
  CircuitBreakerConfigured as CircuitBreakerConfiguredEvent,
  CircuitBreakerTriggered as CircuitBreakerTriggeredEvent,
  TVLSnapshotUpdated as TVLSnapshotUpdatedEvent,
  // Routing/Ops events
  RoutedToStrategy as RoutedToStrategyEvent,
  Realized as RealizedEvent,
  ReserveTargetRestored as ReserveTargetRestoredEvent,
  EpochRolled as EpochRolledEvent,
  VaultPpsSnapshot as VaultPpsSnapshotEvent,
  // Ops high-level
  Rebalanced as RebalancedEvent,
  EmergencyDrainStarted as EmergencyDrainStartedEvent,
  EmergencyDrainCompleted as EmergencyDrainCompletedEvent,
  LiquidityOpLocked as LiquidityOpLockedEvent,
  LiquidityOpUnlocked as LiquidityOpUnlockedEvent,
  // Fee collector
  FeeCollectorSet as FeeCollectorSetEvent,
  // Health registry
  HealthRegistrySetInVault as HealthRegistrySetInVaultEvent,
  // Oracle / Guardrails
  OracleSet as OracleSetEvent,
  BatchGuardrailsUpdated as BatchGuardrailsUpdatedEvent,
  VaultDepositCapUpdated as VaultDepositCapUpdatedEvent,
  AdapterAllowedUpdated as AdapterAllowedUpdatedEvent,
  AdapterCapUpdated as AdapterCapUpdatedEvent,
  NavSmoothUpdated as NavSmoothUpdatedEvent,
  // Governance/Diamond-lite events
  SelectorRegistrySet as SelectorRegistrySetEvent,
  ModuleSet as ModuleSetEvent,
  ModulesBatchSet as ModulesBatchSetEvent,
  RoleSet as RoleSetEvent,
  RoutingFrozen as RoutingFrozenEvent,
  ParamsFrozen as ParamsFrozenEvent,
  OwnershipTransferInitiated as OwnershipTransferInitiatedEvent,
  OwnershipTransferred as OwnershipTransferredEvent,
  AuthorizedSealerSet as AuthorizedSealerSetEvent,
  SealPrepared as SealPreparedEvent,
  SystemSealed as SystemSealedEvent,
  // Component timelock events
  ComponentsTimelockEnabled as ComponentsTimelockEnabledEvent,
  RouterSubmitted as RouterSubmittedEvent,
  RouterAccepted as RouterAcceptedEvent,
  RouterRevoked as RouterRevokedEvent,
  BufferManagerSubmitted as BufferManagerSubmittedEvent,
  BufferManagerAccepted as BufferManagerAcceptedEvent,
  BufferManagerRevoked as BufferManagerRevokedEvent,
  StrategyRouterUpdated as StrategyRouterUpdatedEvent,
  BufferManagerUpdated as BufferManagerUpdatedEvent,
  ParamsProviderUpdated as ParamsProviderUpdatedEvent,
  HealthRegistryUpdated as HealthRegistryUpdatedEvent,
  IncentivesUpdated as IncentivesUpdatedEvent,
  FeeCollectorUpdated as FeeCollectorUpdatedEvent,
  VetoerUpdated as VetoerUpdatedEvent,
  // Warm adapter events
  WarmAdapterApproved as WarmAdapterApprovedEvent,
  WarmAdapterRevoked as WarmAdapterRevokedEvent,
  // DepositFor events
  DepositForExecuted as DepositForExecutedEvent,
  // External call failure events
  ExternalCallFailed as ExternalCallFailedEvent,
  IncentivesOnDepositFailed as IncentivesOnDepositFailedEvent,
  IncentivesOnExitFailed as IncentivesOnExitFailedEvent,
  // Vault routing configured
  VaultRoutingConfigured as VaultRoutingConfiguredEvent,
  // Ecosystem config
  EcosystemConfigured as EcosystemConfiguredEvent
} from "../generated/templates/VaultTemplate/Vault"

// StrategyRouter Events + Contract binding
import {
  StrategyRegistered as StrategyRegisteredEvent,
  StrategyToggled as StrategyToggledEvent,
  WeightsSet as WeightsSetEvent,
  IntakeModeSet as IntakeModeSetEvent,
  LossCapSet as LossCapSetEvent,
  OwnerChanged as RouterOwnerChangedEvent,
  CoreSet as RouterCoreSetEvent,
  ParamsProviderSet as RouterParamsProviderSetEvent,
  HealthRegistrySet as RouterHealthRegistrySetEvent,
  SecondaryOracleSet as SecondaryOracleSetEvent,
  MaxOracleDeviationSet as MaxOracleDeviationSetEvent,
  LossCapPerStrategySet as LossCapPerStrategySetEvent,
  MaxStrategyBpsSet as MaxStrategyBpsSetEvent,
  GasPerStrategyWithdrawUpdated as GasPerStrategyWithdrawUpdatedEvent,
  // Harvest telemetry events (Pendle-style)
  StrategyHarvested as StrategyHarvestedEvent,
  StrategyHarvestFailed as StrategyHarvestFailedEvent,
  HarvestBatchSummary as HarvestBatchSummaryEvent,
  StrategyRouter as StrategyRouterContract
} from "../generated/templates/StrategyRouterTemplate/StrategyRouter"

// Strategy contract binding (for on-chain metadata reads: name, description)
import { Strategy as StrategyContract } from "../generated/templates/StrategyRouterTemplate/Strategy"

// Strategy Template Events (adapter lifecycle + V10 lifecycle)
import {
  AdapterAdded as AdapterAddedEvent,
  AdapterToggled as AdapterToggledEvent,
  AdapterActivated as AdapterActivatedEvent,
  AdapterAutoQuarantined as AdapterAutoQuarantinedEvent,
  AdapterFlagged as AdapterFlaggedEvent,
  // v2.0.7 — Strategy V10 lifecycle events
  RegimeChanged as RegimeChangedEvent,
  StabilityUpdated as StabilityUpdatedEvent,
  GasEmaUpdated as GasEmaUpdatedEvent,
  RebalancePlanCreated as RebalancePlanCreatedEvent,
  RebalanceStepExecuted as RebalanceStepExecutedEvent,
  RebalancePlanCancelled as RebalancePlanCancelledEvent,
  RebalancePlanInvalidated as RebalancePlanInvalidatedEvent,
  AdapterSkippedLowConfidence as AdapterSkippedLowConfidenceEvent,
  AdapterSkippedOverCap as AdapterSkippedOverCapEvent,
  AdapterUsingStaleExternalTVL as AdapterUsingStaleExternalTVLEvent,
  AdapterDepositFailed as AdapterDepositFailedEvent,
  AdapterWithdrawFailed as AdapterWithdrawFailedEvent,
  AdapterHarvestFailed as AdapterHarvestFailedEvent,
  AdapterFundsStranded as AdapterFundsStrandedEvent,
  ScoringComputed as ScoringComputedEvent,
  DeployIdleExecuted as DeployIdleExecutedEvent,
  DegradedViewsObserved as DegradedViewsObservedEvent,
  Strategy as StrategyTemplateContract
} from "../generated/templates/StrategyTemplate/Strategy"

// VaultUpkeep Events + Contract binding
import {
  UpkeepPerformed as UpkeepPerformedEvent,
  VaultUpkeep as VaultUpkeepContract
} from "../generated/VaultUpkeep/VaultUpkeep"

// StrategyUpkeep Events
import {
  UpkeepPerformed as StrategyUpkeepPerformedEvent,
  UpkeepErrored as StrategyUpkeepErroredEvent,
  StrategyAdded as UpkeepStrategyAddedEvent,
  StrategyRemoved as UpkeepStrategyRemovedEvent,
  StrategyToggled as UpkeepStrategyToggledEvent
} from "../generated/StrategyUpkeep/StrategyUpkeep"

// FeeCollectorUpkeep Events
import {
  DistributionTriggered as DistributionTriggeredEvent,
  DistributionFailed as DistributionFailedEvent
} from "../generated/FeeCollectorUpkeep/FeeCollectorUpkeep"

// GlobalConfig Events (Oracle Registry)
import {
  DefaultOracleConfigSet as DefaultOracleConfigSetEvent,
  AssetOracleConfigSet as AssetOracleConfigSetEvent,
  VaultOracleOverrideSet as VaultOracleOverrideSetEvent
} from "../generated/GlobalConfig/GlobalConfig"

// =============================================================================
// PERIPHERY REWARDS PIPELINE EVENTS
// =============================================================================

// OpsCollector Events
import {
  OpsSplitExecuted as OpsSplitExecutedEvent,
  SplitParamsUpdated as SplitParamsUpdatedEvent,
  OpsWalletUpdated as OpsWalletUpdatedEvent,
  FeeDistributorUpdated as FeeDistributorUpdatedEvent
} from "../generated/OpsCollector/OpsCollector"

// FeeDistributor Events
import {
  Redeemed as RedeemedEvent,
  EpochFunded as EpochFundedEvt,
  EpochAdvanced as EpochAdvancedEvt,
  GuardrailsUpdated as GuardrailsUpdatedEvent,
  EpochPayoutUpdated as EpochPayoutUpdatedEvent
} from "../generated/FeeDistributor/FeeDistributor"

// EpochPayout Events
import {
  RootPublished as RootPublishedEvent,
  Claimed as ClaimedEvent
} from "../generated/EpochPayout/EpochPayout"

// ReferralBinding Events
import {
  ReferralBound as ReferralBoundEvt,
  RouterAuthorizationUpdated as RouterAuthorizationUpdatedEvent
} from "../generated/ReferralBinding/ReferralBinding"

// PartnerRegistry Events
import {
  PartnerRegistered as PartnerRegisteredEvent,
  PartnerUpdated as PartnerUpdatedEvent,
  PartnerDisabled as PartnerDisabledEvent
} from "../generated/PartnerRegistry/PartnerRegistry"

// DepositRouter Events
import {
  DepositWithReferral as DepositWithReferralEvt,
  ReferralBindingSkipped as ReferralBindingSkippedEvt
} from "../generated/DepositRouter/DepositRouter"

// PeripheryUpkeepAdapter Events
import {
  PeripheryUpkeepPerformed as PeripheryUpkeepPerformedEvt
} from "../generated/PeripheryUpkeepAdapter/PeripheryUpkeepAdapter"

// Schema Entities
import {
  Protocol,
  VaultFactory,
  Vault,
  VaultDayData,
  UserVaultPosition,
  UserPositionDayData,
  PositionLot,
  Transaction,
  ClaimRequest,
  User,
  TokenPrice,
  UpkeepAction,
  // New event entities
  FeeEvent,
  Crystallization,
  PerfFeeMint,
  StrategyRoute,
  VaultRealization,
  ReserveRestore,
  EpochEvent,
  ClaimQueueEvent,
  SharesFreezeEvent,
  ModuleChange,
  RoleChange,
  SealEvent,
  ComponentTimelockEvent,
  NavSmoothEvent,
  PpsSnapshot,
  WarmAdapterEvent,
  GuardianPauseEvent,
  ComponentUpdate,
  OwnershipEvent,
  VaultStrategy,
  StrategyRouter,
  StrategyRouterEvent,
  ExternalCallFailure,
  StrategyHarvestEvent,
  HarvestBatch,
  // New config event entities
  OpsReserveTargetEvent,
  WithdrawalLimitEvent,
  DynamicCapEvent,
  QueueAntiSpamEvent,
  CircuitBreakerEvent,
  RebalanceEvent,
  EmergencyDrainEvent,
  LiquidityLockEvent,
  OracleConfigEvent,
  BatchGuardrailsEvent,
  DepositCapEvent,
  AdapterAllowlistEvent,
  AdapterCapEvent,
  VaultRoutingConfig,
  OracleRegistryEvent,
  ForceWithdrawEvent,
  // Periphery Rewards Pipeline entities
  OpsSplitEvent,
  OpsSplitParamsEvent,
  OpsAddressUpdateEvent,
  FeeDistributorRedeemEvent,
  EpochFundedEvent,
  EpochAdvancedEvent,
  FeeDistributorGuardrailsEvent,
  FeeDistributorPayoutUpdateEvent,
  EpochRootPublishedEvent,
  EpochClaimedEvent,
  ReferralBoundEvent,
  RouterAuthorizationEvent,
  PartnerEvent,
  DepositWithReferralEvent,
  ReferralBindingSkippedEvent,
  PeripheryUpkeepEvent,
  // Adapter binding entity
  AdapterBinding,
  // v2.0.7 — Strategy V10 lifecycle entities
  RegimeSnapshot,
  RegimeChangeEvent,
  StabilitySnapshot,
  StabilityUpdateEvent,
  GasEmaSnapshot,
  RebalancePlan,
  RebalanceStep,
  AdapterSkipEvent,
  AdapterFailureEvent,
  ScoringSnapshot,
  DeployIdleEvent,
  StrategyHealthFlag,
  // Ops dashboard entities
  StrategyUpkeepBinding,
  VaultUpkeepBinding,
  VaultDeployment,
  // IncentivesEngine v2 entities
  DepositTranche,
  RewardVestingTranche,
  IncentiveParamsSet,
  // Pre-shadow hardening entities
  RealizeForQueueFailureEvent,
  UpkeepConfigEvent,
  StrategyRebalanceEvent,
  MinDelayEvent,
  ReconcileEvent,
  PauseEvent
} from "../generated/schema"

// Template for dynamic vault indexing
import { VaultTemplate, StrategyRouterTemplate, StrategyTemplate, IncentivesEngineTemplate } from "../generated/templates"

// Local helpers
import {
  ZERO_BI,
  ZERO_BD,
  ONE_E18,
  SECONDS_PER_DAY,
  getChainIdFromNetwork
} from "./helpers/constants"

import {
  getTokenPriceUsd,
  convertToUsd,
  getOrCreateTokenPrice
} from "./helpers/pricing"

import {
  createPositionLot,
  consumeSharesFIFO,
  transferLotsFIFO,
  calculateTotalCostBasis
} from "./helpers/fifo"

import {
  getOrCreateProtocol,
  getOrCreateVaultFactory,
  getOrCreateVault,
  refreshVaultState,
  getOrCreateVaultDayData,
  snapshotVaultDayData,
  updateVaultDayDataApy,
  updateVaultApyMetrics,
  getOrCreateProtocolDeployment,
  getOrCreateVaultDeployment,
  syncVaultDeploymentFromVault,
  getOrCreateStrategyDeployment,
  getOrCreateUserPosition,
  updatePositionValues,
  getOrCreateUserPositionDayData,
  createTransaction,
  setTransactionTransferFields,
  setTransactionClaimId,
  setTransactionReceiver,
  getOrCreateClaimRequest,
  getOrCreateUser,
  updateUserAggregates
} from "./helpers/entities"

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getVaultId(vaultAddress: Address): string {
  let chainId = getChainIdFromNetwork(dataSource.network())
  return vaultAddress.toHexString().toLowerCase() + "-" + chainId.toString()
}

function createEventId(txHash: Bytes, logIndex: BigInt): string {
  return txHash.toHex() + "-" + logIndex.toString()
}

// Truncate bytes to max length (for harvest failure reasons to prevent storage bloat)
const MAX_REASON_BYTES: i32 = 512

function truncateBytes(data: Bytes, maxLength: i32): Bytes {
  if (data.length <= maxLength) {
    return data
  }
  let truncated = new Bytes(maxLength)
  for (let i = 0; i < maxLength; i++) {
    truncated[i] = data[i]
  }
  return truncated
}

// =============================================================================
// FACTORY EVENT HANDLERS
// =============================================================================

/**
 * Handle VaultDeployed event from VaultFactory
 * Signature: VaultDeployed(indexed address vault, indexed address asset, indexed address owner, address feeCollector, string name, string symbol)
 */
export function handleVaultDeployed(event: VaultDeployedEvent): void {
  handleVaultCreationInternal(
    event.params.vault,
    event.params.asset,
    event.params.owner,
    event.params.feeCollector,
    event.address,
    event.transaction.hash,
    event.block
  )
}

/**
 * Handle VaultCreated event from VaultFactory (Events library version)
 * Signature: VaultCreated(indexed address vault, indexed address asset, address owner, address feeCollector, string name, string symbol)
 */
export function handleVaultCreated(event: VaultCreatedEvent): void {
  // Check if vault already exists (handleVaultDeployed may have created it)
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.params.vault.toHexString().toLowerCase() + "-" + chainId.toString()
  let existingVault = Vault.load(vaultId)
  if (existingVault != null) {
    return // Already created by handleVaultDeployed
  }

  handleVaultCreationInternal(
    event.params.vault,
    event.params.asset,
    event.params.owner,
    event.params.feeCollector,
    event.address,
    event.transaction.hash,
    event.block
  )
}

function handleVaultCreationInternal(
  vaultAddr: Address,
  assetAddr: Address,
  ownerAddr: Address,
  feeCollectorAddr: Address,
  factoryAddr: Address,
  txHash: Bytes,
  block: ethereum.Block
): void {
  let chainId = getChainIdFromNetwork(dataSource.network())

  // Get or create protocol singleton
  let protocol = getOrCreateProtocol(factoryAddr, block)
  protocol.totalVaults = protocol.totalVaults + 1
  protocol.updatedAt = block.timestamp
  protocol.save()

  // Get or create factory
  let factoryId = factoryAddr.toHexString().toLowerCase() + "-" + chainId.toString()
  let factory = getOrCreateVaultFactory(factoryAddr, block)
  factory.vaultCount = factory.vaultCount + 1
  factory.save()

  // Create vault entity
  let vault = getOrCreateVault(
    vaultAddr,
    factoryId,
    txHash,
    ownerAddr,
    block
  )

  // Set details from event
  vault.owner = ownerAddr
  vault.feeCollector = feeCollectorAddr
  vault.save()

  // Initialize token price for the asset
  if (assetAddr.notEqual(Address.zero())) {
    let tokenPrice = getOrCreateTokenPrice(
      assetAddr,
      chainId,
      vault.assetSymbol,
      vault.assetDecimals
    )
    tokenPrice.save()
  }

  // Populate ProtocolDeployment with factory address
  // datasource: VaultFactory → event.address == VaultFactory contract
  let pd = getOrCreateProtocolDeployment(chainId, block)
  pd.vaultFactory = factoryAddr
  pd.updatedAt = block.timestamp
  pd.updatedAtBlock = block.number
  pd.save()

  // Bootstrap VaultDeployment with data already known from the creation event.
  // EcosystemConfigured / FeeCollectorSet / VaultRoutingConfigured events fire
  // in the same tx but are emitted BEFORE VaultTemplate.create() — so the
  // template is not yet active and those events are lost.  syncVaultDeploymentFromVault
  // copies whatever the Vault entity already has (feeCollector from the event param).
  syncVaultDeploymentFromVault(vault, block)

  // Start indexing this vault's events
  VaultTemplate.create(vaultAddr)
}

/**
 * Handle VaultProductionReady event
 */
export function handleVaultProductionReady(event: VaultProductionReadyEvent): void {
  let vaultId = getVaultId(event.params.vault)
  let vault = Vault.load(vaultId)
  if (vault != null) {
    vault.isActive = true
    vault.status = "ACTIVE"
    vault.updatedAt = event.block.timestamp
    vault.save()
  }
}

/**
 * Handle VaultDeprecated event — marks vault as DEPRECATED in the registry
 */
export function handleVaultDeprecated(event: VaultDeprecatedEvent): void {
  let vaultId = getVaultId(event.params.vault)
  let vault = Vault.load(vaultId)
  if (vault != null) {
    vault.isActive = false
    vault.status = "DEPRECATED"
    vault.statusLabel = "DEPRECATED"
    vault.statusNote = ""
    vault.updatedAt = event.block.timestamp
    vault.save()
  }
}

/**
 * Handle VaultStatusChanged event — sets custom status label and note for frontend display
 */
export function handleVaultStatusChanged(event: VaultStatusChangedEvent): void {
  let vaultId = getVaultId(event.params.vault)
  let vault = Vault.load(vaultId)
  if (vault != null) {
    vault.statusLabel = event.params.status
    vault.statusNote = event.params.note
    vault.updatedAt = event.block.timestamp
    vault.save()
  }
}

// =============================================================================
// VAULT CORE EVENT HANDLERS (ERC-4626 / ERC-20)
// =============================================================================

/**
 * Handle Deposit event (ERC-4626)
 */
export function handleDeposit(event: DepositEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()

  let vault = Vault.load(vaultId)
  if (vault == null) return

  refreshVaultState(vault, event.block)
  let assetPrice = vault.assetPriceUsd
  let assetsUsd = convertToUsd(event.params.assets, vault.assetDecimals, assetPrice)

  vault.totalDeposits = vault.totalDeposits.plus(event.params.assets)
  vault.transactionCount = vault.transactionCount + 1

  let dayId = event.block.timestamp.toI32() / SECONDS_PER_DAY
  let dayData = getOrCreateVaultDayData(vault, event.block.timestamp)
  dayData.depositsAssets = dayData.depositsAssets.plus(event.params.assets)
  dayData.depositsUsd = dayData.depositsUsd.plus(assetsUsd)
  dayData.netFlowAssets = dayData.depositsAssets.minus(dayData.withdrawalsAssets)
  dayData.netFlowUsd = dayData.depositsUsd.minus(dayData.withdrawalsUsd)
  dayData.depositCount = dayData.depositCount + 1
  updateVaultDayDataApy(dayData)
  dayData.save()

  updateVaultApyMetrics(vault, dayId)
  vault.save()

  let position = getOrCreateUserPosition(event.params.owner, vault, event.block)
  let isNewUser = position.shares.equals(ZERO_BI) && position.depositCount == 0

  position.shares = position.shares.plus(event.params.shares)
  position.totalDepositedAssets = position.totalDepositedAssets.plus(event.params.assets)
  position.totalDepositedUsd = position.totalDepositedUsd.plus(assetsUsd)
  position.netDepositedAssets = position.totalDepositedAssets.minus(position.totalWithdrawnAssets)
  position.netDepositedUsd = position.totalDepositedUsd.minus(position.totalWithdrawnUsd)
  position.lastDepositAt = event.block.timestamp
  position.depositCount = position.depositCount + 1
  position.updatedAt = event.block.timestamp

  createPositionLot(
    position,
    event.params.shares,
    event.params.assets,
    assetsUsd,
    vault.sharePrice,
    assetPrice,
    event.transaction.hash,
    event.block
  )

  let costBasis = calculateTotalCostBasis(position)
  position.costBasisFifoAssets = costBasis.totalCostAssets
  position.costBasisFifoUsd = costBasis.totalCostUsd
  updatePositionValues(position, vault)
  position.save()

  let positionDayData = getOrCreateUserPositionDayData(position, vault, event.block.timestamp)
  positionDayData.save()

  if (isNewUser) {
    vault.totalUsers = vault.totalUsers + 1
    vault.save()
    dayData.uniqueUsers = dayData.uniqueUsers + 1
    dayData.save()
  }

  let user = getOrCreateUser(event.params.owner, event.block)
  if (isNewUser) {
    user.totalPositions = user.totalPositions + 1
  }
  user.totalAssetsUsd = user.totalAssetsUsd.plus(assetsUsd)
  updateUserAggregates(user, event.block)

  let depositTx = createTransaction(
    event.transaction.hash,
    event.logIndex,
    "DEPOSIT",
    vault,
    event.params.owner,
    event.params.shares,
    event.params.assets,
    event.block
  )
  setTransactionReceiver(depositTx, event.params.owner)

  let factoryEntity = VaultFactory.load(vault.factory!)
  if (factoryEntity != null) {
    factoryEntity.totalTvlUsd = factoryEntity.totalTvlUsd.plus(assetsUsd)
    factoryEntity.save()
  }

  let protocolEntity = Protocol.load("protocol-" + chainId.toString())
  if (protocolEntity != null) {
    protocolEntity.totalTvlUsd = protocolEntity.totalTvlUsd.plus(assetsUsd)
    protocolEntity.updatedAt = event.block.timestamp
    protocolEntity.save()
  }
}

/**
 * Handle Withdraw event (ERC-4626)
 */
export function handleWithdraw(event: WithdrawEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()

  let vault = Vault.load(vaultId)
  if (vault == null) return

  refreshVaultState(vault, event.block)
  let assetPrice = vault.assetPriceUsd
  let assetsUsd = convertToUsd(event.params.assets, vault.assetDecimals, assetPrice)

  vault.totalWithdrawals = vault.totalWithdrawals.plus(event.params.assets)
  vault.transactionCount = vault.transactionCount + 1

  let dayId = event.block.timestamp.toI32() / SECONDS_PER_DAY
  let dayData = getOrCreateVaultDayData(vault, event.block.timestamp)
  dayData.withdrawalsAssets = dayData.withdrawalsAssets.plus(event.params.assets)
  dayData.withdrawalsUsd = dayData.withdrawalsUsd.plus(assetsUsd)
  dayData.netFlowAssets = dayData.depositsAssets.minus(dayData.withdrawalsAssets)
  dayData.netFlowUsd = dayData.depositsUsd.minus(dayData.withdrawalsUsd)
  dayData.withdrawCount = dayData.withdrawCount + 1
  updateVaultDayDataApy(dayData)
  dayData.save()

  updateVaultApyMetrics(vault, dayId)
  vault.save()

  let position = getOrCreateUserPosition(event.params.owner, vault, event.block)
  let fifoResult = consumeSharesFIFO(
    position,
    event.params.shares,
    event.params.assets,
    assetPrice
  )

  position.shares = position.shares.minus(event.params.shares)
  position.totalWithdrawnAssets = position.totalWithdrawnAssets.plus(event.params.assets)
  position.totalWithdrawnUsd = position.totalWithdrawnUsd.plus(assetsUsd)
  position.netDepositedAssets = position.totalDepositedAssets.minus(position.totalWithdrawnAssets)
  position.netDepositedUsd = position.totalDepositedUsd.minus(position.totalWithdrawnUsd)
  position.realizedPnlAssets = position.realizedPnlAssets.plus(fifoResult.realizedPnlAssets)
  position.realizedPnlUsd = position.realizedPnlUsd.plus(fifoResult.realizedPnlUsd)
  position.lastWithdrawAt = event.block.timestamp
  position.withdrawCount = position.withdrawCount + 1
  position.updatedAt = event.block.timestamp

  let costBasis = calculateTotalCostBasis(position)
  position.costBasisFifoAssets = costBasis.totalCostAssets
  position.costBasisFifoUsd = costBasis.totalCostUsd
  updatePositionValues(position, vault)
  position.save()

  let positionDayData = getOrCreateUserPositionDayData(position, vault, event.block.timestamp)
  positionDayData.save()

  let user = getOrCreateUser(event.params.owner, event.block)
  user.totalAssetsUsd = user.totalAssetsUsd.minus(assetsUsd)
  user.totalRealizedPnlUsd = user.totalRealizedPnlUsd.plus(fifoResult.realizedPnlUsd)
  updateUserAggregates(user, event.block)

  let withdrawTx = createTransaction(
    event.transaction.hash,
    event.logIndex,
    "WITHDRAW",
    vault,
    event.params.owner,
    event.params.shares,
    event.params.assets,
    event.block
  )
  setTransactionReceiver(withdrawTx, event.params.receiver)

  let factoryEntity = VaultFactory.load(vault.factory!)
  if (factoryEntity != null) {
    factoryEntity.totalTvlUsd = factoryEntity.totalTvlUsd.minus(assetsUsd)
    factoryEntity.save()
  }

  let protocolEntity = Protocol.load("protocol-" + chainId.toString())
  if (protocolEntity != null) {
    protocolEntity.totalTvlUsd = protocolEntity.totalTvlUsd.minus(assetsUsd)
    protocolEntity.updatedAt = event.block.timestamp
    protocolEntity.save()
  }
}

/**
 * Handle Transfer event (ERC-20)
 */
export function handleTransfer(event: TransferEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()

  let vault = Vault.load(vaultId)
  if (vault == null) return

  let from = event.params.from
  let to = event.params.to
  let shares = event.params.value

  if (from.equals(Address.zero()) || to.equals(Address.zero())) {
    return
  }

  refreshVaultState(vault, event.block)
  let assetPrice = vault.assetPriceUsd

  let assets = ZERO_BI
  if (vault.totalSupply.gt(ZERO_BI)) {
    assets = shares.times(vault.totalAssets).div(vault.totalSupply)
  }
  let assetsUsd = convertToUsd(assets, vault.assetDecimals, assetPrice)

  let fromPosition = getOrCreateUserPosition(from, vault, event.block)
  fromPosition.shares = fromPosition.shares.minus(shares)
  fromPosition.updatedAt = event.block.timestamp

  let toPosition = getOrCreateUserPosition(to, vault, event.block)
  let isNewUser = toPosition.shares.equals(ZERO_BI) && toPosition.depositCount == 0

  toPosition.shares = toPosition.shares.plus(shares)
  if (toPosition.createdAt.equals(ZERO_BI)) {
    toPosition.createdAt = event.block.timestamp
  }
  toPosition.updatedAt = event.block.timestamp

  transferLotsFIFO(
    fromPosition,
    toPosition,
    shares,
    vault.sharePrice,
    assetPrice,
    event.transaction.hash,
    event.block
  )

  let fromCostBasis = calculateTotalCostBasis(fromPosition)
  fromPosition.costBasisFifoAssets = fromCostBasis.totalCostAssets
  fromPosition.costBasisFifoUsd = fromCostBasis.totalCostUsd

  let toCostBasis = calculateTotalCostBasis(toPosition)
  toPosition.costBasisFifoAssets = toCostBasis.totalCostAssets
  toPosition.costBasisFifoUsd = toCostBasis.totalCostUsd

  updatePositionValues(fromPosition, vault)
  updatePositionValues(toPosition, vault)
  toPosition.depositCount = toPosition.depositCount + 1

  fromPosition.save()
  toPosition.save()

  let fromDayData = getOrCreateUserPositionDayData(fromPosition, vault, event.block.timestamp)
  fromDayData.save()

  let toDayData = getOrCreateUserPositionDayData(toPosition, vault, event.block.timestamp)
  toDayData.save()

  if (isNewUser) {
    vault.totalUsers = vault.totalUsers + 1
    vault.save()

    let user = getOrCreateUser(to, event.block)
    user.totalPositions = user.totalPositions + 1
    updateUserAggregates(user, event.block)
  }

  vault.transactionCount = vault.transactionCount + 1
  vault.save()

  let transferTx = createTransaction(
    event.transaction.hash,
    event.logIndex,
    "TRANSFER",
    vault,
    from,
    shares,
    assets,
    event.block
  )
  setTransactionTransferFields(transferTx, from, to)
}

// =============================================================================
// CLAIM QUEUE EVENT HANDLERS
// =============================================================================

export function handleClaimRequested(event: ClaimRequestedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()

  let vault = Vault.load(vaultId)
  if (vault == null) return

  let estimatedAssets = ZERO_BI
  if (vault.totalSupply.gt(ZERO_BI)) {
    estimatedAssets = event.params.shares.times(vault.totalAssets).div(vault.totalSupply)
  }

  let claim = getOrCreateClaimRequest(vault, event.params.claimId, event.params.user, event.block)
  claim.shares = event.params.shares
  claim.assetsEstimated = estimatedAssets
  claim.isImmediate = event.params.immediate
  claim.status = "PENDING"
  claim.requestedAt = event.block.timestamp
  claim.requestTxHash = event.transaction.hash
  claim.save()

  let claimRequestTx = createTransaction(
    event.transaction.hash,
    event.logIndex,
    "CLAIM_REQUEST",
    vault,
    event.params.user,
    event.params.shares,
    estimatedAssets,
    event.block
  )
  setTransactionClaimId(claimRequestTx, event.params.claimId)

  vault.transactionCount = vault.transactionCount + 1
  vault.save()
}

export function handleClaimCancelled(event: ClaimCancelledEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()

  let vault = Vault.load(vaultId)
  if (vault == null) return

  let claimRequestId = vaultId + "-" + event.params.claimId.toString()
  let claim = ClaimRequest.load(claimRequestId)

  if (claim != null) {
    claim.status = "CANCELLED"
    claim.cancelledAt = event.block.timestamp
    claim.cancelTxHash = event.transaction.hash
    claim.save()

    let claimCancelTx = createTransaction(
      event.transaction.hash,
      event.logIndex,
      "CLAIM_CANCEL",
      vault,
      event.params.user,
      claim.shares,
      ZERO_BI,
      event.block
    )
    setTransactionClaimId(claimCancelTx, event.params.claimId)
  }

  vault.transactionCount = vault.transactionCount + 1
  vault.save()
}

export function handleClaimSettled(event: ClaimSettledEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()

  let vault = Vault.load(vaultId)
  if (vault == null) return

  let claimRequestId = vaultId + "-" + event.params.claimId.toString()
  let claim = ClaimRequest.load(claimRequestId)

  if (claim != null) {
    claim.status = "SETTLED"
    claim.settledAt = event.block.timestamp
    claim.settleTxHash = event.transaction.hash
    claim.assetsReceived = event.params.netAssets
    claim.save()

    let claimTx = createTransaction(
      event.transaction.hash,
      event.logIndex,
      "CLAIM",
      vault,
      event.params.user,
      claim.shares,
      event.params.netAssets,
      event.block
    )
    setTransactionReceiver(claimTx, event.params.user)
    setTransactionClaimId(claimTx, event.params.claimId)
  }

  vault.transactionCount = vault.transactionCount + 1
  vault.save()
}

export function handleClaimQueued(event: ClaimQueuedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let queueEvent = new ClaimQueueEvent(id)
  queueEvent.vault = vaultId
  queueEvent.chainId = chainId
  queueEvent.type = "QUEUED"
  queueEvent.claimId = event.params.claimId
  queueEvent.timestamp = event.block.timestamp
  queueEvent.blockNumber = event.block.number
  queueEvent.txHash = event.transaction.hash
  queueEvent.save()
}

export function handleClaimDequeued(event: ClaimDequeuedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let queueEvent = new ClaimQueueEvent(id)
  queueEvent.vault = vaultId
  queueEvent.chainId = chainId
  queueEvent.type = "DEQUEUED"
  queueEvent.claimId = event.params.claimId
  queueEvent.timestamp = event.block.timestamp
  queueEvent.blockNumber = event.block.number
  queueEvent.txHash = event.transaction.hash
  queueEvent.save()
}

export function handleSharesFrozen(event: SharesFrozenEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let freezeEvent = new SharesFreezeEvent(id)
  freezeEvent.vault = vaultId
  freezeEvent.chainId = chainId
  freezeEvent.type = "FROZEN"
  freezeEvent.user = event.params.user
  freezeEvent.shares = event.params.shares
  freezeEvent.claimId = event.params.claimId
  freezeEvent.timestamp = event.block.timestamp
  freezeEvent.blockNumber = event.block.number
  freezeEvent.txHash = event.transaction.hash
  freezeEvent.save()
}

export function handleSharesUnfrozen(event: SharesUnfrozenEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let freezeEvent = new SharesFreezeEvent(id)
  freezeEvent.vault = vaultId
  freezeEvent.chainId = chainId
  freezeEvent.type = "UNFROZEN"
  freezeEvent.user = event.params.user
  freezeEvent.shares = event.params.shares
  freezeEvent.claimId = event.params.claimId
  freezeEvent.timestamp = event.block.timestamp
  freezeEvent.blockNumber = event.block.number
  freezeEvent.txHash = event.transaction.hash
  freezeEvent.save()
}

// =============================================================================
// FEE EVENT HANDLERS
// =============================================================================

export function handleDepositFeeParamsSet(event: DepositFeeParamsSetEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault != null) {
    vault.depositFeeBps = event.params.depositFeeBps
    vault.withdrawFeeBps = event.params.withdrawFeeBps
    vault.feeCollector = event.params.treasury
    vault.updatedAt = event.block.timestamp
    vault.save()
  }
}

export function handleDepositFeeTaken(event: DepositFeeTakenEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let feeEvent = new FeeEvent(id)
  feeEvent.vault = vaultId
  feeEvent.chainId = chainId
  feeEvent.type = "DEPOSIT_FEE"
  feeEvent.sender = event.params.sender
  feeEvent.assetsFee = event.params.assetsFee
  feeEvent.sharesToTreasury = event.params.sharesToTreasury
  feeEvent.timestamp = event.block.timestamp
  feeEvent.blockNumber = event.block.number
  feeEvent.txHash = event.transaction.hash
  feeEvent.save()
}

export function handleWithdrawFeeTaken(event: WithdrawFeeTakenEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let feeEvent = new FeeEvent(id)
  feeEvent.vault = vaultId
  feeEvent.chainId = chainId
  feeEvent.type = "WITHDRAW_FEE"
  feeEvent.sender = event.params.sender
  feeEvent.assetsFee = event.params.assetsFee
  feeEvent.sharesToTreasury = event.params.sharesToTreasury
  feeEvent.timestamp = event.block.timestamp
  feeEvent.blockNumber = event.block.number
  feeEvent.txHash = event.transaction.hash
  feeEvent.save()
}

export function handleImmediateExitPenaltyApplied(event: ImmediateExitPenaltyAppliedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let feeEvent = new FeeEvent(id)
  feeEvent.vault = vaultId
  feeEvent.chainId = chainId
  feeEvent.type = "IMMEDIATE_EXIT_PENALTY"
  feeEvent.sender = event.params.user
  feeEvent.assetsFee = event.params.penaltyAssets
  feeEvent.sharesToTreasury = event.params.penaltyShares
  feeEvent.timestamp = event.block.timestamp
  feeEvent.blockNumber = event.block.number
  feeEvent.txHash = event.transaction.hash
  feeEvent.save()
}

export function handleImmediateExitPenaltyUpdated(event: ImmediateExitPenaltyUpdatedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  // Update vault's immediate exit penalty bps
  vault.immediateExitPenaltyBps = event.params.newBps
  vault.updatedAt = event.block.timestamp
  vault.save()

  // Also create a FeeEvent for audit trail
  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let feeEvent = new FeeEvent(id)
  feeEvent.vault = vaultId
  feeEvent.chainId = chainId
  feeEvent.type = "IMMEDIATE_EXIT_PENALTY_UPDATED"
  feeEvent.oldBps = BigInt.fromI32(event.params.oldBps)
  feeEvent.newBps = BigInt.fromI32(event.params.newBps)
  feeEvent.timestamp = event.block.timestamp
  feeEvent.blockNumber = event.block.number
  feeEvent.txHash = event.transaction.hash
  feeEvent.save()
}

export function handleForceExitPenaltyApplied(event: ForceExitPenaltyAppliedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let feeEvent = new FeeEvent(id)
  feeEvent.vault = vaultId
  feeEvent.chainId = chainId
  feeEvent.type = "FORCE_EXIT_PENALTY"
  feeEvent.sender = event.params.user
  feeEvent.sharesToTreasury = event.params.penaltyShares
  feeEvent.timestamp = event.block.timestamp
  feeEvent.blockNumber = event.block.number
  feeEvent.txHash = event.transaction.hash
  feeEvent.save()
}

export function handleForceExitPenaltyUpdated(event: ForceExitPenaltyUpdatedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  // Update vault's force exit penalty bps
  vault.forceExitPenaltyBps = event.params.newBps
  vault.updatedAt = event.block.timestamp
  vault.save()

  // Also create a FeeEvent for audit trail
  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let feeEvent = new FeeEvent(id)
  feeEvent.vault = vaultId
  feeEvent.chainId = chainId
  feeEvent.type = "FORCE_EXIT_PENALTY_UPDATED"
  feeEvent.oldBps = BigInt.fromI32(event.params.oldBps)
  feeEvent.newBps = BigInt.fromI32(event.params.newBps)
  feeEvent.timestamp = event.block.timestamp
  feeEvent.blockNumber = event.block.number
  feeEvent.txHash = event.transaction.hash
  feeEvent.save()
}

export function handleForceWithdrawExecuted(event: ForceWithdrawExecutedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let forceWithdraw = new ForceWithdrawEvent(id)
  forceWithdraw.vault = vaultId
  forceWithdraw.chainId = chainId
  forceWithdraw.caller = event.params.caller
  forceWithdraw.owner = event.params.owner_
  forceWithdraw.receiver = event.params.receiver
  forceWithdraw.assets = event.params.assets
  forceWithdraw.sharesSpent = event.params.sharesSpent
  forceWithdraw.timestamp = event.block.timestamp
  forceWithdraw.blockNumber = event.block.number
  forceWithdraw.txHash = event.transaction.hash
  forceWithdraw.save()

  // Update vault stats
  vault.totalWithdrawals = vault.totalWithdrawals.plus(event.params.assets)
  vault.transactionCount = vault.transactionCount + 1
  vault.updatedAt = event.block.timestamp
  vault.save()
}

export function handleCrystallized(event: CrystallizedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let feeEvent = new FeeEvent(id)
  feeEvent.vault = vaultId
  feeEvent.chainId = chainId
  feeEvent.type = "CRYSTALLIZE"
  feeEvent.oldHwm = event.params.oldHwm
  feeEvent.newHwm = event.params.newHwm
  feeEvent.feeAssets = event.params.feeAssets
  feeEvent.timestamp = event.block.timestamp
  feeEvent.blockNumber = event.block.number
  feeEvent.txHash = event.transaction.hash
  feeEvent.save()

  let crystal = new Crystallization(id)
  crystal.vault = vaultId
  crystal.chainId = chainId
  crystal.oldHwm = event.params.oldHwm
  crystal.newHwm = event.params.newHwm
  crystal.feeAssets = event.params.feeAssets
  crystal.timestamp = event.block.timestamp
  crystal.blockNumber = event.block.number
  crystal.txHash = event.transaction.hash
  crystal.save()

  // Crystallization changes PPS — refresh and snapshot APY
  refreshVaultState(vault, event.block)
  snapshotVaultDayData(vault, event.block)
}

export function handlePerfFeeMinted(event: PerfFeeMintedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let feeEvent = new FeeEvent(id)
  feeEvent.vault = vaultId
  feeEvent.chainId = chainId
  feeEvent.type = "PERF_MINT"
  feeEvent.hwmBefore = event.params.hwmBefore
  feeEvent.ppsBefore = event.params.ppsBefore
  feeEvent.sharesMinted = event.params.sharesMinted
  feeEvent.ppsAfter = event.params.ppsAfter
  feeEvent.timestamp = event.block.timestamp
  feeEvent.blockNumber = event.block.number
  feeEvent.txHash = event.transaction.hash
  feeEvent.save()

  let perfMint = new PerfFeeMint(id)
  perfMint.vault = vaultId
  perfMint.chainId = chainId
  perfMint.hwmBefore = event.params.hwmBefore
  perfMint.ppsBefore = event.params.ppsBefore
  perfMint.sharesMinted = event.params.sharesMinted
  perfMint.ppsAfter = event.params.ppsAfter
  perfMint.timestamp = event.block.timestamp
  perfMint.blockNumber = event.block.number
  perfMint.txHash = event.transaction.hash
  perfMint.save()
}

export function handleFeeParamsSubmitted(event: FeeParamsSubmittedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault != null) {
    vault.updatedAt = event.block.timestamp
    vault.save()
  }
}

export function handleFeeParamsAccepted(event: FeeParamsAcceptedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault != null) {
    vault.depositFeeBps = event.params.depositFeeBps
    vault.withdrawFeeBps = event.params.withdrawFeeBps
    vault.feeCollector = event.params.treasury
    vault.updatedAt = event.block.timestamp
    vault.save()
  }
}

export function handleFeeParamsRevoked(event: FeeParamsRevokedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault != null) {
    vault.updatedAt = event.block.timestamp
    vault.save()
  }
}

export function handlePerfParamsSubmitted(event: PerfParamsSubmittedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault != null) {
    vault.updatedAt = event.block.timestamp
    vault.save()
  }
}

export function handlePerfParamsAccepted(event: PerfParamsAcceptedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault != null) {
    vault.updatedAt = event.block.timestamp
    vault.save()
  }
}

export function handlePerfParamsRevoked(event: PerfParamsRevokedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault != null) {
    vault.updatedAt = event.block.timestamp
    vault.save()
  }
}

export function handlePerfParamsSet(event: PerfParamsSetEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault != null) {
    vault.updatedAt = event.block.timestamp
    vault.save()
  }
}

// =============================================================================
// ROUTING / OPS EVENT HANDLERS
// =============================================================================

export function handleRoutedToStrategy(event: RoutedToStrategyEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let route = new StrategyRoute(id)
  route.vault = vaultId
  route.chainId = chainId
  route.strategy = event.params.strategy
  route.amount = event.params.amount
  route.cashAfter = event.params.cashAfter
  route.timestamp = event.block.timestamp
  route.blockNumber = event.block.number
  route.txHash = event.transaction.hash
  route.save()
}

export function handleRealized(event: RealizedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let realization = new VaultRealization(id)
  realization.vault = vaultId
  realization.chainId = chainId
  realization.amount = event.params.amount
  realization.timestamp = event.block.timestamp
  realization.blockNumber = event.block.number
  realization.txHash = event.transaction.hash
  realization.save()
}

export function handleReserveTargetRestored(event: ReserveTargetRestoredEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let restore = new ReserveRestore(id)
  restore.vault = vaultId
  restore.chainId = chainId
  restore.cashAfter = event.params.cashAfter
  restore.timestamp = event.block.timestamp
  restore.blockNumber = event.block.number
  restore.txHash = event.transaction.hash
  restore.save()

  // Reserve restore changes totalAssets — refresh and snapshot APY
  refreshVaultState(vault, event.block)
  snapshotVaultDayData(vault, event.block)
}

export function handleEpochRolled(event: EpochRolledEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let epochEvent = new EpochEvent(id)
  epochEvent.vault = vaultId
  epochEvent.chainId = chainId
  epochEvent.newEpochStart = event.params.newEpochStart
  epochEvent.timestamp = event.block.timestamp
  epochEvent.blockNumber = event.block.number
  epochEvent.txHash = event.transaction.hash
  epochEvent.save()
}

export function handleVaultPpsSnapshot(event: VaultPpsSnapshotEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let snapshot = new PpsSnapshot(id)
  snapshot.vault = vaultId
  snapshot.chainId = chainId
  snapshot.snapshotTimestamp = event.params.timestamp
  snapshot.totalAssets = event.params.totalAssets
  snapshot.totalSupply = event.params.totalSupply
  snapshot.pps = event.params.pps
  snapshot.timestamp = event.block.timestamp
  snapshot.blockNumber = event.block.number
  snapshot.txHash = event.transaction.hash
  snapshot.save()

  vault.totalAssets = event.params.totalAssets
  vault.totalSupply = event.params.totalSupply
  vault.sharePrice = event.params.pps
  vault.updatedAt = event.block.timestamp
  // APY snapshot — canonical save point
  snapshotVaultDayData(vault, event.block)
}

export function handleNavSmoothUpdated(event: NavSmoothUpdatedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let navEvent = new NavSmoothEvent(id)
  navEvent.vault = vaultId
  navEvent.chainId = chainId
  navEvent.navReal = event.params.navReal
  navEvent.navSmooth = event.params.navSmooth
  navEvent.timestamp = event.block.timestamp
  navEvent.blockNumber = event.block.number
  navEvent.txHash = event.transaction.hash
  navEvent.save()
}

// =============================================================================
// GOVERNANCE / DIAMOND-LITE EVENT HANDLERS
// =============================================================================

export function handleSelectorRegistrySet(event: SelectorRegistrySetEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault != null) {
    vault.updatedAt = event.block.timestamp
    vault.save()
  }
}

export function handleModuleSet(event: ModuleSetEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let moduleChange = new ModuleChange(id)
  moduleChange.vault = vaultId
  moduleChange.chainId = chainId
  moduleChange.selector = event.params.selector
  moduleChange.module = event.params.module
  moduleChange.role = event.params.role
  moduleChange.timestamp = event.block.timestamp
  moduleChange.blockNumber = event.block.number
  moduleChange.txHash = event.transaction.hash
  moduleChange.save()

  vault.updatedAt = event.block.timestamp
  vault.save()
}

export function handleModulesBatchSet(event: ModulesBatchSetEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault != null) {
    vault.updatedAt = event.block.timestamp
    vault.save()
  }
}

export function handleRoleSet(event: RoleSetEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let roleChange = new RoleChange(id)
  roleChange.vault = vaultId
  roleChange.chainId = chainId
  roleChange.selector = event.params.selector
  roleChange.role = event.params.role
  roleChange.timestamp = event.block.timestamp
  roleChange.blockNumber = event.block.number
  roleChange.txHash = event.transaction.hash
  roleChange.save()
}

export function handleRoutingFrozen(event: RoutingFrozenEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault != null) {
    vault.updatedAt = event.block.timestamp
    vault.save()
  }
}

export function handleParamsFrozen(event: ParamsFrozenEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault != null) {
    vault.updatedAt = event.block.timestamp
    vault.save()
  }
}

export function handleOwnershipTransferInitiated(event: OwnershipTransferInitiatedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let ownerEvent = new OwnershipEvent(id)
  ownerEvent.vault = vaultId
  ownerEvent.chainId = chainId
  ownerEvent.previousOwner = event.params.currentOwner
  ownerEvent.newOwner = event.params.pendingOwner
  ownerEvent.isPending = true
  ownerEvent.timestamp = event.block.timestamp
  ownerEvent.blockNumber = event.block.number
  ownerEvent.txHash = event.transaction.hash
  ownerEvent.save()
}

export function handleOwnershipTransferred(event: OwnershipTransferredEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let ownerEvent = new OwnershipEvent(id)
  ownerEvent.vault = vaultId
  ownerEvent.chainId = chainId
  ownerEvent.previousOwner = event.params.previousOwner
  ownerEvent.newOwner = event.params.newOwner
  ownerEvent.isPending = false
  ownerEvent.timestamp = event.block.timestamp
  ownerEvent.blockNumber = event.block.number
  ownerEvent.txHash = event.transaction.hash
  ownerEvent.save()

  vault.owner = event.params.newOwner
  vault.updatedAt = event.block.timestamp
  vault.save()

  // Source: OwnershipTransferred event payload
  let vdOwn = getOrCreateVaultDeployment(vault, event.block)
  vdOwn.owner = event.params.newOwner
  vdOwn.updatedAt = event.block.timestamp
  vdOwn.updatedAtBlock = event.block.number
  vdOwn.save()
}

export function handleAuthorizedSealerSet(event: AuthorizedSealerSetEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault != null) {
    vault.updatedAt = event.block.timestamp
    vault.save()
  }
}

export function handleSealPrepared(event: SealPreparedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let sealEvent = new SealEvent(id)
  sealEvent.vault = vaultId
  sealEvent.chainId = chainId
  sealEvent.type = "PREPARED"
  sealEvent.sealer = event.params.sealer
  sealEvent.configHash = event.params.configHash
  sealEvent.timestamp = event.block.timestamp
  sealEvent.blockNumber = event.block.number
  sealEvent.txHash = event.transaction.hash
  sealEvent.save()
}

export function handleSystemSealed(event: SystemSealedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let sealEvent = new SealEvent(id)
  sealEvent.vault = vaultId
  sealEvent.chainId = chainId
  sealEvent.type = "SEALED"
  sealEvent.sealer = event.params.sealer
  sealEvent.configHash = event.params.configHash
  sealEvent.sealedAt = event.params.timestamp
  sealEvent.timestamp = event.block.timestamp
  sealEvent.blockNumber = event.block.number
  sealEvent.txHash = event.transaction.hash
  sealEvent.save()

  // Source: SystemSealed event — mark deployment as sealed
  let vdSeal = getOrCreateVaultDeployment(vault, event.block)
  vdSeal.sealed = true
  vdSeal.updatedAt = event.block.timestamp
  vdSeal.updatedAtBlock = event.block.number
  vdSeal.save()
}

// =============================================================================
// COMPONENT TIMELOCK EVENT HANDLERS
// =============================================================================

export function handleComponentsTimelockEnabled(event: ComponentsTimelockEnabledEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault != null) {
    vault.updatedAt = event.block.timestamp
    vault.save()
  }
}

export function handleRouterSubmitted(event: RouterSubmittedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let timelockEvent = new ComponentTimelockEvent(id)
  timelockEvent.vault = vaultId
  timelockEvent.chainId = chainId
  timelockEvent.type = "ROUTER_SUBMITTED"
  timelockEvent.component = event.params.newRouter
  timelockEvent.eta = event.params.eta
  timelockEvent.timestamp = event.block.timestamp
  timelockEvent.blockNumber = event.block.number
  timelockEvent.txHash = event.transaction.hash
  timelockEvent.save()
}

export function handleRouterAccepted(event: RouterAcceptedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let timelockEvent = new ComponentTimelockEvent(id)
  timelockEvent.vault = vaultId
  timelockEvent.chainId = chainId
  timelockEvent.type = "ROUTER_ACCEPTED"
  timelockEvent.component = event.params.newRouter
  timelockEvent.timestamp = event.block.timestamp
  timelockEvent.blockNumber = event.block.number
  timelockEvent.txHash = event.transaction.hash
  timelockEvent.save()

  // Only create template if router address changed (AS-safe narrowing)
  let currentRouter = vault.strategyRouter
  let routerChanged = false
  if (currentRouter === null) {
    routerChanged = true
  } else {
    if (!currentRouter.equals(event.params.newRouter)) {
      routerChanged = true
    }
  }
  if (routerChanged) {
    StrategyRouterTemplate.create(event.params.newRouter)
  }

  vault.strategyRouter = event.params.newRouter
  vault.updatedAt = event.block.timestamp
  vault.save()
}

export function handleRouterRevoked(event: RouterRevokedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let timelockEvent = new ComponentTimelockEvent(id)
  timelockEvent.vault = vaultId
  timelockEvent.chainId = chainId
  timelockEvent.type = "ROUTER_REVOKED"
  timelockEvent.timestamp = event.block.timestamp
  timelockEvent.blockNumber = event.block.number
  timelockEvent.txHash = event.transaction.hash
  timelockEvent.save()
}

export function handleBufferManagerSubmitted(event: BufferManagerSubmittedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let timelockEvent = new ComponentTimelockEvent(id)
  timelockEvent.vault = vaultId
  timelockEvent.chainId = chainId
  timelockEvent.type = "BUFFER_SUBMITTED"
  timelockEvent.component = event.params.newBuffer
  timelockEvent.eta = event.params.eta
  timelockEvent.timestamp = event.block.timestamp
  timelockEvent.blockNumber = event.block.number
  timelockEvent.txHash = event.transaction.hash
  timelockEvent.save()
}

export function handleBufferManagerAccepted(event: BufferManagerAcceptedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let timelockEvent = new ComponentTimelockEvent(id)
  timelockEvent.vault = vaultId
  timelockEvent.chainId = chainId
  timelockEvent.type = "BUFFER_ACCEPTED"
  timelockEvent.component = event.params.newBuffer
  timelockEvent.timestamp = event.block.timestamp
  timelockEvent.blockNumber = event.block.number
  timelockEvent.txHash = event.transaction.hash
  timelockEvent.save()

  vault.bufferManager = event.params.newBuffer
  vault.updatedAt = event.block.timestamp
  vault.save()
}

export function handleBufferManagerRevoked(event: BufferManagerRevokedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let timelockEvent = new ComponentTimelockEvent(id)
  timelockEvent.vault = vaultId
  timelockEvent.chainId = chainId
  timelockEvent.type = "BUFFER_REVOKED"
  timelockEvent.timestamp = event.block.timestamp
  timelockEvent.blockNumber = event.block.number
  timelockEvent.txHash = event.transaction.hash
  timelockEvent.save()
}

export function handleStrategyRouterUpdated(event: StrategyRouterUpdatedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let componentUpdate = new ComponentUpdate(id)
  componentUpdate.vault = vaultId
  componentUpdate.chainId = chainId
  componentUpdate.componentType = "STRATEGY_ROUTER"
  componentUpdate.newAddress = event.params.newRouter
  componentUpdate.timestamp = event.block.timestamp
  componentUpdate.blockNumber = event.block.number
  componentUpdate.txHash = event.transaction.hash
  componentUpdate.save()

  // Only create template if router address changed (AS-safe narrowing)
  let currentRouter2 = vault.strategyRouter
  let routerChanged2 = false
  if (currentRouter2 === null) {
    routerChanged2 = true
  } else {
    if (!currentRouter2.equals(event.params.newRouter)) {
      routerChanged2 = true
    }
  }
  if (routerChanged2) {
    StrategyRouterTemplate.create(event.params.newRouter)
  }

  vault.strategyRouter = event.params.newRouter
  vault.updatedAt = event.block.timestamp
  vault.save()
}

export function handleBufferManagerUpdated(event: BufferManagerUpdatedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let componentUpdate = new ComponentUpdate(id)
  componentUpdate.vault = vaultId
  componentUpdate.chainId = chainId
  componentUpdate.componentType = "BUFFER_MANAGER"
  componentUpdate.newAddress = event.params.newBuffer
  componentUpdate.timestamp = event.block.timestamp
  componentUpdate.blockNumber = event.block.number
  componentUpdate.txHash = event.transaction.hash
  componentUpdate.save()

  vault.bufferManager = event.params.newBuffer
  vault.updatedAt = event.block.timestamp
  vault.save()
}

export function handleParamsProviderUpdated(event: ParamsProviderUpdatedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let componentUpdate = new ComponentUpdate(id)
  componentUpdate.vault = vaultId
  componentUpdate.chainId = chainId
  componentUpdate.componentType = "PARAMS_PROVIDER"
  componentUpdate.newAddress = event.params.newParams
  componentUpdate.timestamp = event.block.timestamp
  componentUpdate.blockNumber = event.block.number
  componentUpdate.txHash = event.transaction.hash
  componentUpdate.save()

  vault.updatedAt = event.block.timestamp
  vault.save()

  // Source: ParamsProviderUpdated event payload
  let vdPp = getOrCreateVaultDeployment(vault, event.block)
  vdPp.paramsProvider = event.params.newParams
  vdPp.updatedAt = event.block.timestamp
  vdPp.updatedAtBlock = event.block.number
  vdPp.save()
}

export function handleHealthRegistryUpdated(event: HealthRegistryUpdatedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let componentUpdate = new ComponentUpdate(id)
  componentUpdate.vault = vaultId
  componentUpdate.chainId = chainId
  componentUpdate.componentType = "HEALTH_REGISTRY"
  componentUpdate.newAddress = event.params.newRegistry
  componentUpdate.timestamp = event.block.timestamp
  componentUpdate.blockNumber = event.block.number
  componentUpdate.txHash = event.transaction.hash
  componentUpdate.save()

  vault.updatedAt = event.block.timestamp
  vault.save()
}

export function handleIncentivesUpdated(event: IncentivesUpdatedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let componentUpdate = new ComponentUpdate(id)
  componentUpdate.vault = vaultId
  componentUpdate.chainId = chainId
  componentUpdate.componentType = "INCENTIVES"
  componentUpdate.newAddress = event.params.newIncentives
  componentUpdate.timestamp = event.block.timestamp
  componentUpdate.blockNumber = event.block.number
  componentUpdate.txHash = event.transaction.hash
  componentUpdate.save()

  vault.incentives = event.params.newIncentives
  vault.updatedAt = event.block.timestamp
  vault.save()
}

export function handleFeeCollectorUpdated(event: FeeCollectorUpdatedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let componentUpdate = new ComponentUpdate(id)
  componentUpdate.vault = vaultId
  componentUpdate.chainId = chainId
  componentUpdate.componentType = "FEE_COLLECTOR"
  componentUpdate.newAddress = event.params.newCollector
  componentUpdate.timestamp = event.block.timestamp
  componentUpdate.blockNumber = event.block.number
  componentUpdate.txHash = event.transaction.hash
  componentUpdate.save()

  vault.feeCollector = event.params.newCollector
  vault.updatedAt = event.block.timestamp
  vault.save()
}

export function handleVetoerUpdated(event: VetoerUpdatedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let componentUpdate = new ComponentUpdate(id)
  componentUpdate.vault = vaultId
  componentUpdate.chainId = chainId
  componentUpdate.componentType = "VETOER"
  componentUpdate.newAddress = event.params.newVetoer
  componentUpdate.timestamp = event.block.timestamp
  componentUpdate.blockNumber = event.block.number
  componentUpdate.txHash = event.transaction.hash
  componentUpdate.save()

  vault.updatedAt = event.block.timestamp
  vault.save()
}

// =============================================================================
// PAUSE EVENT HANDLERS
// =============================================================================

export function handleAllPaused(event: AllPausedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault != null) {
    vault.depositsEnabled = false
    vault.withdrawalsEnabled = false
    vault.status = "PAUSED"
    vault.updatedAt = event.block.timestamp
    vault.save()
  }
}

export function handleAllUnpaused(event: AllUnpausedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault != null) {
    vault.depositsEnabled = true
    vault.withdrawalsEnabled = true
    vault.status = "ACTIVE"
    vault.updatedAt = event.block.timestamp
    vault.save()
  }
}

export function handleDepositsPaused(event: DepositsPausedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault != null) {
    vault.depositsEnabled = false
    vault.updatedAt = event.block.timestamp
    vault.save()
  }
}

export function handleDepositsUnpaused(event: DepositsUnpausedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault != null) {
    vault.depositsEnabled = true
    vault.updatedAt = event.block.timestamp
    vault.save()
  }
}

export function handleWithdrawalsPaused(event: WithdrawalsPausedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault != null) {
    vault.withdrawalsEnabled = false
    vault.updatedAt = event.block.timestamp
    vault.save()
  }
}

export function handleWithdrawalsUnpaused(event: WithdrawalsUnpausedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault != null) {
    vault.withdrawalsEnabled = true
    vault.updatedAt = event.block.timestamp
    vault.save()
  }
}

export function handleGuardianPauseActivated(event: GuardianPauseActivatedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let pauseEvent = new GuardianPauseEvent(id)
  pauseEvent.vault = vaultId
  pauseEvent.chainId = chainId
  pauseEvent.guardian = event.params.guardian
  pauseEvent.pausedAt = event.params.timestamp
  pauseEvent.timestamp = event.block.timestamp
  pauseEvent.blockNumber = event.block.number
  pauseEvent.txHash = event.transaction.hash
  pauseEvent.save()

  vault.depositsEnabled = false
  vault.withdrawalsEnabled = false
  vault.status = "PAUSED"
  vault.updatedAt = event.block.timestamp
  vault.save()
}

export function handleGuardianUpdated(event: GuardianUpdatedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault != null) {
    vault.guardian = event.params.newGuardian
    vault.updatedAt = event.block.timestamp
    vault.save()
  }
}

// =============================================================================
// WARM ADAPTER EVENT HANDLERS
// =============================================================================

export function handleWarmAdapterApproved(event: WarmAdapterApprovedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let adapterEvent = new WarmAdapterEvent(id)
  adapterEvent.vault = vaultId
  adapterEvent.chainId = chainId
  adapterEvent.type = "APPROVED"
  adapterEvent.adapter = event.params.adapter
  adapterEvent.timestamp = event.block.timestamp
  adapterEvent.blockNumber = event.block.number
  adapterEvent.txHash = event.transaction.hash
  adapterEvent.save()
}

export function handleWarmAdapterRevoked(event: WarmAdapterRevokedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let adapterEvent = new WarmAdapterEvent(id)
  adapterEvent.vault = vaultId
  adapterEvent.chainId = chainId
  adapterEvent.type = "REVOKED"
  adapterEvent.adapter = event.params.adapter
  adapterEvent.timestamp = event.block.timestamp
  adapterEvent.blockNumber = event.block.number
  adapterEvent.txHash = event.transaction.hash
  adapterEvent.save()
}

// =============================================================================
// DEPOSIT FOR EVENT HANDLERS
// =============================================================================

export function handleDepositForExecuted(event: DepositForExecutedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault != null) {
    vault.updatedAt = event.block.timestamp
    vault.save()
  }
}

// =============================================================================
// EXTERNAL CALL FAILURE EVENT HANDLERS
// =============================================================================

export function handleIncentivesOnDepositFailed(event: IncentivesOnDepositFailedEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let failure = new ExternalCallFailure(id)
  failure.vault = vaultId
  failure.chainId = chainId
  failure.target = event.params.receiver
  failure.functionName = "onDeposit"
  failure.reason = event.params.reason
  failure.timestamp = event.block.timestamp
  failure.blockNumber = event.block.number
  failure.txHash = event.transaction.hash
  failure.save()
}

// =============================================================================
// ECOSYSTEM CONFIGURATION EVENT HANDLER
// =============================================================================

export function handleEcosystemConfigured(event: EcosystemConfiguredEvent): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  // Only create template if router address is new and non-zero (AS-safe narrowing)
  let currentRouter3 = vault.strategyRouter
  let routerChanged = false
  if (currentRouter3 === null) {
    routerChanged = true
  } else {
    if (!currentRouter3.equals(event.params.strategyRouter)) {
      routerChanged = true
    }
  }

  vault.bufferManager = event.params.bufferManager
  vault.strategyRouter = event.params.strategyRouter
  vault.guardian = event.params.guardian
  vault.updatedAt = event.block.timestamp
  vault.save()

  if (routerChanged && event.params.strategyRouter.notEqual(Address.zero())) {
    StrategyRouterTemplate.create(event.params.strategyRouter)
  }

  // Sync VaultDeployment with ecosystem wiring
  // Source: event payload (bufferManager, strategyRouter, healthRegistry, incentives, guardian, vetoer)
  let vd = getOrCreateVaultDeployment(vault, event.block)
  vd.bufferManager = event.params.bufferManager
  vd.strategyRouter = event.params.strategyRouter
  vd.healthRegistry = event.params.healthRegistry
  vd.incentives = event.params.incentives
  vd.guardian = event.params.guardian
  vd.vetoer = event.params.vetoer
  vd.updatedAt = event.block.timestamp
  vd.updatedAtBlock = event.block.number
  vd.save()
}

// =============================================================================
// STRATEGY ROUTER EVENT HANDLERS
// =============================================================================

export function handleStrategyRegistered(event: StrategyRegisteredEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let routerId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let strategyId = routerId + "-" + event.params.strat.toHexString().toLowerCase()

  let strategy = new VaultStrategy(strategyId)
  strategy.router = routerId
  strategy.strategy = event.params.strat
  strategy.chainId = chainId
  strategy.priority = event.params.priority
  strategy.weightBps = event.params.weightBps
  strategy.enabled = true
  strategy.totalAssets = ZERO_BI

  // Read strategy metadata on-chain (name, description)
  let strategyContract = StrategyContract.bind(event.params.strat)
  let nameResult = strategyContract.try_name()
  strategy.name = nameResult.reverted ? null : nameResult.value
  let descResult = strategyContract.try_description()
  strategy.description = descResult.reverted ? null : descResult.value

  // Initialize harvest telemetry fields
  strategy.totalHarvestCount = ZERO_BI
  strategy.totalHarvestFailCount = ZERO_BI
  strategy.lastHarvestFailed = false
  strategy.createdAt = event.block.timestamp
  strategy.updatedAt = event.block.timestamp
  strategy.save()

  // Resolve vault via StrategyRouter.core() — needed for VaultStrategy.vault + StrategyDeployment
  let routerContract = StrategyRouterContract.bind(event.address)
  let coreResult = routerContract.try_core()
  if (!coreResult.reverted) {
    let vaultIdSd = coreResult.value.toHexString().toLowerCase() + "-" + chainId.toString()
    let vaultSd = Vault.load(vaultIdSd)
    if (vaultSd !== null) {
      // Set VaultStrategy.vault for @derivedFrom resolution (Panel 10 PnL)
      strategy.vault = vaultIdSd
      strategy.save()

      let sd = getOrCreateStrategyDeployment(vaultSd, event.params.strat, event.block)
      sd.priority = event.params.priority
      sd.weightBps = event.params.weightBps
      sd.enabled = true
      sd.strategyRouter = event.address
      sd.updatedAt = event.block.timestamp
      sd.updatedAtBlock = event.block.number
      sd.save()

      // Create StrategyTemplate to index adapter events going forward
      StrategyTemplate.create(event.params.strat)

      // Backfill: read existing adapter state from on-chain (adapters wired before registration)
      let strat = StrategyTemplateContract.bind(event.params.strat)
      let countResult = strat.try_adapterCount()
      if (!countResult.reverted) {
        let count = countResult.value.toI32()
        for (let i = 0; i < count; i++) {
          let adapterResult = strat.try_adapters(BigInt.fromI32(i))
          if (!adapterResult.reverted) {
            let adapterAddr = adapterResult.value
            let bindingId = event.params.strat.toHexString().toLowerCase() + "-" + adapterAddr.toHexString().toLowerCase() + "-" + chainId.toString()
            let binding = AdapterBinding.load(bindingId)
            if (binding == null) {
              binding = new AdapterBinding(bindingId)
              binding.chainId = chainId
              binding.strategy = sd.id
              binding.vault = vaultSd.id
              binding.adapter = adapterAddr
              binding.consecutiveFailures = 0
              binding.quarantined = false
              binding.createdAtBlock = event.block.number

              let enabledResult = strat.try_enabled(adapterAddr)
              binding.enabled = enabledResult.reverted ? true : enabledResult.value

              let flaggedResult = strat.try_flagged(adapterAddr)
              binding.flagged = flaggedResult.reverted ? false : flaggedResult.value

              binding.activatedAt = null
              binding.updatedAtBlock = event.block.number
              binding.save()
            }
          }
        }
      }
    }
  }

  let id = createEventId(event.transaction.hash, event.logIndex)
  let routerEvent = new StrategyRouterEvent(id)
  routerEvent.router = routerId
  routerEvent.chainId = chainId
  routerEvent.eventType = "STRATEGY_REGISTERED"
  routerEvent.strategy = event.params.strat
  routerEvent.enabled = true
  routerEvent.priority = event.params.priority
  routerEvent.weightBps = event.params.weightBps
  routerEvent.timestamp = event.block.timestamp
  routerEvent.blockNumber = event.block.number
  routerEvent.txHash = event.transaction.hash
  routerEvent.save()
}

export function handleStrategyToggled(event: StrategyToggledEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let routerId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let strategyId = routerId + "-" + event.params.strat.toHexString().toLowerCase()

  let strategy = VaultStrategy.load(strategyId)
  if (strategy != null) {
    strategy.enabled = event.params.enabled
    strategy.updatedAt = event.block.timestamp
    strategy.save()
  }

  let id = createEventId(event.transaction.hash, event.logIndex)
  let routerEvent = new StrategyRouterEvent(id)
  routerEvent.router = routerId
  routerEvent.chainId = chainId
  routerEvent.eventType = "STRATEGY_TOGGLED"
  routerEvent.strategy = event.params.strat
  routerEvent.enabled = event.params.enabled
  routerEvent.timestamp = event.block.timestamp
  routerEvent.blockNumber = event.block.number
  routerEvent.txHash = event.transaction.hash
  routerEvent.save()
}

export function handleWeightsSet(event: WeightsSetEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let routerId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()

  let strats = event.params.strats
  let weights = event.params.weights

  for (let i = 0; i < strats.length; i++) {
    let strategyId = routerId + "-" + strats[i].toHexString().toLowerCase()
    let strategy = VaultStrategy.load(strategyId)
    if (strategy != null) {
      strategy.weightBps = BigInt.fromI32(weights[i]).toI32()
      strategy.updatedAt = event.block.timestamp
      strategy.save()
    }
  }

  let id = createEventId(event.transaction.hash, event.logIndex)
  let routerEvent = new StrategyRouterEvent(id)
  routerEvent.router = routerId
  routerEvent.chainId = chainId
  routerEvent.eventType = "WEIGHTS_SET"
  routerEvent.timestamp = event.block.timestamp
  routerEvent.blockNumber = event.block.number
  routerEvent.txHash = event.transaction.hash
  routerEvent.save()
}

export function handleIntakeModeSet(event: IntakeModeSetEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let routerId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()

  let router = StrategyRouter.load(routerId)
  if (router != null) {
    router.intakeMode = event.params.mode
    router.updatedAt = event.block.timestamp
    router.save()
  }
}

export function handleLossCapSet(event: LossCapSetEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let routerId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()

  let router = StrategyRouter.load(routerId)
  if (router != null) {
    router.lossCapBps = event.params.capBps
    router.updatedAt = event.block.timestamp
    router.save()
  }
}

export function handleRouterOwnerChanged(event: RouterOwnerChangedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let routerId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()

  let router = StrategyRouter.load(routerId)
  if (router == null) {
    router = new StrategyRouter(routerId)
    router.router = event.address
    router.chainId = chainId
    router.createdAt = event.block.timestamp
    // Initialize harvest telemetry fields
    router.totalHarvestBatches = ZERO_BI
    router.cumulativeHarvestPnl = ZERO_BI
    router.cumulativeHarvestRealized = ZERO_BI
  }
  router.owner = event.params.newOwner
  router.updatedAt = event.block.timestamp
  router.save()
}

export function handleRouterCoreSet(event: RouterCoreSetEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let routerId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()

  let router = StrategyRouter.load(routerId)
  if (router == null) {
    router = new StrategyRouter(routerId)
    router.router = event.address
    router.chainId = chainId
    router.createdAt = event.block.timestamp
    // Initialize harvest telemetry fields
    router.totalHarvestBatches = ZERO_BI
    router.cumulativeHarvestPnl = ZERO_BI
    router.cumulativeHarvestRealized = ZERO_BI
  }
  router.core = event.params.core
  // Populate vault FK for @derivedFrom resolution (e.g. StrategyRouter { vault { id } })
  let vaultFkId = event.params.core.toHexString().toLowerCase() + "-" + chainId.toString()
  if (Vault.load(vaultFkId) != null) {
    router.vault = vaultFkId
  }
  router.updatedAt = event.block.timestamp
  router.save()
}

export function handleRouterParamsProviderSet(event: RouterParamsProviderSetEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let routerId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()

  let router = StrategyRouter.load(routerId)
  if (router != null) {
    router.paramsProvider = event.params.params
    router.updatedAt = event.block.timestamp
    router.save()
  }
}

export function handleRouterHealthRegistrySet(event: RouterHealthRegistrySetEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let routerId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()

  let router = StrategyRouter.load(routerId)
  if (router != null) {
    router.healthRegistry = event.params.registry
    router.updatedAt = event.block.timestamp
    router.save()
  }
}

export function handleSecondaryOracleSet(event: SecondaryOracleSetEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let routerId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()

  let router = StrategyRouter.load(routerId)
  if (router != null) {
    router.secondaryOracle = event.params.oracle
    router.updatedAt = event.block.timestamp
    router.save()
  }
}

export function handleMaxOracleDeviationSet(event: MaxOracleDeviationSetEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let routerId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()

  let router = StrategyRouter.load(routerId)
  if (router != null) {
    router.maxOracleDeviationBps = event.params.deviationBps
    router.updatedAt = event.block.timestamp
    router.save()
  }
}

export function handleLossCapPerStrategySet(event: LossCapPerStrategySetEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let routerId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let strategyId = routerId + "-" + event.params.strategy.toHexString().toLowerCase()

  let strategy = VaultStrategy.load(strategyId)
  if (strategy != null) {
    strategy.updatedAt = event.block.timestamp
    strategy.save()
  }
}

export function handleMaxStrategyBpsSet(event: MaxStrategyBpsSetEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let routerId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let strategyId = routerId + "-" + event.params.strategy.toHexString().toLowerCase()

  let strategy = VaultStrategy.load(strategyId)
  if (strategy != null) {
    strategy.updatedAt = event.block.timestamp
    strategy.save()
  }
}

export function handleGasPerStrategyWithdrawUpdated(event: GasPerStrategyWithdrawUpdatedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let routerId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()

  let router = StrategyRouter.load(routerId)
  if (router != null) {
    router.gasPerStrategyWithdraw = event.params.gasAmount
    router.updatedAt = event.block.timestamp
    router.save()
  }
}

// =============================================================================
// HARVEST TELEMETRY EVENT HANDLERS (Pendle-style)
// =============================================================================

export function handleStrategyHarvested(event: StrategyHarvestedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let harvest = new StrategyHarvestEvent(id)
  harvest.router = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  harvest.chainId = chainId
  harvest.strategy = event.params.strat
  harvest.pnl = event.params.pnl
  harvest.realized = event.params.realized
  harvest.success = true
  harvest.timestamp = event.block.timestamp
  harvest.blockNumber = event.block.number
  harvest.txHash = event.transaction.hash
  harvest.save()

  // Also update the VaultStrategy entity with latest harvest info
  let routerId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let strategyId = routerId + "-" + event.params.strat.toHexString().toLowerCase()
  let strategy = VaultStrategy.load(strategyId)
  if (strategy != null) {
    strategy.lastHarvestPnl = event.params.pnl
    strategy.lastHarvestRealized = event.params.realized
    strategy.lastHarvestTimestamp = event.block.timestamp
    strategy.totalHarvestCount = strategy.totalHarvestCount.plus(BigInt.fromI32(1))
    strategy.updatedAt = event.block.timestamp
    strategy.save()
  }
}

export function handleStrategyHarvestFailed(event: StrategyHarvestFailedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let harvest = new StrategyHarvestEvent(id)
  harvest.router = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  harvest.chainId = chainId
  harvest.strategy = event.params.strat
  harvest.pnl = BigInt.fromI32(0)
  harvest.realized = BigInt.fromI32(0)
  harvest.success = false
  harvest.failureReason = truncateBytes(event.params.reason, MAX_REASON_BYTES)
  harvest.timestamp = event.block.timestamp
  harvest.blockNumber = event.block.number
  harvest.txHash = event.transaction.hash
  harvest.save()

  // Update VaultStrategy with failure info
  let routerId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let strategyId = routerId + "-" + event.params.strat.toHexString().toLowerCase()
  let strategy = VaultStrategy.load(strategyId)
  if (strategy != null) {
    strategy.lastHarvestFailed = true
    strategy.lastHarvestTimestamp = event.block.timestamp
    strategy.totalHarvestFailCount = strategy.totalHarvestFailCount.plus(BigInt.fromI32(1))
    strategy.updatedAt = event.block.timestamp
    strategy.save()
  }
}

export function handleHarvestBatchSummary(event: HarvestBatchSummaryEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let batch = new HarvestBatch(id)
  batch.router = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  batch.chainId = chainId
  batch.visited = event.params.visited
  batch.aggregatePnl = event.params.aggPnl
  batch.aggregateRealized = event.params.aggRealized
  batch.timestamp = event.block.timestamp
  batch.blockNumber = event.block.number
  batch.txHash = event.transaction.hash
  batch.save()

  // Update the StrategyRouter with cumulative stats
  let routerId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let router = StrategyRouter.load(routerId)
  if (router != null) {
    router.totalHarvestBatches = router.totalHarvestBatches.plus(BigInt.fromI32(1))
    router.cumulativeHarvestPnl = router.cumulativeHarvestPnl.plus(event.params.aggPnl)
    router.cumulativeHarvestRealized = router.cumulativeHarvestRealized.plus(event.params.aggRealized)
    router.lastHarvestTimestamp = event.block.timestamp
    router.updatedAt = event.block.timestamp
    router.save()
  }
}

// =============================================================================
// ADDITIONAL CONFIGURATION EVENT HANDLERS (from Events.sol)
// =============================================================================

export function handleFeeParamsUpdated(event: FeeParamsUpdatedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let id = createEventId(event.transaction.hash, event.logIndex)

  let feeEvent = new FeeEvent(id)
  feeEvent.vault = vaultId
  feeEvent.chainId = chainId
  feeEvent.type = "DEPOSIT_FEE"
  feeEvent.timestamp = event.block.timestamp
  feeEvent.blockNumber = event.block.number
  feeEvent.txHash = event.transaction.hash
  feeEvent.save()
}

export function handlePerfParamsUpdated(event: PerfParamsUpdatedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let id = createEventId(event.transaction.hash, event.logIndex)

  let feeEvent = new FeeEvent(id)
  feeEvent.vault = vaultId
  feeEvent.chainId = chainId
  feeEvent.type = "PERF_MINT"
  feeEvent.timestamp = event.block.timestamp
  feeEvent.blockNumber = event.block.number
  feeEvent.txHash = event.transaction.hash
  feeEvent.save()
}

export function handleOpsReserveTargetSubmitted(event: OpsReserveTargetSubmittedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let id = createEventId(event.transaction.hash, event.logIndex)

  let evt = new OpsReserveTargetEvent(id)
  evt.vault = vaultId
  evt.chainId = chainId
  evt.eventType = "SUBMITTED"
  evt.bps = event.params.bps
  evt.eta = event.params.eta
  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash
  evt.save()
}

export function handleOpsReserveTargetAccepted(event: OpsReserveTargetAcceptedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let id = createEventId(event.transaction.hash, event.logIndex)

  let evt = new OpsReserveTargetEvent(id)
  evt.vault = vaultId
  evt.chainId = chainId
  evt.eventType = "ACCEPTED"
  evt.bps = event.params.bps
  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash
  evt.save()
}

export function handleOpsReserveTargetRevoked(event: OpsReserveTargetRevokedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let id = createEventId(event.transaction.hash, event.logIndex)

  let evt = new OpsReserveTargetEvent(id)
  evt.vault = vaultId
  evt.chainId = chainId
  evt.eventType = "REVOKED"
  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash
  evt.save()
}

export function handleMaxWithdrawalPerBlockUpdated(event: MaxWithdrawalPerBlockUpdatedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let id = createEventId(event.transaction.hash, event.logIndex)

  let evt = new WithdrawalLimitEvent(id)
  evt.vault = vaultId
  evt.chainId = chainId
  evt.limitType = "MAX_PER_BLOCK"
  evt.value = event.params.limit
  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash
  evt.save()
}

export function handleMaxWithdrawalPerTxUpdated(event: MaxWithdrawalPerTxUpdatedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let id = createEventId(event.transaction.hash, event.logIndex)

  let evt = new WithdrawalLimitEvent(id)
  evt.vault = vaultId
  evt.chainId = chainId
  evt.limitType = "MAX_PER_TX"
  evt.value = event.params.limit
  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash
  evt.save()
}

export function handleMinClaimAmountUpdated(event: MinClaimAmountUpdatedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let id = createEventId(event.transaction.hash, event.logIndex)

  let evt = new WithdrawalLimitEvent(id)
  evt.vault = vaultId
  evt.chainId = chainId
  evt.limitType = "MIN_CLAIM"
  evt.value = event.params.minimum
  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash
  evt.save()
}

export function handleCapPerEpochBpsUpdated(event: CapPerEpochBpsUpdatedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let id = createEventId(event.transaction.hash, event.logIndex)

  let evt = new WithdrawalLimitEvent(id)
  evt.vault = vaultId
  evt.chainId = chainId
  evt.limitType = "CAP_PER_EPOCH"
  evt.value = BigInt.fromI32(event.params.bps)
  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash
  evt.save()
}

export function handleDynamicCapConfigured(event: DynamicCapConfiguredEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let id = createEventId(event.transaction.hash, event.logIndex)

  let evt = new DynamicCapEvent(id)
  evt.vault = vaultId
  evt.chainId = chainId
  evt.minBps = event.params.minBps
  evt.maxBps = event.params.maxBps
  evt.threshold = event.params.threshold
  evt.enabled = event.params.enabled
  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash
  evt.save()
}

export function handleQueueAntiSpamConfigured(event: QueueAntiSpamConfiguredEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let id = createEventId(event.transaction.hash, event.logIndex)

  let evt = new QueueAntiSpamEvent(id)
  evt.vault = vaultId
  evt.chainId = chainId
  evt.maxClaimsPerEpoch = event.params.maxClaimsPerEpoch
  evt.cooldownSeconds = event.params.cooldownSeconds
  evt.epochDuration = event.params.epochDuration
  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash
  evt.save()
}

export function handleCircuitBreakerConfigured(event: CircuitBreakerConfiguredEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let id = createEventId(event.transaction.hash, event.logIndex)

  let evt = new CircuitBreakerEvent(id)
  evt.vault = vaultId
  evt.chainId = chainId
  evt.eventType = "CONFIGURED"
  evt.thresholdBps = event.params.thresholdBps
  evt.snapshotInterval = event.params.snapshotInterval
  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash
  evt.save()
}

export function handleCircuitBreakerTriggered(event: CircuitBreakerTriggeredEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let id = createEventId(event.transaction.hash, event.logIndex)

  let evt = new CircuitBreakerEvent(id)
  evt.vault = vaultId
  evt.chainId = chainId
  evt.eventType = "TRIGGERED"
  evt.lastTVL = event.params.lastTVL
  evt.currentTVL = event.params.currentTVL
  evt.dropBps = event.params.dropBps
  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash
  evt.save()
}

export function handleTVLSnapshotUpdated(event: TVLSnapshotUpdatedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let id = createEventId(event.transaction.hash, event.logIndex)

  let evt = new CircuitBreakerEvent(id)
  evt.vault = vaultId
  evt.chainId = chainId
  evt.eventType = "TVL_SNAPSHOT"
  evt.currentTVL = event.params.tvl
  evt.snapshotInterval = event.params.timestamp
  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash
  evt.save()
}

export function handleRebalanced(event: RebalancedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let id = createEventId(event.transaction.hash, event.logIndex)

  let evt = new RebalanceEvent(id)
  evt.vault = vaultId
  evt.chainId = chainId
  evt.fromStrategy = event.params.from
  evt.toStrategy = event.params.to
  evt.amount = event.params.amount
  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash
  evt.save()
}

export function handleEmergencyDrainStarted(event: EmergencyDrainStartedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let id = createEventId(event.transaction.hash, event.logIndex)

  let evt = new EmergencyDrainEvent(id)
  evt.vault = vaultId
  evt.chainId = chainId
  evt.eventType = "STARTED"
  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash
  evt.save()
}

export function handleEmergencyDrainCompleted(event: EmergencyDrainCompletedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let id = createEventId(event.transaction.hash, event.logIndex)

  let evt = new EmergencyDrainEvent(id)
  evt.vault = vaultId
  evt.chainId = chainId
  evt.eventType = "COMPLETED"
  evt.totalRecovered = event.params.totalRecovered
  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash
  evt.save()
}

export function handleLiquidityOpLocked(event: LiquidityOpLockedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let id = createEventId(event.transaction.hash, event.logIndex)

  let evt = new LiquidityLockEvent(id)
  evt.vault = vaultId
  evt.chainId = chainId
  evt.locked = true
  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash
  evt.save()
}

export function handleLiquidityOpUnlocked(event: LiquidityOpUnlockedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let id = createEventId(event.transaction.hash, event.logIndex)

  let evt = new LiquidityLockEvent(id)
  evt.vault = vaultId
  evt.chainId = chainId
  evt.locked = false
  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash
  evt.save()
}

export function handleFeeCollectorSet(event: FeeCollectorSetEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let id = createEventId(event.transaction.hash, event.logIndex)

  let vault = Vault.load(vaultId)
  if (vault != null) {
    vault.feeCollector = event.params.feeCollector
    vault.updatedAt = event.block.timestamp
    vault.save()

    // Source: FeeCollectorSet event payload
    let vdFc = getOrCreateVaultDeployment(vault, event.block)
    vdFc.feeCollector = event.params.feeCollector
    vdFc.updatedAt = event.block.timestamp
    vdFc.updatedAtBlock = event.block.number
    vdFc.save()
  }

  let update = new ComponentUpdate(id)
  update.vault = vaultId
  update.chainId = chainId
  update.componentType = "FEE_COLLECTOR"
  update.newAddress = event.params.feeCollector
  update.timestamp = event.block.timestamp
  update.blockNumber = event.block.number
  update.txHash = event.transaction.hash
  update.save()
}

export function handleHealthRegistrySetInVault(event: HealthRegistrySetInVaultEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let id = createEventId(event.transaction.hash, event.logIndex)

  let vault = Vault.load(vaultId)
  if (vault != null) {
    vault.healthRegistry = event.params.registry
    vault.updatedAt = event.block.timestamp
    vault.save()
  }

  let update = new ComponentUpdate(id)
  update.vault = vaultId
  update.chainId = chainId
  update.componentType = "HEALTH_REGISTRY"
  update.newAddress = event.params.registry
  update.timestamp = event.block.timestamp
  update.blockNumber = event.block.number
  update.txHash = event.transaction.hash
  update.save()
}

export function handleOracleSet(event: OracleSetEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let id = createEventId(event.transaction.hash, event.logIndex)

  let evt = new OracleConfigEvent(id)
  evt.vault = vaultId
  evt.chainId = chainId
  evt.oracle = event.params.oracle
  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash
  evt.save()

  // Source: OracleSet event payload
  let vault = Vault.load(vaultId)
  if (vault !== null) {
    let vdOr = getOrCreateVaultDeployment(vault, event.block)
    vdOr.oracle = event.params.oracle
    vdOr.updatedAt = event.block.timestamp
    vdOr.updatedAtBlock = event.block.number
    vdOr.save()
  }
}

export function handleBatchGuardrailsUpdated(event: BatchGuardrailsUpdatedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let id = createEventId(event.transaction.hash, event.logIndex)

  let evt = new BatchGuardrailsEvent(id)
  evt.vault = vaultId
  evt.chainId = chainId
  evt.maxActions = event.params.maxActions
  evt.maxNavDelta = event.params.maxNavDelta
  evt.staleness = event.params.staleness
  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash
  evt.save()
}

export function handleVaultDepositCapUpdated(event: VaultDepositCapUpdatedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let id = createEventId(event.transaction.hash, event.logIndex)

  let evt = new DepositCapEvent(id)
  evt.vault = vaultId
  evt.chainId = chainId
  evt.cap = event.params.cap
  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash
  evt.save()
}

export function handleAdapterAllowedUpdated(event: AdapterAllowedUpdatedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let id = createEventId(event.transaction.hash, event.logIndex)

  let evt = new AdapterAllowlistEvent(id)
  evt.vault = vaultId
  evt.chainId = chainId
  evt.adapter = event.params.adapter
  evt.allowed = event.params.allowed
  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash
  evt.save()
}

export function handleAdapterCapUpdated(event: AdapterCapUpdatedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let id = createEventId(event.transaction.hash, event.logIndex)

  let evt = new AdapterCapEvent(id)
  evt.vault = vaultId
  evt.chainId = chainId
  evt.adapter = event.params.adapter
  evt.cap = event.params.cap
  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash
  evt.save()
}

export function handleExternalCallFailed(event: ExternalCallFailedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let id = createEventId(event.transaction.hash, event.logIndex)

  let failure = new ExternalCallFailure(id)
  failure.vault = vaultId
  failure.chainId = chainId
  failure.target = event.params.target
  failure.functionName = event.params.functionName
  failure.reason = event.params.reason
  failure.timestamp = event.block.timestamp
  failure.blockNumber = event.block.number
  failure.txHash = event.transaction.hash
  failure.save()
}

export function handleIncentivesOnExitFailed(event: IncentivesOnExitFailedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let id = createEventId(event.transaction.hash, event.logIndex)

  let failure = new ExternalCallFailure(id)
  failure.vault = vaultId
  failure.chainId = chainId
  failure.target = event.params.user
  failure.functionName = "onExit"
  failure.reason = event.params.reason
  failure.timestamp = event.block.timestamp
  failure.blockNumber = event.block.number
  failure.txHash = event.transaction.hash
  failure.save()
}

export function handleVaultRoutingConfigured(event: VaultRoutingConfiguredEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let vaultId = event.params.vault.toHexString().toLowerCase() + "-" + chainId.toString()
  let id = createEventId(event.transaction.hash, event.logIndex)

  let evt = new VaultRoutingConfig(id)
  evt.vault = vaultId
  evt.chainId = chainId
  evt.queueModule = event.params.queueModule
  evt.adminModule = event.params.adminModule
  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash
  evt.save()

  // Source: VaultRoutingConfigured event payload — CRITICAL for ops dashboard
  let vault = Vault.load(vaultId)
  if (vault !== null) {
    let vdRc = getOrCreateVaultDeployment(vault, event.block)
    vdRc.queueModule = event.params.queueModule
    vdRc.adminModule = event.params.adminModule
    vdRc.updatedAt = event.block.timestamp
    vdRc.updatedAtBlock = event.block.number
    vdRc.save()
  }
}

// =============================================================================
// VAULT UPKEEP EVENT HANDLERS
// =============================================================================

export function handleUpkeepPerformed(event: UpkeepPerformedEvent): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let action = new UpkeepAction(id)

  action.chainId = getChainIdFromNetwork(dataSource.network())
  action.upkeep = event.address
  action.op = event.params.op
  action.arg = event.params.arg
  action.success = event.params.success

  action.timestamp = event.block.timestamp
  action.blockNumber = event.block.number
  action.txHash = event.transaction.hash

  action.save()

  // Populate VaultDeployment.vaultUpkeep via on-chain call to VaultUpkeep.core()
  let upkeepContract = VaultUpkeepContract.bind(event.address)
  let coreResult = upkeepContract.try_core()
  if (!coreResult.reverted) {
    let chainIdUp = getChainIdFromNetwork(dataSource.network())
    let vaultIdUp = coreResult.value.toHexString().toLowerCase() + "-" + chainIdUp.toString()
    let vaultUp = Vault.load(vaultIdUp)
    if (vaultUp !== null) {
      let vd = getOrCreateVaultDeployment(vaultUp, event.block)
      if (vd.vaultUpkeep === null) {
        vd.vaultUpkeep = event.address
        vd.updatedAt = event.block.timestamp
        vd.updatedAtBlock = event.block.number
        vd.save()
      }
    }
  }
}

// =============================================================================
// GLOBAL CONFIG EVENT HANDLERS (Oracle Registry)
// =============================================================================

export function handleDefaultOracleConfigSet(event: DefaultOracleConfigSetEvent): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let evt = new OracleRegistryEvent(id)

  evt.chainId = getChainIdFromNetwork(dataSource.network())
  evt.type = "DEFAULT_CONFIG_SET"
  evt.asset = null
  evt.vault = null
  evt.oracle = event.params.oracle
  evt.maxStaleness = event.params.maxStaleness

  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash

  evt.save()

  // datasource: GlobalConfig → event.address == GlobalConfig contract
  let chainId2 = getChainIdFromNetwork(dataSource.network())
  let pd = getOrCreateProtocolDeployment(chainId2, event.block)
  pd.globalConfig = event.address
  pd.priceOracle = event.params.oracle
  pd.updatedAt = event.block.timestamp
  pd.updatedAtBlock = event.block.number
  pd.save()
}

export function handleAssetOracleConfigSet(event: AssetOracleConfigSetEvent): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let evt = new OracleRegistryEvent(id)

  evt.chainId = getChainIdFromNetwork(dataSource.network())
  evt.type = "ASSET_CONFIG_SET"
  evt.asset = event.params.asset
  evt.vault = null
  evt.oracle = event.params.oracle
  evt.maxStaleness = event.params.maxStaleness

  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash

  evt.save()
}

export function handleVaultOracleOverrideSet(event: VaultOracleOverrideSetEvent): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let evt = new OracleRegistryEvent(id)

  evt.chainId = getChainIdFromNetwork(dataSource.network())
  evt.type = "VAULT_OVERRIDE_SET"
  evt.asset = null
  evt.vault = event.params.vault
  evt.oracle = event.params.oracle
  evt.maxStaleness = event.params.maxStaleness

  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash

  evt.save()
}

// =============================================================================
// PERIPHERY REWARDS PIPELINE — OpsCollector
// =============================================================================

export function handleOpsSplitExecuted(event: OpsSplitExecutedEvent): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let evt = new OpsSplitEvent(id)

  evt.chainId = getChainIdFromNetwork(dataSource.network())
  evt.totalShares = event.params.totalShares
  evt.opsShares = event.params.opsShares
  evt.growthShares = event.params.growthShares
  evt.opsWallet = event.params.opsWallet
  evt.feeDistributor = event.params.feeDistributor

  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash

  evt.save()

  // datasource: OpsCollector → event.address == OpsCollector contract
  let pdOps = getOrCreateProtocolDeployment(evt.chainId, event.block)
  pdOps.opsCollector = event.address
  pdOps.updatedAt = event.block.timestamp
  pdOps.updatedAtBlock = event.block.number
  pdOps.save()
}

export function handleSplitParamsUpdated(event: SplitParamsUpdatedEvent): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let evt = new OpsSplitParamsEvent(id)

  evt.chainId = getChainIdFromNetwork(dataSource.network())
  evt.opsBps = event.params.opsBps
  evt.growthBps = event.params.growthBps

  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash

  evt.save()
}

export function handleOpsWalletUpdated(event: OpsWalletUpdatedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())

  // Populate ProtocolDeployment.opsCollector on first config event
  let pd = getOrCreateProtocolDeployment(chainId, event.block)
  if (pd.opsCollector === null) {
    pd.opsCollector = event.address
    pd.updatedAt = event.block.timestamp
    pd.updatedAtBlock = event.block.number
    pd.save()
  }

  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let evt = new OpsAddressUpdateEvent(id)

  evt.chainId = chainId
  evt.updateType = "OPS_WALLET"
  evt.oldAddress = event.params.oldWallet
  evt.newAddress = event.params.newWallet

  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash

  evt.save()
}

export function handleFeeDistributorUpdated(event: FeeDistributorUpdatedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())

  // Populate ProtocolDeployment.feeDistributor — event.address is OpsCollector,
  // event.params.newDistributor is the FeeDistributor address
  let pd = getOrCreateProtocolDeployment(chainId, event.block)
  pd.feeDistributor = event.params.newDistributor
  pd.updatedAt = event.block.timestamp
  pd.updatedAtBlock = event.block.number
  pd.save()

  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let evt = new OpsAddressUpdateEvent(id)

  evt.chainId = chainId
  evt.updateType = "FEE_DISTRIBUTOR"
  evt.oldAddress = event.params.oldDistributor
  evt.newAddress = event.params.newDistributor

  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash

  evt.save()
}

// =============================================================================
// PERIPHERY REWARDS PIPELINE — FeeDistributor
// =============================================================================

export function handleRedeemed(event: RedeemedEvent): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let evt = new FeeDistributorRedeemEvent(id)

  evt.chainId = getChainIdFromNetwork(dataSource.network())
  evt.sharesToRedeem = event.params.sharesToRedeem
  evt.actualSharesRedeemed = event.params.actualSharesRedeemed
  evt.assetsReceived = event.params.assetsReceived
  evt.epochId = event.params.epochId.toI32()

  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash

  evt.save()

  // datasource: FeeDistributor → event.address == FeeDistributor contract
  let pdFd = getOrCreateProtocolDeployment(evt.chainId, event.block)
  pdFd.feeDistributor = event.address
  pdFd.updatedAt = event.block.timestamp
  pdFd.updatedAtBlock = event.block.number
  pdFd.save()
}

export function handleEpochFunded(event: EpochFundedEvt): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let evt = new EpochFundedEvent(id)

  evt.chainId = getChainIdFromNetwork(dataSource.network())
  evt.epochId = event.params.epochId.toI32()
  evt.assets = event.params.assets

  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash

  evt.save()
}

export function handleEpochAdvanced(event: EpochAdvancedEvt): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let evt = new EpochAdvancedEvent(id)

  evt.chainId = getChainIdFromNetwork(dataSource.network())
  evt.newEpochId = event.params.newEpochId.toI32()

  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash

  evt.save()
}

export function handleGuardrailsUpdated(event: GuardrailsUpdatedEvent): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let evt = new FeeDistributorGuardrailsEvent(id)

  evt.chainId = getChainIdFromNetwork(dataSource.network())
  evt.maxRedeemPerEpoch = event.params.maxRedeemPerEpoch
  evt.minDelayBetweenRedeems = event.params.minDelayBetweenRedeems

  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash

  evt.save()
}

export function handleEpochPayoutUpdated(event: EpochPayoutUpdatedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())

  // Populate ProtocolDeployment.epochPayout from FeeDistributor config event
  let pd = getOrCreateProtocolDeployment(chainId, event.block)
  pd.epochPayout = event.params.newPayout
  pd.updatedAt = event.block.timestamp
  pd.updatedAtBlock = event.block.number
  pd.save()

  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let evt = new FeeDistributorPayoutUpdateEvent(id)

  evt.chainId = chainId
  evt.oldPayout = event.params.oldPayout
  evt.newPayout = event.params.newPayout

  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash

  evt.save()
}

// =============================================================================
// PERIPHERY REWARDS PIPELINE — EpochPayout (Merkle Distributor)
// =============================================================================

export function handleRootPublished(event: RootPublishedEvent): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let evt = new EpochRootPublishedEvent(id)

  evt.chainId = getChainIdFromNetwork(dataSource.network())
  evt.epochId = event.params.epochId.toI32()
  evt.root = event.params.root
  evt.metadataHash = event.params.metadataHash

  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash

  evt.save()

  // datasource: EpochPayout → event.address == EpochPayout contract
  let pdEp = getOrCreateProtocolDeployment(evt.chainId, event.block)
  pdEp.epochPayout = event.address
  pdEp.updatedAt = event.block.timestamp
  pdEp.updatedAtBlock = event.block.number
  pdEp.save()
}

export function handleClaimed(event: ClaimedEvent): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let evt = new EpochClaimedEvent(id)

  evt.chainId = getChainIdFromNetwork(dataSource.network())
  evt.epochId = event.params.epochId.toI32()
  evt.category = event.params.category
  evt.beneficiary = event.params.beneficiary
  evt.amount = event.params.amount
  evt.metadataHash = event.params.metadataHash
  evt.claimedBy = event.transaction.from

  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash

  evt.save()
}

// =============================================================================
// PERIPHERY REWARDS PIPELINE — ReferralBinding
// =============================================================================

export function handleReferralBound(event: ReferralBoundEvt): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let evt = new ReferralBoundEvent(id)

  evt.chainId = getChainIdFromNetwork(dataSource.network())
  evt.user = event.params.user
  evt.referrer = event.params.referrer

  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash

  evt.save()

  // datasource: ReferralBinding → event.address == ReferralBinding contract
  let pdRb = getOrCreateProtocolDeployment(evt.chainId, event.block)
  pdRb.referralBinding = event.address
  pdRb.updatedAt = event.block.timestamp
  pdRb.updatedAtBlock = event.block.number
  pdRb.save()
}

export function handleRouterAuthorizationUpdated(event: RouterAuthorizationUpdatedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())

  // Populate ProtocolDeployment: event.address = ReferralBinding, event.params.router = DepositRouter
  if (event.params.authorized) {
    let pd = getOrCreateProtocolDeployment(chainId, event.block)
    pd.referralBinding = event.address
    pd.depositRouter = event.params.router
    pd.updatedAt = event.block.timestamp
    pd.updatedAtBlock = event.block.number
    pd.save()
  }

  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let evt = new RouterAuthorizationEvent(id)

  evt.chainId = chainId
  evt.router = event.params.router
  evt.authorized = event.params.authorized

  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash

  evt.save()
}

// =============================================================================
// PERIPHERY REWARDS PIPELINE — PartnerRegistry
// =============================================================================

export function handlePartnerRegistered(event: PartnerRegisteredEvent): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let evt = new PartnerEvent(id)

  evt.chainId = getChainIdFromNetwork(dataSource.network())
  evt.eventType = "REGISTERED"
  evt.partner = event.params.partner
  evt.enabled = event.params.terms.enabled
  evt.bps = event.params.terms.bps
  evt.capPerEpoch = event.params.terms.capPerEpoch
  evt.expiry = event.params.terms.expiry
  evt.recipient = event.params.terms.recipient

  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash

  evt.save()

  // datasource: PartnerRegistry → event.address == PartnerRegistry contract
  let pdPr = getOrCreateProtocolDeployment(evt.chainId, event.block)
  pdPr.partnerRegistry = event.address
  pdPr.updatedAt = event.block.timestamp
  pdPr.updatedAtBlock = event.block.number
  pdPr.save()
}

export function handlePartnerUpdated(event: PartnerUpdatedEvent): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let evt = new PartnerEvent(id)

  evt.chainId = getChainIdFromNetwork(dataSource.network())
  evt.eventType = "UPDATED"
  evt.partner = event.params.partner
  evt.enabled = event.params.terms.enabled
  evt.bps = event.params.terms.bps
  evt.capPerEpoch = event.params.terms.capPerEpoch
  evt.expiry = event.params.terms.expiry
  evt.recipient = event.params.terms.recipient

  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash

  evt.save()
}

export function handlePartnerDisabled(event: PartnerDisabledEvent): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let evt = new PartnerEvent(id)

  evt.chainId = getChainIdFromNetwork(dataSource.network())
  evt.eventType = "DISABLED"
  evt.partner = event.params.partner
  evt.enabled = false
  evt.bps = 0
  evt.capPerEpoch = ZERO_BI
  evt.expiry = ZERO_BI
  evt.recipient = null

  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash

  evt.save()
}

// =============================================================================
// PERIPHERY REWARDS PIPELINE — DepositRouter
// =============================================================================

export function handleDepositWithReferral(event: DepositWithReferralEvt): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let evt = new DepositWithReferralEvent(id)

  evt.chainId = getChainIdFromNetwork(dataSource.network())
  evt.user = event.params.user
  evt.referrer = event.params.referrer
  evt.assets = event.params.assets
  evt.shares = event.params.shares

  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash

  evt.save()

  // datasource: DepositRouter → event.address == DepositRouter contract
  let pdDr = getOrCreateProtocolDeployment(evt.chainId, event.block)
  pdDr.depositRouter = event.address
  pdDr.updatedAt = event.block.timestamp
  pdDr.updatedAtBlock = event.block.number
  pdDr.save()
}

export function handleReferralBindingSkipped(event: ReferralBindingSkippedEvt): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let evt = new ReferralBindingSkippedEvent(id)

  evt.chainId = getChainIdFromNetwork(dataSource.network())
  evt.user = event.params.user
  evt.referrer = event.params.referrer
  evt.reason = event.params.reason

  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash

  evt.save()
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERIPHERY UPKEEP ADAPTER HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export function handlePeripheryUpkeepPerformed(event: PeripheryUpkeepPerformedEvt): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let evt = new PeripheryUpkeepEvent(id)

  evt.chainId = getChainIdFromNetwork(dataSource.network())

  // PeripheryOp enum: 1=SPLIT, 2=REDEEM, 3=FUND
  let opVal = event.params.op
  if (opVal == 1) {
    evt.op = "SPLIT"
  } else if (opVal == 2) {
    evt.op = "REDEEM"
  } else if (opVal == 3) {
    evt.op = "FUND"
  } else {
    evt.op = "UNKNOWN"
  }

  evt.timestamp = event.block.timestamp
  evt.blockNumber = event.block.number
  evt.txHash = event.transaction.hash

  evt.save()
}

// =============================================================================
// STRATEGY UPKEEP EVENT HANDLERS (LendingStrategyUpkeep v4)
// =============================================================================

export function handleStrategyUpkeepPerformed(event: StrategyUpkeepPerformedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()

  let action = new UpkeepAction(id)
  action.chainId = chainId
  action.upkeep = event.address
  action.op = event.params.op
  action.arg = ZERO_BI
  action.success = true
  action.timestamp = event.block.timestamp
  action.blockNumber = event.block.number
  action.txHash = event.transaction.hash
  action.save()
}

export function handleStrategyUpkeepErrored(event: StrategyUpkeepErroredEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()

  let action = new UpkeepAction(id)
  action.chainId = chainId
  action.upkeep = event.address
  action.op = event.params.op
  action.arg = ZERO_BI
  action.success = false
  action.timestamp = event.block.timestamp
  action.blockNumber = event.block.number
  action.txHash = event.transaction.hash
  action.save()
}

export function handleUpkeepStrategyAdded(event: UpkeepStrategyAddedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let bindingId = event.address.toHexString().toLowerCase() + "-" + event.params.strategy.toHexString().toLowerCase() + "-" + chainId.toString()

  let binding = new StrategyUpkeepBinding(bindingId)
  binding.chainId = chainId
  binding.strategyUpkeep = event.address
  binding.strategyAddress = event.params.strategy
  binding.upkeepKind = "lending"
  binding.vault = null
  binding.updatedAt = event.block.timestamp
  binding.save()
}

export function handleUpkeepStrategyRemoved(event: UpkeepStrategyRemovedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let bindingId = event.address.toHexString().toLowerCase() + "-" + event.params.strategy.toHexString().toLowerCase() + "-" + chainId.toString()
  let binding = StrategyUpkeepBinding.load(bindingId)
  if (binding !== null) {
    binding.updatedAt = event.block.timestamp
    binding.save()
  }
}

export function handleUpkeepStrategyToggled(event: UpkeepStrategyToggledEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let bindingId = event.address.toHexString().toLowerCase() + "-" + event.params.strategy.toHexString().toLowerCase() + "-" + chainId.toString()
  let binding = StrategyUpkeepBinding.load(bindingId)
  if (binding !== null) {
    binding.updatedAt = event.block.timestamp
    binding.save()
  }
}

// =============================================================================
// FEE COLLECTOR UPKEEP EVENT HANDLERS
// =============================================================================

export function handleFeeDistributionTriggered(event: DistributionTriggeredEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()

  let action = new UpkeepAction(id)
  action.chainId = chainId
  action.upkeep = event.address
  action.op = 0
  action.arg = ZERO_BI
  action.success = true
  action.timestamp = event.block.timestamp
  action.blockNumber = event.block.number
  action.txHash = event.transaction.hash
  action.save()

  // datasource: FeeCollectorUpkeep → event.address == FeeCollectorUpkeep
  let pd = getOrCreateProtocolDeployment(chainId, event.block)
  pd.feeCollectorUpkeep = event.address
  pd.updatedAt = event.block.timestamp
  pd.updatedAtBlock = event.block.number
  pd.save()
}

export function handleFeeDistributionFailed(event: DistributionFailedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()

  let action = new UpkeepAction(id)
  action.chainId = chainId
  action.upkeep = event.address
  action.op = 0
  action.arg = ZERO_BI
  action.success = false
  action.timestamp = event.block.timestamp
  action.blockNumber = event.block.number
  action.txHash = event.transaction.hash
  action.save()
}

// =============================================================================
// STRATEGY ADAPTER EVENT HANDLERS
// =============================================================================

function getOrCreateAdapterBinding(
  strategyAddress: Address, adapterAddress: Address, chainId: i32, block: ethereum.Block
): AdapterBinding {
  let id = strategyAddress.toHexString().toLowerCase() + "-" + adapterAddress.toHexString().toLowerCase() + "-" + chainId.toString()
  let binding = AdapterBinding.load(id)
  if (binding == null) {
    binding = new AdapterBinding(id)
    binding.chainId = chainId
    binding.adapter = adapterAddress

    // Resolve strategy deployment + vault
    let sdId = strategyAddress.toHexString().toLowerCase()
    // Strategy deployment ID is "{strategyAddress}-{vaultId}" — we need to find it
    // Use the StrategyRouter.core() pattern: read core from strategy contract
    let strat = StrategyTemplateContract.bind(strategyAddress)
    let coreResult = strat.try_core()
    if (!coreResult.reverted) {
      let vaultId = coreResult.value.toHexString().toLowerCase() + "-" + chainId.toString()
      binding.vault = vaultId
      binding.strategy = strategyAddress.toHexString().toLowerCase() + "-" + vaultId
    }

    binding.enabled = true
    binding.flagged = false
    binding.activatedAt = null
    binding.consecutiveFailures = 0
    binding.quarantined = false
    binding.createdAtBlock = block.number
    binding.updatedAtBlock = block.number
  }
  return binding as AdapterBinding
}

export function handleAdapterAdded(event: AdapterAddedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let binding = getOrCreateAdapterBinding(event.address, event.params.adapter, chainId, event.block)
  binding.enabled = true
  binding.updatedAtBlock = event.block.number
  binding.save()
}

export function handleAdapterToggled(event: AdapterToggledEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let binding = getOrCreateAdapterBinding(event.address, event.params.adapter, chainId, event.block)
  binding.enabled = event.params.enabled
  binding.updatedAtBlock = event.block.number
  binding.save()
}

export function handleAdapterActivated(event: AdapterActivatedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let binding = getOrCreateAdapterBinding(event.address, event.params.adapter, chainId, event.block)
  binding.activatedAt = event.params.activatedAt
  binding.updatedAtBlock = event.block.number
  binding.save()
}

export function handleAdapterAutoQuarantined(event: AdapterAutoQuarantinedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let binding = getOrCreateAdapterBinding(event.address, event.params.adapter, chainId, event.block)
  binding.consecutiveFailures = event.params.consecutiveFailures
  binding.quarantined = true
  binding.updatedAtBlock = event.block.number
  binding.save()
}

export function handleAdapterFlagged(event: AdapterFlaggedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let binding = getOrCreateAdapterBinding(event.address, event.params.adapter, chainId, event.block)
  binding.flagged = event.params.flagged
  binding.updatedAtBlock = event.block.number
  binding.save()
}

// =============================================================================
// INCENTIVES ENGINE v2 — VaultTemplate handlers (events from CoreVault)
// =============================================================================

export function handleIncentivesEngineUpdated(event: ethereum.Event): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let newEngine = event.parameters[0].value.toAddress()

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let componentUpdate = new ComponentUpdate(id)
  componentUpdate.vault = vaultId
  componentUpdate.chainId = chainId
  componentUpdate.componentType = "INCENTIVES_ENGINE"
  componentUpdate.newAddress = newEngine
  componentUpdate.timestamp = event.block.timestamp
  componentUpdate.blockNumber = event.block.number
  componentUpdate.txHash = event.transaction.hash
  componentUpdate.save()

  // Create template to index IncentivesEngine events
  IncentivesEngineTemplate.create(newEngine)
}

export function handleRewardsPayoutManagerUpdated(event: ethereum.Event): void {
  let vaultId = getVaultId(event.address)
  let vault = Vault.load(vaultId)
  if (vault == null) return

  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = createEventId(event.transaction.hash, event.logIndex)

  let componentUpdate = new ComponentUpdate(id)
  componentUpdate.vault = vaultId
  componentUpdate.chainId = chainId
  componentUpdate.componentType = "REWARDS_PAYOUT_MANAGER"
  componentUpdate.newAddress = event.parameters[0].value.toAddress()
  componentUpdate.timestamp = event.block.timestamp
  componentUpdate.blockNumber = event.block.number
  componentUpdate.txHash = event.transaction.hash
  componentUpdate.save()
}

export function handleRewardSharesMinted(event: ethereum.Event): void {
  // Informational — no entity update needed beyond transaction logging
}

// =============================================================================
// INCENTIVES ENGINE v2 — IncentivesEngineTemplate handlers
// =============================================================================

export function handleTrancheCreated(event: ethereum.Event): void {
  let user = event.parameters[0].value.toAddress()
  let idx = event.parameters[1].value.toBigInt()
  let principalWad = event.parameters[2].value.toBigInt()
  let paramsId = event.parameters[3].value.toI32()

  let id = event.address.toHexString() + "-" + user.toHexString() + "-" + idx.toString()
  let tranche = new DepositTranche(id)
  tranche.engine = event.address
  tranche.user = user
  tranche.trancheIdx = idx
  tranche.principalWad = principalWad
  tranche.depositTs = event.block.timestamp
  tranche.lastAccrualTs = event.block.timestamp
  tranche.paramsId = paramsId
  tranche.active = true
  tranche.createdAt = event.block.timestamp
  tranche.updatedAt = event.block.timestamp
  tranche.save()
}

export function handleTrancheConsumed(event: ethereum.Event): void {
  let user = event.parameters[0].value.toAddress()
  let idx = event.parameters[1].value.toBigInt()
  let consumedWad = event.parameters[2].value.toBigInt()

  let id = event.address.toHexString() + "-" + user.toHexString() + "-" + idx.toString()
  let tranche = DepositTranche.load(id)
  if (tranche == null) return

  tranche.principalWad = tranche.principalWad.minus(consumedWad)
  if (tranche.principalWad.isZero()) {
    tranche.active = false
  }
  tranche.updatedAt = event.block.timestamp
  tranche.save()
}

export function handleTranchesConsolidated(event: ethereum.Event): void {
  // Consolidation changes tranche array — full reload needed from contract
  // For now, just log the event
}

export function handleRewardVestingCreated(event: ethereum.Event): void {
  let user = event.parameters[0].value.toAddress()
  let idx = event.parameters[1].value.toBigInt()
  let rewardUnits = event.parameters[2].value.toBigInt()
  let modeRaw = event.parameters[3].value.toI32()

  let mode: string
  if (modeRaw == 0) mode = "VAULT_SHARES"
  else if (modeRaw == 1) mode = "MULTYR_TOKEN"
  else mode = "USDC"

  let id = event.address.toHexString() + "-" + user.toHexString() + "-" + idx.toString()
  let vesting = new RewardVestingTranche(id)
  vesting.engine = event.address
  vesting.user = user
  vesting.vestingIdx = idx
  vesting.rewardUnits = rewardUnits
  vesting.vestStart = event.block.timestamp
  vesting.vestDurationDays = 180 // default, could be read from params
  vesting.withdrawnUnits = BigInt.zero()
  vesting.paramsId = 0 // could be read from contract
  vesting.mode = mode
  vesting.conversionRatio = BigInt.fromI64(1000000000000000000) // 1e18 = 1:1
  vesting.active = true
  vesting.createdAt = event.block.timestamp
  vesting.updatedAt = event.block.timestamp
  vesting.save()
}

export function handleRewardSlashed(event: ethereum.Event): void {
  let user = event.parameters[0].value.toAddress()
  let idx = event.parameters[1].value.toBigInt()
  let slashedUnits = event.parameters[2].value.toBigInt()

  let id = event.address.toHexString() + "-" + user.toHexString() + "-" + idx.toString()
  let vesting = RewardVestingTranche.load(id)
  if (vesting == null) return

  vesting.rewardUnits = vesting.rewardUnits.minus(slashedUnits)
  vesting.updatedAt = event.block.timestamp
  vesting.save()
}

export function handleRewardWithdrawn(event: ethereum.Event): void {
  let user = event.parameters[0].value.toAddress()
  let idx = event.parameters[1].value.toBigInt()
  let paidUnits = event.parameters[2].value.toBigInt()

  let id = event.address.toHexString() + "-" + user.toHexString() + "-" + idx.toString()
  let vesting = RewardVestingTranche.load(id)
  if (vesting == null) return

  vesting.withdrawnUnits = vesting.withdrawnUnits.plus(paidUnits)
  vesting.updatedAt = event.block.timestamp
  vesting.save()
}

export function handleIncentiveParamsUpdated(event: ethereum.Event): void {
  let paramsId = event.parameters[0].value.toI32()

  let id = event.address.toHexString() + "-" + paramsId.toString()
  let params = new IncentiveParamsSet(id)
  params.engine = event.address
  params.paramsId = paramsId
  // Tuple fields would need proper decoding — simplified for now
  params.cliffDays = 30
  params.fullDays = 180
  params.vestingDays = 180
  params.bmaxWad = BigInt.fromI64(30000000000000000) // 3e16
  params.rewardMode = "VAULT_SHARES"
  params.active = true
  params.effectiveFrom = event.block.timestamp
  params.blockTimestamp = event.block.timestamp
  params.txHash = event.transaction.hash
  params.save()
}

export function handleIncentivesGovernanceTransferred(event: ethereum.Event): void {
  // Informational — governance change logged
}

// =============================================================================
// NEW HANDLERS — Pre-Shadow Hardening (VaultUpkeep, Core, FeeDistributor, IncentivesEngine)
// =============================================================================

export function handleRealizeForQueueFailed(event: ethereum.Event): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let entity = new RealizeForQueueFailureEvent(id)
  entity.chainId = getChainIdFromNetwork(dataSource.network())
  entity.target = event.parameters[0].value.toBigInt()
  entity.reason = event.parameters[1].value.toBytes()
  entity.timestamp = event.block.timestamp
  entity.blockNumber = event.block.number
  entity.txHash = event.transaction.hash
  entity.save()
}

export function handleDeployRealizeCooldownSet(event: ethereum.Event): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let entity = new UpkeepConfigEvent(id)
  entity.chainId = getChainIdFromNetwork(dataSource.network())
  entity.paramName = "deployRealizeCooldown"
  entity.value = event.parameters[0].value.toBigInt()
  entity.timestamp = event.block.timestamp
  entity.blockNumber = event.block.number
  entity.txHash = event.transaction.hash
  entity.save()
}

export function handleReconcileHighThresholdSet(event: ethereum.Event): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let entity = new UpkeepConfigEvent(id)
  entity.chainId = getChainIdFromNetwork(dataSource.network())
  entity.paramName = "reconcileHighThreshold"
  entity.value = event.parameters[0].value.toBigInt()
  entity.timestamp = event.block.timestamp
  entity.blockNumber = event.block.number
  entity.txHash = event.transaction.hash
  entity.save()
}

export function handleStrategyRebalanceCooldownSet(event: ethereum.Event): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let entity = new UpkeepConfigEvent(id)
  entity.chainId = getChainIdFromNetwork(dataSource.network())
  entity.paramName = "strategyRebalanceCooldown"
  entity.value = event.parameters[0].value.toBigInt()
  entity.timestamp = event.block.timestamp
  entity.blockNumber = event.block.number
  entity.txHash = event.transaction.hash
  entity.save()
}

export function handleRealizedForQueue(event: ethereum.Event): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let entity = new StrategyRebalanceEvent(id)
  entity.chainId = getChainIdFromNetwork(dataSource.network())
  entity.totalMoved = event.parameters[1].value.toBigInt()
  entity.strategyCount = BigInt.fromI32(0)
  entity.timestamp = event.block.timestamp
  entity.blockNumber = event.block.number
  entity.txHash = event.transaction.hash
  entity.save()
}

export function handleStrategiesRebalanced(event: ethereum.Event): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let entity = new StrategyRebalanceEvent(id)
  entity.chainId = getChainIdFromNetwork(dataSource.network())
  entity.totalMoved = event.parameters[0].value.toBigInt()
  entity.strategyCount = event.parameters[1].value.toBigInt()
  entity.timestamp = event.block.timestamp
  entity.blockNumber = event.block.number
  entity.txHash = event.transaction.hash
  entity.save()
}

export function handleQueuePrescanBoundHit(event: ethereum.Event): void {
  // Telemetry event — logged but no entity needed
}

export function handleMinDelaySubmitted(event: ethereum.Event): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let entity = new MinDelayEvent(id)
  entity.chainId = getChainIdFromNetwork(dataSource.network())
  entity.action = "submitted"
  entity.newDelay = event.parameters[0].value.toBigInt()
  entity.eta = event.parameters[1].value.toBigInt()
  entity.timestamp = event.block.timestamp
  entity.blockNumber = event.block.number
  entity.txHash = event.transaction.hash
  entity.save()
}

export function handleMinDelayAccepted(event: ethereum.Event): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let entity = new MinDelayEvent(id)
  entity.chainId = getChainIdFromNetwork(dataSource.network())
  entity.action = "accepted"
  entity.newDelay = event.parameters[0].value.toBigInt()
  entity.timestamp = event.block.timestamp
  entity.blockNumber = event.block.number
  entity.txHash = event.transaction.hash
  entity.save()
}

export function handleMinDelayRevoked(event: ethereum.Event): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let entity = new MinDelayEvent(id)
  entity.chainId = getChainIdFromNetwork(dataSource.network())
  entity.action = "revoked"
  entity.timestamp = event.block.timestamp
  entity.blockNumber = event.block.number
  entity.txHash = event.transaction.hash
  entity.save()
}

export function handleRedeemPauseUpdated(event: ethereum.Event): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let entity = new PauseEvent(id)
  entity.chainId = getChainIdFromNetwork(dataSource.network())
  entity.contract = "FeeDistributor"
  entity.pauseType = "redeem"
  entity.paused = event.parameters[0].value.toBoolean()
  entity.timestamp = event.block.timestamp
  entity.blockNumber = event.block.number
  entity.txHash = event.transaction.hash
  entity.save()
}

export function handleFundingPauseUpdated(event: ethereum.Event): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let entity = new PauseEvent(id)
  entity.chainId = getChainIdFromNetwork(dataSource.network())
  entity.contract = "FeeDistributor"
  entity.pauseType = "funding"
  entity.paused = event.parameters[0].value.toBoolean()
  entity.timestamp = event.block.timestamp
  entity.blockNumber = event.block.number
  entity.txHash = event.transaction.hash
  entity.save()
}

// --- IncentivesEngine Reconcile Lifecycle ---

export function handleExitPendingRecorded(event: ethereum.Event): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let entity = new ReconcileEvent(id)
  entity.chainId = getChainIdFromNetwork(dataSource.network())
  entity.eventType = "pending"
  entity.user = event.parameters[0].value.toAddress()
  entity.assetsExitedWad = event.parameters[1].value.toBigInt()
  entity.pendingId = event.parameters[2].value.toBigInt()
  entity.timestamp = event.block.timestamp
  entity.blockNumber = event.block.number
  entity.txHash = event.transaction.hash
  entity.save()
}

export function handleExitReconciled(event: ethereum.Event): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let entity = new ReconcileEvent(id)
  entity.chainId = getChainIdFromNetwork(dataSource.network())
  entity.eventType = "reconciled"
  entity.user = event.parameters[0].value.toAddress()
  entity.pendingId = event.parameters[1].value.toBigInt()
  entity.vestedUnits = event.parameters[2].value.toBigInt()
  entity.slashedUnits = event.parameters[3].value.toBigInt()
  entity.timestamp = event.block.timestamp
  entity.blockNumber = event.block.number
  entity.txHash = event.transaction.hash
  entity.save()
}

export function handleExitReconcileFailed(event: ethereum.Event): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let entity = new ReconcileEvent(id)
  entity.chainId = getChainIdFromNetwork(dataSource.network())
  entity.eventType = "failed"
  entity.user = event.parameters[0].value.toAddress()
  entity.pendingId = event.parameters[1].value.toBigInt()
  entity.reason = event.parameters[2].value.toBytes()
  entity.timestamp = event.block.timestamp
  entity.blockNumber = event.block.number
  entity.txHash = event.transaction.hash
  entity.save()
}

export function handleExitReconcileSkipped(event: ethereum.Event): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let entity = new ReconcileEvent(id)
  entity.chainId = getChainIdFromNetwork(dataSource.network())
  entity.eventType = "skipped"
  entity.user = event.parameters[0].value.toAddress()
  entity.pendingId = event.parameters[1].value.toBigInt()
  entity.timestamp = event.block.timestamp
  entity.blockNumber = event.block.number
  entity.txHash = event.transaction.hash
  entity.save()
}

export function handleReconcileBatchCompleted(event: ethereum.Event): void {
  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let entity = new ReconcileEvent(id)
  entity.chainId = getChainIdFromNetwork(dataSource.network())
  entity.eventType = "batchCompleted"
  entity.processed = event.parameters[0].value.toBigInt()
  entity.remaining = event.parameters[1].value.toBigInt()
  entity.timestamp = event.block.timestamp
  entity.blockNumber = event.block.number
  entity.txHash = event.transaction.hash
  entity.save()
}

export function handleIncentivesCoreSet(event: ethereum.Event): void {
  // Informational — IncentivesEngine core address changed
}

export function handleIncentivesTreasurySet(event: ethereum.Event): void {
  // Informational — IncentivesEngine treasury address changed
}

// =============================================================================
// v2.0.7 — STRATEGY V10 LIFECYCLE HANDLERS (Option B+)
// =============================================================================

// Resolve StrategyDeployment id from a strategy address by reading strategy.core()
function strategyDeploymentId(strategyAddress: Address, chainId: i32): string {
  let strat = StrategyTemplateContract.bind(strategyAddress)
  let coreResult = strat.try_core()
  if (coreResult.reverted) {
    // Fallback: best-effort id (vault unresolved). Still unique per (strategy,chain).
    return strategyAddress.toHexString().toLowerCase() + "-unknown-" + chainId.toString()
  }
  let vaultId = coreResult.value.toHexString().toLowerCase() + "-" + chainId.toString()
  return strategyAddress.toHexString().toLowerCase() + "-" + vaultId
}

export function handleRegimeChanged(event: RegimeChangedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let sdId = strategyDeploymentId(event.address, chainId)

  let snapId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let snap = RegimeSnapshot.load(snapId)
  if (snap == null) {
    snap = new RegimeSnapshot(snapId)
    snap.chainId = chainId
    snap.strategy = sdId
  }
  snap.regime = event.params.regime
  snap.changedAtBlock = event.block.number
  snap.changedAtTimestamp = event.block.timestamp
  snap.save()

  let evId = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let ev = new RegimeChangeEvent(evId)
  ev.chainId = chainId
  ev.strategy = sdId
  ev.regime = event.params.regime
  ev.blockNumber = event.block.number
  ev.timestamp = event.block.timestamp
  ev.txHash = event.transaction.hash
  ev.save()
}

export function handleStabilityUpdated(event: StabilityUpdatedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let sdId = strategyDeploymentId(event.address, chainId)

  let snapId = event.address.toHexString().toLowerCase() + "-" + event.params.adapter.toHexString().toLowerCase() + "-" + chainId.toString()
  let snap = StabilitySnapshot.load(snapId)
  if (snap == null) {
    snap = new StabilitySnapshot(snapId)
    snap.chainId = chainId
    snap.strategy = sdId
    snap.adapter = event.params.adapter
  }
  snap.prevApyBps = event.params.prevApyBps
  snap.currApyBps = event.params.currApyBps
  snap.rawStabilityBps = event.params.rawStabilityBps
  snap.emaStabilityBps = event.params.emaStabilityBps
  snap.updatedAtBlock = event.block.number
  snap.updatedAtTimestamp = event.block.timestamp
  snap.save()

  let evId = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let ev = new StabilityUpdateEvent(evId)
  ev.chainId = chainId
  ev.strategy = sdId
  ev.adapter = event.params.adapter
  ev.prevApyBps = event.params.prevApyBps
  ev.currApyBps = event.params.currApyBps
  ev.rawStabilityBps = event.params.rawStabilityBps
  ev.emaStabilityBps = event.params.emaStabilityBps
  ev.blockNumber = event.block.number
  ev.timestamp = event.block.timestamp
  ev.save()
}

export function handleGasEmaUpdated(event: GasEmaUpdatedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let sdId = strategyDeploymentId(event.address, chainId)
  let direction = event.params.isDeposit ? "deposit" : "withdraw"
  let snapId = event.address.toHexString().toLowerCase() + "-" + event.params.adapter.toHexString().toLowerCase() + "-" + direction + "-" + chainId.toString()
  let snap = GasEmaSnapshot.load(snapId)
  if (snap == null) {
    snap = new GasEmaSnapshot(snapId)
    snap.chainId = chainId
    snap.strategy = sdId
    snap.adapter = event.params.adapter
    snap.isDeposit = event.params.isDeposit
  }
  snap.emaGas = event.params.emaGas
  snap.updatedAtBlock = event.block.number
  snap.updatedAtTimestamp = event.block.timestamp
  snap.save()
}

export function handleRebalancePlanCreated(event: RebalancePlanCreatedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let sdId = strategyDeploymentId(event.address, chainId)
  let planId = event.transaction.hash.toHex() + "-" + event.logIndex.toString()

  let plan = new RebalancePlan(planId)
  plan.chainId = chainId
  plan.strategy = sdId
  plan.actionCount = event.params.actionCount
  plan.totalMoved = event.params.totalMoved
  plan.tvlSnapshot = event.params.tvlSnapshot
  plan.status = "CREATED"
  plan.createdAtBlock = event.block.number
  plan.createdAtTimestamp = event.block.timestamp
  plan.save()
}

// Resolve most-recent RebalancePlan for a strategy by scanning from this tx.
// Graph Node doesn't support queries in mappings; we use a "latest plan per strategy"
// convention via a synthetic singleton id. Instead, we attach steps to the
// latest plan id stored on StrategyDeployment via updatedAtBlock heuristic.
// To keep it simple: RebalanceStep.plan = last RebalancePlanCreated id in SAME tx (guaranteed adjacent).
// Since graph-node provides no reverse lookup, we emit steps with plan = null if none seen yet in tx.
// Simpler approach: link step to plan by the same-tx assumption (steps follow created in same tx).
// Given AssemblyScript limits, we derive the "latest plan id" from a helper entity.

// For Option B+ we use StrategyDeployment field lastRebalancePlanId (added below as transient via ScoringSnapshot? no)
// Solution: introduce a minimal transient helper — store last plan id on StrategyHealthFlag (reused).

export function handleRebalanceStepExecuted(event: RebalanceStepExecutedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let sdId = strategyDeploymentId(event.address, chainId)
  let stepId = event.transaction.hash.toHex() + "-" + event.logIndex.toString()

  // Best-effort: find the RebalancePlan in SAME tx by scanning logIndex backwards is impossible in AS.
  // Use convention: plan id = txHash + "-0" is NOT valid (logIndex varies).
  // Instead, store the last plan id via StrategyHealthFlag.lastRebalancePlanId (informational field).
  // For now, create the step with a synthetic plan id matching the strategy + tx — acceptable fallback.
  // The subgraph clients can correlate plan+steps via the tx hash prefix.
  let fallbackPlanId = event.transaction.hash.toHex() + "-plan-" + sdId
  let plan = RebalancePlan.load(fallbackPlanId)
  if (plan == null) {
    // Create an orphan plan marker so the step has a valid FK
    plan = new RebalancePlan(fallbackPlanId)
    plan.chainId = chainId
    plan.strategy = sdId
    plan.actionCount = 0
    plan.totalMoved = ZERO_BI
    plan.tvlSnapshot = ZERO_BI
    plan.status = "CREATED"
    plan.createdAtBlock = event.block.number
    plan.createdAtTimestamp = event.block.timestamp
    plan.save()
  }

  let step = new RebalanceStep(stepId)
  step.chainId = chainId
  step.plan = fallbackPlanId
  step.fromAction = event.params.fromAction
  step.toAction = event.params.toAction
  step.blockNumber = event.block.number
  step.timestamp = event.block.timestamp
  step.save()
}

export function handleRebalancePlanCancelled(event: RebalancePlanCancelledEvent): void {
  // Status change on the most-recent plan — best-effort via tx-synthesized id
  let chainId = getChainIdFromNetwork(dataSource.network())
  let sdId = strategyDeploymentId(event.address, chainId)
  let fallbackPlanId = event.transaction.hash.toHex() + "-plan-" + sdId
  let plan = RebalancePlan.load(fallbackPlanId)
  if (plan != null) {
    plan.status = "CANCELLED"
    plan.settledAtBlock = event.block.number
    plan.settledAtTimestamp = event.block.timestamp
    plan.save()
  }
}

export function handleRebalancePlanInvalidated(event: RebalancePlanInvalidatedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let sdId = strategyDeploymentId(event.address, chainId)
  let fallbackPlanId = event.transaction.hash.toHex() + "-plan-" + sdId
  let plan = RebalancePlan.load(fallbackPlanId)
  if (plan != null) {
    plan.status = "INVALIDATED"
    plan.invalidationPlanTvl = event.params.planTvl
    plan.invalidationCurrentTvl = event.params.currentTvl
    plan.settledAtBlock = event.block.number
    plan.settledAtTimestamp = event.block.timestamp
    plan.save()
  }
}

function saveAdapterSkip(
  strategy: string, chainId: i32, event: ethereum.Event, adapter: Address, reason: string,
  cachedTVL: BigInt | null, confidence: BigInt | null, current: BigInt | null, cap: BigInt | null, age: BigInt | null
): void {
  let evId = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let ev = new AdapterSkipEvent(evId)
  ev.chainId = chainId
  ev.strategy = strategy
  ev.adapter = adapter
  ev.reason = reason
  ev.cachedTVL = cachedTVL
  ev.confidence = confidence
  ev.current = current
  ev.cap = cap
  ev.age = age
  ev.blockNumber = event.block.number
  ev.timestamp = event.block.timestamp
  ev.save()
}

export function handleAdapterSkippedLowConfidence(event: AdapterSkippedLowConfidenceEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let sdId = strategyDeploymentId(event.address, chainId)
  saveAdapterSkip(sdId, chainId, event, event.params.adapter, "LOW_CONFIDENCE",
    event.params.cachedTVL, event.params.confidence, null, null, null)
}

export function handleAdapterSkippedOverCap(event: AdapterSkippedOverCapEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let sdId = strategyDeploymentId(event.address, chainId)
  saveAdapterSkip(sdId, chainId, event, event.params.adapter, "OVER_CAP",
    null, null, event.params.current, event.params.cap, null)
}

export function handleAdapterUsingStaleExternalTVL(event: AdapterUsingStaleExternalTVLEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let sdId = strategyDeploymentId(event.address, chainId)
  saveAdapterSkip(sdId, chainId, event, event.params.adapter, "STALE_EXTERNAL_TVL",
    event.params.cachedTVL, null, null, null, event.params.age)
}

function saveAdapterFailure(
  strategy: string, chainId: i32, event: ethereum.Event, adapter: Address, kind: string,
  amount: BigInt | null, reason: Bytes | null
): void {
  let evId = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let ev = new AdapterFailureEvent(evId)
  ev.chainId = chainId
  ev.strategy = strategy
  ev.adapter = adapter
  ev.kind = kind
  ev.amount = amount
  ev.reason = reason
  ev.blockNumber = event.block.number
  ev.timestamp = event.block.timestamp
  ev.save()
}

export function handleAdapterDepositFailed(event: AdapterDepositFailedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let sdId = strategyDeploymentId(event.address, chainId)
  saveAdapterFailure(sdId, chainId, event, event.params.adapter, "DEPOSIT", event.params.amount, event.params.reason)
}

export function handleAdapterWithdrawFailed(event: AdapterWithdrawFailedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let sdId = strategyDeploymentId(event.address, chainId)
  saveAdapterFailure(sdId, chainId, event, event.params.adapter, "WITHDRAW", event.params.amount, event.params.reason)
}

export function handleAdapterHarvestFailed(event: AdapterHarvestFailedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let sdId = strategyDeploymentId(event.address, chainId)
  saveAdapterFailure(sdId, chainId, event, event.params.adapter, "HARVEST", null, event.params.reason)
}

export function handleAdapterFundsStranded(event: AdapterFundsStrandedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let sdId = strategyDeploymentId(event.address, chainId)
  saveAdapterFailure(sdId, chainId, event, event.params.adapter, "FUNDS_STRANDED", event.params.amount, null)
}

export function handleScoringComputed(event: ScoringComputedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let sdId = strategyDeploymentId(event.address, chainId)
  let snapId = event.address.toHexString().toLowerCase() + "-" + event.params.adapter.toHexString().toLowerCase() + "-" + chainId.toString()
  let snap = ScoringSnapshot.load(snapId)
  if (snap == null) {
    snap = new ScoringSnapshot(snapId)
    snap.chainId = chainId
    snap.strategy = sdId
    snap.adapter = event.params.adapter
  }
  snap.scoreRaw = event.params.scoreRaw
  snap.scoreNorm = event.params.scoreNorm
  snap.targetAlloc = event.params.targetAlloc
  snap.currentPos = event.params.currentPos
  snap.apyBps = event.params.apyBps
  snap.liqBps = event.params.liqBps
  snap.riskBps = event.params.riskBps
  snap.stabilityBps = event.params.stabilityBps
  snap.incentiveBps = event.params.incentiveBps
  snap.updatedAtBlock = event.block.number
  snap.updatedAtTimestamp = event.block.timestamp
  snap.save()
}

export function handleDeployIdleExecuted(event: DeployIdleExecutedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let sdId = strategyDeploymentId(event.address, chainId)
  let evId = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let ev = new DeployIdleEvent(evId)
  ev.chainId = chainId
  ev.strategy = sdId
  ev.deployed = event.params.deployed
  ev.remainingIdle = event.params.remainingIdle
  ev.blockNumber = event.block.number
  ev.timestamp = event.block.timestamp
  ev.save()
}

export function handleDegradedViewsObserved(event: DegradedViewsObservedEvent): void {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let sdId = strategyDeploymentId(event.address, chainId)
  let flagId = event.address.toHexString().toLowerCase() + "-" + chainId.toString()
  let flag = StrategyHealthFlag.load(flagId)
  if (flag == null) {
    flag = new StrategyHealthFlag(flagId)
    flag.chainId = chainId
    flag.strategy = sdId
  }
  flag.degraded = true
  flag.fallbackBps = event.params.fallbackBps
  flag.lastDegradedObservedAtBlock = event.block.number
  flag.lastDegradedObservedAtTimestamp = event.block.timestamp
  flag.updatedAtBlock = event.block.number
  flag.updatedAtTimestamp = event.block.timestamp
  flag.save()
}
