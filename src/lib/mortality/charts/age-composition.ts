import { getCauseGroupAgeSeries } from "../access";
import { ageCompositionChartTitle } from "../chart-titles";
import {
  buildFilenameBase,
  roundTo,
  setupChartExport,
  type ChartExportRows,
} from "../chart-export";
import { setupChartFullscreen } from "../chart-fullscreen";
import { subscribeWhenVisible } from "../chart-visibility";
import { fetchDeathsByCauseGroupAgeForLocation } from "../data";
import { indexOf } from "../dimensions";
import type { EChartsCoreOption } from "../echarts-core";
import { echarts } from "../echarts-core";
import { formatPercent, formatPercentInteger } from "../format";
import { causeGroupColor } from "../palette";
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
  let exportRows: ChartExportRows = { headers: [], rows: [] };
  let seriesOrder: string[] = [];
  let sharesByAge: number[][] = [];

  chart.getZr().on("click", (event) => {
    const pixel: [number, number] = [event.offsetX, event.offsetY];
    if (!chart.containPixel({ gridIndex: 0 }, pixel)) return;

    const ageIndex = Math.round(
      Number(chart.convertFromPixel({ xAxisIndex: 0 }, pixel[0])),
    );
    const shareAtClick = Number(
      chart.convertFromPixel({ yAxisIndex: 0 }, pixel[1]),
    );

    let cumulative = 0;
    for (let i = 0; i < seriesOrder.length; i++) {
      cumulative += sharesByAge[i]?.[ageIndex] ?? 0;
      if (shareAtClick <= cumulative) {
        store.setCauseGroup(seriesOrder[i] ?? null);
        return;
      }
    }
  });

  async function render(): Promise<void> {
    const filters = store.get();
    if (titleEl)
      titleEl.textContent = ageCompositionChartTitle(filters, dimensions);

    const table = await fetchDeathsByCauseGroupAgeForLocation(filters.location);
    const sexIndex = indexOf(dimensions.sexes, filters.sex);
    const yearIndex = indexOf(dimensions.years, filters.year);

    const deathsByCauseGroup = dimensions.cause_groups.map(
      (_, causeGroupIndex) =>
        getCauseGroupAgeSeries(table, sexIndex, yearIndex, causeGroupIndex) ??
        [],
    );

    const totalByAge = dimensions.age_groups.map((_, ageIndex) =>
      deathsByCauseGroup.reduce(
        (sum, series) => sum + (series[ageIndex] ?? 0),
        0,
      ),
    );

    const includedIndices = dimensions.cause_groups
      .map((_, causeGroupIndex) => causeGroupIndex)
      .filter((causeGroupIndex) =>
        deathsByCauseGroup[causeGroupIndex]?.some(
          (deaths) => (deaths ?? 0) > 0,
        ),
      );

    const stackedFromBase = [...includedIndices].reverse();

    const series = stackedFromBase.map((causeGroupIndex) => {
      const causeGroup = dimensions.cause_groups[causeGroupIndex];
      const isHighlighted =
        !filters.causeGroup || filters.causeGroup === causeGroup;
      const shares = dimensions.age_groups.map((_, ageIndex) => {
        const deaths = deathsByCauseGroup[causeGroupIndex]?.[ageIndex] ?? 0;
        const total = totalByAge[ageIndex] ?? 0;
        return total > 0 ? deaths / total : 0;
      });

      const color = causeGroupColor(causeGroupIndex);

      return {
        name: causeGroup,
        type: "line" as const,
        stack: "total",
        symbol: "none" as const,
        areaStyle: { opacity: isHighlighted ? 0.9 : 0.25 },
        lineStyle: {
          color: "#fff",
          width: 1,
          opacity: isHighlighted ? 1 : 0.25,
        },
        color,
        endLabel: {
          show: isHighlighted,
          formatter: () => causeGroup,
          color,
          fontSize: 10,
          fontWeight: 600,
        },
        data: shares,
      };
    });

    const isNarrow = container.clientWidth < 480;

    const option: EChartsCoreOption = {
      grid: {
        left: isNarrow ? 36 : 48,
        right: isNarrow ? 88 : 120,
        top: 16,
        bottom: isNarrow ? 40 : 48,
      },
      tooltip: {
        trigger: "axis",
        order: "seriesDesc",
        valueFormatter: (value: number | string) =>
          formatPercent(Number(value)),
      },
      xAxis: {
        type: "category",
        data: dimensions.age_groups,
        name: "Faixa de idade (anos)",
        nameLocation: "middle",
        nameGap: 24,
        axisLabel: {
          formatter: (value: string, index: number) =>
            index % 2 === 0 || index === dimensions.age_groups.length - 1
              ? value
              : "",
        },
      },
      yAxis: {
        type: "value",
        max: 1,
        axisLabel: {
          formatter: (value: number) => formatPercentInteger(value),
        },
      },
      series,
    };

    chart.setOption(option, { notMerge: true });

    seriesOrder = series.map((s) => s.name);
    sharesByAge = series.map((s) => s.data);

    exportRows = {
      headers: [
        "Faixa etária",
        ...includedIndices.map(
          (causeGroupIndex) => dimensions.cause_groups[causeGroupIndex] ?? "",
        ),
      ],
      rows: dimensions.age_groups.map((ageGroup, ageIndex) => [
        ageGroup,
        ...includedIndices.map((causeGroupIndex) => {
          const deaths = deathsByCauseGroup[causeGroupIndex]?.[ageIndex] ?? 0;
          const total = totalByAge[ageIndex] ?? 0;
          return roundTo(total > 0 ? (deaths / total) * 100 : 0, 1);
        }),
      ]),
    };
  }

  setupChartExport(card, chart, {
    getFilenameBase: () => buildFilenameBase("composicao-etaria", store.get()),
    getRows: () => exportRows,
  });

  setupChartFullscreen(card, container);

  subscribeWhenVisible(card, store, render);
}
