import type { FeatureCollection } from "geojson";
import manifest from "./data-manifest.json";
import type {
  OverallTable,
  OverallLocationTable,
  DeathsByCauseGroupTable,
  DeathsByCauseGroupLocationTable,
  DeathsByCauseGroupAgeLocationTable,
  DeathsByExternalCauseTable,
  DeathsByExternalCauseLocationTable,
  DeathsByExternalCauseAgeLocationTable,
  DeathsByAssaultMeansTable,
  DeathsByAssaultMeansLocationTable,
  DeathsByAssaultMeansAgeLocationTable,
  DeathsByDetailedSubgroupTable,
  DeathsByDetailedSubgroupLocationTable,
  DeathsByDetailedSubgroupAgeLocationTable,
  DeathsByAgeLocationTable,
  PopulationByAgeLocationTable,
  CoverageTable,
} from "./types";

const BASE_URL = "/data/mortality";
const BY_LOCATION_URL = `${BASE_URL}/by-location/${manifest.mortalityVersion}`;

const cache = new Map<string, Promise<unknown>>();

function fetchJson<T>(url: string, cacheKey: string): Promise<T> {
  let cached = cache.get(cacheKey) as Promise<T> | undefined;
  if (!cached) {
    cached = fetch(url)
      .then((response) => response.json() as Promise<T>)
      .catch((error: unknown) => {
        cache.delete(cacheKey);
        throw error;
      });
    cache.set(cacheKey, cached);
  }
  return cached;
}

function fetchTable<T>(name: string): Promise<T> {
  return fetchJson(`${BASE_URL}/${name}.json`, name);
}

function fetchLocationTable<T>(name: string, location: string): Promise<T> {
  return fetchJson(
    `${BY_LOCATION_URL}/${name}/${location}.json`,
    `${name}:${location}`,
  );
}

export const fetchOverall = (): Promise<OverallTable> => fetchTable("overall");
export const fetchDeathsByCauseGroup = (): Promise<DeathsByCauseGroupTable> =>
  fetchTable("deaths_by_cause_group");
export const fetchDeathsByExternalCause =
  (): Promise<DeathsByExternalCauseTable> =>
    fetchTable("deaths_by_external_cause");
export const fetchDeathsByAssaultMeans =
  (): Promise<DeathsByAssaultMeansTable> =>
    fetchTable("deaths_by_assault_means");
export const fetchDeathsByDetailedSubgroup =
  (): Promise<DeathsByDetailedSubgroupTable> =>
    fetchTable("deaths_by_detailed_subgroup");
export const fetchCoverage = (): Promise<CoverageTable> =>
  fetchTable("coverage");

export const fetchOverallForLocation = (
  location: string,
): Promise<OverallLocationTable> => fetchLocationTable("overall", location);
export const fetchDeathsByCauseGroupForLocation = (
  location: string,
): Promise<DeathsByCauseGroupLocationTable> =>
  fetchLocationTable("deaths_by_cause_group", location);
export const fetchDeathsByCauseGroupAgeForLocation = (
  location: string,
): Promise<DeathsByCauseGroupAgeLocationTable> =>
  fetchLocationTable("deaths_by_cause_group_age", location);
export const fetchDeathsByExternalCauseForLocation = (
  location: string,
): Promise<DeathsByExternalCauseLocationTable> =>
  fetchLocationTable("deaths_by_external_cause", location);
export const fetchDeathsByExternalCauseAgeForLocation = (
  location: string,
): Promise<DeathsByExternalCauseAgeLocationTable> =>
  fetchLocationTable("deaths_by_external_cause_age", location);
export const fetchDeathsByAssaultMeansForLocation = (
  location: string,
): Promise<DeathsByAssaultMeansLocationTable> =>
  fetchLocationTable("deaths_by_assault_means", location);
export const fetchDeathsByAssaultMeansAgeForLocation = (
  location: string,
): Promise<DeathsByAssaultMeansAgeLocationTable> =>
  fetchLocationTable("deaths_by_assault_means_age", location);
export const fetchDeathsByDetailedSubgroupForLocation = (
  location: string,
): Promise<DeathsByDetailedSubgroupLocationTable> =>
  fetchLocationTable("deaths_by_detailed_subgroup", location);
export const fetchDeathsByDetailedSubgroupAgeForLocation = (
  location: string,
): Promise<DeathsByDetailedSubgroupAgeLocationTable> =>
  fetchLocationTable("deaths_by_detailed_subgroup_age", location);
export const fetchDeathsByAgeForLocation = (
  location: string,
): Promise<DeathsByAgeLocationTable> =>
  fetchLocationTable("deaths_by_age", location);
export const fetchPopulationByAgeForLocation = (
  location: string,
): Promise<PopulationByAgeLocationTable> =>
  fetchLocationTable("population_by_age", location);

let geoJsonPromise: Promise<FeatureCollection> | null = null;

export function fetchBrazilStatesGeoJson(): Promise<FeatureCollection> {
  geoJsonPromise ??= fetch(`/data/geo/${manifest.geoFile}`)
    .then((response) => response.json() as Promise<FeatureCollection>)
    .catch((error: unknown) => {
      geoJsonPromise = null;
      throw error;
    });
  return geoJsonPromise;
}
