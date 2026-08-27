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
  fetchDeathsByAge,
  fetchDeathsByAssaultMeans,
  fetchDeathsByAssaultMeansAge,
  fetchDeathsByCauseGroup,
  fetchDeathsByCauseGroupAge,
  fetchDeathsByDetailedSubgroup,
  fetchDeathsByDetailedSubgroupAge,
  fetchDeathsByExternalCause,
  fetchDeathsByExternalCauseAge,
  fetchOverall,
} from "./data";
import { indexOf } from "./dimensions";
import { crudeRate } from "./rate";
import type { AgeSeries, CauseFilter, Dimensions } from "./types";

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
      const entry = getOverall(table, li, si, yi);
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
        causeGroupTable,
        li,
        si,
        yi,
        causeGroupIndex,
      );
      const population = getOverall(overallTable, li, si, yi)?.[3] ?? 0;
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
        table,
        li,
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
        table,
        li,
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
      table,
      li,
      si,
      yi,
      assaultMeansIndex,
    );
    return { deaths, crudeRate: crude, stdRate };
  };
}

export type AgeSeriesGetter = (
  locationIndex: number,
  sexIndex: number,
  yearIndex: number,
) => AgeSeries | null;

export async function loadDeathsByAgeGetter(
  level: CauseLevel,
  dimensions: Dimensions,
): Promise<AgeSeriesGetter> {
  if (level.kind === "overall") {
    const table = await fetchDeathsByAge();
    return (li, si, yi) => getAgeSeries(table, li, si, yi);
  }

  if (level.kind === "cause_group") {
    const causeGroupIndex = indexOf(dimensions.cause_groups, level.causeGroup);
    const table = await fetchDeathsByCauseGroupAge();
    return (li, si, yi) =>
      getCauseGroupAgeSeries(table, li, si, yi, causeGroupIndex);
  }

  if (level.kind === "detailed_subgroup") {
    const detailedSubgroupIndex = indexOf(
      dimensions.detailed_subgroups,
      level.detailedSubgroup,
    );
    const table = await fetchDeathsByDetailedSubgroupAge();
    return (li, si, yi) =>
      getDetailedSubgroupAgeSeries(table, li, si, yi, detailedSubgroupIndex);
  }

  if (level.kind === "external_cause") {
    const externalCauseTypeIndex = indexOf(
      dimensions.external_cause_types,
      level.externalCauseType,
    );
    const table = await fetchDeathsByExternalCauseAge();
    return (li, si, yi) =>
      getExternalCauseAgeSeries(table, li, si, yi, externalCauseTypeIndex);
  }

  const assaultMeansIndex = indexOf(
    dimensions.assault_means,
    level.assaultMeans,
  );
  const table = await fetchDeathsByAssaultMeansAge();
  return (li, si, yi) =>
    getAssaultMeansAgeSeries(table, li, si, yi, assaultMeansIndex);
}
