import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { MortalityIndexed } from "../src/lib/mortality/types.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC_INDEXED = path.join(HERE, "..", "data", "mortality-indexed.json");
const OUT_DIR = path.join(HERE, "..", "public", "data", "mortality");

mkdirSync(OUT_DIR, { recursive: true });

const indexed: MortalityIndexed = JSON.parse(
  readFileSync(SRC_INDEXED, "utf-8"),
);

const TABLES = [
  "dimensions",
  "overall",
  "deaths_by_cause_group",
  "deaths_by_cause_group_age",
  "deaths_by_external_cause",
  "deaths_by_external_cause_age",
  "deaths_by_assault_means",
  "deaths_by_assault_means_age",
  "deaths_by_detailed_subgroup",
  "deaths_by_detailed_subgroup_age",
  "deaths_by_age",
  "population_by_age",
  "coverage",
] as const;

const stats = TABLES.map((table) => {
  const file = path.join(OUT_DIR, `${table}.json`);
  writeFileSync(file, JSON.stringify(indexed[table]), "utf-8");
  return { table, bytes: statSync(file).size };
});

const totalBytes = stats.reduce((sum, s) => sum + s.bytes, 0);
console.log(`OK — data/mortality-indexed.json -> public/data/mortality/*.json`);
console.log(
  `  ${stats.length} tabelas, ${(totalBytes / 1e6).toFixed(2)} MB total`,
);
for (const s of stats) {
  console.log(
    `    ${s.table.padEnd(32)} ${(s.bytes / 1e3).toFixed(1).padStart(9)} KB`,
  );
}
