#!/usr/bin/env node
/**
 * Matchstick resolves its AS lib from `<network>/node_modules`, but deps are
 * installed once at the repo root. Symlink each network dir's node_modules to
 * the root so `graph test` works without per-network installs.
 */
import { symlinkSync, existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const net of ['arbitrum', 'base', 'ethereum']) {
  const link = join(ROOT, net, 'node_modules');
  try { if (existsSync(link)) rmSync(link, { recursive: true, force: true }); } catch {}
  try {
    symlinkSync(join('..', 'node_modules'), link, 'dir');
    console.log(`linked ${net}/node_modules -> ../node_modules`);
  } catch (e) {
    console.warn(`could not link ${net}/node_modules: ${e.message}`);
  }
}
