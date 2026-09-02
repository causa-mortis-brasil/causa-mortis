import {
  getAgeSeries,
  getAssaultMeansAgeSeries,
  getAssaultMeansEntry,
  getCauseGroupAgeSeries,
  getCauseGroupEntry,
  getDetailedSubgroupAgeSeries,
  getDetailedSubgroupEntry,
  getExternalCauseAgeSeries,
  getExternalCauseEntry,
  getOverall,
} from "./access";
import {
  fetchDeathsByAgeForLocation,
  fetchDeathsByAssaultMeans,
  fetchDeathsByAssaultMeansAgeForLocation,
  fetchDeathsByAssaultMeansForLocation,
  fetchDeathsByCauseGroup,
  fetchDeathsByCauseGroupAgeForLocation,
  fetchDeathsByCauseGroupForLocation,
  fetchDeathsByDetailedSubgroup,
  fetchDeathsByDetailedSubgroupAgeForLocation,
  fetchDeathsByDetailedSubgroupForLocation,
  fetchDeathsByExternalCause,
  fetchDeathsByExternalCauseAgeForLocation,
  fetchDeathsByExternalCauseForLocation,
  fetchOverall,
  fetchOverallForLocation,
} from "./data";
import { indexOf } from "./dimensions";
import { crudeRate } from "./rate";
import type {
  AgeSeries,
  CauseFilter,
  Dimensions,
  OverallLocationTable,
} from "./types";

export type CauseLevel =
  | { kind: "overall" }
  | { kind: "cause_group"; causeGroup: string }
  | { kind: "detailed_subgroup"; causeGroup: string; detailedSubgroup: string }
  | { kind: "external_cause"; causeGroup: string; externalCauseType: string }
  | {
      kind: "assault_means";
      causeGroup: string;
      externalCauseType: string;
      assaultMeans: string;
    };

export function resolveCauseLevel(filters: CauseFilter): CauseLevel {
  if (!filters.causeGroup) return { kind: "overall" };
  if (filters.externalCauseType && filters.assaultMeans) {
    return {
      kind: "assault_means",
      causeGroup: filters.causeGroup,
      externalCauseType: filters.externalCauseType,
      assaultMeans: filters.assaultMeans,
    };
  }
  if (filters.externalCauseType) {
    return {
      kind: "external_cause",
      causeGroup: filters.causeGroup,
      externalCauseType: filters.externalCauseType,
    };
  }
  if (filters.detailedSubgroup) {
    return {
      kind: "detailed_subgroup",
      causeGroup: filters.causeGroup,
      detailedSubgroup: filters.detailedSubgroup,
    };
  }
  return { kind: "cause_group", causeGroup: filters.causeGroup };
}

export interface RatePoint {
  deaths: number;
  crudeRate: number;
  stdRate: number;
}

const ZERO_POINT: RatePoint = { deaths: 0, crudeRate: 0, stdRate: 0 };
const EMPTY_LOCATION_TABLE: OverallLocationTable = [];

export type RatePointGetter = (
  locationIndex: number,
  sexIndex: number,
  yearIndex: number,
) => RatePoint;

export async function loadRatePointGetter(
  level: CauseLevel,
  dimensions: Dimensions,
): Promise<RatePointGetter> {
  if (level.kind === "overall") {
    const table = await fetchOverall();
    return (li, si, yi) => {
      const entry = getOverall(table[li] ?? EMPTY_LOCATION_TABLE, si, yi);
      return entry
        ? { deaths: entry[0], crudeRate: entry[1], stdRate: entry[2] }
        : ZERO_POINT;
    };
  }

  if (level.kind === "cause_group") {
    const causeGroupIndex = indexOf(dimensions.cause_groups, level.causeGroup);
    const [overallTable, causeGroupTable] = await Promise.all([
      fetchOverall(),
      fetchDeathsByCauseGroup(),
    ]);
    return (li, si, yi) => {
      const [deaths, stdRate] = getCauseGroupEntry(
        causeGroupTable[li] ?? [],
        si,
        yi,
        causeGroupIndex,
      );
      const population =
        getOverall(overallTable[li] ?? EMPTY_LOCATION_TABLE, si, yi)?.[3] ?? 0;
      return { deaths, crudeRate: crudeRate(deaths, population), stdRate };
    };
  }

  if (level.kind === "detailed_subgroup") {
    const detailedSubgroupIndex = indexOf(
      dimensions.detailed_subgroups,
      level.detailedSubgroup,
    );
    const table = await fetchDeathsByDetailedSubgroup();
    return (li, si, yi) => {
      const [deaths, crude, stdRate] = getDetailedSubgroupEntry(
        table[li] ?? [],
        si,
        yi,
        detailedSubgroupIndex,
      );
      return { deaths, crudeRate: crude, stdRate };
    };
  }

  if (level.kind === "external_cause") {
    const externalCauseTypeIndex = indexOf(
      dimensions.external_cause_types,
      level.externalCauseType,
    );
    const table = await fetchDeathsByExternalCause();
    return (li, si, yi) => {
      const [deaths, crude, stdRate] = getExternalCauseEntry(
        table[li] ?? [],
        si,
        yi,
        externalCauseTypeIndex,
      );
      return { deaths, crudeRate: crude, stdRate };
    };
  }

  const assaultMeansIndex = indexOf(
    dimensions.assault_means,
    level.assaultMeans,
  );
  const table = await fetchDeathsByAssaultMeans();
  return (li, si, yi) => {
    const [deaths, crude, stdRate] = getAssaultMeansEntry(
      table[li] ?? [],
      si,
      yi,
      assaultMeansIndex,
    );
    return { deaths, crudeRate: crude, stdRate };
  };
}

