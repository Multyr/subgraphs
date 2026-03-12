#!/usr/bin/env node
/**
 * extract-abis.mjs
 *
 * Cross-platform Node script to extract ABI from Foundry artifacts.
 * Replaces jq-based extraction for Windows/macOS/Linux compatibility.
 *
 * Usage: node scripts/extract-abis.mjs
 * Run from: subgraphs/ directory
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const ROOT_SUBGRAPHS = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT_SUBGRAPHS, '..', 'out');
const CHAINS = ['ethereum', 'arbitrum', 'base'];

/**
 * Contract mapping configuration
 *
 * Simple contracts: outputFileName -> single artifact path
 * Combined contracts: outputFileName -> array of artifact paths (ABIs will be merged)
 *
 * For Vault.json we merge CoreVault + QueueModule + AdminModule because:
 * - QueueModule and AdminModule are called via delegatecall
 * - Their events are emitted from CoreVault's address
 * - The subgraph needs all events in one ABI
 */
const CONTRACTS = {
  'VaultFactory.json': 'VaultFactory.sol/VaultFactory.json',
  'Vault.json': [
    'CoreVault.sol/CoreVault.json',
    'QueueModule.sol/QueueModule.json',
    'AdminModule.sol/AdminModule.json',
    'Events.sol/Events.json',
  ],
  'ERC20.json': 'IERC20Metadata.sol/IERC20Metadata.json',
};

// Static ABIs that don't come from Foundry artifacts
const STATIC_ABIS = {
  'ChainlinkAggregator.json': null, // Already exists in abis/, don't overwrite
};

/**
 * Extract ABI from Foundry artifact JSON
 */
function extractAbi(artifactPath) {
  if (!existsSync(artifactPath)) {
    return { success: false, error: `missing artifact at ${artifactPath}` };
  }

  let artifact;
  try {
    const content = readFileSync(artifactPath, 'utf8');
    artifact = JSON.parse(content);
  } catch (e) {
    return { success: false, error: `failed to parse JSON at ${artifactPath}: ${e.message}` };
  }

  if (!artifact.abi) {
    return { success: false, error: `no abi field in ${artifactPath}` };
  }

  if (!Array.isArray(artifact.abi)) {
    return { success: false, error: `abi field is not an array in ${artifactPath}` };
  }

  return { success: true, abi: artifact.abi };
}

/**
 * Create a unique key for an ABI entry to detect duplicates
 * Dedup rule:
 * - events: type + name + input types WITH indexed attribute (i/n suffix)
 * - functions/errors: type + name + input types only
 * This ensures events with same types but different indexed are kept separate.
 */
function abiEntryKey(entry) {
  if (entry.type === 'event') {
    // For events, include indexed attribute: "address:i,uint256:n" format
    const inputs = (entry.inputs || []).map(i => `${i.type}:${i.indexed ? 'i' : 'n'}`).join(',');
    return `${entry.type}:${entry.name}(${inputs})`;
  }
  if (entry.type === 'function' || entry.type === 'error') {
    const inputs = (entry.inputs || []).map(i => i.type).join(',');
    return `${entry.type}:${entry.name}(${inputs})`;
  }
  if (entry.type === 'constructor') {
    const inputs = (entry.inputs || []).map(i => i.type).join(',');
    return `constructor(${inputs})`;
  }
  if (entry.type === 'fallback' || entry.type === 'receive') {
    return entry.type;
  }
  return JSON.stringify(entry);
}

/**
 * Get human-readable signature for an ABI entry
 */
function abiEntrySignature(entry) {
  if (entry.type === 'function' || entry.type === 'event' || entry.type === 'error') {
    const inputs = (entry.inputs || []).map(i => {
      const indexed = i.indexed ? 'indexed ' : '';
      return `${indexed}${i.type}`;
    }).join(', ');
    return `${entry.type} ${entry.name}(${inputs})`;
  }
  if (entry.type === 'constructor') {
    const inputs = (entry.inputs || []).map(i => i.type).join(', ');
    return `constructor(${inputs})`;
  }
  return entry.type;
}

/**
 * Merge multiple ABIs, removing duplicates
 * Returns: { merged: ABI[], collisions: { key, signature, sources[] }[] }
 */
function mergeAbisWithReport(abiArrays, sourceNames) {
  const seen = new Map(); // key -> { entry, sources: string[] }
  const collisions = [];
  const merged = [];

  for (let i = 0; i < abiArrays.length; i++) {
    const abi = abiArrays[i];
    const sourceName = sourceNames[i];

    for (const entry of abi) {
      const key = abiEntryKey(entry);

      if (seen.has(key)) {
        // Collision detected - same signature from multiple sources
        const existing = seen.get(key);
        if (!existing.sources.includes(sourceName)) {
          existing.sources.push(sourceName);
        }
      } else {
        seen.set(key, { entry, sources: [sourceName] });
        merged.push(entry);
      }
    }
  }

  // Build collision report
  for (const [key, data] of seen) {
    if (data.sources.length > 1) {
      collisions.push({
        key,
        signature: abiEntrySignature(data.entry),
        sources: data.sources
      });
    }
  }

  return { merged, collisions };
}

/**
 * Ensure directory exists
 */
function ensureDir(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Write ABI to file with pretty formatting
 */
function writeAbi(filePath, abi) {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, JSON.stringify(abi, null, 2) + '\n', 'utf8');
}

