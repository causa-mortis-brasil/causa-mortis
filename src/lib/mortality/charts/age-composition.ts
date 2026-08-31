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
import { isManualYearOnlyChange, type FiltersStore } from "../filters";
import { setupChartShare } from "../share";
import type { Dimensions, Filters } from "../types";

const EXPORT_SIZE = { width: 880, height: 660 };
const MIN_ANNUAL_DEATHS_TO_INCLUDE = 20;
const LABEL_FONT_SIZE = 10;
const LABEL_FONT_WEIGHT = 600;
const LABEL_LINE_HEIGHT = 12;
const LABEL_PADDING_Y = 1;

export function init(
  container: HTMLElement,
  store: FiltersStore,
  dimensions: Dimensions,
): void {
  const chart = echarts.init(container);
  new ResizeObserver(() => {
    chart.resize();
  }).observe(container);

  const card = container.closest(".chart-card") ?? document;
  const titleEl = card.querySelector("[data-chart-title]");
  let exportRows: ChartExportRows = { headers: [], rows: [] };
  let seriesOrder: string[] = [];
  let sharesByAge: number[][] = [];
  let forceWideLayout = false;
  let previousFilters: Filters | null = null;

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
    const useFastAnimation = isManualYearOnlyChange(
      store.getLastYearOrigin(),
      previousFilters,
      filters,
    );
    previousFilters = filters;

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
      .filter((causeGroupIndex) => {
        const annualDeaths = (deathsByCauseGroup[causeGroupIndex] ?? []).reduce(
          (sum: number, deaths) => sum + (deaths ?? 0),
          0,
        );
        return annualDeaths >= MIN_ANNUAL_DEATHS_TO_INCLUDE;
      });

    const stackedFromBase = [...includedIndices].reverse();

    const isNarrow = !forceWideLayout && container.clientWidth < 480;
    const labelWidth = forceWideLayout ? 224 : isNarrow ? 80 : 116;
    const rightMargin = labelWidth + 16;
    const gridTop = 16;
    const gridBottom = isNarrow ? 40 : 48;

    const stackedSeriesData = stackedFromBase.map((causeGroupIndex) => {
      const causeGroup = dimensions.cause_groups[causeGroupIndex];
      const isHighlighted =
        !filters.causeGroup || filters.causeGroup === causeGroup;
      const shares = dimensions.age_groups.map((_, ageIndex) => {
        const deaths = deathsByCauseGroup[causeGroupIndex]?.[ageIndex] ?? 0;
        const total = totalByAge[ageIndex] ?? 0;
        return total > 0 ? deaths / total : 0;
      });
      return { causeGroupIndex, causeGroup, isHighlighted, shares };
    });

    const series = stackedSeriesData.map(
      ({ causeGroupIndex, causeGroup, isHighlighted, shares }) => {
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
          ...(useFastAnimation ? { animationDurationUpdate: 200 } : {}),
          endLabel: {
            show: isHighlighted,
            formatter: () => causeGroup,
            color,
            fontSize: LABEL_FONT_SIZE,
            fontWeight: LABEL_FONT_WEIGHT,
            width: labelWidth,
            lineHeight: LABEL_LINE_HEIGHT,
            padding: [LABEL_PADDING_Y, 0] as [number, number],
          },
          labelLayout: { moveOverlap: "shiftY" as const },
          data: shares,
        };
      },
    );

    const option: EChartsCoreOption = {
      grid: {
        left: isNarrow ? 36 : 48,
        right: rightMargin,
        top: gridTop,
        bottom: gridBottom,
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

  setupChartExport(card, chart, EXPORT_SIZE, {
    getFilenameBase: () => buildFilenameBase("composicao-etaria", store.get()),
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
