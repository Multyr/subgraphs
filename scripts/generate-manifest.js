#!/usr/bin/env node

/**
 * generate-manifest.js
 *
 * Reads address books and a template YAML to produce a final subgraph.yaml
 * with all {{PLACEHOLDER}} tokens replaced by actual deployed addresses.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * TEMPLATE SETUP
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * To create arbitrum/subgraph.template.yaml:
 *   1. Copy arbitrum/subgraph.yaml → arbitrum/subgraph.template.yaml
 *   2. Replace each hardcoded address with a {{PLACEHOLDER}} token:
 *
 *      Core addresses (from core-addresses.json):
 *        {{VAULT}}             — CoreVault proxy
 *        {{VAULT_FACTORY}}     — VaultFactory
 *        {{UPKEEP}}            — VaultUpkeep (Chainlink Automation)
 *        {{GLOBAL_CONFIG}}     — GlobalConfig
 *        {{FEE_COLLECTOR}}     — FeeCollector
 *        {{BUFFER_MANAGER}}    — BufferManager
 *        {{STRATEGY_ROUTER}}   — StrategyRouter
 *        {{HEALTH_REGISTRY}}   — StrategyHealthRegistry
 *        {{PRICE_ORACLE}}      — PriceOracleMiddleware
 *        {{ADMIN_MODULE}}      — AdminModule
 *        {{QUEUE_MODULE}}      — QueueModule
 *        {{LIQUIDITY_OPS_MODULE}} — LiquidityOpsModule
 *        {{AAVE_WARM_ADAPTER}} — AaveV3WarmAdapter
 *        {{MORPHO_WARM_ADAPTER}} — MorphoVaultWarmAdapter
 *        {{DEPOSIT_ROUTER}}    — DepositRouter
 *        {{FEE_COLLECTOR_UPKEEP}} — FeeCollectorUpkeep
 *
 *      Strategy addresses (from strategy-addresses.json):
 *        {{STRATEGY}}          — UsdcMultiLendingVault
 *        {{STRATEGY_UPKEEP}}   — StrategyUpkeep (LendingStrategyUpkeep)
 *        {{AAVE_LENDING_ADAPTER}}   — AaveV3USDCAdapter
 *        {{MORPHO_LENDING_ADAPTER}} — MorphoUsdcMultiMarketAdapter
 *        {{COMET_LENDING_ADAPTER}}  — CometUsdcMultiMarketAdapter
 *        {{EULER_LENDING_ADAPTER}}  — EulerUsdcMultiMarketAdapter
 *        {{DOLOMITE_LENDING_ADAPTER}} — DolomiteUsdcMultiMarketAdapter
 *        {{PROTOCOL_REGISTRY}}      — SimpleProtocolRegistry
 *
 *   3. Leave startBlock, ABI paths, and entity definitions unchanged.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Usage:
 *   node scripts/generate-manifest.js [chain]
 *
 * Default chain: arbitrum
 *
 * Input files:
 *   deployments/{chain}/core-addresses.json
 *   deployments/{chain}/strategy-addresses.json
 *   {chain}/subgraph.template.yaml
 *
 * Output:
 *   {chain}/subgraph.yaml
 */

const fs = require("fs");
const path = require("path");

const chain = process.argv[2] || "arbitrum";
const ROOT = path.resolve(__dirname, "..");

// ── Input paths ──────────────────────────────────────────────────────────────

const coreAddressesPath = path.join(ROOT, "deployments", chain, "core-addresses.json");
const strategyAddressesPath = path.join(ROOT, "deployments", chain, "strategy-addresses.json");
const templatePath = path.join(ROOT, chain, "subgraph.template.yaml");
const outputPath = path.join(ROOT, chain, "subgraph.yaml");

// ── Read inputs ──────────────────────────────────────────────────────────────

function readJSON(filepath) {
  if (!fs.existsSync(filepath)) {
    console.error(`ERROR: file not found: ${filepath}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(filepath, "utf-8"));
}

if (!fs.existsSync(templatePath)) {
  console.error(`ERROR: template not found: ${templatePath}`);
  console.error(`Create it by copying ${chain}/subgraph.yaml and replacing addresses with {{PLACEHOLDER}} tokens.`);
  process.exit(1);
}

const core = readJSON(coreAddressesPath);
const strategy = readJSON(strategyAddressesPath);
let template = fs.readFileSync(templatePath, "utf-8");

// ── Build replacement map ────────────────────────────────────────────────────
// Maps {{PLACEHOLDER}} → address from the JSON files.
// Keys are SCREAMING_SNAKE derived from the camelCase JSON keys.

function toScreamingSnake(camelCase) {
  return camelCase
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toUpperCase();
}

const replacements = {};

for (const [key, value] of Object.entries(core)) {
  if (typeof value === "string" && value.startsWith("0x")) {
    replacements[toScreamingSnake(key)] = value;
  }
}

for (const [key, value] of Object.entries(strategy)) {
  if (typeof value === "string" && value.startsWith("0x")) {
    replacements[toScreamingSnake(key)] = value;
  }
}

// ── Replace placeholders ─────────────────────────────────────────────────────

let replacedCount = 0;
const replacedKeys = [];

for (const [placeholder, address] of Object.entries(replacements)) {
  const token = `{{${placeholder}}}`;
  if (template.includes(token)) {
    template = template.split(token).join(address);
    replacedCount++;
    replacedKeys.push(`  ${token} → ${address}`);
  }
}

// ── Check for unreplaced placeholders ────────────────────────────────────────

const unreplaced = template.match(/\{\{[A-Z_]+\}\}/g);
if (unreplaced) {
  const unique = [...new Set(unreplaced)];
  console.warn(`WARNING: ${unique.length} unreplaced placeholder(s) remain:`);
  unique.forEach((p) => console.warn(`  ${p}`));
}

// ── Write output ─────────────────────────────────────────────────────────────

fs.writeFileSync(outputPath, template, "utf-8");

console.log(`generate-manifest: ${chain}`);
console.log(`  template : ${templatePath}`);
console.log(`  output   : ${outputPath}`);
console.log(`  replaced : ${replacedCount} placeholder(s)`);
if (replacedKeys.length > 0) {
  console.log("");
  replacedKeys.forEach((line) => console.log(line));
}
console.log("\nDone.");
