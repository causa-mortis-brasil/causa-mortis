import type { FiltersStore } from "./filters";
import type { Dimensions, Filters, PyramidMeasure, Sex } from "./types";

const SEX_VALUES: Sex[] = ["Ambos", "Homens", "Mulheres"];
const PYRAMID_MEASURE_VALUES: PyramidMeasure[] = ["deaths", "rate"];

export interface SharedState {
  filters: Filters;
  tab: string | null;
}

export function parseSharedState(
  search: string,
  dimensions: Dimensions,
  maxYear: number,
): SharedState {
  const params = new URLSearchParams(search);

  const location = params.get("loc");
  const sex = params.get("sex");
  const year = Number(params.get("year"));
  const causeGroup = params.get("cause");
  const detailedSubgroup = params.get("detail");
  const externalCauseType = params.get("ext");
  const assaultMeans = params.get("assault");
  const measure = params.get("measure");

  const filters: Filters = {
    location:
      location && dimensions.locations.includes(location) ? location : "BR",
    sex: sex && SEX_VALUES.includes(sex as Sex) ? (sex as Sex) : "Ambos",
    year: dimensions.years.includes(year) ? year : maxYear,
    causeGroup:
      causeGroup && dimensions.cause_groups.includes(causeGroup)
        ? causeGroup
        : null,
    detailedSubgroup:
      detailedSubgroup &&
      dimensions.detailed_subgroups.includes(detailedSubgroup)
        ? detailedSubgroup
        : null,
    externalCauseType:
      externalCauseType &&
      dimensions.external_cause_types.includes(externalCauseType)
        ? externalCauseType
        : null,
    assaultMeans:
      assaultMeans && dimensions.assault_means.includes(assaultMeans)
        ? assaultMeans
        : null,
    pyramidMeasure:
      measure && PYRAMID_MEASURE_VALUES.includes(measure as PyramidMeasure)
        ? (measure as PyramidMeasure)
        : "rate",
  };

  return { filters, tab: params.get("tab") };
}

export function buildShareUrl(filters: Filters, chartName: string): string {
  const params = new URLSearchParams();
  params.set("tab", chartName);
  params.set("loc", filters.location);
  params.set("sex", filters.sex);
  params.set("year", String(filters.year));
  if (filters.causeGroup) params.set("cause", filters.causeGroup);
  if (filters.detailedSubgroup) params.set("detail", filters.detailedSubgroup);
  if (filters.externalCauseType) params.set("ext", filters.externalCauseType);
  if (filters.assaultMeans) params.set("assault", filters.assaultMeans);
  if (chartName === "pyramid") params.set("measure", filters.pyramidMeasure);

  const url = new URL(window.location.href);
  url.search = params.toString();
  return url.toString();
}

export function setupChartShare(card: ParentNode, store: FiltersStore): void {
  if (!(card instanceof HTMLElement)) return;
  const button = card.querySelector<HTMLButtonElement>("[data-chart-share]");
  const chartName = card.dataset.chartPanel;
  if (!button || !chartName) return;

  const label = button.querySelector("[data-chart-share-label]");
  const defaultLabel = label?.textContent ?? "";
  const defaultIcon = button.querySelector("[data-chart-share-icon-default]");
  const successIcon = button.querySelector("[data-chart-share-icon-success]");
  let resetTimeout: ReturnType<typeof setTimeout> | undefined;

  button.addEventListener("click", () => {
    const url = buildShareUrl(store.get(), chartName);

    void navigator.clipboard
      .writeText(url)
      .then(() => {
        clearTimeout(resetTimeout);
        if (label) label.textContent = "Link copiado!";
        defaultIcon?.toggleAttribute("hidden", true);
        successIcon?.toggleAttribute("hidden", false);
        resetTimeout = setTimeout(() => {
          if (label) label.textContent = defaultLabel;
          defaultIcon?.toggleAttribute("hidden", false);
          successIcon?.toggleAttribute("hidden", true);
        }, 2000);
      })
      .catch((error: unknown) => {
        console.error("Falha ao copiar o link de compartilhamento.", error);
      });
  });
}
