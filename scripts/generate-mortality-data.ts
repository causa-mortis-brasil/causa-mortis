import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildZip } from "../src/lib/mortality/zip.ts";
import type {
  AgeSeries,
  CauseRateEntry,
  CoverageTable,
  DeathsByAgeTable,
  DeathsByCauseGroupTable,
  MortalityIndexed,
  OverallTable,
  PopulationByAgeTable,
} from "../src/lib/mortality/types.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC_INDEXED = path.join(HERE, "..", "data", "mortality-indexed.json");
const JSON_OUT_DIR = path.join(HERE, "..", "public", "data", "mortality");
const CSV_OUT_DIR = path.join(HERE, "..", "public", "data", "mortality-csv");

mkdirSync(JSON_OUT_DIR, { recursive: true });
mkdirSync(CSV_OUT_DIR, { recursive: true });

const indexed: MortalityIndexed = JSON.parse(
  readFileSync(SRC_INDEXED, "utf-8"),
);
const dimensions = indexed.dimensions;

const JSON_TABLES = [
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

const jsonStats = JSON_TABLES.map((table) => {
  const file = path.join(JSON_OUT_DIR, `${table}.json`);
  writeFileSync(file, JSON.stringify(indexed[table]), "utf-8");
  return { table, bytes: statSync(file).size };
});

function csvEscape(value: string | number): string {
  const text = String(value);
  return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvEscape).join(";"));
  return `\uFEFF${lines.join("\r\n")}`;
}

function locationName(location: string): string {
  return dimensions.location_names[location] ?? location;
}

function forEachEntry<T>(
  table: (T | null)[][][],
  fn: (location: string, sex: string, year: number, value: T) => void,
): void {
  dimensions.locations.forEach((location, locationIndex) => {
    dimensions.sexes.forEach((sex, sexIndex) => {
      dimensions.years.forEach((year, yearIndex) => {
        const value = table[locationIndex]?.[sexIndex]?.[yearIndex];
        if (value != null) fn(location, sex, year, value);
      });
    });
  });
}

function forEachDetail<T>(
  values: (T | null)[] | null | undefined,
  labels: string[],
  fn: (label: string, value: T) => void,
): void {
  if (!values) return;
  labels.forEach((label, index) => {
    const value = values[index];
    if (value != null) fn(label, value);
  });
}

function forEachAge(
  series: AgeSeries | null | undefined,
  fn: (ageGroup: string, value: number) => void,
): void {
  if (!series) return;
  dimensions.age_groups.forEach((ageGroup, index) => {
    const value = series[index];
    if (value != null) fn(ageGroup, value);
  });
}

function buildOverallCsv(table: OverallTable): string {
  const rows: (string | number)[][] = [];
  forEachEntry(table, (location, sex, year, entry) => {
    const [deaths, crudeRate, stdRate, population] = entry;
    rows.push([
      location,
      locationName(location),
      sex,
      year,
      deaths,
      crudeRate,
      stdRate,
      population,
    ]);
  });
  return toCsv(
    [
      "Território",
      "Nome do território",
      "Sexo",
      "Ano",
      "Óbitos",
      "Taxa bruta (por 100 mil hab.)",
      "Taxa padronizada (por 100 mil hab.)",
      "População",
    ],
    rows,
  );
}

function buildCauseGroupCsv(table: DeathsByCauseGroupTable): string {
  const rows: (string | number)[][] = [];
  forEachEntry(table, (location, sex, year, entries) => {
    forEachDetail(entries, dimensions.cause_groups, (causeGroup, entry) => {
      const [deaths, stdRate] = entry;
      rows.push([
        location,
        locationName(location),
        sex,
        year,
        causeGroup,
        deaths,
        stdRate,
      ]);
    });
  });
  return toCsv(
    [
      "Território",
      "Nome do território",
      "Sexo",
      "Ano",
      "Grupo de causa",
      "Óbitos",
      "Taxa padronizada (por 100 mil hab.)",
    ],
    rows,
  );
}

function buildRateEntryTableCsv(
  table: ((CauseRateEntry | null)[] | null)[][][],
  labels: string[],
  labelHeader: string,
): string {
  const rows: (string | number)[][] = [];
  forEachEntry(table, (location, sex, year, entries) => {
    forEachDetail(entries, labels, (label, entry) => {
      const [deaths, crudeRate, stdRate] = entry;
      rows.push([
        location,
        locationName(location),
        sex,
        year,
        label,
        deaths,
        crudeRate,
        stdRate,
      ]);
    });
  });
  return toCsv(
    [
      "Território",
      "Nome do território",
      "Sexo",
      "Ano",
      labelHeader,
      "Óbitos",
      "Taxa bruta (por 100 mil hab.)",
      "Taxa padronizada (por 100 mil hab.)",
    ],
    rows,
  );
}

