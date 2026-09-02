import { loadLocationRatePointGetter, resolveCauseLevel } from "../cause-level";
import {
  buildFilenameBase,
  EXPORT_WIDTH,
  roundTo,
  setupChartExport,
  type ChartExportRows,
} from "../chart-export";
import { setupChartFullscreen } from "../chart-fullscreen";
import { subscribeWhenVisible } from "../chart-visibility";
import type { EChartsOption } from "../echarts-core";
import { echarts } from "../echarts-core";
import { evolutionChartTitle, setChartTitle } from "../chart-titles";
import { indexOf } from "../dimensions";
import { formatInteger, formatRate } from "../format";
import { themeColor } from "../palette";
import type { FiltersStore } from "../filters";
import { setupChartShare } from "../share";
import type { Dimensions } from "../types";

const EXPORT_SIZE = { width: EXPORT_WIDTH, height: 560 };
const GRID_TOP = 24;
const GRID_BOTTOM = 32;
const PRELIMINARY_AREA_START_OFFSET = 0.4;

type YearPoint = [number, number];
type LinePoint =
  YearPoint | { value: YearPoint; label: Record<string, unknown> };

function withLastPointLabel(
  years: number[],
  data: number[],
  position: "top" | "bottom",
  color: string,
  formatter: string,
): LinePoint[] {
  return data.map((value, index) => {
    const point: YearPoint = [years[index] ?? 0, value];
    return index === data.length - 1
      ? {
          value: point,
          label: {
            show: true,
            position,
            formatter,
            color,
            fontSize: 11,
            fontWeight: 600,
          },
        }
      : point;
  });
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
  if (subtitleEl) subtitleEl.textContent = "Taxa/100 mil habitantes";
  let renderToken = 0;
  let exportRows: ChartExportRows = { headers: [], rows: [] };

  interface EvolutionOptionData {
    years: number[];
    standardized: number[];
    crude: number[];
    minYear: number;
    maxYear: number;
    selectedYear: number;
    standardizedColor: string;
    crudeColor: string;
  }

  let lastOptionData: EvolutionOptionData | null = null;

  function buildOption(data: EvolutionOptionData): EChartsOption {
    const {
      years,
      standardized,
      crude,
      minYear,
      maxYear,
      selectedYear,
      standardizedColor,
      crudeColor,
    } = data;
    const lastIndex = years.length - 1;
    const standardizedIsHigher =
      (standardized[lastIndex] ?? 0) >= (crude[lastIndex] ?? 0);

    return {
      grid: { left: 48, right: 80, top: GRID_TOP, bottom: GRID_BOTTOM },
      tooltip: {
        trigger: "axis",
        valueFormatter: (value) => formatRate(Number(value)),
      },
      xAxis: {
        type: "value",
        min: minYear,
        max: maxYear,
        interval: 5,
        splitLine: { show: false },
        axisLabel: {
          formatter: (value: number) => String(value),
        },
        axisPointer: {
          label: {
            formatter: (params) => String(params.value),
          },
        },
      },
      yAxis: {
        type: "value",
        name: "Taxa (por 100 mil hab.)",
        min: 0,
        axisLabel: {
          formatter: (value: number | string) => formatInteger(Number(value)),
        },
      },
      series: [
        {
          name: "Padronizada por idade",
          type: "line",
          data: withLastPointLabel(
            years,
            standardized,
            standardizedIsHigher ? "top" : "bottom",
            standardizedColor,
            "Padronizada por idade",
          ),
          color: standardizedColor,
          symbolSize: 5,
          emphasis: { disabled: true },
          markArea: {
            silent: true,
            itemStyle: { color: "rgba(0, 0, 0, 0.04)" },
            label: {
              show: true,
              position: "insideTop",
              color: themeColor("--color-gray-500"),
              fontSize: 11,
            },
            data: [
              [{ name: "pandemia", xAxis: 2020 }, { xAxis: 2023 }],
              [
                {
                  name: "preliminar",
                  xAxis: maxYear - 1 + PRELIMINARY_AREA_START_OFFSET,
                },
                { xAxis: maxYear },
              ],
            ],
          },
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: {
              type: "dashed",
              color: themeColor("--color-gray-400"),
            },
            label: { formatter: "ano selecionado" },
            data: [{ xAxis: selectedYear }],
          },
        },
        {
          name: "Bruta",
          type: "line",
          data: withLastPointLabel(
            years,
            crude,
            standardizedIsHigher ? "bottom" : "top",
            crudeColor,
            "Bruta",
          ),
          color: crudeColor,
          symbolSize: 5,
          emphasis: { disabled: true },
        },
      ],
    };
  }

  async function render(): Promise<void> {
    const token = ++renderToken;
    const filters = store.get();
    const level = resolveCauseLevel(filters);
    const pointGetter = await loadLocationRatePointGetter(
      level,
      dimensions,
      filters.location,
    );
    if (token !== renderToken) return;

    setChartTitle(titleEl, evolutionChartTitle(filters, dimensions));

    const sexIndex = indexOf(dimensions.sexes, filters.sex);

    const crude: number[] = [];
    const standardized: number[] = [];
    for (let yearIndex = 0; yearIndex < dimensions.years.length; yearIndex++) {
      const point = pointGetter(sexIndex, yearIndex);
      crude.push(point.crudeRate);
      standardized.push(point.stdRate);
    }

    const lastIndex = dimensions.years.length - 1;
    const minYear = dimensions.years[0] ?? 0;
    const maxYear = dimensions.years[lastIndex] ?? 0;
    const standardizedColor = themeColor("--color-primary-500");
    const crudeColor = themeColor("--color-gray-500");

    lastOptionData = {
      years: dimensions.years,
      standardized,
      crude,
      minYear,
      maxYear,
      selectedYear: filters.year,
      standardizedColor,
      crudeColor,
    };
    chart.setOption(buildOption(lastOptionData), { notMerge: true });

    exportRows = {
      headers: [
        "Ano",
        "Taxa padronizada (por 100 mil hab.)",
        "Taxa bruta (por 100 mil hab.)",
      ],
      rows: dimensions.years.map((year, i) => [
        year,
        roundTo(standardized[i] ?? 0, 1),
        roundTo(crude[i] ?? 0, 1),
      ]),
    };
  }

  setupChartExport(card, EXPORT_SIZE, {
    getFilenameBase: () => buildFilenameBase("evolucao", store.get()),
    getRows: () => exportRows,
    getExportOption: () =>
      lastOptionData
        ? { ...buildOption(lastOptionData), animation: false }
        : {},
  });

  setupChartFullscreen(card, container);
  setupChartShare(card, store);

  subscribeWhenVisible(card, store, render);
}