export type LocationRatePointGetter = (
  sexIndex: number,
  yearIndex: number,
) => RatePoint;

export async function loadLocationRatePointGetter(
  level: CauseLevel,
  dimensions: Dimensions,
  location: string,
): Promise<LocationRatePointGetter> {
  if (level.kind === "overall") {
    const table = await fetchOverallForLocation(location);
    return (si, yi) => {
      const entry = getOverall(table, si, yi);
      return entry
        ? { deaths: entry[0], crudeRate: entry[1], stdRate: entry[2] }
        : ZERO_POINT;
    };
  }

  if (level.kind === "cause_group") {
    const causeGroupIndex = indexOf(dimensions.cause_groups, level.causeGroup);
    const [overallTable, causeGroupTable] = await Promise.all([
      fetchOverallForLocation(location),
      fetchDeathsByCauseGroupForLocation(location),
    ]);
    return (si, yi) => {
      const [deaths, stdRate] = getCauseGroupEntry(
        causeGroupTable,
        si,
        yi,
        causeGroupIndex,
      );
      const population = getOverall(overallTable, si, yi)?.[3] ?? 0;
      return { deaths, crudeRate: crudeRate(deaths, population), stdRate };
    };
  }

  if (level.kind === "detailed_subgroup") {
    const detailedSubgroupIndex = indexOf(
      dimensions.detailed_subgroups,
      level.detailedSubgroup,
    );
    const table = await fetchDeathsByDetailedSubgroupForLocation(location);
    return (si, yi) => {
      const [deaths, crude, stdRate] = getDetailedSubgroupEntry(
        table,
        si,
        yi,
        detailedSubgroupIndex,
      );
      return { deaths, crudeRate: crude, stdRate };
    };
  }

  if (level.kind === "external_cause") {
    const externalCauseTypeIndex = indexOf(
      dimensions.external_cause_types,
      level.externalCauseType,
    );
    const table = await fetchDeathsByExternalCauseForLocation(location);
    return (si, yi) => {
      const [deaths, crude, stdRate] = getExternalCauseEntry(
        table,
        si,
        yi,
        externalCauseTypeIndex,
      );
      return { deaths, crudeRate: crude, stdRate };
    };
  }

  const assaultMeansIndex = indexOf(
    dimensions.assault_means,
    level.assaultMeans,
  );
  const table = await fetchDeathsByAssaultMeansForLocation(location);
  return (si, yi) => {
    const [deaths, crude, stdRate] = getAssaultMeansEntry(
      table,
      si,
      yi,
      assaultMeansIndex,
    );
    return { deaths, crudeRate: crude, stdRate };
  };
}

export type AgeSeriesGetter = (
  sexIndex: number,
  yearIndex: number,
) => AgeSeries | null;

export async function loadDeathsByAgeGetter(
  level: CauseLevel,
  dimensions: Dimensions,
  location: string,
): Promise<AgeSeriesGetter> {
  if (level.kind === "overall") {
    const table = await fetchDeathsByAgeForLocation(location);
    return (si, yi) => getAgeSeries(table, si, yi);
  }

  if (level.kind === "cause_group") {
    const causeGroupIndex = indexOf(dimensions.cause_groups, level.causeGroup);
    const table = await fetchDeathsByCauseGroupAgeForLocation(location);
    return (si, yi) => getCauseGroupAgeSeries(table, si, yi, causeGroupIndex);
  }

  if (level.kind === "detailed_subgroup") {
    const detailedSubgroupIndex = indexOf(
      dimensions.detailed_subgroups,
      level.detailedSubgroup,
    );
    const table = await fetchDeathsByDetailedSubgroupAgeForLocation(location);
    return (si, yi) =>
      getDetailedSubgroupAgeSeries(table, si, yi, detailedSubgroupIndex);
  }

  if (level.kind === "external_cause") {
    const externalCauseTypeIndex = indexOf(
      dimensions.external_cause_types,
      level.externalCauseType,
    );
    const table = await fetchDeathsByExternalCauseAgeForLocation(location);
    return (si, yi) =>
      getExternalCauseAgeSeries(table, si, yi, externalCauseTypeIndex);
  }

  const assaultMeansIndex = indexOf(
    dimensions.assault_means,
    level.assaultMeans,
  );
  const table = await fetchDeathsByAssaultMeansAgeForLocation(location);
  return (si, yi) => getAssaultMeansAgeSeries(table, si, yi, assaultMeansIndex);
}
