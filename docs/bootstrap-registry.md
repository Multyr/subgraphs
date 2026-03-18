# Bootstrap Registry — Non-Recoverable Deploy-Time Wiring

**Data**: 2026-03-18
**Scopo**: source of truth per campi che il subgraph non può recuperare retroattivamente

---

## Perché esiste questo file

Il subgraph è la source of truth primaria per tutti i dati del protocollo. Tuttavia, alcuni campi di wiring sono emessi come eventi **solo durante il deploy** e non sono queryabili on-chain (nessun getter pubblico). Per i vault deployati **prima** della creazione del VaultTemplate nel subgraph, questi eventi sono persi.

Questo registry copre **esclusivamente** quei campi. Non è un fallback generico — è un bootstrap registry for non-recoverable deploy-time wiring.

## Regola per la ops console

```
1. Leggere VaultDeployment dal subgraph (source primaria)
2. Se queueModule o adminModule sono null → completare dal bootstrap registry
3. Mai usare il bootstrap per campi che il subgraph può popolare
```

## Causa root

Il deploy script v4 esegue le operazioni in questo ordine:

```
Blocco 442802486: EcosystemConfigured (bufferManager, strategyRouter, guardian, vetoer)
Blocco 442802489: FeeCollectorSet
Blocco 442802489: setInitialFees → FeeParamsAccepted (depBps=50, witBps=100)
Blocco 442802523: WarmAdapterApproved (x2)
Blocco 442802530: registerVault nella factory → VaultDeployed → VaultTemplate creato QUI
```

Il VaultTemplate viene creato solo quando `handleVaultDeployed` processa l'evento della factory.
Tutti gli eventi emessi dal vault PRIMA di quel blocco sono **persi** — il template non esisteva.

Per i futuri deploy: `registerVault` deve essere il **primo step**, non l'ultimo.

## Campi coperti

| Campo | Evento perso | Motivo |
|-------|-------------|--------|
| `queueModule` | `VaultRoutingConfigured` | Emesso da DeployLib prima del registerVault |
| `adminModule` | `VaultRoutingConfigured` | Stesso evento |
| `bufferManager` | `EcosystemConfigured` | Blocco 442802486, 44 blocchi prima del template |
| `strategyRouter` | `EcosystemConfigured` | Stesso evento |
| `guardian` | `EcosystemConfigured` | Stesso evento |
| `vetoer` | `EcosystemConfigured` | Stesso evento |
| `healthRegistry` | `EcosystemConfigured` | Stesso evento |
| `depositFeeBps` | `FeeParamsAccepted` | Blocco 442802489, 41 blocchi prima del template |
| `withdrawFeeBps` | `FeeParamsAccepted` | Stesso evento |

## Registry

### Arbitrum One (chainId 42161)

```json
{
  "chainId": 42161,
  "vaults": [
    {
      "vault": "0x77d9288e104fa643a2c07e4bd1f3a2f35d62008c",
      "version": "v4",
      "queueModule": "0x41815C7774caad6E051d1F23375526F07AF85eBa",
      "adminModule": "0x17a342233b47f71038a2f05c1220d32ab8d43a03",
      "erc4626Module": "0x72cB278dFD4DB3882b9aFbB45c0d63D93985683f",
      "liquidityOpsModule": "0x2cf61ad75eec17529c891d85519737eb1f260d80",
      "bufferManager": "0xfad82ff14623a74dbc5fa647e6892a05351d4507",
      "strategyRouter": "0x4F3434cBA996ebc44587DF95742048F04871480f",
      "healthRegistry": "0x4058C04B195fDbEE36838f3497D3e2137C7A5256",
      "guardian": "0x7407E68a5553E948eed862f19fc6B292eb48d677",
      "vetoer": "0xF0c1A33d6741EB2dc174a0977095587a0648f1D7",
      "depositFeeBps": 50,
      "withdrawFeeBps": 100,
      "immediateExitPenaltyBps": 100,
      "forceExitPenaltyBps": 150,
      "deployBlock": 442802530,
      "wiringBlock": 442802486,
      "note": "Tutti gli eventi di wiring emessi ai blocchi 442802486-442802523, registerVault al blocco 442802530. VaultTemplate creato 44 blocchi dopo il primo evento."
    }
  ]
}
```

### Base (chainId 8453)

Non ancora deployato. Il bootstrap sarà generato dal deploy script.

### Ethereum (chainId 1)

Non ancora deployato. Il bootstrap sarà generato dal deploy script.

## Come evitare il problema nei futuri deploy

Per i vault futuri il problema non si ripresenta se:

1. **`registerVault()` sulla factory** viene chiamato PRIMA o NELLA STESSA TX del deploy script che emette `VaultRoutingConfigured`
2. Il subgraph crea il VaultTemplate in `handleVaultDeployed` → il template è attivo → cattura `VaultRoutingConfigured` dalla stessa tx o da blocchi successivi

In alternativa, se il core non è in freeze:
- Aggiungere getter `queueModule()` e `adminModule()` nel CoreVault
- Oppure emettere `VaultRoutingConfigured` anche da AdminModule in un setter dedicato

## Manutenzione

Questo file va aggiornato:
- Ad ogni nuovo deploy vault su qualsiasi chain
- Il deploy script deve generare automaticamente la entry del bootstrap
- Non aggiungere campi che il subgraph può recuperare
