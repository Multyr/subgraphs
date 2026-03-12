import { Address, BigInt, BigDecimal, Bytes, ethereum, dataSource } from "@graphprotocol/graph-ts"
import {
  Protocol,
  VaultFactory,
  Vault,
  VaultDayData,
  UserVaultPosition,
  UserPositionDayData,
  Transaction,
  ClaimRequest,
  User,
  ProtocolDeployment,
  VaultDeployment,
  StrategyDeployment,
  VaultUpkeepBinding,
  StrategyUpkeepBinding
} from "../../generated/schema"
import { Vault as VaultContract } from "../../generated/templates/VaultTemplate/Vault"
import { ERC20 } from "../../generated/templates/VaultTemplate/ERC20"
import {
  ZERO_BI,
  ZERO_BD,
  ONE_E18,
  ONE_E18_BD,
  HUNDRED_BD,
  SECONDS_PER_DAY,
  DAYS_PER_YEAR_BD,
  getChainIdFromNetwork,
  safeDiv
} from "./constants"
import { getTokenPriceUsd, convertToUsd, updateTokenPriceWithStatus } from "./pricing"

// =============================================================================
// PROTOCOL ENTITY
// =============================================================================

export function getOrCreateProtocol(factoryAddress: Address, block: ethereum.Block): Protocol {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = "protocol-" + chainId.toString()

  let protocol = Protocol.load(id)
  if (protocol == null) {
    protocol = new Protocol(id)
    protocol.chainId = chainId
    protocol.factoryAddress = factoryAddress
    protocol.totalVaults = 0
    protocol.totalTvlUsd = ZERO_BD
    protocol.totalUsers = 0
    protocol.updatedAt = block.timestamp
  }

  return protocol
}

// =============================================================================
// VAULT FACTORY ENTITY
// =============================================================================

export function getOrCreateVaultFactory(address: Address, block: ethereum.Block): VaultFactory {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = address.toHexString().toLowerCase() + "-" + chainId.toString()

  let factory = VaultFactory.load(id)
  if (factory == null) {
    factory = new VaultFactory(id)
    factory.address = address
    factory.chainId = chainId
    factory.vaultCount = 0
    factory.totalTvlUsd = ZERO_BD
    factory.createdAt = block.timestamp
    factory.createdAtBlock = block.number
  }

  return factory
}

// =============================================================================
// VAULT ENTITY
// =============================================================================

export function getOrCreateVault(
  address: Address,
  factoryId: string,
  txHash: Bytes,
  creator: Address | null,
  block: ethereum.Block
): Vault {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = address.toHexString().toLowerCase() + "-" + chainId.toString()

  let vault = Vault.load(id)
  if (vault == null) {
    vault = new Vault(id)
    vault.factory = factoryId
    vault.address = address
    vault.chainId = chainId

    // Fetch metadata from contract
    let contract = VaultContract.bind(address)

    let nameResult = contract.try_name()
    vault.name = nameResult.reverted ? "" : nameResult.value

    let symbolResult = contract.try_symbol()
    vault.symbol = symbolResult.reverted ? "" : symbolResult.value

    let decimalsResult = contract.try_decimals()
    vault.decimals = decimalsResult.reverted ? 18 : decimalsResult.value

    let assetResult = contract.try_asset()
    let assetAddr = assetResult.reverted ? Address.zero() : assetResult.value
    vault.asset = assetAddr

    // Fetch asset metadata
    if (assetAddr.notEqual(Address.zero())) {
      let token = ERC20.bind(assetAddr)
      let symResult = token.try_symbol()
      vault.assetSymbol = symResult.reverted ? "" : symResult.value
      let decResult = token.try_decimals()
      vault.assetDecimals = decResult.reverted ? 18 : decResult.value
    } else {
      vault.assetSymbol = ""
      vault.assetDecimals = 18
    }

    // Creation metadata
    vault.createdAt = block.timestamp
    vault.createdAtBlock = block.number
    vault.createdTxHash = txHash
    vault.creator = creator

    // Initial state
    vault.totalAssets = ZERO_BI
    vault.totalSupply = ZERO_BI
    vault.sharePrice = ZERO_BI
    vault.tvlUsd = ZERO_BD
    vault.assetPriceUsd = ZERO_BD
    vault.priceStatus = "MISSING"

    // Performance
    vault.apy1d = ZERO_BD
    vault.apy7d = ZERO_BD
    vault.apy30d = ZERO_BD

    // Fees (will be updated by events)
    vault.depositFeeBps = 0
    vault.withdrawFeeBps = 0
    vault.immediateExitPenaltyBps = 0
    vault.forceExitPenaltyBps = 0

    // Status
    vault.status = "ACTIVE"
    vault.isActive = true
    vault.depositsEnabled = true
    vault.withdrawalsEnabled = true

    // Components
    vault.bufferManager = null
    vault.strategyRouter = null
    vault.incentives = null
    vault.feeCollector = null
    vault.guardian = null
    vault.owner = null

    // Statistics
    vault.totalDeposits = ZERO_BI
    vault.totalWithdrawals = ZERO_BI
    vault.totalUsers = 0
    vault.transactionCount = 0

    vault.updatedAt = block.timestamp
  }

  return vault
}

