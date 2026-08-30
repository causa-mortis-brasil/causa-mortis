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

// Tabelas "LocationTable" trazem só sexo × ano (um território), como servidas
// por /data/mortality/by-location/. As tabelas completas ("Table") continuam
// indexadas por território × sexo × ano e são um array dessas fatias — usadas
// só onde todos os territórios precisam ser lidos de uma vez (mapa).

export type OverallLocationTable = (OverallEntry | null)[][];
export type OverallTable = OverallLocationTable[];

export type DeathsByCauseGroupLocationTable = (
  (CauseGroupEntry | null)[] | null
)[][];
export type DeathsByCauseGroupTable = DeathsByCauseGroupLocationTable[];

export type DeathsByExternalCauseLocationTable = (
  (CauseRateEntry | null)[] | null
)[][];
export type DeathsByExternalCauseTable = DeathsByExternalCauseLocationTable[];

export type DeathsByAssaultMeansLocationTable = (
  (CauseRateEntry | null)[] | null
)[][];
export type DeathsByAssaultMeansTable = DeathsByAssaultMeansLocationTable[];

export type DeathsByDetailedSubgroupLocationTable = (
  (CauseRateEntry | null)[] | null
)[][];
export type DeathsByDetailedSubgroupTable =
  DeathsByDetailedSubgroupLocationTable[];

export type DeathsByAgeLocationTable = (AgeSeries | null)[][];
export type DeathsByAgeTable = DeathsByAgeLocationTable[];

export type PopulationByAgeLocationTable = (AgeSeries | null)[][];
export type PopulationByAgeTable = PopulationByAgeLocationTable[];

export type DeathsByCauseGroupAgeLocationTable = (
  (AgeSeries | null)[] | null
)[][];
export type DeathsByCauseGroupAgeTable = DeathsByCauseGroupAgeLocationTable[];

export type DeathsByExternalCauseAgeLocationTable = (
  (AgeSeries | null)[] | null
)[][];
export type DeathsByExternalCauseAgeTable =
  DeathsByExternalCauseAgeLocationTable[];

export type DeathsByAssaultMeansAgeLocationTable = (
  (AgeSeries | null)[] | null
)[][];
export type DeathsByAssaultMeansAgeTable =
  DeathsByAssaultMeansAgeLocationTable[];

export type DeathsByDetailedSubgroupAgeLocationTable = (
  (AgeSeries | null)[] | null
)[][];
export type DeathsByDetailedSubgroupAgeTable =
  DeathsByDetailedSubgroupAgeLocationTable[];

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
export type PyramidMeasure = "deaths" | "rate";

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
  pyramidMeasure: PyramidMeasure;
}
