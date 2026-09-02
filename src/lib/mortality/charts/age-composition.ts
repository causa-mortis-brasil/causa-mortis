import { getCauseGroupAgeSeries } from "../access";
import { ageCompositionChartTitle, setChartTitle } from "../chart-titles";
import {
  buildFilenameBase,
  EXPORT_WIDTH,
  roundTo,
  setupChartExport,
  type ChartExportRows,
} from "../chart-export";
import { setupChartFullscreen } from "../chart-fullscreen";
import { subscribeWhenVisible } from "../chart-visibility";
import { fetchDeathsByCauseGroupAgeForLocation } from "../data";
import { indexOf } from "../dimensions";
import type { EChartsOption } from "../echarts-core";
import { echarts } from "../echarts-core";
import { formatPercent, formatPercentInteger } from "../format";
import { causeGroupColor, themeColor } from "../palette";
import {
  isManualYearOnlyChange,
  isYearOnlyChange,
  type FiltersStore,
} from "../filters";
import { setupChartShare } from "../share";
import type { Dimensions, Filters } from "../types";

const EXPORT_SIZE = { width: EXPORT_WIDTH, height: 620 };
const MIN_ANNUAL_DEATHS_TO_INCLUDE = 20;
const LABEL_FONT_SIZE = 10;
const LABEL_FONT_WEIGHT = 600;
const LABEL_LINE_HEIGHT = 12;
const LABEL_PADDING_Y = 1;
const FAST_AREA_DURATION = 200;
const NORMAL_AREA_DURATION = 400;
const PLAYBACK_ANIMATION_BUFFER_MS = 80;

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
  let previousFilters: Filters | null = null;

  interface AgeCompositionOptionData {
    filters: Filters;
    stackedFromBase: number[];
    deathsByCauseGroup: (number | null)[][];
    totalByAge: number[];
    animationDuration: number | undefined;
  }

  let lastOptionData: AgeCompositionOptionData | null = null;

  function buildOption(
    data: AgeCompositionOptionData,
    wide: boolean,
  ): EChartsOption {
    const {
      filters,
      stackedFromBase,
      deathsByCauseGroup,
      totalByAge,
      animationDuration,
    } = data;
    const isNarrow = !wide && container.clientWidth < 480;
    const labelWidth = wide ? 168 : isNarrow ? 80 : 116;
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
          ...(animationDuration !== undefined
            ? { animationDuration, animationDurationUpdate: animationDuration }
            : {}),
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

    return {
      grid: {
        left: isNarrow ? 36 : 48,
        right: rightMargin,
        top: gridTop,
        bottom: gridBottom,
      },
      tooltip: {
        trigger: "axis",
        order: "seriesDesc",
        valueFormatter: (value) => formatPercent(Number(value)),
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
        axisTick: {
          show: true,
          alignWithLabel: true,
          interval: 0,
          length: 5,
          lineStyle: { color: themeColor("--color-gray-400"), width: 2 },
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
  }

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

  function areaAnimationDuration(filters: Filters): number | undefined {
    const origin = store.getLastYearOrigin();
    if (isManualYearOnlyChange(origin, previousFilters, filters))
      return FAST_AREA_DURATION;

    if (origin === "playback" && isYearOnlyChange(previousFilters, filters)) {
      const intervalMs = store.getLastYearIntervalMs();
      if (intervalMs !== null)
        return Math.min(
          NORMAL_AREA_DURATION,
          Math.max(
            FAST_AREA_DURATION,
            intervalMs - PLAYBACK_ANIMATION_BUFFER_MS,
          ),
        );
      return NORMAL_AREA_DURATION;
    }

    return undefined;
  }

  async function render(): Promise<void> {
    const filters = store.get();
    setChartTitle(titleEl, ageCompositionChartTitle(filters, dimensions));
    const animationDuration = areaAnimationDuration(filters);
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

    lastOptionData = {
      filters,
      stackedFromBase,
      deathsByCauseGroup,
      totalByAge,
      animationDuration,
    };
    const wide = container.clientWidth >= 480;
    chart.setOption(buildOption(lastOptionData, wide), { notMerge: true });

    seriesOrder = stackedFromBase.map(
      (causeGroupIndex) => dimensions.cause_groups[causeGroupIndex] ?? "",
    );
    sharesByAge = stackedFromBase.map((causeGroupIndex) =>
      dimensions.age_groups.map((_, ageIndex) => {
        const deaths = deathsByCauseGroup[causeGroupIndex]?.[ageIndex] ?? 0;
        const total = totalByAge[ageIndex] ?? 0;
        return total > 0 ? deaths / total : 0;
      }),
    );

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

  setupChartExport(card, EXPORT_SIZE, {
    getFilenameBase: () => buildFilenameBase("composicao-etaria", store.get()),
    getRows: () => exportRows,
    getExportOption: () =>
      lastOptionData
        ? { ...buildOption(lastOptionData, true), animation: false }
        : {},
  });

  setupChartFullscreen(card, container);
  setupChartShare(card, store);

  subscribeWhenVisible(card, store, render);
}
