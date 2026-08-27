import type { FeatureCollection } from "geojson";
import type {
  OverallTable,
  DeathsByCauseGroupTable,
  DeathsByCauseGroupAgeTable,
  DeathsByExternalCauseTable,
  DeathsByExternalCauseAgeTable,
  DeathsByAssaultMeansTable,
  DeathsByAssaultMeansAgeTable,
  DeathsByDetailedSubgroupTable,
  DeathsByDetailedSubgroupAgeTable,
  DeathsByAgeTable,
  PopulationByAgeTable,
} from "./types";

const BASE_URL = "/data/mortality";

const tableCache = new Map<string, Promise<unknown>>();

function fetchTable<T>(name: string): Promise<T> {
  let cached = tableCache.get(name) as Promise<T> | undefined;
  if (!cached) {
    cached = fetch(`${BASE_URL}/${name}.json`).then(
      (response) => response.json() as Promise<T>,
    );
    tableCache.set(name, cached);
  }
  return cached;
}

export const fetchOverall = (): Promise<OverallTable> => fetchTable("overall");
export const fetchDeathsByCauseGroup = (): Promise<DeathsByCauseGroupTable> =>
  fetchTable("deaths_by_cause_group");
export const fetchDeathsByCauseGroupAge =
  (): Promise<DeathsByCauseGroupAgeTable> =>
    fetchTable("deaths_by_cause_group_age");
export const fetchDeathsByExternalCause =
  (): Promise<DeathsByExternalCauseTable> =>
    fetchTable("deaths_by_external_cause");
export const fetchDeathsByExternalCauseAge =
  (): Promise<DeathsByExternalCauseAgeTable> =>
    fetchTable("deaths_by_external_cause_age");
export const fetchDeathsByAssaultMeans =
  (): Promise<DeathsByAssaultMeansTable> =>
    fetchTable("deaths_by_assault_means");
export const fetchDeathsByAssaultMeansAge =
  (): Promise<DeathsByAssaultMeansAgeTable> =>
    fetchTable("deaths_by_assault_means_age");
export const fetchDeathsByDetailedSubgroup =
  (): Promise<DeathsByDetailedSubgroupTable> =>
    fetchTable("deaths_by_detailed_subgroup");
export const fetchDeathsByDetailedSubgroupAge =
  (): Promise<DeathsByDetailedSubgroupAgeTable> =>
    fetchTable("deaths_by_detailed_subgroup_age");
export const fetchDeathsByAge = (): Promise<DeathsByAgeTable> =>
  fetchTable("deaths_by_age");
export const fetchPopulationByAge = (): Promise<PopulationByAgeTable> =>
  fetchTable("population_by_age");

let geoJsonPromise: Promise<FeatureCollection> | null = null;

export function fetchBrazilStatesGeoJson(): Promise<FeatureCollection> {
  geoJsonPromise ??= fetch("/data/geo/br-states.geojson").then(
    (response) => response.json() as Promise<FeatureCollection>,
  );
  return geoJsonPromise;
}
