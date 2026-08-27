import type { AgeSeries } from "./types";

export function crudeRate(deaths: number, population: number): number {
  return population > 0 ? (deaths / population) * 100000 : 0;
}

export function standardizedContributionByAge(
  deathsByAge: AgeSeries,
  populationByAge: AgeSeries,
  weights: readonly number[],
): number[] {
  return weights.map((weight, i) => {
    const deaths = deathsByAge[i];
    const population = populationByAge[i];
    if (deaths == null || population == null || population === 0) return 0;
    return (deaths / population) * weight;
  });
}
