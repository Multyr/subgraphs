#!/usr/bin/env node
/**
 * sync-sources.mjs
 *
 * The three network subgraphs (arbitrum, base, ethereum) share byte-identical
 * mapping code and ABIs. `arbitrum/` is the SOURCE OF TRUTH; this script copies:
 *
 *   arbitrum/src/mappings.ts   -> base/src/, ethereum/src/
 *   arbitrum/src/helpers/*.ts  -> base/src/helpers/, ethereum/src/helpers/
 *   arbitrum/abis/*.json       -> base/abis/, ethereum/abis/
 *
 * subgraph.yaml is NOT synced (per-network addresses / startBlock / network).
 *
 * Usage:
 *   node scripts/sync-sources.mjs           # write
 *   node scripts/sync-sources.mjs --check   # exit 1 if anything would change (CI)
 */

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = 'arbitrum';
const TARGETS = ['base', 'ethereum'];
const CHECK = process.argv.includes('--check');

/** files/dirs under a network folder to keep in lockstep with the source */
const SYNC_ROOTS = ['src/mappings.ts', 'src/helpers', 'abis', 'tests'];

/** basenames never synced (per-network / local runner artifacts) */
const SKIP = new Set(['.latest.json']);
const SKIP_DIRS = new Set(['.bin']);

let drift = 0;
let copied = 0;

function walk(absPath, relPath, visit) {
  const base = relPath.split('/').pop();
  if (SKIP.has(base) || SKIP_DIRS.has(base)) return;
  const st = statSync(absPath);
  if (st.isDirectory()) {
    for (const name of readdirSync(absPath)) {
      walk(join(absPath, name), join(relPath, name), visit);
    }
  } else {
    visit(relPath);
  }
}

function syncFile(relPath) {
  const content = readFileSync(join(ROOT, SOURCE, relPath));
  for (const target of TARGETS) {
    const dst = join(ROOT, target, relPath);
    const same = existsSync(dst) && Buffer.compare(readFileSync(dst), content) === 0;
    if (same) continue;
    drift++;
    if (CHECK) {
      console.error(`DRIFT: ${target}/${relPath} differs from ${SOURCE}/${relPath}`);
    } else {
      mkdirSync(dirname(dst), { recursive: true });
      writeFileSync(dst, content);
      copied++;
      console.log(`synced ${target}/${relPath}`);
    }
  }
}

for (const root of SYNC_ROOTS) {
  const abs = join(ROOT, SOURCE, root);
  if (!existsSync(abs)) { console.warn(`skip (missing): ${SOURCE}/${root}`); continue; }
  walk(abs, root, syncFile);
}

if (CHECK) {
  if (drift > 0) {
    console.error(`\n${drift} file(s) out of sync. Run: node scripts/sync-sources.mjs`);
    process.exit(1);
  }
  console.log('sync-sources: base/ethereum match arbitrum ✔');
} else {
  console.log(`\nsync-sources: ${copied} file(s) written${drift === 0 ? ' (already in sync)' : ''}`);
}