/**
 * Decimals-aware share price calculation.
 * Produces PPS in WAD 1e18, coerente con VaultPpsSnapshot.pps.
 * Core formula: pps = ta * 10^(18 + shareDecimals - assetDecimals) / ts
 */
export function updateVaultSharePriceCanonical(
  vault: Vault, totalAssets: BigInt, totalSupply: BigInt
): void {
  vault.totalAssets = totalAssets
  vault.totalSupply = totalSupply
  if (totalSupply.gt(ZERO_BI)) {
    let scalingExp = 18 + vault.decimals - vault.assetDecimals
    let scalingFactor = BigInt.fromI32(10).pow(u8(scalingExp))
    vault.sharePrice = totalAssets.times(scalingFactor).div(totalSupply)
  } else {
    vault.sharePrice = ONE_E18
  }
}

/**
 * Refresh vault state from on-chain data
 */
export function refreshVaultState(vault: Vault, block: ethereum.Block): void {
  let contract = VaultContract.bind(Address.fromBytes(vault.address))
  let chainId = vault.chainId

  // Fetch current state
  let totalAssetsResult = contract.try_totalAssets()
  if (!totalAssetsResult.reverted) {
    vault.totalAssets = totalAssetsResult.value
  }

  let totalSupplyResult = contract.try_totalSupply()
  if (!totalSupplyResult.reverted) {
    vault.totalSupply = totalSupplyResult.value
  }

  // Calculate share price using decimals-aware formula
  updateVaultSharePriceCanonical(vault, vault.totalAssets, vault.totalSupply)

  // Update USD values with status
  let priceResult = updateTokenPriceWithStatus(Address.fromBytes(vault.asset), chainId, block)
  vault.assetPriceUsd = priceResult.price
  vault.tvlUsd = convertToUsd(vault.totalAssets, vault.assetDecimals, priceResult.price)
  vault.priceStatus = priceResult.status

  vault.updatedAt = block.timestamp
  vault.save()
}

// =============================================================================
// VAULT DAY DATA ENTITY
// =============================================================================

export function getOrCreateVaultDayData(vault: Vault, timestamp: BigInt): VaultDayData {
  let dayId = timestamp.toI32() / SECONDS_PER_DAY
  let id = vault.id + "-" + dayId.toString()

  let dayData = VaultDayData.load(id)
  if (dayData == null) {
    dayData = new VaultDayData(id)
    dayData.vault = vault.id
    dayData.chainId = vault.chainId
    dayData.date = dayId
    dayData.dateTimestamp = BigInt.fromI32(dayId * SECONDS_PER_DAY)

    // State snapshot
    dayData.totalAssets = vault.totalAssets
    dayData.totalSupply = vault.totalSupply
    dayData.sharePrice = vault.sharePrice
    dayData.tvlUsd = vault.tvlUsd
    dayData.assetPriceUsd = vault.assetPriceUsd

    // Performance
    dayData.dailyReturn = ZERO_BD
    dayData.apy = ZERO_BD

    // Volume - start at zero
    dayData.depositsAssets = ZERO_BI
    dayData.depositsUsd = ZERO_BD
    dayData.withdrawalsAssets = ZERO_BI
    dayData.withdrawalsUsd = ZERO_BD
    dayData.netFlowAssets = ZERO_BI
    dayData.netFlowUsd = ZERO_BD

    // Counts
    dayData.depositCount = 0
    dayData.withdrawCount = 0
    dayData.uniqueUsers = 0
  }

  // Always update with current vault state
  dayData.totalAssets = vault.totalAssets
  dayData.totalSupply = vault.totalSupply
  dayData.sharePrice = vault.sharePrice
  dayData.tvlUsd = vault.tvlUsd
  dayData.assetPriceUsd = vault.assetPriceUsd

  return dayData
}

