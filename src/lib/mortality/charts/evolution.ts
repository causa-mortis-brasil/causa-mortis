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
import { evolutionChartTitle } from "../chart-titles";
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
  const titleEl = card.querySelector("[data-chart-title]");
  const subtitleEl = card.querySelector("[data-chart-subtitle]");
  if (subtitleEl) subtitleEl.textContent = "Taxa/100 mil habitantes";
  const maxYear = Math.max(...dimensions.years);
  let renderToken = 0;
  let exportRows: ChartExportRows = { headers: [], rows: [] };

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

    if (titleEl) titleEl.textContent = evolutionChartTitle(filters, dimensions);

    const sexIndex = indexOf(dimensions.sexes, filters.sex);

    const crude: number[] = [];
    const standardized: number[] = [];
    for (let yearIndex = 0; yearIndex < dimensions.years.length; yearIndex++) {
      const point = pointGetter(sexIndex, yearIndex);
      crude.push(point.crudeRate);
      standardized.push(point.stdRate);
    }

    const option: EChartsCoreOption = {
      grid: { left: 48, right: 132, top: 24, bottom: 32 },
      tooltip: { trigger: "axis" },
      xAxis: {
        type: "category",
        data: [...dimensions.years.map(String), String(maxYear + 1)],
        boundaryGap: false,
        axisLabel: {
          interval: (index: number, value: string) =>
            index < dimensions.years.length && Number(value) % 5 === 0,
        },
        axisTick: {
          interval: (index: number) => index < dimensions.years.length,
        },
      },
      yAxis: { type: "value", name: "Taxa (por 100 mil hab.)", min: 0 },
      series: [
        {
          name: "Padronizada por idade",
          type: "line",
          data: standardized,
          color: themeColor("--color-primary-500"),
          symbolSize: 5,
          emphasis: { disabled: true },
          endLabel: {
            show: true,
            formatter: "Padronizada por idade",
            color: themeColor("--color-primary-500"),
            fontSize: 11,
            fontWeight: 600,
          },
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
                {
                  name: "preliminar",
                  xAxis: String(maxYear),
                  label: { position: "insideTopLeft" },
                },
                { xAxis: String(maxYear + 1) },
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
          emphasis: { disabled: true },
          endLabel: {
            show: true,
            formatter: "Bruta",
            color: themeColor("--color-gray-400"),
            fontSize: 11,
            fontWeight: 600,
          },
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
    getRows: () => exportRows,
  });

  setupChartFullscreen(card, container);

  subscribeWhenVisible(card, store, render);
}
