# Subgraph Multi-Factory / Multi-Upkeep + Strategy Metadata — Spec

## Obiettivo

Portare il subgraph da modello single-factory / single-upkeep per chain a modello **multi-factory / multi-upkeep per chain**, mantenendo il periphery singleton per chain, e aggiungere metadata strategy `name` / `description` letti on-chain.

Il risultato deve restare allineato su **Arbitrum, Base, Ethereum** anche se oggi il bisogno operativo e' Arbitrum.

---

## Scope

### Da modificare

- subgraph manifests
- subgraph mappings
- schema GraphQL
- ABI extraction / merged ABIs
- docs subgraph / deployment / ops
- redeploy subgraphs sulle chain supportate

### Da non toccare

- core contracts
- periphery shared contracts
- deploy flow on-chain
- dashboard semantics, salvo query aggregate se necessario

---

## Decisioni architetturali

- **Protocol** resta entity chain-wide aggregata.
- **VaultFactory** resta entity distinta per ogni factory.
- **Vault** continua a referenziare la propria factory.
- **UpkeepAction** deve supportare piu' upkeep address sulla stessa chain.
- **VaultStrategy** deve includere metadata strategy:
  - `name`
  - `description`
- **Periphery shared** resta singleton per chain, quindi nessun refactor li'.

---

## Lavori da fare

### 1. Schema GraphQL

**Aggiornare** `schema.graphql`

**Modifiche richieste:**

#### Protocol

- Rimuovere l'assunzione forte di factory unica
- Se `factoryAddress` oggi implica unicita', deprecarlo o rinominarlo logicamente in docs
- Tenere `totalVaults`, `totalTvlUsd`, `totalUsers` come aggregati chain-wide

#### VaultStrategy

- Aggiungere:
  - `name: String`
  - `description: String`
- Verificare se serve una nuova entity opzionale tipo `StrategyMetadata`
- Raccomandazione: **non serve**, basta arricchire `VaultStrategy`

**Acceptance:**

- Schema builda su tutte le chain
- Backward compatibility ragionevole per query esistenti

---

### 2. Manifest multi-factory / multi-upkeep

**Aggiornare:**

- `subgraphs/arbitrum/subgraph.yaml`
- `subgraphs/base/subgraph.yaml`
- `subgraphs/ethereum/subgraph.yaml`

**Richieste:**

- Supportare piu' datasource `VaultFactory` per chain
- Supportare piu' datasource `VaultUpkeep` per chain
- Mantenere singleton per:
  - `GlobalConfig`
  - `OpsCollector`
  - `FeeDistributor`
  - `EpochPayout`
  - `ReferralBinding`
  - `PartnerRegistry`
  - `DepositRouter`
  - altri periphery shared

**Implementazione consigliata:**

- Non mantenere i manifest scritti a mano come sorgente canonica
- Generare i datasource da address book / manifest deploy
- Introdurre una pipeline manifest-driven per chain:
  - `vaultFactories[]`
  - `vaultUpkeeps[]`

**Acceptance:**

- Ogni chain puo' avere N factory e N upkeep
- Nessuna regressione per chain con una sola factory/upkeep

---

### 3. Mappings factory

**Aggiornare** mappings chain-specifiche, soprattutto:

- `subgraphs/arbitrum/src/mappings.ts`
- Allineare anche Base/Ethereum

**Richieste:**

- Ogni `VaultCreated` / `VaultDeployed` deve:
  - Creare il `Vault`
  - Collegarlo alla `VaultFactory` corretta
  - Incrementare contatori factory-specifici
  - Aggiornare `Protocol.totalVaults` chain-wide
- Evitare assunzioni implicite "esiste una sola factory"

**Acceptance:**

- Vault creati da factory diverse sulla stessa chain convivono correttamente
- `Vault.factory` e' sempre corretto
- `Protocol.totalVaults` aggrega tutte le factory

---

### 4. Mappings upkeep

**Aggiornare** handler `UpkeepPerformed` per supportare piu' upkeep address.

**Richieste:**

- `UpkeepAction.upkeep` deve riflettere il datasource address che ha emesso l'evento
- Le query devono poter filtrare per upkeep specifico oppure aggregare cross-upkeep
- Nessuna assunzione "c'e' un solo upkeep per chain"

**Acceptance:**

- Eventi da upkeep multipli vengono indicizzati tutti
- I pannelli ops possono filtrare per address

---

### 5. Metadata strategy name / description

**Aggiornare** il flusso di indicizzazione strategy.

**Richieste:**

- Nel punto in cui la strategy viene scoperta/registrata, tipicamente `StrategyRegistered`
- Fare read on-chain:
  - `try_name()`
  - `try_description()`
