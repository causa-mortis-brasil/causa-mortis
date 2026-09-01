import { loadLocationRatePointGetter, resolveCauseLevel } from "../cause-level";
import {
  buildFilenameBase,
  roundTo,
  setupChartExport,
  type ChartExportRows,
} from "../chart-export";
import { setupChartFullscreen } from "../chart-fullscreen";
import { subscribeWhenVisible } from "../chart-visibility";
import type { EChartsCoreOption } from "../echarts-core";
import { echarts } from "../echarts-core";
import { evolutionChartTitle, setChartTitle } from "../chart-titles";
import { indexOf } from "../dimensions";
import { formatInteger, formatRate } from "../format";
import { themeColor } from "../palette";
import type { FiltersStore } from "../filters";
import { setupChartShare } from "../share";
import type { Dimensions } from "../types";

const EXPORT_SIZE = { width: 760, height: 400 };
const GRID_TOP = 24;
const GRID_BOTTOM = 32;
const PRELIMINARY_AREA_START_OFFSET = 0.4;

type LinePoint = number | { value: number; label: Record<string, unknown> };

function withLastPointLabel(
  data: number[],
  position: "top" | "bottom",
  color: string,
  formatter: string,
): LinePoint[] {
  return data.map((value, index) =>
    index === data.length - 1
      ? {
          value,
          label: {
            show: true,
            position,
            formatter,
            color,
            fontSize: 11,
            fontWeight: 600,
          },
        }
      : value,
  );
}

export function init(
  container: HTMLElement,
  store: FiltersStore,
  dimensions: Dimensions,
): void {
  const chart = echarts.init(container);
  let hasRendered = false;
  new ResizeObserver(() => {
    chart.resize();
    if (hasRendered) applyPreliminaryHighlight();
  }).observe(container);

  const card = container.closest(".chart-card") ?? document;
  const titleEl = card.querySelector("[data-chart-title]");
  const subtitleEl = card.querySelector("[data-chart-subtitle]");
  if (subtitleEl) subtitleEl.textContent = "Taxa/100 mil habitantes";
  const maxYear = Math.max(...dimensions.years);
  let renderToken = 0;
  let exportRows: ChartExportRows = { headers: [], rows: [] };

  function applyPreliminaryHighlight(): void {
    const startPixel = chart.convertToPixel(
      { xAxisIndex: 0 },
      String(maxYear - 1),
    );
    const endPixel = chart.convertToPixel({ xAxisIndex: 0 }, String(maxYear));

    const x =
      startPixel + (endPixel - startPixel) * PRELIMINARY_AREA_START_OFFSET;
    const width = Math.max(endPixel - x, 0);
    const height = Math.max(container.clientHeight - GRID_TOP - GRID_BOTTOM, 0);

    chart.setOption({
      graphic: {
        elements: [
          {
            id: "preliminary-area",
            type: "rect",
            silent: true,
            z: 1,
            x,
            y: GRID_TOP,
            shape: { width, height },
            style: { fill: "rgba(0, 0, 0, 0.04)" },
          },
          {
            id: "preliminary-label",
            type: "text",
            silent: true,
            z: 2,
            x: x + 4,
            y: GRID_TOP + 4,
            style: {
              text: "preliminar",
              fill: themeColor("--color-gray-500"),
              fontSize: 11,
            },
          },
        ],
      },
    });
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
    const standardizedIsHigher =
      (standardized[lastIndex] ?? 0) >= (crude[lastIndex] ?? 0);
    const standardizedColor = themeColor("--color-primary-500");
    const crudeColor = themeColor("--color-gray-500");

    const option: EChartsCoreOption = {
      grid: { left: 48, right: 80, top: GRID_TOP, bottom: GRID_BOTTOM },
      tooltip: {
        trigger: "axis",
        valueFormatter: (value: number | string) => formatRate(Number(value)),
      },
      xAxis: {
        type: "category",
        data: dimensions.years.map(String),
        boundaryGap: false,
        axisLabel: {
          interval: (_index: number, value: string) => Number(value) % 5 === 0,
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
            data: [[{ name: "pandemia", xAxis: "2020" }, { xAxis: "2023" }]],
          },
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: {
              type: "dashed",
              color: themeColor("--color-gray-400"),
            },
            label: { formatter: "ano selecionado" },
            data: [{ xAxis: String(store.get().year) }],
          },
        },
        {
          name: "Bruta",
          type: "line",
          data: withLastPointLabel(
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

    chart.setOption(option, { notMerge: true });
    hasRendered = true;
    applyPreliminaryHighlight();

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

  setupChartExport(card, chart, EXPORT_SIZE, {
    getFilenameBase: () => buildFilenameBase("evolucao", store.get()),
    getRows: () => exportRows,
  });

  setupChartFullscreen(card, container);
  setupChartShare(card, store);

  subscribeWhenVisible(card, store, render);
}
