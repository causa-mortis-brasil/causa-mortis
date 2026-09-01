import type { CauseFilter, Dimensions, Filters, Sex } from "./types";

export interface ChartTitle {
  line1: string;
  line2: string;
}

export function setChartTitle(
  titleEl: Element | null,
  title: ChartTitle,
): void {
  if (!titleEl) return;
  const line1El = titleEl.querySelector("[data-chart-title-line1]");
  const line2El = titleEl.querySelector("[data-chart-title-line2]");
  if (line1El) line1El.textContent = title.line1;
  if (line2El) line2El.textContent = title.line2;
}

function hasLocation(filters: Filters): boolean {
  return filters.location !== "BR";
}

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
): ChartTitle {
  return {
    line1: `Mortes por UF - ${causePathLabel(filters)} · ${yearLabel(filters.year, dimensions)}`,
    line2: sexLabel(filters.sex),
  };
}

export function evolutionChartTitle(
  filters: Filters,
  dimensions: Dimensions,
): ChartTitle {
  return {
    line1: `Histórico de óbitos - ${causePathLabel(filters)}`,
    line2: hasLocation(filters)
      ? `${sexLabel(filters.sex)} · ${locationLabel(dimensions, filters.location)}`
      : sexLabel(filters.sex),
  };
}

export function causesChartTitle(
  filters: Filters,
  dimensions: Dimensions,
): ChartTitle {
  return {
    line1: `Composição dos óbitos - ${causePathLabel(filters)} · ${yearLabel(filters.year, dimensions)}`,
    line2: hasLocation(filters)
      ? `${sexLabel(filters.sex)} · ${locationLabel(dimensions, filters.location)}`
      : sexLabel(filters.sex),
  };
}

export function statsChartTitle(
  filters: Filters,
  dimensions: Dimensions,
): string {
  return `Resumo · ${yearLabel(filters.year, dimensions)}`;
}

export function ageCompositionChartTitle(
  filters: Filters,
  dimensions: Dimensions,
): ChartTitle {
  return {
    line1: `Composição dos óbitos por faixa etária · ${yearLabel(filters.year, dimensions)}`,
    line2: hasLocation(filters)
      ? `${sexLabel(filters.sex)} · ${locationLabel(dimensions, filters.location)}`
      : sexLabel(filters.sex),
  };
}

export function qualityChartTitle(filters: Filters): ChartTitle {
  return {
    line1: `Cobertura do SIM por UF · ${filters.year}`,
    line2: "",
  };
}

export function pyramidChartTitle(
  filters: Filters,
  dimensions: Dimensions,
): ChartTitle {
  return {
    line1: `Pirâmide de mortalidade - ${causePathLabel(filters)} · ${yearLabel(filters.year, dimensions)}`,
    line2: hasLocation(filters)
      ? locationLabel(dimensions, filters.location)
      : "",
  };
}
