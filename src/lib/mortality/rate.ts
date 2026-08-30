export function crudeRate(deaths: number, population: number): number {
  return population > 0 ? (deaths / population) * 100000 : 0;
}
