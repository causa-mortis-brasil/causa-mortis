import type {
  AgeSeries,
  CauseGroupEntry,
  CauseRateEntry,
  DeathsByAssaultMeansAgeTable,
  DeathsByAssaultMeansTable,
  DeathsByCauseGroupAgeTable,
  DeathsByCauseGroupTable,
  DeathsByDetailedSubgroupAgeTable,
  DeathsByDetailedSubgroupTable,
  DeathsByExternalCauseAgeTable,
  DeathsByExternalCauseTable,
  OverallEntry,
  OverallTable,
} from "./types";

const ZERO_CAUSE_GROUP_ENTRY: CauseGroupEntry = [0, 0];
const ZERO_CAUSE_RATE_ENTRY: CauseRateEntry = [0, 0, 0];

export function getOverall(
  table: OverallTable,
  locationIndex: number,
  sexIndex: number,
  yearIndex: number,
): OverallEntry | null {
  return table[locationIndex]?.[sexIndex]?.[yearIndex] ?? null;
}

export function getCauseGroupEntry(
  table: DeathsByCauseGroupTable,
  locationIndex: number,
  sexIndex: number,
  yearIndex: number,
  causeGroupIndex: number,
): CauseGroupEntry {
  const entries = table[locationIndex]?.[sexIndex]?.[yearIndex];
  return entries?.[causeGroupIndex] ?? ZERO_CAUSE_GROUP_ENTRY;
}

export function getExternalCauseEntry(
  table: DeathsByExternalCauseTable,
  locationIndex: number,
  sexIndex: number,
  yearIndex: number,
  externalCauseTypeIndex: number,
): CauseRateEntry {
  const entries = table[locationIndex]?.[sexIndex]?.[yearIndex];
  return entries?.[externalCauseTypeIndex] ?? ZERO_CAUSE_RATE_ENTRY;
}

export function getAssaultMeansEntry(
  table: DeathsByAssaultMeansTable,
  locationIndex: number,
  sexIndex: number,
  yearIndex: number,
  assaultMeansIndex: number,
): CauseRateEntry {
  const entries = table[locationIndex]?.[sexIndex]?.[yearIndex];
  return entries?.[assaultMeansIndex] ?? ZERO_CAUSE_RATE_ENTRY;
}

export function getDetailedSubgroupEntry(
  table: DeathsByDetailedSubgroupTable,
  locationIndex: number,
  sexIndex: number,
  yearIndex: number,
  detailedSubgroupIndex: number,
): CauseRateEntry {
  const entries = table[locationIndex]?.[sexIndex]?.[yearIndex];
  return entries?.[detailedSubgroupIndex] ?? ZERO_CAUSE_RATE_ENTRY;
}

export function getAgeSeries(
  table: (AgeSeries | null)[][][],
  locationIndex: number,
  sexIndex: number,
  yearIndex: number,
): AgeSeries | null {
  return table[locationIndex]?.[sexIndex]?.[yearIndex] ?? null;
}

export function getCauseGroupAgeSeries(
  table: DeathsByCauseGroupAgeTable,
  locationIndex: number,
  sexIndex: number,
  yearIndex: number,
  causeGroupIndex: number,
): AgeSeries | null {
  const byCauseGroup = table[locationIndex]?.[sexIndex]?.[yearIndex];
  return byCauseGroup?.[causeGroupIndex] ?? null;
}

export function getExternalCauseAgeSeries(
  table: DeathsByExternalCauseAgeTable,
  locationIndex: number,
  sexIndex: number,
  yearIndex: number,
  externalCauseTypeIndex: number,
): AgeSeries | null {
  const byType = table[locationIndex]?.[sexIndex]?.[yearIndex];
  return byType?.[externalCauseTypeIndex] ?? null;
}

export function getAssaultMeansAgeSeries(
  table: DeathsByAssaultMeansAgeTable,
  locationIndex: number,
  sexIndex: number,
  yearIndex: number,
  assaultMeansIndex: number,
): AgeSeries | null {
  const byMeans = table[locationIndex]?.[sexIndex]?.[yearIndex];
  return byMeans?.[assaultMeansIndex] ?? null;
}

export function getDetailedSubgroupAgeSeries(
  table: DeathsByDetailedSubgroupAgeTable,
  locationIndex: number,
  sexIndex: number,
  yearIndex: number,
  detailedSubgroupIndex: number,
): AgeSeries | null {
  const bySubgroup = table[locationIndex]?.[sexIndex]?.[yearIndex];
  return bySubgroup?.[detailedSubgroupIndex] ?? null;
}
