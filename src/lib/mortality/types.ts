export interface Dimensions {
  locations: string[];
  location_names: Record<string, string>;
  sexes: string[];
  cause_groups: string[];
  age_groups: string[];
  years: number[];
  external_cause_types: string[];
  assault_means: string[];
  detailed_subgroups: string[];
  detailed_subgroups_by_cause_group: Record<string, number[]>;
  standard_population_weights: number[];
}

export type OverallEntry = [
  deaths: number,
  crudeRate: number,
  stdRate: number,
  population: number,
];
export type CauseGroupEntry = [deaths: number, stdRate: number];
export type CauseRateEntry = [
  deaths: number,
  crudeRate: number,
  stdRate: number,
];
export type AgeSeries = (number | null)[];
export type CoverageTable = (number | null)[][];

export type OverallTable = (OverallEntry | null)[][][];
export type DeathsByCauseGroupTable = ((CauseGroupEntry | null)[] | null)[][][];
export type DeathsByExternalCauseTable = (
  (CauseRateEntry | null)[] | null
)[][][];
export type DeathsByAssaultMeansTable = (
  (CauseRateEntry | null)[] | null
)[][][];
export type DeathsByDetailedSubgroupTable = (
  (CauseRateEntry | null)[] | null
)[][][];

export type DeathsByAgeTable = (AgeSeries | null)[][][];
export type PopulationByAgeTable = (AgeSeries | null)[][][];
export type DeathsByCauseGroupAgeTable = ((AgeSeries | null)[] | null)[][][];
export type DeathsByExternalCauseAgeTable = ((AgeSeries | null)[] | null)[][][];
export type DeathsByAssaultMeansAgeTable = ((AgeSeries | null)[] | null)[][][];
export type DeathsByDetailedSubgroupAgeTable = (
  (AgeSeries | null)[] | null
)[][][];

export interface MortalityIndexed {
  dimensions: Dimensions;
  overall: OverallTable;
  deaths_by_cause_group: DeathsByCauseGroupTable;
  population_by_age: PopulationByAgeTable;
  deaths_by_age: DeathsByAgeTable;
  deaths_by_cause_group_age: DeathsByCauseGroupAgeTable;
  deaths_by_external_cause: DeathsByExternalCauseTable;
  deaths_by_external_cause_age: DeathsByExternalCauseAgeTable;
  deaths_by_assault_means: DeathsByAssaultMeansTable;
  deaths_by_assault_means_age: DeathsByAssaultMeansAgeTable;
  deaths_by_detailed_subgroup: DeathsByDetailedSubgroupTable;
  deaths_by_detailed_subgroup_age: DeathsByDetailedSubgroupAgeTable;
  coverage: CoverageTable;
}

export type Sex = "Ambos" | "Homens" | "Mulheres";

export interface CauseFilter {
  causeGroup: string | null;
  detailedSubgroup: string | null;
  externalCauseType: string | null;
  assaultMeans: string | null;
}

export interface Filters extends CauseFilter {
  location: string;
  sex: Sex;
  year: number;
}
