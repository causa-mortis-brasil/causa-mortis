import { loadDeathsByAgeGetter, resolveCauseLevel } from "../cause-level";
import { getAgeSeries } from "../access";
import { pyramidChartTitle } from "../chart-titles";
import {
  buildFilenameBase,
  roundTo,
  setupChartExport,
  type ChartExportRows,
} from "../chart-export";
import { setupChartFullscreen } from "../chart-fullscreen";
import { subscribeWhenVisible } from "../chart-visibility";
import { fetchPopulationByAgeForLocation } from "../data";
import { indexOf } from "../dimensions";
import type { EChartsCoreOption } from "../echarts-core";
import { echarts } from "../echarts-core";
import { formatCompact, formatInteger, formatRate } from "../format";
import { themeColor } from "../palette";
import type { FiltersStore } from "../filters";
import type { Dimensions } from "../types";

type Measure = "deaths" | "rate";

const MEN_COLOR = "#1e3a8a";
const WOMEN_COLOR = "#fca5a5";

function niceAxisMax(value: number): number {
  const padded = value * 1.2;
  if (padded <= 0) return 10;
  if (padded <= 100) return Math.ceil(padded / 10) * 10;
  if (padded <= 1000) return Math.ceil(padded / 100) * 100;
  return Math.ceil(padded / 1000) * 1000;
}

export function init(
  container: HTMLElement,
  store: FiltersStore,
  dimensions: Dimensions,
): void {
  const chart = echarts.init(container);
  new ResizeObserver(() => chart.resize()).observe(container);

  const card = container.closest(".chart-card") ?? document;
  const titleEl = card.querySelector("[data-chart-title]");
  const subtitleEl = card.querySelector("[data-chart-subtitle]");
  const measureSelect = card.querySelector("#pyramid-measure");
  let measure: Measure = "rate";

  function syncSubtitle(): void {
    if (!subtitleEl) return;
    subtitleEl.textContent =
      measure === "rate" ? "Taxa/100 mil habitantes" : "Óbitos absolutos";
  }

  if (measureSelect instanceof HTMLSelectElement) {
    measure = measureSelect.value as Measure;
    measureSelect.addEventListener("change", () => {
      measure = measureSelect.value as Measure;
      syncSubtitle();
      void render();
    });
  }
  syncSubtitle();

  let renderToken = 0;
  let exportRows: ChartExportRows = { headers: [], rows: [] };

  async function render(): Promise<void> {
    const token = ++renderToken;
    const filters = store.get();
    const level = resolveCauseLevel(filters);

    const [deathsByAgeGetter, populationTable] = await Promise.all([
      loadDeathsByAgeGetter(level, dimensions, filters.location),
      fetchPopulationByAgeForLocation(filters.location),
    ]);
    if (token !== renderToken) return;

    if (titleEl) titleEl.textContent = pyramidChartTitle(filters, dimensions);

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

    const menValues =
      measure === "deaths" ? menDeaths.map((v) => v ?? 0) : menRate;
    const womenValues =
      measure === "deaths" ? womenDeaths.map((v) => v ?? 0) : womenRate;

    let maxAcrossYears = 0;
    for (let yi = 0; yi < dimensions.years.length; yi++) {
      for (const sexIndex of [menIndex, womenIndex]) {
        const deathsByAge = deathsByAgeGetter(sexIndex, yi) ?? [];
        if (measure === "deaths") {
          for (const deaths of deathsByAge)
            maxAcrossYears = Math.max(maxAcrossYears, deaths ?? 0);
        } else {
          const populationByAge =
            getAgeSeries(populationTable, sexIndex, yi) ?? [];
          for (let i = 0; i < deathsByAge.length; i++) {
            maxAcrossYears = Math.max(
              maxAcrossYears,
              rateAt(deathsByAge[i], populationByAge[i]),
            );
          }
        }
      }
    }
    const maxAbs = niceAxisMax(maxAcrossYears);
    const fullValueFormatter =
      measure === "deaths" ? formatInteger : formatRate;
    const dataLabelFormatter = (value: number): string =>
      measure === "deaths"
        ? formatInteger(value)
        : `${formatRate(value)} por 100 mil`;

    const isNarrow = container.clientWidth < 480;
    const labelMargin = isNarrow ? 72 : 116;

    const option: EChartsCoreOption = {
      grid: [
        { left: labelMargin, right: "53%", top: 40, bottom: 32 },
        { left: "53%", right: labelMargin, top: 40, bottom: 32 },
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
          inverse: true,
          axisLabel: { formatter: (value: number) => formatCompact(value) },
        },
        {
          gridIndex: 1,
          type: "value",
          min: 0,
          max: maxAbs,
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
          label: {
            show: true,
            position: "left",
            formatter: (params: { value: number }) =>
              params.value > 0 ? dataLabelFormatter(params.value) : "",
            color: themeColor("--color-gray-700"),
            fontSize: 10,
          },
        },
        {
          name: "Mulheres",
          type: "bar",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: womenValues,
          color: WOMEN_COLOR,
          label: {
            show: true,
            position: "right",
            formatter: (params: { value: number }) =>
              params.value > 0 ? dataLabelFormatter(params.value) : "",
            color: themeColor("--color-gray-700"),
            fontSize: 10,
          },
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
      measure === "deaths" ? "Óbitos" : "Taxa por faixa (por 100 mil hab.)";
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
    getRows: () => exportRows,
  });

  setupChartFullscreen(card, container);

  subscribeWhenVisible(card, store, render);
}

function rateAt(
  deaths: number | null | undefined,
  population: number | null | undefined,
): number {
  if (!deaths || !population) return 0;
  return (deaths / population) * 100000;
}