function buildAgeTableCsv(
  table: DeathsByAgeTable | PopulationByAgeTable,
  valueHeader: string,
): string {
  const rows: (string | number)[][] = [];
  forEachEntry(table, (location, sex, year, series) => {
    forEachAge(series, (ageGroup, value) => {
      rows.push([location, locationName(location), sex, year, ageGroup, value]);
    });
  });
  return toCsv(
    [
      "Território",
      "Nome do território",
      "Sexo",
      "Ano",
      "Faixa etária",
      valueHeader,
    ],
    rows,
  );
}

function buildCoverageCsv(table: CoverageTable): string {
  const rows: (string | number)[][] = [];
  dimensions.locations.forEach((location, locationIndex) => {
    dimensions.years.forEach((year, yearIndex) => {
      const value = table[locationIndex]?.[yearIndex];
      if (value != null)
        rows.push([location, locationName(location), year, value]);
    });
  });
  return toCsv(
    ["Território", "Nome do território", "Ano", "Cobertura do SIM"],
    rows,
  );
}

const friendlyCsvs: { table: string; content: string }[] = [
  { table: "overall", content: buildOverallCsv(indexed.overall) },
  {
    table: "deaths_by_cause_group",
    content: buildCauseGroupCsv(indexed.deaths_by_cause_group),
  },
  {
    table: "deaths_by_external_cause",
    content: buildRateEntryTableCsv(
      indexed.deaths_by_external_cause,
      dimensions.external_cause_types,
      "Tipo de causa externa",
    ),
  },
  {
    table: "deaths_by_assault_means",
    content: buildRateEntryTableCsv(
      indexed.deaths_by_assault_means,
      dimensions.assault_means,
      "Meio de agressão",
    ),
  },
  {
    table: "deaths_by_detailed_subgroup",
    content: buildRateEntryTableCsv(
      indexed.deaths_by_detailed_subgroup,
      dimensions.detailed_subgroups,
      "Subgrupo detalhado",
    ),
  },
  {
    table: "deaths_by_age",
    content: buildAgeTableCsv(indexed.deaths_by_age, "Óbitos"),
  },
  {
    table: "population_by_age",
    content: buildAgeTableCsv(indexed.population_by_age, "População"),
  },
  { table: "coverage", content: buildCoverageCsv(indexed.coverage) },
];

const encoder = new TextEncoder();
const csvStats = friendlyCsvs.map(({ table, content }) => {
  const file = path.join(CSV_OUT_DIR, `${table}.csv`);
  writeFileSync(file, content, "utf-8");
  return { table, bytes: statSync(file).size };
});

const bundle = buildZip(
  friendlyCsvs.map(({ table, content }) => ({
    name: `${table}.csv`,
    data: encoder.encode(content),
  })),
);
const bundleFile = path.join(CSV_OUT_DIR, "causa-mortis-dados-completos.zip");
writeFileSync(bundleFile, bundle);

const totalJsonBytes = jsonStats.reduce((sum, s) => sum + s.bytes, 0);
const totalCsvBytes = csvStats.reduce((sum, s) => sum + s.bytes, 0);

console.log(`OK — data/mortality-indexed.json -> public/data/mortality/*.json`);
console.log(
  `  ${jsonStats.length} tabelas, ${(totalJsonBytes / 1e6).toFixed(2)} MB total`,
);
for (const s of jsonStats) {
  console.log(
    `    ${s.table.padEnd(32)} ${(s.bytes / 1e3).toFixed(1).padStart(9)} KB`,
  );
}

console.log(
  `OK — data/mortality-indexed.json -> public/data/mortality-csv/*.csv`,
);
console.log(
  `  ${csvStats.length} tabelas, ${(totalCsvBytes / 1e6).toFixed(2)} MB total`,
);
for (const s of csvStats) {
  console.log(
    `    ${s.table.padEnd(32)} ${(s.bytes / 1e3).toFixed(1).padStart(9)} KB`,
  );
}
console.log(
  `  ${bundleFile.replace(`${HERE}/../`, "")} ${(statSync(bundleFile).size / 1e6).toFixed(2)} MB`,
);