/**
 * Main extraction logic
 */
function main() {
  console.log('=== ABI Extraction (cross-platform, no jq) ===\n');
  console.log(`Foundry out dir: ${OUT_DIR}`);
  console.log(`Target chains: ${CHAINS.join(', ')}\n`);

  // Verify out directory exists
  if (!existsSync(OUT_DIR)) {
    console.error(`\n❌ ERROR: Foundry out directory not found at ${OUT_DIR}`);
    console.error('   Run "forge build" first to generate artifacts.');
    process.exit(1);
  }

  let hasErrors = false;
  const results = [];

  // Process each contract
  for (const [outputFile, artifactConfig] of Object.entries(CONTRACTS)) {
    const isMerged = Array.isArray(artifactConfig);
    const artifactPaths = isMerged ? artifactConfig : [artifactConfig];

    console.log(`\nProcessing: ${outputFile}${isMerged ? ' (merged)' : ''}`);

    const abisToMerge = [];
    const sourceNames = [];
    let allSuccess = true;
    const sources = [];
    const preMergeCounts = [];

    for (const artifactRelPath of artifactPaths) {
      const artifactPath = join(OUT_DIR, artifactRelPath);
      const sourceName = basename(dirname(artifactRelPath));
      console.log(`  Source: ${artifactRelPath}`);
      sources.push(artifactRelPath);
      sourceNames.push(sourceName);

      const result = extractAbi(artifactPath);

      if (!result.success) {
        console.error(`    ❌ ${result.error}`);
        hasErrors = true;
        allSuccess = false;
        preMergeCounts.push(0);
      } else {
        console.log(`    ✅ extracted ${result.abi.length} entries`);
        preMergeCounts.push(result.abi.length);
        abisToMerge.push(result.abi);
      }
    }

    if (!allSuccess) {
      results.push({ file: outputFile, status: 'FAIL', error: 'one or more sources failed' });
      continue;
    }

    // Merge ABIs if multiple sources
    let finalAbi;
    let collisionReport = null;

    if (isMerged) {
      const totalPreMerge = preMergeCounts.reduce((a, b) => a + b, 0);
      const mergeResult = mergeAbisWithReport(abisToMerge, sourceNames);
      finalAbi = mergeResult.merged;
      collisionReport = mergeResult.collisions;

      console.log(`\n  === MERGE REPORT ===`);
      console.log(`  Pre-merge totals:`);
      for (let i = 0; i < sourceNames.length; i++) {
        console.log(`    - ${sourceNames[i]}: ${preMergeCounts[i]} entries`);
      }
      console.log(`  Total pre-merge: ${totalPreMerge}`);
      console.log(`  Post-merge: ${finalAbi.length} unique entries`);
      console.log(`  Duplicates removed: ${totalPreMerge - finalAbi.length}`);

      if (collisionReport.length > 0) {
        console.log(`\n  Collisions resolved (${collisionReport.length}):`);
        console.log(`  (Dedup rule: first occurrence wins, keyed by type+name+inputTypes)`);
        for (const col of collisionReport) {
          console.log(`    - ${col.signature}`);
          console.log(`      Sources: ${col.sources.join(', ')}`);
        }
      } else {
        console.log(`\n  Collisions: 0 (no duplicate signatures across sources)`);
      }
      console.log(`  === END MERGE REPORT ===\n`);
    } else {
      finalAbi = abisToMerge[0];
    }

    // Write to all chain directories
    for (const chain of CHAINS) {
      const outputPath = join(ROOT_SUBGRAPHS, chain, 'abis', outputFile);
      try {
        writeAbi(outputPath, finalAbi);
        console.log(`  ✅ wrote ${chain}/abis/${outputFile}`);
      } catch (e) {
        console.error(`  ❌ failed to write ${outputPath}: ${e.message}`);
        hasErrors = true;
      }
    }

    results.push({
      file: outputFile,
      status: 'OK',
      abiLength: finalAbi.length,
      source: sources.join(' + '),
      merged: isMerged,
      collisions: collisionReport ? collisionReport.length : 0
    });
  }

  // Summary table
  console.log('\n=== Summary ===\n');
  console.log('Contract            | Source(s)                               | Status');
  console.log('--------------------|----------------------------------------|--------');
  for (const r of results) {
    const contract = r.file.padEnd(19);
    const source = (r.source || 'N/A').substring(0, 40).padEnd(40);
    const status = r.status === 'OK'
      ? `OK (${r.abiLength} entries${r.merged ? `, ${r.collisions} collisions` : ''})`
      : `FAIL: ${r.error}`;
    console.log(`${contract}| ${source}| ${status}`);
  }

  // Check for static ABIs
  console.log('\n=== Static ABIs (not extracted) ===\n');
  for (const [staticFile] of Object.entries(STATIC_ABIS)) {
    for (const chain of CHAINS) {
      const staticPath = join(ROOT_SUBGRAPHS, chain, 'abis', staticFile);
      if (existsSync(staticPath)) {
        console.log(`  ✅ ${chain}/abis/${staticFile} (exists)`);
      } else {
        console.warn(`  ⚠️  ${chain}/abis/${staticFile} (MISSING - add manually)`);
      }
    }
  }

  if (hasErrors) {
    console.error('\n❌ Extraction completed with errors. Fix issues above.');
    process.exit(1);
  }

  console.log('\n✅ All ABIs extracted successfully.\n');
}

main();
