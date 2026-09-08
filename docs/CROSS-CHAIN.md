# Cross-chain aggregation (SG-15)

## Decision

**The backend fans out to the three subgraph endpoints and sums. There is no
`MultyrGlobal` entity and no meta/composed subgraph.**

`Protocol` and `VaultFactory` are per chain (`id: "protocol-{chainId}"`,
`{factoryAddress}-{chainId}`). Each of `multyr-ethereum`, `multyr-arbitrum`,
`multyr-base` indexes its own chain against the shared `schema.graphql`.

## Consequences for consumers

- **"Total Multyr TVL" is not a query.** The backend queries `protocols` /
  `vaults` on each endpoint and adds the results.
- **Freshness is per chain.** Never show a single aggregate indexing-lag figure —
  each chain has its own `_meta.block` and its own lag. Display them separately.
- **RPC config is per chain.** One provider set per chain, each with its own
  `chainId` validation and quorum.

## Why not a meta subgraph

A composed/meta subgraph adds an indexing layer to maintain, its own lag, and its
own failure mode, for an aggregation the backend already has to do (it also joins
subgraph data with RPC snapshots and persisted history). The fan-out is simpler
and keeps each chain's data independently verifiable.
