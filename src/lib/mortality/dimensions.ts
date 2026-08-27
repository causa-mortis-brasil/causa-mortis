import type { Dimensions } from "./types";

const DIMENSIONS_URL = "/data/mortality/dimensions.json";

let dimensionsPromise: Promise<Dimensions> | null = null;

export function fetchDimensions(): Promise<Dimensions> {
  dimensionsPromise ??= fetch(DIMENSIONS_URL).then(
    (response) => response.json() as Promise<Dimensions>,
  );
  return dimensionsPromise;
}

export function indexOf(
  values: readonly (string | number)[],
  value: string | number,
): number {
  const index = values.indexOf(value);
  if (index === -1) {
    throw new Error(`Valor "${value}" não encontrado nas dimensões.`);
  }
  return index;
}

export function causeGroupsForDetail(
  dimensions: Dimensions,
  causeGroupIndex: number,
): number[] {
  return (
    dimensions.detailed_subgroups_by_cause_group[String(causeGroupIndex)] ?? []
  );
}
