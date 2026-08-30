import { loadDeathsByAgeGetter, resolveCauseLevel } from "../cause-level";
import { getAgeSeries } from "../access";
import { causePathLabel, locationLabel } from "../chart-titles";
import {
  buildFilenameBase,
  buildFilterContext,
  roundTo,
  setupChartExport,
  type ChartExportRows,
} from "../chart-export";
import { fetchPopulationByAgeForLocation } from "../data";
import { indexOf } from "../dimensions";
import type { EChartsCoreOption } from "../echarts-core";
import { echarts } from "../echarts-core";
import { formatCompact, formatInteger, formatRate } from "../format";
import { themeColor } from "../palette";
import { standardizedContributionByAge } from "../rate";
import type { FiltersStore } from "../filters";
import type { Dimensions } from "../types";

type Measure = "deaths" | "rate" | "contribution";

const MEN_COLOR = "#1e3a8a";
const WOMEN_COLOR = "#fca5a5";
const DEATHS_AXIS_MAX = 300000;
const DEATHS_AXIS_INTERVAL = 100000;
const RATE_AXIS_MAX = 15000;
const RATE_AXIS_INTERVAL = 5000;

function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const base = 10 ** exponent;
  const fraction = value / base;
  const niceFraction =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return niceFraction * base;
}

