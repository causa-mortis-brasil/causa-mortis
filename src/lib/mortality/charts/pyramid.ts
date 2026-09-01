import { loadDeathsByAgeGetter, resolveCauseLevel } from "../cause-level";
import { getAgeSeries } from "../access";
import { pyramidChartTitle, setChartTitle } from "../chart-titles";
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
import { isManualYearOnlyChange, type FiltersStore } from "../filters";
import { crudeRate } from "../rate";
import { setupChartShare } from "../share";
import type { Dimensions, Filters } from "../types";

const MEN_COLOR = "#1e3a8a";
const WOMEN_COLOR = "#fca5a5";

const AXIS_SPLIT_COUNT = 5;
const NICE_FRACTIONS = [1, 2, 5, 10];
const EXPORT_SIZE = { width: 820, height: 480 };

function niceStepBounds(roughStep: number): { down: number; up: number } {
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  let down = magnitude;
  let up = 10 * magnitude;
  for (const fraction of NICE_FRACTIONS) {
    const step = fraction * magnitude;
    if (step <= roughStep) down = step;
    if (step >= roughStep) {
      up = step;
      break;
    }
  }
  return { down, up };
}

function niceAxisScale(value: number): { max: number; interval: number } {
  const padded = value * 1.2;
  if (padded <= 0) return { max: 10, interval: 2 };

  const roughStep = padded / AXIS_SPLIT_COUNT;
  const { down, up } = niceStepBounds(roughStep);
  const downMax = Math.ceil(value / down) * down;
  const upMax = Math.ceil(value / up) * up;

  return Math.abs(downMax - padded) <= Math.abs(upMax - padded)
    ? { max: downMax, interval: down }
    : { max: upMax, interval: up };
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

  let renderToken = 0;
  let previousFilters: Filters | null = null;
  let exportRows: ChartExportRows = { headers: [], rows: [] };
  let forceWideLayout = false;

  async function render(): Promise<void> {
    const token = ++renderToken;
    const filters = store.get();
    const level = resolveCauseLevel(filters);
    const useFastAnimation = isManualYearOnlyChange(
      store.getLastYearOrigin(),
      previousFilters,
      filters,
    );
    previousFilters = filters;

    const [deathsByAgeGetter, populationTable] = await Promise.all([
      loadDeathsByAgeGetter(level, dimensions, filters.location),
      fetchPopulationByAgeForLocation(filters.location),
    ]);
    if (token !== renderToken) return;

    setChartTitle(titleEl, pyramidChartTitle(filters, dimensions));
    const measure = filters.pyramidMeasure;
    if (subtitleEl)
      subtitleEl.textContent =
        measure === "rate" ? "Taxa/100 mil habitantes" : "Óbitos absolutos";

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
      crudeRate(menDeaths[i] ?? 0, menPopulation[i] ?? 0),
    );
    const womenRate = dimensions.age_groups.map((_, i) =>
      crudeRate(womenDeaths[i] ?? 0, womenPopulation[i] ?? 0),
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
              crudeRate(deathsByAge[i] ?? 0, populationByAge[i] ?? 0),
            );
          }
        }
      }
    }
    const { max: maxAbs, interval: axisInterval } =
      niceAxisScale(maxAcrossYears);
    const fullValueFormatter =
      measure === "deaths" ? formatInteger : formatRate;
    const dataLabelFormatter = (value: number): string =>
      measure === "deaths" ? formatInteger(value) : `${formatRate(value)}`;

    const isNarrow = !forceWideLayout && container.clientWidth < 480;
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
          ...(useFastAnimation ? { animationDurationUpdate: 200 } : {}),
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
          ...(useFastAnimation ? { animationDurationUpdate: 200 } : {}),
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

  setupChartExport(card, chart, EXPORT_SIZE, {
    getFilenameBase: () => buildFilenameBase("piramide", store.get()),
    getRows: () => exportRows,
    prepareExport: async () => {
      forceWideLayout = true;
      await render();
    },
    finishExport: () => {
      forceWideLayout = false;
      void render();
    },
  });

  setupChartFullscreen(card, container);
  setupChartShare(card, store);

  subscribeWhenVisible(card, store, render);
}
