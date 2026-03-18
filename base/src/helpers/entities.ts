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
  StrategyDeployment
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
    vault.statusLabel = "ACTIVE"
    vault.statusNote = ""
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
 * Canonical share price calculation using real vault/asset decimals.
 * Result is in WAD (1e18). Formula: totalAssets * 10^(18 + shareDecimals - assetDecimals) / totalSupply
 * Verified against VaultPpsSnapshot.pps and convertToAssets(1e18) on-chain.
 */
export function updateVaultSharePriceCanonical(
  vault: Vault, totalAssets: BigInt, totalSupply: BigInt
): void {
  vault.totalAssets = totalAssets
  vault.totalSupply = totalSupply
  if (totalSupply.gt(ZERO_BI)) {
    let scalePower = 18 + vault.decimals - vault.assetDecimals
    let scale = BigInt.fromI32(10).pow(u8(scalePower))
    vault.sharePrice = totalAssets.times(scale).div(totalSupply)
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
  let totalSupplyResult = contract.try_totalSupply()

  let ta = !totalAssetsResult.reverted ? totalAssetsResult.value : vault.totalAssets
  let ts = !totalSupplyResult.reverted ? totalSupplyResult.value : vault.totalSupply

  // Update share price using canonical formula (decimals-aware)
  updateVaultSharePriceCanonical(vault, ta, ts)

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
 * Canonical snapshot: copies vault state to day data, computes APY, saves vault.
 * This is the single canonical point for APY persistence.
 */
export function snapshotVaultDayData(vault: Vault, block: ethereum.Block): void {
  let dayId = block.timestamp.toI32() / SECONDS_PER_DAY
  let dayData = getOrCreateVaultDayData(vault, block.timestamp)

  // Copy current vault state
  dayData.totalAssets = vault.totalAssets
  dayData.totalSupply = vault.totalSupply
  dayData.sharePrice = vault.sharePrice
  dayData.tvlUsd = vault.tvlUsd
  dayData.assetPriceUsd = vault.assetPriceUsd

  updateVaultDayDataApy(dayData)
  dayData.save()

  updateVaultApyMetrics(vault, dayId)
  vault.save()
}

/**
 * Update vault day data APY with lookback up to 30 days
 */
export function updateVaultDayDataApy(dayData: VaultDayData): void {
  let currentPrice = dayData.sharePrice.toBigDecimal().div(ONE_E18_BD)
  if (currentPrice.le(ZERO_BD)) {
    dayData.dailyReturn = ZERO_BD
    dayData.apy = ZERO_BD
    return
  }

  // Look back up to 30 days for a day with sharePrice > 0
  let prevPrice = ZERO_BD
  let daysDelta = 0
  for (let i: i32 = 1; i <= 30; i++) {
    let prevId = dayData.vault + "-" + (dayData.date - i).toString()
    let prev = VaultDayData.load(prevId)
    if (prev !== null) {
      if (prev.sharePrice.gt(ZERO_BI)) {
        prevPrice = prev.sharePrice.toBigDecimal().div(ONE_E18_BD)
        daysDelta = i
        break
      }
    }
  }

  if (prevPrice.le(ZERO_BD) || daysDelta == 0) {
    dayData.dailyReturn = ZERO_BD
    dayData.apy = ZERO_BD
    return
  }

  // Daily return normalized by daysDelta
  let totalReturn = currentPrice.minus(prevPrice).div(prevPrice)
  let dailyReturn = safeDiv(totalReturn, BigDecimal.fromString(daysDelta.toString()))
  dayData.dailyReturn = dailyReturn.times(HUNDRED_BD)
  dayData.apy = dailyReturn.times(DAYS_PER_YEAR_BD).times(HUNDRED_BD)
}

/**
 * Update vault APY metrics from day data
 */
export function updateVaultApyMetrics(vault: Vault, currentDayId: i32): void {
  // 1-day APY: current day (i=0)
  let day0Id = vault.id + "-" + currentDayId.toString()
  let day0Data = VaultDayData.load(day0Id)
  if (day0Data !== null) {
    vault.apy1d = day0Data.apy
  } else {
    vault.apy1d = ZERO_BD
  }

  // 7-day APY: average of days 0..6
  let sum7d = ZERO_BD
  let count7d: i32 = 0
  for (let i: i32 = 0; i < 7; i++) {
    let dayId = vault.id + "-" + (currentDayId - i).toString()
    let dayData = VaultDayData.load(dayId)
    if (dayData !== null) {
      if (dayData.apy.gt(ZERO_BD)) {
        sum7d = sum7d.plus(dayData.apy)
        count7d++
      }
    }
  }
  if (count7d > 0) {
    vault.apy7d = safeDiv(sum7d, BigDecimal.fromString(count7d.toString()))
  } else {
    vault.apy7d = ZERO_BD
  }

  // 30-day APY: average of days 0..29
  let sum30d = ZERO_BD
  let count30d: i32 = 0
  for (let i: i32 = 0; i < 30; i++) {
    let dayId = vault.id + "-" + (currentDayId - i).toString()
    let dayData = VaultDayData.load(dayId)
    if (dayData !== null) {
      if (dayData.apy.gt(ZERO_BD)) {
        sum30d = sum30d.plus(dayData.apy)
        count30d++
      }
    }
  }
  if (count30d > 0) {
    vault.apy30d = safeDiv(sum30d, BigDecimal.fromString(count30d.toString()))
  } else {
    vault.apy30d = ZERO_BD
  }
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
// OPS DEPLOYMENT WIRING ENTITIES
// =============================================================================

/**
 * Get or create the protocol-level deployment entity for a chain.
 */
export function getOrCreateProtocolDeployment(chainId: i32, block: ethereum.Block): ProtocolDeployment {
  let id = "protocol-deploy-" + chainId.toString()
  let pd = ProtocolDeployment.load(id)
  if (pd == null) {
    pd = new ProtocolDeployment(id)
    pd.chainId = chainId
    pd.vaultFactory = null
    pd.globalConfig = null
    pd.priceOracle = null
    pd.depositRouter = null
    pd.referralBinding = null
    pd.opsCollector = null
    pd.feeDistributor = null
    pd.epochPayout = null
    pd.peripheryUpkeep = null
    pd.feeCollectorUpkeep = null
    pd.partnerRegistry = null
    pd.updatedAt = block.timestamp
    pd.updatedAtBlock = block.number
  }
  return pd
}

/**
 * Get or create the vault deployment wiring entity.
 */
export function getOrCreateVaultDeployment(vault: Vault, block: ethereum.Block): VaultDeployment {
  let id = vault.id  // same ID as vault: "{address}-{chainId}"
  let vd = VaultDeployment.load(id)
  if (vd == null) {
    vd = new VaultDeployment(id)
    vd.chainId = vault.chainId
    vd.coreVault = vault.id
    vd.bufferManager = null
    vd.queueModule = null
    vd.adminModule = null
    vd.strategyRouter = null
    vd.healthRegistry = null
    vd.feeCollector = null
    vd.oracle = null
    vd.paramsProvider = null
    vd.incentives = null
    vd.owner = null
    vd.guardian = null
    vd.vetoer = null
    vd.sealed = false
    vd.vaultUpkeep = null
    vd.protocolDeployment = "protocol-deploy-" + vault.chainId.toString()
    vd.updatedAt = block.timestamp
    vd.updatedAtBlock = block.number
  }
  return vd
}

/**
 * Sync vault deployment fields from the current vault entity state.
 */
export function syncVaultDeploymentFromVault(vault: Vault, block: ethereum.Block): void {
  let vd = getOrCreateVaultDeployment(vault, block)
  vd.bufferManager = vault.bufferManager
  vd.strategyRouter = vault.strategyRouter
  vd.feeCollector = vault.feeCollector
  vd.guardian = vault.guardian
  vd.owner = vault.owner
  vd.incentives = vault.incentives
  vd.updatedAt = block.timestamp
  vd.updatedAtBlock = block.number
  vd.save()
}

/**
 * Get or create a strategy deployment for a vault.
 */
export function getOrCreateStrategyDeployment(
  vault: Vault, strategyAddress: Address, block: ethereum.Block
): StrategyDeployment {
  let id = strategyAddress.toHexString().toLowerCase() + "-" + vault.id
  let sd = StrategyDeployment.load(id)
  if (sd == null) {
    sd = new StrategyDeployment(id)
    sd.chainId = vault.chainId
    sd.vault = vault.id
    sd.strategyAddress = strategyAddress
    sd.strategyRouter = vault.strategyRouter
    sd.enabled = true
    sd.priority = 0
    sd.weightBps = 0
    sd.totalAssets = ZERO_BI
    sd.strategyUpkeep = null
    sd.upkeepKind = null
    sd.updatedAt = block.timestamp
    sd.updatedAtBlock = block.number
  }
  return sd
}
