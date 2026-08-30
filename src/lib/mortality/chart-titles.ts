import type { CauseFilter, Dimensions, Filters, Sex } from "./types";

export function causePathLabel(filters: CauseFilter): string {
  const parts = [
    filters.causeGroup,
    filters.detailedSubgroup ?? filters.externalCauseType,
    filters.assaultMeans,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" – ") : "Todas as causas";
}

export function sexLabel(sex: Sex): string {
  if (sex === "Homens") return "Homens";
  if (sex === "Mulheres") return "Mulheres";
  return "Homens e Mulheres";
}

export function yearLabel(year: number, dimensions: Dimensions): string {
  const maxYear = Math.max(...dimensions.years);
  return year === maxYear ? `${year} (preliminar)` : String(year);
}

export function locationLabel(
  dimensions: Dimensions,
  location: string,
): string {
  return dimensions.location_names[location] ?? location;
}

export function mapChartTitle(
  filters: Filters,
  dimensions: Dimensions,
): string {
  return `Onde se morre mais por ${causePathLabel(filters)} · ${yearLabel(filters.year, dimensions)} · ${sexLabel(filters.sex)}`;
}

export function evolutionChartTitle(
  filters: Filters,
  dimensions: Dimensions,
): string {
  return `Histórico de óbitos por ${causePathLabel(filters)} · ${sexLabel(filters.sex)} · ${locationLabel(dimensions, filters.location)}`;
}

export function causesChartTitle(
  filters: Filters,
  dimensions: Dimensions,
): string {
  return `Composição dos óbitos por ${causePathLabel(filters)} · ${yearLabel(filters.year, dimensions)} · ${sexLabel(filters.sex)} · ${locationLabel(dimensions, filters.location)}`;
}

export function ageCompositionChartTitle(
  filters: Filters,
  dimensions: Dimensions,
): string {
  return `Composição dos óbitos por faixa etária · ${yearLabel(filters.year, dimensions)} · ${sexLabel(filters.sex)} · ${locationLabel(dimensions, filters.location)}`;
}

export function pyramidChartTitle(
  filters: Filters,
  dimensions: Dimensions,
): string {
  return `Pirâmide de mortalidade por ${causePathLabel(filters)} · ${yearLabel(filters.year, dimensions)} · ${locationLabel(dimensions, filters.location)}`;
}
