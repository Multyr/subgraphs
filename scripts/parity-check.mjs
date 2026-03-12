#!/usr/bin/env node
/**
 * Parity Check Script
 *
 * Verifies that all events emitted in Solidity contracts are indexed in the subgraph.
 *
 * Usage: node scripts/parity-check.mjs
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..', '..');

// Read Events.sol and extract event names
function extractEventsFromSol() {
  const eventsPath = join(rootDir, 'src/core/libraries/Events.sol');
  const content = readFileSync(eventsPath, 'utf-8');

  const eventRegex = /event\s+(\w+)\s*\(/g;
  const events = [];
  let match;
  while ((match = eventRegex.exec(content)) !== null) {
    events.push(match[1]);
  }
  return events;
}

// Read StrategyRouter.sol and extract event names
function extractEventsFromStrategyRouter() {
  const routerPath = join(rootDir, 'src/core/modules/StrategyRouter.sol');
  const content = readFileSync(routerPath, 'utf-8');

  const eventRegex = /event\s+(\w+)\s*\(/g;
  const events = [];
  let match;
  while ((match = eventRegex.exec(content)) !== null) {
    events.push(match[1]);
  }
  return events;
}

// Read subgraph.yaml and extract handler names
function extractHandlersFromSubgraph() {
  const subgraphPath = join(__dirname, '..', 'arbitrum', 'subgraph.yaml');
  const content = readFileSync(subgraphPath, 'utf-8');

  // Extract event signatures
  const eventRegex = /event:\s+(\w+)\(/g;
  const events = [];
  let match;
  while ((match = eventRegex.exec(content)) !== null) {
    events.push(match[1]);
  }
  return events;
}

// Read mappings.ts and extract export function names
function extractHandlersFromMappings() {
  const mappingsPath = join(__dirname, '..', 'arbitrum', 'src', 'mappings.ts');
  const content = readFileSync(mappingsPath, 'utf-8');

  const handlerRegex = /export function handle(\w+)/g;
  const handlers = [];
  let match;
  while ((match = handlerRegex.exec(content)) !== null) {
    handlers.push(match[1]);
  }
  return handlers;
}

// Main
console.log('=== Subgraph Parity Check ===\n');

const solEvents = extractEventsFromSol();
const routerEvents = extractEventsFromStrategyRouter();
const subgraphEvents = extractHandlersFromSubgraph();
const mappingsHandlers = extractHandlersFromMappings();

console.log(`Events.sol events: ${solEvents.length}`);
console.log(`StrategyRouter events: ${routerEvents.length}`);
console.log(`Subgraph indexed events: ${subgraphEvents.length}`);
console.log(`Mappings handlers: ${mappingsHandlers.length}`);
console.log('');

// Check for missing handlers
const allSolEvents = new Set([...solEvents, ...routerEvents]);
const indexedEvents = new Set(subgraphEvents);

const missing = [];
for (const event of allSolEvents) {
  if (!indexedEvents.has(event)) {
    missing.push(event);
  }
}

if (missing.length > 0) {
  console.log('Events not indexed in subgraph:');
  missing.forEach(e => console.log(`  - ${e}`));
} else {
  console.log('All Solidity events are indexed in the subgraph!');
}

// Check for extra handlers (indexed but not in Solidity)
const extra = [];
for (const event of indexedEvents) {
  if (!allSolEvents.has(event)) {
    extra.push(event);
  }
}

if (extra.length > 0) {
  console.log('\nEvents indexed but not found in Solidity (may be inherited/external):');
  extra.forEach(e => console.log(`  - ${e}`));
}

console.log('\n=== Summary ===');
console.log(`Total Solidity events: ${allSolEvents.size}`);
console.log(`Total indexed events: ${indexedEvents.size}`);
console.log(`Missing: ${missing.length}`);
console.log(`Extra: ${extra.length}`);

// Exit with error if missing events
if (missing.length > 0) {
  console.log('\n');
  process.exit(1);
}

console.log('\nParity check passed!');