/**
 * Update vault day data APY with 30-day lookback.
 * Finds the most recent VaultDayData with valid sharePrice within 30 days,
 * normalizes the return by the number of days between snapshots.
 */
export function updateVaultDayDataApy(dayData: VaultDayData): void {
  if (dayData.sharePrice.equals(ZERO_BI)) {
    dayData.dailyReturn = ZERO_BD
    dayData.apy = ZERO_BD
    return
  }

  let prevData: VaultDayData | null = null
  let daysDelta = 0
  for (let i = 1; i <= 30; i++) {
    let prevId = dayData.vault + "-" + (dayData.date - i).toString()
    let candidate = VaultDayData.load(prevId)
    if (candidate != null) {
      if (candidate.sharePrice.gt(ZERO_BI)) {
        prevData = candidate
        daysDelta = i
        break
      }
    }
  }

  if (prevData == null) {
    dayData.dailyReturn = ZERO_BD
    dayData.apy = ZERO_BD
    return
  }

  if (daysDelta == 0) {
    dayData.dailyReturn = ZERO_BD
    dayData.apy = ZERO_BD
    return
  }

  let prev = prevData as VaultDayData
  let priceDiff = dayData.sharePrice.minus(prev.sharePrice)
  let rawReturn = safeDiv(priceDiff.toBigDecimal(), prev.sharePrice.toBigDecimal())
  let dailyReturn = safeDiv(rawReturn, BigDecimal.fromString(daysDelta.toString()))

  dayData.dailyReturn = dailyReturn.times(HUNDRED_BD)
  dayData.apy = dailyReturn.times(DAYS_PER_YEAR_BD).times(HUNDRED_BD)
}

/**
 * Update vault APY metrics from day data.
 * Loops from 0 (current day) to include today's data.
 */
export function updateVaultApyMetrics(vault: Vault, currentDayId: i32): void {
  // 1-day APY = current day
  let day0Id = vault.id + "-" + currentDayId.toString()
  let day0Data = VaultDayData.load(day0Id)
  if (day0Data != null) {
    vault.apy1d = day0Data.apy
  }

  // 7-day APY (average of days 0..6)
  let sum7d = ZERO_BD
  let count7d = 0
  for (let i = 0; i < 7; i++) {
    let dayId = vault.id + "-" + (currentDayId - i).toString()
    let dayData = VaultDayData.load(dayId)
    if (dayData != null) {
      if (dayData.apy.notEqual(ZERO_BD)) {
        sum7d = sum7d.plus(dayData.apy)
        count7d++
      }
    }
  }
  if (count7d > 0) {
    vault.apy7d = sum7d.div(BigDecimal.fromString(count7d.toString()))
  }

  // 30-day APY (average of days 0..29)
  let sum30d = ZERO_BD
  let count30d = 0
  for (let i = 0; i < 30; i++) {
    let dayId = vault.id + "-" + (currentDayId - i).toString()
    let dayData = VaultDayData.load(dayId)
    if (dayData != null) {
      if (dayData.apy.notEqual(ZERO_BD)) {
        sum30d = sum30d.plus(dayData.apy)
        count30d++
      }
    }
  }
  if (count30d > 0) {
    vault.apy30d = sum30d.div(BigDecimal.fromString(count30d.toString()))
  }
}

/**
 * Canonical snapshot helper: materializes vault state into VaultDayData,
 * recalculates APY, and persists everything including vault.save().
 */
export function snapshotVaultDayData(vault: Vault, timestamp: BigInt): void {
  let dayId = timestamp.toI32() / SECONDS_PER_DAY
  let dayData = getOrCreateVaultDayData(vault, timestamp)

  // Materialize current vault state
  dayData.sharePrice = vault.sharePrice
  dayData.totalAssets = vault.totalAssets
  dayData.totalSupply = vault.totalSupply
  dayData.tvlUsd = vault.tvlUsd
  dayData.assetPriceUsd = vault.assetPriceUsd

  // Recalculate APY
  updateVaultDayDataApy(dayData)
  dayData.save()

  // Update rolling metrics on vault
  updateVaultApyMetrics(vault, dayId)
  vault.save()
}

// =============================================================================
// USER POSITION ENTITY
// =============================================================================

