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

## Campi coperti

| Campo | Motivo non recuperabile |
|-------|------------------------|
| `queueModule` | Emesso solo da `VaultRoutingConfigured` a deploy-time. Nessun getter on-chain. |
| `adminModule` | Stesso evento, stesso limite. |

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
      "deployBlock": 442800000,
      "note": "VaultRoutingConfigured emesso al blocco ~442800000, VaultTemplate creato al blocco 443070412 (270K blocchi dopo)"
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
