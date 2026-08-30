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
  if (sex === "Homens") return "Sexo masculino";
  if (sex === "Mulheres") return "Sexo feminino";
  return "Ambos os sexos";
}

export function locationLabel(
  dimensions: Dimensions,
  location: string,
): string {
  return dimensions.location_names[location] ?? location;
}

export function mapChartTitle(filters: Filters): string {
  return `Onde se morre mais por ${causePathLabel(filters)} · ano ${filters.year} · sexo ${filters.sex}`;
}

export function evolutionChartTitle(
  filters: Filters,
  dimensions: Dimensions,
): string {
  return `Histórico de óbitos por ${causePathLabel(filters)} · sexo ${filters.sex} · ${locationLabel(dimensions, filters.location)}`;
}

export function causesChartTitle(
  filters: Filters,
  dimensions: Dimensions,
): string {
  return `Composição dos óbitos por ${causePathLabel(filters)} · ano ${filters.year} · sexo ${filters.sex} · ${locationLabel(dimensions, filters.location)}`;
}

export function ageCompositionChartTitle(
  filters: Filters,
  dimensions: Dimensions,
): string {
  return `Composição dos óbitos por faixa etária · ano ${filters.year} · sexo ${filters.sex} · ${locationLabel(dimensions, filters.location)}`;
}

export function pyramidChartTitle(
  filters: Filters,
  dimensions: Dimensions,
): string {
  return `Pirâmide de mortalidade por ${causePathLabel(filters)} · ano ${filters.year} · ${locationLabel(dimensions, filters.location)}`;
}