export function getOrCreateUserPosition(
  user: Address,
  vault: Vault,
  block: ethereum.Block
): UserVaultPosition {
  let id = vault.id + "-" + user.toHexString().toLowerCase()

  let position = UserVaultPosition.load(id)
  if (position == null) {
    position = new UserVaultPosition(id)
    position.user = user
    position.vault = vault.id
    position.chainId = vault.chainId

    // Current holdings
    position.shares = ZERO_BI
    position.assets = ZERO_BI
    position.assetsUsd = ZERO_BD

    // Cost basis
    position.netDepositedAssets = ZERO_BI
    position.netDepositedUsd = ZERO_BD
    position.costBasisFifoAssets = ZERO_BI
    position.costBasisFifoUsd = ZERO_BD

    // P&L
    position.realizedPnlAssets = ZERO_BI
    position.realizedPnlUsd = ZERO_BD
    position.unrealizedPnlAssets = ZERO_BI
    position.unrealizedPnlUsd = ZERO_BD

    // Earned
    position.earnedAssets = ZERO_BI
    position.earnedUsd = ZERO_BD

    // Cumulative
    position.totalDepositedAssets = ZERO_BI
    position.totalDepositedUsd = ZERO_BD
    position.totalWithdrawnAssets = ZERO_BI
    position.totalWithdrawnUsd = ZERO_BD

    // Timestamps
    position.createdAt = block.timestamp
    position.updatedAt = block.timestamp
    position.lastDepositAt = null
    position.lastWithdrawAt = null

    // Counts
    position.depositCount = 0
    position.withdrawCount = 0
  }

  return position
}

/**
 * Update position with current values and P&L calculations
 */
export function updatePositionValues(
  position: UserVaultPosition,
  vault: Vault
): void {
  // Calculate current asset value
  if (vault.totalSupply.gt(ZERO_BI)) {
    position.assets = position.shares.times(vault.totalAssets).div(vault.totalSupply)
  } else {
    position.assets = ZERO_BI
  }

  // USD value
  position.assetsUsd = convertToUsd(position.assets, vault.assetDecimals, vault.assetPriceUsd)

  // Unrealized P&L = current value - cost basis
  position.unrealizedPnlAssets = position.assets.minus(position.costBasisFifoAssets)
  position.unrealizedPnlUsd = position.assetsUsd.minus(position.costBasisFifoUsd)

  // Earned = current value - net deposited (deposits - withdrawals at current prices)
  // This represents total value gained including realized + unrealized
  position.earnedAssets = position.assets.plus(position.totalWithdrawnAssets).minus(position.totalDepositedAssets)
  position.earnedUsd = position.assetsUsd.plus(position.totalWithdrawnUsd).minus(position.totalDepositedUsd)
}

// =============================================================================
// USER POSITION DAY DATA ENTITY
// =============================================================================

export function getOrCreateUserPositionDayData(
  position: UserVaultPosition,
  vault: Vault,
  timestamp: BigInt
): UserPositionDayData {
  let dayId = timestamp.toI32() / SECONDS_PER_DAY
  let id = position.id + "-" + dayId.toString()

  let dayData = UserPositionDayData.load(id)
  if (dayData == null) {
    dayData = new UserPositionDayData(id)
    dayData.position = position.id
    dayData.vault = vault.id
    dayData.user = position.user
    dayData.chainId = position.chainId
    dayData.date = dayId
    dayData.dateTimestamp = BigInt.fromI32(dayId * SECONDS_PER_DAY)
  }

  // Update with current state
  dayData.shares = position.shares
  dayData.assets = position.assets
  dayData.assetsUsd = position.assetsUsd
  dayData.sharePrice = vault.sharePrice
  dayData.assetPriceUsd = vault.assetPriceUsd
  dayData.totalDepositedAssets = position.totalDepositedAssets
  dayData.totalWithdrawnAssets = position.totalWithdrawnAssets
  dayData.realizedPnlAssets = position.realizedPnlAssets
  dayData.unrealizedPnlAssets = position.unrealizedPnlAssets
  dayData.earnedAssets = position.earnedAssets

  return dayData
}

// =============================================================================
// TRANSACTION ENTITY
// =============================================================================

