import { getCoverage } from "./access";
import { loadLocationRatePointGetter, resolveCauseLevel } from "./cause-level";
import { subscribeWhenVisible } from "./chart-visibility";
import { statsChartTitle } from "./chart-titles";
import { fetchCoverage } from "./data";
import { indexOf } from "./dimensions";
import type { FiltersStore } from "./filters";
import { formatInteger, formatRate, formatSignedPercent } from "./format";
import type { Dimensions } from "./types";

function textEl(root: ParentNode, id: string): HTMLElement | null {
  return root.querySelector(`#${id}`);
}

function renderRate(
  valueEl: HTMLElement | null,
  deltaEl: HTMLElement | null,
  rate: number,
  previousRate: number | null,
): void {
  if (valueEl) valueEl.textContent = `${formatRate(rate)} por 100 mil hab.`;
  if (!deltaEl) return;
  if (previousRate == null || previousRate === 0) {
    deltaEl.textContent = "sem comparação";
    return;
  }
  const change = (rate - previousRate) / previousRate;
  deltaEl.textContent = `(${formatSignedPercent(change)} no ano)`;
}

export function initSummaryStats(
  root: ParentNode,
  store: FiltersStore,
  dimensions: Dimensions,
): void {
  const deathsValue = textEl(root, "stat-deaths-value");
  const stdRateValue = textEl(root, "stat-std-rate-value");
  const stdRateDelta = textEl(root, "stat-std-rate-delta");
  const crudeRateValue = textEl(root, "stat-crude-rate-value");
  const crudeRateDelta = textEl(root, "stat-crude-rate-delta");
  const coverageValue = textEl(root, "stat-coverage-value");
  const coverageSubtitle = textEl(root, "stat-coverage-subtitle");
  const panel = root.querySelector("#panel-stats") ?? root;
  const titleEl = panel.querySelector("[data-chart-title]");

  let renderToken = 0;

  async function render(): Promise<void> {
    const token = ++renderToken;
    const filters = store.get();
    const level = resolveCauseLevel(filters);
    const [pointGetter, coverageTable] = await Promise.all([
      loadLocationRatePointGetter(level, dimensions, filters.location),
      fetchCoverage(),
    ]);
    if (token !== renderToken) return;

    const locationIndex = indexOf(dimensions.locations, filters.location);
    const sexIndex = indexOf(dimensions.sexes, filters.sex);
    const yearIndex = indexOf(dimensions.years, filters.year);
    const previousYearIndex = yearIndex - 1;

    const point = pointGetter(sexIndex, yearIndex);
    const previousPoint =
      previousYearIndex >= 0 ? pointGetter(sexIndex, previousYearIndex) : null;

    if (titleEl) titleEl.textContent = statsChartTitle(filters, dimensions);
    if (deathsValue) deathsValue.textContent = formatInteger(point.deaths);
    renderRate(
      stdRateValue,
      stdRateDelta,
      point.stdRate,
      previousPoint?.stdRate ?? null,
    );
    renderRate(
      crudeRateValue,
      crudeRateDelta,
      point.crudeRate,
      previousPoint?.crudeRate ?? null,
    );

    const coverage = getCoverage(coverageTable, locationIndex, yearIndex);
    if (coverageValue && coverageSubtitle) {
      if (coverage == null) {
        coverageValue.textContent = "—";
        coverageSubtitle.textContent = "sem dado publicado";
      } else {
        coverageValue.textContent = `${formatRate(coverage)}%`;
        coverageSubtitle.textContent = "óbitos captados";
      }
    }
  }

  subscribeWhenVisible(panel, store, render);
}
