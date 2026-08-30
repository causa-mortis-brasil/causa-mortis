import type {
  AgeSeries,
  CauseGroupEntry,
  CauseRateEntry,
  CoverageTable,
  DeathsByAssaultMeansAgeLocationTable,
  DeathsByAssaultMeansLocationTable,
  DeathsByCauseGroupAgeLocationTable,
  DeathsByCauseGroupLocationTable,
  DeathsByDetailedSubgroupAgeLocationTable,
  DeathsByDetailedSubgroupLocationTable,
  DeathsByExternalCauseAgeLocationTable,
  DeathsByExternalCauseLocationTable,
  OverallEntry,
  OverallLocationTable,
} from "./types";

const ZERO_CAUSE_GROUP_ENTRY: CauseGroupEntry = [0, 0];
const ZERO_CAUSE_RATE_ENTRY: CauseRateEntry = [0, 0, 0];

export function getOverall(
  table: OverallLocationTable,
  sexIndex: number,
  yearIndex: number,
): OverallEntry | null {
  return table[sexIndex]?.[yearIndex] ?? null;
}

export function getCauseGroupEntry(
  table: DeathsByCauseGroupLocationTable,
  sexIndex: number,
  yearIndex: number,
  causeGroupIndex: number,
): CauseGroupEntry {
  const entries = table[sexIndex]?.[yearIndex];
  return entries?.[causeGroupIndex] ?? ZERO_CAUSE_GROUP_ENTRY;
}

export function getExternalCauseEntry(
  table: DeathsByExternalCauseLocationTable,
  sexIndex: number,
  yearIndex: number,
  externalCauseTypeIndex: number,
): CauseRateEntry {
  const entries = table[sexIndex]?.[yearIndex];
  return entries?.[externalCauseTypeIndex] ?? ZERO_CAUSE_RATE_ENTRY;
}

export function getAssaultMeansEntry(
  table: DeathsByAssaultMeansLocationTable,
  sexIndex: number,
  yearIndex: number,
  assaultMeansIndex: number,
): CauseRateEntry {
  const entries = table[sexIndex]?.[yearIndex];
  return entries?.[assaultMeansIndex] ?? ZERO_CAUSE_RATE_ENTRY;
}

export function getDetailedSubgroupEntry(
  table: DeathsByDetailedSubgroupLocationTable,
  sexIndex: number,
  yearIndex: number,
  detailedSubgroupIndex: number,
): CauseRateEntry {
  const entries = table[sexIndex]?.[yearIndex];
  return entries?.[detailedSubgroupIndex] ?? ZERO_CAUSE_RATE_ENTRY;
}

export function getAgeSeries(
  table: (AgeSeries | null)[][],
  sexIndex: number,
  yearIndex: number,
): AgeSeries | null {
  return table[sexIndex]?.[yearIndex] ?? null;
}

export function getCauseGroupAgeSeries(
  table: DeathsByCauseGroupAgeLocationTable,
  sexIndex: number,
  yearIndex: number,
  causeGroupIndex: number,
): AgeSeries | null {
  const byCauseGroup = table[sexIndex]?.[yearIndex];
  return byCauseGroup?.[causeGroupIndex] ?? null;
}

export function getExternalCauseAgeSeries(
  table: DeathsByExternalCauseAgeLocationTable,
  sexIndex: number,
  yearIndex: number,
  externalCauseTypeIndex: number,
): AgeSeries | null {
  const byType = table[sexIndex]?.[yearIndex];
  return byType?.[externalCauseTypeIndex] ?? null;
}

export function getAssaultMeansAgeSeries(
  table: DeathsByAssaultMeansAgeLocationTable,
  sexIndex: number,
  yearIndex: number,
  assaultMeansIndex: number,
): AgeSeries | null {
  const byMeans = table[sexIndex]?.[yearIndex];
  return byMeans?.[assaultMeansIndex] ?? null;
}

export function getDetailedSubgroupAgeSeries(
  table: DeathsByDetailedSubgroupAgeLocationTable,
  sexIndex: number,
  yearIndex: number,
  detailedSubgroupIndex: number,
): AgeSeries | null {
  const bySubgroup = table[sexIndex]?.[yearIndex];
  return bySubgroup?.[detailedSubgroupIndex] ?? null;
}

export function getCoverage(
  table: CoverageTable,
  locationIndex: number,
  yearIndex: number,
): number | null {
  return table[locationIndex]?.[yearIndex] ?? null;
}
