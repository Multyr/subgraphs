import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts"
import { Vault } from "../../../generated/schema"
import { Vault as VaultContract } from "../../../generated/VaultTemplate/Vault"
import { ERC20 } from "../../../generated/VaultTemplate/ERC20"

export function getOrCreateVault(
  address: Address,
  factory: string,
  block: ethereum.Block
): Vault {
  let id = address.toHexString().toLowerCase()
  let vault = Vault.load(id)

  if (vault == null) {
    vault = new Vault(id)
    vault.factory = factory
    vault.address = address

    let contract = VaultContract.bind(address)

    // Try to fetch metadata with reverted checks
    let nameResult = contract.try_name()
    vault.name = nameResult.reverted ? "" : nameResult.value

    let symbolResult = contract.try_symbol()
    vault.symbol = symbolResult.reverted ? "" : symbolResult.value

    let assetResult = contract.try_asset()
    let assetAddr = assetResult.reverted ? Address.zero() : assetResult.value
    vault.asset = assetAddr

    let decimalsResult = contract.try_decimals()
    vault.decimals = decimalsResult.reverted ? 18 : decimalsResult.value

    // Fetch asset symbol from ERC20
    if (assetAddr.notEqual(Address.zero())) {
      let token = ERC20.bind(assetAddr)
      let sym = token.try_symbol()
      vault.assetSymbol = sym.reverted ? "" : sym.value
    } else {
      vault.assetSymbol = ""
    }

    vault.totalAssets = BigInt.zero()
    vault.totalSupply = BigInt.zero()
    vault.sharePrice = BigInt.zero()

    vault.createdAt = block.timestamp
    vault.updatedAt = block.timestamp
  }

  return vault
}

export function refreshVaultState(vault: Vault, block: ethereum.Block): void {
  let contract = VaultContract.bind(Address.fromBytes(vault.address))

  let totalAssetsResult = contract.try_totalAssets()
  if (!totalAssetsResult.reverted) {
    vault.totalAssets = totalAssetsResult.value
  }

  let totalSupplyResult = contract.try_totalSupply()
  if (!totalSupplyResult.reverted) {
    vault.totalSupply = totalSupplyResult.value
  }

  // Calculate share price: (totalAssets * 1e18) / totalSupply
  if (vault.totalSupply.gt(BigInt.zero())) {
    let ONE_E18 = BigInt.fromI32(10).pow(18 as u8)
    vault.sharePrice = vault.totalAssets.times(ONE_E18).div(vault.totalSupply)
  } else {
    vault.sharePrice = BigInt.zero()
  }

  vault.updatedAt = block.timestamp
  vault.save()
}
