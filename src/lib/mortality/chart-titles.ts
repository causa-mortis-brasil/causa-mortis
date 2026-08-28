import type { CauseFilter, Dimensions, Sex } from "./types";

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