export function createTransaction(
  txHash: Bytes,
  logIndex: BigInt,
  type: string,
  vault: Vault,
  user: Address,
  shares: BigInt,
  assets: BigInt,
  block: ethereum.Block
): Transaction {
  let id = txHash.toHexString() + "-" + logIndex.toString()

  let tx = new Transaction(id)
  tx.hash = txHash
  tx.logIndex = logIndex
  tx.vault = vault.id
  tx.user = user
  tx.chainId = vault.chainId
  tx.type = type
  tx.shares = shares
  tx.assets = assets
  tx.assetsUsd = convertToUsd(assets, vault.assetDecimals, vault.assetPriceUsd)

  tx.timestamp = block.timestamp
  tx.blockNumber = block.number
  tx.sharePrice = vault.sharePrice
  tx.assetPriceUsd = vault.assetPriceUsd

  tx.save()

  return tx
}

export function setTransactionTransferFields(tx: Transaction, from: Address, to: Address): void {
  tx.from = from
  tx.to = to
  tx.receiver = to
  tx.save()
}

export function setTransactionClaimId(tx: Transaction, claimId: BigInt): void {
  tx.claimId = claimId
  tx.save()
}

export function setTransactionReceiver(tx: Transaction, receiver: Address): void {
  tx.receiver = receiver
  tx.save()
}

// =============================================================================
// CLAIM REQUEST ENTITY
// =============================================================================

export function getOrCreateClaimRequest(
  vault: Vault,
  claimId: BigInt,
  user: Address,
  block: ethereum.Block
): ClaimRequest {
  let id = vault.id + "-" + claimId.toString()

  let claim = ClaimRequest.load(id)
  if (claim == null) {
    claim = new ClaimRequest(id)
    claim.vault = vault.id
    claim.user = user
    claim.chainId = vault.chainId
    claim.claimId = claimId
    claim.shares = ZERO_BI
    claim.assetsEstimated = ZERO_BI
    claim.isImmediate = false
    claim.status = "PENDING"
    claim.requestedAt = block.timestamp
    claim.requestTxHash = Bytes.empty()
  }

  return claim
}

// =============================================================================
// USER ENTITY
// =============================================================================

export function getOrCreateUser(address: Address, block: ethereum.Block): User {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = address.toHexString().toLowerCase() + "-" + chainId.toString()

  let user = User.load(id)
  if (user == null) {
    user = new User(id)
    user.address = address
    user.chainId = chainId
    user.totalPositions = 0
    user.totalAssetsUsd = ZERO_BD
    user.totalEarnedUsd = ZERO_BD
    user.totalRealizedPnlUsd = ZERO_BD
    user.firstSeenAt = block.timestamp
    user.lastActiveAt = block.timestamp
  }

  return user
}

/**
 * Update user aggregate stats from all positions
 */
export function updateUserAggregates(user: User, block: ethereum.Block): void {
  user.lastActiveAt = block.timestamp
  // Note: Full aggregation would require iterating positions
  // For now, we increment/decrement on position changes
  user.save()
}

// =============================================================================
// OPS DEPLOYMENT ENTITIES
// =============================================================================

export function getOrCreateProtocolDeployment(
  timestamp: BigInt, block: ethereum.Block
): ProtocolDeployment {
  let chainId = getChainIdFromNetwork(dataSource.network())
  let id = "protocol-" + chainId.toString()

  let pd = ProtocolDeployment.load(id)
  if (pd == null) {
    pd = new ProtocolDeployment(id)
    pd.chainId = chainId
    pd.vaultFactory = null
    pd.globalConfig = null
    pd.depositRouter = null
    pd.referralBinding = null
    pd.opsCollector = null
    pd.feeDistributor = null
    pd.epochPayout = null
    pd.peripheryUpkeep = null
    pd.feeCollectorUpkeep = null
    pd.partnerRegistry = null
    pd.updatedAt = timestamp
    pd.updatedAtBlock = block.number
  }

  return pd
}

export function getOrCreateVaultDeployment(
  vault: Vault, timestamp: BigInt, block: ethereum.Block
): VaultDeployment {
  let id = vault.id

  let vd = VaultDeployment.load(id)
  if (vd == null) {
    vd = new VaultDeployment(id)
    vd.vault = vault.id
    vd.chainId = vault.chainId
    vd.coreVault = Address.fromBytes(vault.address)
    vd.bufferManager = null
    vd.queueModule = null
    vd.adminModule = null
    vd.strategyRouter = null
    vd.healthRegistry = null
    vd.feeCollector = null
    vd.oracle = null
    vd.owner = null
    vd.guardian = null
    vd.vetoer = null
    vd.paramsProvider = null
    vd.incentives = null
    vd.vaultUpkeep = null
    vd.sealed = false

    // Link to protocol deployment
    let chainId = vault.chainId
    let pdId = "protocol-" + chainId.toString()
    let pd = ProtocolDeployment.load(pdId)
    if (pd != null) {
      vd.protocolDeployment = pd.id
    }

    vd.updatedAt = timestamp
    vd.updatedAtBlock = block.number
  }

  return vd
}

