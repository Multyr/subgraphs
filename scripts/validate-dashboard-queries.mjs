#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Kind, parse, visit } from "graphql";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const queryPath = join(root, "docs", "DASHBOARD-QUERIES.graphql");
const source = readFileSync(queryPath, "utf8");
const document = parse(source);

const paginatedCollections = new Set([
  "vaults",
  "vaultDayDatas",
  "vaultHourDatas",
  "ppsSnapshots",
  "claimRequests",
  "withdrawalEpochs",
  "withdrawalEpochEvents",
  "vaultStrategies",
  "strategyHarvestEvents",
  "harvestBatches",
  "strategyDayDatas",
  "adapterHealthSnapshots",
  "upkeepActions",
  "ownershipEvents",
  "moduleChanges",
  "moduleAuthorizationEvents",
  "deadDepositEvents",
  "vaultPauseEvents",
  "sealEvents",
  "oracleRegistryEvents",
  "tokenPrices",
  "tokenPriceDayDatas",
  "referralBoundEvents",
  "depositWithReferralEvents",
  "partnerEvents",
  "transactions"
]);

const failures = [];

function argument(field, name) {
  return (field.arguments || []).find((arg) => arg.name.value === name);
}

function objectField(object, name) {
  if (!object || object.value.kind !== Kind.OBJECT) return undefined;
  return object.value.fields.find((field) => field.name.value === name);
}

visit(document, {
  Field(field) {
    const name = field.name.value;
    if (!paginatedCollections.has(name)) return;

    const first = argument(field, "first");
    const orderBy = argument(field, "orderBy");
    const orderDirection = argument(field, "orderDirection");
    const where = argument(field, "where");
    const idGt = objectField(where, "id_gt");

    if (!first || first.value.kind !== Kind.VARIABLE) {
      failures.push(`${name}: first must be a variable`);
    }
    if (!orderBy || orderBy.value.kind !== Kind.ENUM || orderBy.value.value !== "id") {
      failures.push(`${name}: orderBy must be id`);
    }
    if (!orderDirection || orderDirection.value.kind !== Kind.ENUM || orderDirection.value.value !== "asc") {
      failures.push(`${name}: orderDirection must be asc`);
    }
    if (!idGt || idGt.value.kind !== Kind.VARIABLE) {
      failures.push(`${name}: where.id_gt must be a variable`);
    }
    if (argument(field, "skip")) failures.push(`${name}: skip is forbidden`);
  }
});

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("dashboard queries: syntax valid and collection cursors enforced");