export function init(
  container: HTMLElement,
  store: FiltersStore,
  dimensions: Dimensions,
): void {
  const chart = echarts.init(container);
  new ResizeObserver(() => chart.resize()).observe(container);

  const card = container.closest(".chart-card") ?? document;
  const context = card.querySelector("[data-chart-context]");
  const measureSelect = card.querySelector("#pyramid-measure");
  let measure: Measure = "rate";

  if (measureSelect instanceof HTMLSelectElement) {
    measure = measureSelect.value as Measure;
    measureSelect.addEventListener("change", () => {
      measure = measureSelect.value as Measure;
      void render();
    });
  }

  let renderToken = 0;
  let exportRows: ChartExportRows = { headers: [], rows: [] };
  const totalWeight = dimensions.standard_population_weights.reduce(
    (sum, w) => sum + w,
    0,
  );

  async function render(): Promise<void> {
    const token = ++renderToken;
    const filters = store.get();
    const level = resolveCauseLevel(filters);

    const [deathsByAgeGetter, populationTable] = await Promise.all([
      loadDeathsByAgeGetter(level, dimensions, filters.location),
      fetchPopulationByAgeForLocation(filters.location),
    ]);
    if (token !== renderToken) return;

    if (context) {
      context.textContent = `${causePathLabel(filters)} · ${filters.year} · ${locationLabel(dimensions, filters.location)}`;
    }

    const yearIndex = indexOf(dimensions.years, filters.year);
    const menIndex = indexOf(dimensions.sexes, "Homens");
    const womenIndex = indexOf(dimensions.sexes, "Mulheres");

    const menDeaths =
      deathsByAgeGetter(menIndex, yearIndex) ??
      dimensions.age_groups.map(() => 0);
    const womenDeaths =
      deathsByAgeGetter(womenIndex, yearIndex) ??
      dimensions.age_groups.map(() => 0);
    const menPopulation =
      getAgeSeries(populationTable, menIndex, yearIndex) ??
      dimensions.age_groups.map(() => 0);
    const womenPopulation =
      getAgeSeries(populationTable, womenIndex, yearIndex) ??
      dimensions.age_groups.map(() => 0);

    const menRate = dimensions.age_groups.map((_, i) =>
      rateAt(menDeaths[i], menPopulation[i]),
    );
    const womenRate = dimensions.age_groups.map((_, i) =>
      rateAt(womenDeaths[i], womenPopulation[i]),
    );

    const menContribution = standardizedContributionByAge(
      menDeaths,
      menPopulation,
      dimensions.standard_population_weights,
    ).map((v) => (totalWeight > 0 ? (v / totalWeight) * 100000 : 0));
    const womenContribution = standardizedContributionByAge(
      womenDeaths,
      womenPopulation,
      dimensions.standard_population_weights,
    ).map((v) => (totalWeight > 0 ? (v / totalWeight) * 100000 : 0));

    const menValues =
      measure === "deaths"
        ? menDeaths.map((v) => v ?? 0)
        : measure === "rate"
          ? menRate
          : menContribution;
    const womenValues =
      measure === "deaths"
        ? womenDeaths.map((v) => v ?? 0)
        : measure === "rate"
          ? womenRate
          : womenContribution;

    const maxAbs =
      measure === "deaths"
        ? DEATHS_AXIS_MAX
        : measure === "rate"
          ? RATE_AXIS_MAX
          : niceCeil(Math.max(...menValues, ...womenValues, 1));
    const axisInterval =
      measure === "deaths"
        ? DEATHS_AXIS_INTERVAL
        : measure === "rate"
          ? RATE_AXIS_INTERVAL
          : undefined;
    const fullValueFormatter =
      measure === "deaths" ? formatInteger : formatRate;

    const option: EChartsCoreOption = {
      grid: [
        { left: 16, right: "53%", top: 40, bottom: 32 },
        { left: "53%", right: 64, top: 40, bottom: 32 },
        { left: 0, right: 0, top: 40, bottom: 32 },
      ],
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        valueFormatter: (value: number | string) =>
          fullValueFormatter(Math.abs(Number(value))),
      },
      legend: [
        {
          data: ["Homens"],
          left: 16,
          top: 0,
          itemWidth: 12,
          itemHeight: 12,
          textStyle: { fontWeight: 600 },
        },
        {
          data: ["Mulheres"],
          right: 16,
          top: 0,
          itemWidth: 12,
          itemHeight: 12,
          textStyle: { fontWeight: 600 },
        },
      ],
      xAxis: [
        {
          gridIndex: 0,
          type: "value",
          min: 0,
          max: maxAbs,
          interval: axisInterval,
          inverse: true,
          axisLabel: { formatter: (value: number) => formatCompact(value) },
        },
        {
          gridIndex: 1,
          type: "value",
          min: 0,
          max: maxAbs,
          interval: axisInterval,
          axisLabel: { formatter: (value: number) => formatCompact(value) },
        },
        {
          gridIndex: 2,
          type: "value",
          min: -1,
          max: 1,
          show: false,
        },
      ],
      yAxis: [
        {
          gridIndex: 0,
          type: "category",
          data: dimensions.age_groups,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { show: false },
        },
        {
          gridIndex: 1,
          type: "category",
          data: dimensions.age_groups,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { show: false },
        },
        {
          gridIndex: 2,
          type: "category",
          data: dimensions.age_groups,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { show: false },
        },
      ],
      series: [
        {
          name: "Homens",
          type: "bar",
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: menValues,
          color: MEN_COLOR,
        },
        {
          name: "Mulheres",
          type: "bar",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: womenValues,
          color: WOMEN_COLOR,
        },
        {
          name: "Faixa etária",
          type: "scatter",
          xAxisIndex: 2,
          yAxisIndex: 2,
          data: dimensions.age_groups.map(() => 0),
          symbolSize: 0,
          silent: true,
          tooltip: { show: false },
          label: {
            show: true,
            position: "inside",
            formatter: (params: { dataIndex: number }) =>
              dimensions.age_groups[params.dataIndex],
            color: themeColor("--color-gray-700"),
            fontSize: 11,
            fontWeight: 600,
            backgroundColor: "#fff",
            padding: [2, 6],
            borderRadius: 4,
          },
        },
      ],
    };

    chart.setOption(option, { notMerge: true });

    const measureLabel =
      measure === "deaths"
        ? "Óbitos"
        : measure === "rate"
          ? "Taxa por faixa (por 100 mil hab.)"
          : "Contribuição para taxa padronizada (por 100 mil hab.)";
    exportRows = {
      headers: [
        "Faixa etária",
        `Homens - ${measureLabel}`,
        `Mulheres - ${measureLabel}`,
      ],
      rows: dimensions.age_groups.map((ageGroup, i) => [
        ageGroup,
        measure === "deaths"
          ? Math.round(menValues[i] ?? 0)
          : roundTo(menValues[i] ?? 0, 1),
        measure === "deaths"
          ? Math.round(womenValues[i] ?? 0)
          : roundTo(womenValues[i] ?? 0, 1),
      ]),
    };
  }

  setupChartExport(card, chart, {
    getFilenameBase: () => buildFilenameBase("piramide", store.get()),
    getContext: () => buildFilterContext(dimensions, store.get()),
    getRows: () => exportRows,
  });

  store.subscribe(() => void render());
}

function rateAt(
  deaths: number | null | undefined,
  population: number | null | undefined,
): number {
  if (!deaths || !population) return 0;
  return (deaths / population) * 100000;
}