- Salvare i risultati su `VaultStrategy`

**Da aggiornare:**

- ABI strategy usata dal subgraph
- Merged ABI extraction se necessario
- Mapping di strategy discovery

**Linee guida:**

- Usare solo `try_*`
- Se call fallisce, non revertare
- Fallback:
  - `name` = null o `""`
  - `description` = null o `""`

**Acceptance:**

- Per `UsdcLendingStrategy`, i campi risultano valorizzati nel subgraph
- Nessun crash se una strategy non implementa quelle funzioni

---

### 6. ABI extraction

**Aggiornare** pipeline ABI:

- Merged ABI vault/router come gia' fate
- Aggiungere ABI/funzioni necessarie per strategy metadata

**Verificare:**

- `name()`
- `description()`

**Comandi:**

```bash
forge build
cd subgraphs
npm run extract-abis
npm run codegen:all
npm run build:all
```

**Acceptance:**

- ABI aggiornate su tutte le chain
- Codegen pulito

---

### 7. Query layer / backward compatibility

**Rivedere** query reference in `subgraphs/README.md`

**Da aggiungere/aggiornare:**

- Query multi-factory aggregate
- Query `UpkeepAction` filtrabile per upkeep address
- Query `VaultStrategy` con `name` e `description`

**Acceptance:**

- Query examples allineate allo schema nuovo
- Nessun esempio rimasto single-factory by assumption

---

### 8. Documentazione

**Aggiornare** almeno questi documenti:

- `subgraphs/README.md`
- `docs/09-audit/subgraph-and-indexing.md`
- `docs/09-audit/subgraph-event-matrix.md`
- `docs/09-audit/gates-subgraph.md`
- `docs/operations/ops-console-subgraph-integration.md`

**Contenuti da documentare:**

- Supporto multi-factory per chain
- Supporto multi-upkeep per chain
- Protocol come aggregato chain-wide
- Periphery shared singleton per chain
- Strategy metadata on-chain (`name`, `description`)
- Nuovi requisiti manifest/address-book
- Procedura redeploy subgraph
- Smoke tests post-deploy

---

### 9. Aggiornamento altre chain

Anche se oggi il bisogno e' Arbitrum, il dev deve mantenere allineamento su:

- **Arbitrum**
- **Base**
- **Ethereum**

**Regola:**

- Stesso schema condiviso
- Stessi pattern mapping
- Manifest adattati agli address book della chain
- Se una chain oggi ha una sola factory/upkeep, il manifest deve comunque restare compatibile con N

**Acceptance:**

- `codegen:all` e `build:all` verdi
- Nessuna divergenza architetturale tra chain

---

## Testing

### Build gates

```bash
cd subgraphs
npm run codegen:all
npm run build:all
node scripts/parity-check.mjs
```

### Test funzionali minimi

1. Factory A crea vault A1
2. Factory B crea vault B1
3. Entrambe indicizzate sulla stessa chain
4. Due upkeep diversi emettono `UpkeepPerformed`
5. Entrambe le serie appaiono in `UpkeepAction`
6. `StrategyRegistered` popola `VaultStrategy.name`
7. `StrategyRegistered` popola `VaultStrategy.description`
8. Se `description()` manca o fallisce, il mapping non revert

---

## Redeploy subgraph

Procedura da eseguire dopo merge:

```bash
forge build
cd subgraphs && npm run extract-abis
# aggiornare manifests chain-specifici con address reali
npm run codegen:all && npm run build:all
# deploy su Arbitrum, Base, Ethereum
```

### Verifiche live post-deploy

```graphql
query {
  _meta { block { number } hasIndexingErrors }
}

query {
  vaultFactories(first: 10) { id address vaultCount totalTvlUsd }
  vaults(first: 20) { id address factory { id } }
}

query {
  upkeepActions(first: 20, orderBy: timestamp, orderDirection: desc) {
    id
    upkeep
    op
    success
  }
}

query {
  vaultStrategies(first: 20) {
    id
    strategy
    name
    description
  }
}
```

---

## Definition of done

Il task e' chiuso solo se:

- [ ] Subgraph supporta N `VaultFactory` per chain
- [ ] Subgraph supporta N `VaultUpkeep` per chain
- [ ] `Protocol` non assume piu' una sola factory
- [ ] `VaultStrategy` espone `name` e `description`
- [ ] Arbitrum, Base, Ethereum restano allineati
- [ ] Docs aggiornate
- [ ] Deploy eseguito
- [ ] Smoke queries live passano
- [ ] Nessun indexing error

---

## Direttiva finale

**Non fare una patch Arbitrum-only.**
Devi fare un refactor coerente cross-chain, perche' schema e query sono condivisi e non vogliamo divergenze tra chain.
