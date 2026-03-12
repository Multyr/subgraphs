# AssemblyScript Compiler Gotchas (graph-ts / AS 0.19.x)

This document catalogs patterns that cause **internal compiler crashes** in
AssemblyScript 0.19.x as used by The Graph's `graph-cli` toolchain.

These are NOT normal type errors — they produce an `AssertionError` inside
`compileBinaryOverload` and crash the entire build with zero useful diagnostics.

---

## 1. `== null` on nullable value types

`Bytes | null`, `BigInt | null`, and similar nullable value-type fields crash
when tested with `==`.  Entity `.load()` results (reference types) are fine.

```typescript
// CRASHES
let core: Bytes | null = router.core
if (core == null) return

// SAFE — use strict equality
let core: Bytes | null = router.core
if (core === null) return
```

**Rule**: always use `=== null` / `!== null` for nullable value types.

---

## 2. Compound nullable check + non-null assertion

Combining a nullable guard with a non-null assertion (`!`) in the same boolean
expression crashes the compiler.

```typescript
// CRASHES
if (vault.router === null || !vault.router!.equals(newRouter)) { ... }

// SAFE — split into separate blocks
if (vault.router === null) {
  // handle null case
} else {
  let current = vault.router! as Bytes
  if (!current.equals(newRouter)) {
    // handle mismatch
  }
}
```

**Rule**: never combine `=== null` and `!x!.method()` in the same `if`.

---

## 3. Ternary expressions that produce `null`

Ternaries whose branches evaluate to `null` crash the type resolver.

```typescript
// CRASHES
let name: string | null = result.reverted ? null : result.value

// SAFE — explicit if/else
let name: string | null = null
if (!result.reverted) {
  name = result.value
}
```

**Rule**: avoid ternaries where either branch is a literal `null`.

---

## 4. Template idempotency — use a guard entity

`DataSourceTemplate.create()` is NOT guaranteed idempotent across graph-node
implementations.  Calling it multiple times for the same address may cause
duplicate indexing or other undefined behavior.

```typescript
// RISKY — creates template every time the event fires
StrategyRouterTemplate.create(routerAddr)

// SAFE — guard with a seen-entity
function ensureRouterTemplate(routerAddr: Address, timestamp: BigInt): void {
  let id = routerAddr.toHexString()
  let seen = StrategyRouterSeen.load(id)
  if (seen == null) {
    StrategyRouterTemplate.create(routerAddr)
    seen = new StrategyRouterSeen(id)
    seen.createdAt = timestamp
    seen.save()
  }
}
```

This also avoids the nullable-comparison crash from pattern #2, since we never
need to compare `vault.strategyRouter` at all.

---

## 5. General safe-coding style

| Prefer | Avoid |
|--------|-------|
| `=== null` / `!== null` | `== null` / `!= null` on value types |
| Split nullable checks into separate `if` blocks | Compound `\|\|` / `&&` with nullable + `!` assertion |
| Explicit `if/else` for nullable assignments | Ternary with `null` branch |
| Early return after null check | Deep nesting with non-null assertions |
| Guard entities for template dedup | Blind `Template.create()` calls |
| `let local = field; if (local === null) return;` | Inline field access in boolean expressions |

---

## Diagnosis tips

When `graph build` crashes with a stack trace mentioning `compileBinaryOverload`
or `AssertionError`, the problem is almost always a nullable-related expression.

Binary search is effective: comment out half the handlers, build, narrow down.
The crash gives no line number, so isolation is the only reliable method.
