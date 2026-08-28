import { loadRatePointGetter, resolveCauseLevel } from "../cause-level";
import {
  buildFilenameBase,
  buildFilterContext,
  roundTo,
  setupChartExport,
  type ChartExportRows,
} from "../chart-export";
import type { EChartsCoreOption } from "../echarts-core";
import { echarts } from "../echarts-core";
import { indexOf } from "../dimensions";
import { themeColor } from "../palette";
import type { FiltersStore } from "../filters";
import type { Dimensions } from "../types";

export function init(
  container: HTMLElement,
  store: FiltersStore,
  dimensions: Dimensions,
): void {
  const chart = echarts.init(container);
  new ResizeObserver(() => chart.resize()).observe(container);

  const card = container.closest(".chart-card") ?? document;
  const maxYear = Math.max(...dimensions.years);
  let renderToken = 0;
  let exportRows: ChartExportRows = { headers: [], rows: [] };

  async function render(): Promise<void> {
    const token = ++renderToken;
    const filters = store.get();
    const level = resolveCauseLevel(filters);
    const pointGetter = await loadRatePointGetter(level, dimensions);
    if (token !== renderToken) return;

    const locationIndex = indexOf(dimensions.locations, filters.location);
    const sexIndex = indexOf(dimensions.sexes, filters.sex);

    const crude: number[] = [];
    const standardized: number[] = [];
    for (let yearIndex = 0; yearIndex < dimensions.years.length; yearIndex++) {
      const point = pointGetter(locationIndex, sexIndex, yearIndex);
      crude.push(point.crudeRate);
      standardized.push(point.stdRate);
    }

    const option: EChartsCoreOption = {
      grid: { left: 48, right: 40, top: 24, bottom: 56 },
      tooltip: { trigger: "axis" },
      legend: { bottom: 4, data: ["Padronizada por idade", "Bruta"] },
      xAxis: {
        type: "category",
        data: dimensions.years.map(String),
        boundaryGap: false,
        axisLabel: {
          interval: (_index: number, value: string) => Number(value) % 5 === 0,
        },
      },
      yAxis: { type: "value", name: "Taxa (por 100 mil hab.)" },
      series: [
        {
          name: "Padronizada por idade",
          type: "line",
          data: standardized,
          color: themeColor("--color-primary-500"),
          symbolSize: 5,
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
              [{ name: "pandemia", xAxis: "2020" }, { xAxis: "2023" }],
              [
                { name: "preliminar", xAxis: String(maxYear) },
                { xAxis: String(maxYear) },
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
            data: [{ xAxis: String(store.get().year) }],
          },
        },
        {
          name: "Bruta",
          type: "line",
          data: crude,
          color: themeColor("--color-gray-400"),
          symbolSize: 5,
        },
      ],
    };

    chart.setOption(option, { notMerge: true });

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

  setupChartExport(card, chart, {
    getFilenameBase: () => buildFilenameBase("evolucao", store.get()),
    getContext: () => buildFilterContext(dimensions, store.get()),
    getRows: () => exportRows,
  });

  store.subscribe(() => void render());
}