/**
 * Copy all available component addresses from Vault entity to VaultDeployment.
 * Called after vault creation and any component update handler.
 */
export function syncVaultDeploymentFromVault(
  vault: Vault, timestamp: BigInt, block: ethereum.Block
): void {
  let vd = getOrCreateVaultDeployment(vault, timestamp, block)

  // Copy all fields tracked on the Vault entity
  vd.bufferManager = vault.bufferManager
  vd.strategyRouter = vault.strategyRouter
  vd.healthRegistry = vault.healthRegistry
  vd.feeCollector = vault.feeCollector
  vd.owner = vault.owner
  vd.guardian = vault.guardian
  vd.incentives = vault.incentives
  vd.paramsProvider = vault.paramsProvider
  vd.vetoer = vault.vetoer
  vd.oracle = vault.oracle

  vd.updatedAt = timestamp
  vd.updatedAtBlock = block.number
  vd.save()
}

export function getOrCreateStrategyDeployment(
  vault: Vault,
  strategyAddress: Address,
  routerAddress: Address,
  name: string,
  enabled: bool,
  priority: i32,
  weightBps: i32,
  timestamp: BigInt,
  block: ethereum.Block
): StrategyDeployment {
  let id = vault.id + "-" + strategyAddress.toHexString().toLowerCase()

  let sd = StrategyDeployment.load(id)
  if (sd == null) {
    sd = new StrategyDeployment(id)
    sd.vault = vault.id
    sd.chainId = vault.chainId
    sd.strategyAddress = strategyAddress
    sd.strategyRouter = routerAddress
    sd.name = name
    sd.enabled = enabled
    sd.priority = priority
    sd.weightBps = weightBps
    sd.totalAssets = null
    sd.strategyUpkeep = null
    sd.upkeepKind = null

    // Link to VaultDeployment
    let vd = VaultDeployment.load(vault.id)
    if (vd != null) {
      sd.vaultDeployment = vd.id
    }

    sd.updatedAt = timestamp
    sd.updatedAtBlock = block.number
  }

  return sd
}

export function getOrCreateVaultUpkeepBinding(
  upkeepAddress: Address,
  vault: Vault,
  timestamp: BigInt,
  block: ethereum.Block
): VaultUpkeepBinding {
  let chainId = vault.chainId
  let id = upkeepAddress.toHexString().toLowerCase() + "-"
    + Address.fromBytes(vault.address).toHexString().toLowerCase() + "-"
    + chainId.toString()

  let binding = VaultUpkeepBinding.load(id)
  if (binding == null) {
    binding = new VaultUpkeepBinding(id)
    binding.upkeep = upkeepAddress
    binding.vault = vault.id
    binding.chainId = chainId
    binding.createdAt = timestamp

    let vd = VaultDeployment.load(vault.id)
    if (vd != null) {
      binding.vaultDeployment = vd.id
    }
  }

  binding.updatedAt = timestamp
  binding.updatedAtBlock = block.number

  return binding
}

export function getOrCreateStrategyUpkeepBinding(
  upkeepAddress: Address,
  strategyAddress: Address,
  chainId: i32,
  upkeepType: string,
  timestamp: BigInt,
  block: ethereum.Block
): StrategyUpkeepBinding {
  let id = upkeepAddress.toHexString().toLowerCase() + "-"
    + strategyAddress.toHexString().toLowerCase() + "-"
    + chainId.toString()

  let binding = StrategyUpkeepBinding.load(id)
  if (binding == null) {
    binding = new StrategyUpkeepBinding(id)
    binding.upkeep = upkeepAddress
    binding.strategy = strategyAddress
    binding.chainId = chainId
    binding.upkeepType = upkeepType
    binding.enabled = true
    binding.vault = null
    binding.strategyDeployment = null
    binding.createdAt = timestamp
  }

  binding.updatedAt = timestamp
  binding.updatedAtBlock = block.number

  return binding
}
