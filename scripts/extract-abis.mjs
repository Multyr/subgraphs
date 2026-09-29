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
const REPOSITORIES_ROOT = resolve(ROOT_SUBGRAPHS, '..');
const CORE_OUT_DIR = process.env.MULTYR_CORE_OUT || resolve(REPOSITORIES_ROOT, 'multyr-core', 'out');
const STRATEGIES_OUT_DIR = process.env.MULTYR_STRATEGIES_OUT || resolve(REPOSITORIES_ROOT, 'multyr-strategies', 'out');
const CHAINS = ['ethereum', 'arbitrum', 'base'];

/**
 * Contract mapping configuration
 *
 * Every output maps to one or more absolute Foundry artifact paths. Multiple
 * artifacts are merged because module events are emitted from the delegating
 * CoreVault/strategy address.
 *
 * For Vault.json we merge CoreVault + its delegatecall modules (EpochedQueueModule,
 * AdminModule, ERC4626Module, LiquidityOpsModule) because:
 * - The modules are called via delegatecall
 * - Their events are emitted from CoreVault's address
 * - The subgraph needs all events in one ABI
 */
const CONTRACTS = {
  'VaultFactory.json': [resolve(CORE_OUT_DIR, 'VaultFactory.sol/VaultFactory.json')],
  'Vault.json': [
    resolve(CORE_OUT_DIR, 'CoreVault.sol/CoreVault.json'),
    resolve(CORE_OUT_DIR, 'EpochedQueueModule.sol/EpochedQueueModule.json'),
    resolve(CORE_OUT_DIR, 'AdminModule.sol/AdminModule.json'),
    resolve(CORE_OUT_DIR, 'ERC4626Module.sol/ERC4626Module.json'),
    resolve(CORE_OUT_DIR, 'LiquidityOpsModule.sol/LiquidityOpsModule.json'),
    resolve(CORE_OUT_DIR, 'Events.sol/Events.json'),
  ],
  'GlobalConfig.json': [resolve(CORE_OUT_DIR, 'GlobalConfig.sol/GlobalConfig.json')],
  'PriceOracleMiddleware.json': [resolve(CORE_OUT_DIR, 'PriceOracleMiddleware.sol/PriceOracleMiddleware.json')],
  'VaultUpkeep.json': [resolve(CORE_OUT_DIR, 'VaultUpkeep.sol/VaultUpkeep.json')],
  'ClaimSettlementUpkeep.json': [resolve(CORE_OUT_DIR, 'ClaimSettlementUpkeep.sol/ClaimSettlementUpkeep.json')],
  'StrategyRouter.json': [resolve(CORE_OUT_DIR, 'StrategyRouter.sol/StrategyRouter.json')],
  'Strategy.json': [
    resolve(STRATEGIES_OUT_DIR, 'UsdcLendingStrategy.sol/UsdcMultiLendingVault.json'),
    resolve(STRATEGIES_OUT_DIR, 'StrategyStorageLayout.sol/StrategyStorageLayout.json'),
    resolve(STRATEGIES_OUT_DIR, 'StrategyParamsModule.sol/StrategyParamsModule.json'),
    resolve(STRATEGIES_OUT_DIR, 'StrategyScoringModule.sol/StrategyScoringModule.json'),
    resolve(STRATEGIES_OUT_DIR, 'StrategyAdapterOpsModule.sol/StrategyAdapterOpsModule.json'),
    resolve(STRATEGIES_OUT_DIR, 'StrategyRebalanceGateModule.sol/StrategyRebalanceGateModule.json'),
    resolve(STRATEGIES_OUT_DIR, 'StrategySettingsModule.sol/StrategySettingsModule.json'),
    resolve(STRATEGIES_OUT_DIR, 'StrategyAllocCalcModule.sol/StrategyAllocCalcModule.json'),
    resolve(STRATEGIES_OUT_DIR, 'StrategyRebalancePlanModule.sol/StrategyRebalancePlanModule.json'),
    resolve(STRATEGIES_OUT_DIR, 'StrategySafetyOverflowModule.sol/StrategySafetyOverflowModule.json'),
  ],
  'StrategyUpkeep.json': [resolve(STRATEGIES_OUT_DIR, 'LendingStrategyUpkeep.sol/StrategyUpkeep.json')],
  'ERC20.json': [resolve(CORE_OUT_DIR, 'IERC20Metadata.sol/IERC20Metadata.json')],
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
  console.log(`Core Foundry out dir: ${CORE_OUT_DIR}`);
  console.log(`Strategies Foundry out dir: ${STRATEGIES_OUT_DIR}`);
  console.log(`Target chains: ${CHAINS.join(', ')}\n`);

  // Verify out directory exists
  if (!existsSync(CORE_OUT_DIR) || !existsSync(STRATEGIES_OUT_DIR)) {
    console.error(`\n❌ ERROR: one or more Foundry output directories are missing`);
    console.error('   Run "forge build" first to generate artifacts.');
    process.exit(1);
  }

  let hasErrors = false;
  const results = [];

  // Process each contract
  for (const [outputFile, artifactConfig] of Object.entries(CONTRACTS)) {
    const artifactPaths = artifactConfig;
    const isMerged = artifactPaths.length > 1;

    console.log(`\nProcessing: ${outputFile}${isMerged ? ' (merged)' : ''}`);

    const abisToMerge = [];
    const sourceNames = [];
    let allSuccess = true;
    const sources = [];
    const preMergeCounts = [];

    for (const artifactPath of artifactPaths) {
      const sourceName = basename(dirname(artifactPath));
      console.log(`  Source: ${artifactPath}`);
      sources.push(artifactPath);
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
