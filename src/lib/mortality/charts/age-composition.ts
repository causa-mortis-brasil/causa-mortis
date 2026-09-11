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
import { subscribeWhenVisible, type RenderOptions } from "../chart-visibility";
import { fetchDeathsByCauseGroupAgeForLocation } from "../data";
import { indexOf } from "../dimensions";
import { LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { LabelLayout } from "echarts/features";
import type { EChartsOption } from "../echarts-core";
import { echarts } from "../echarts-core";
import { formatPercent, formatPercentInteger } from "../format";
import {
  causeGroupColor,
  chartGridColor,
  chartSurfaceColor,
  themeColor,
  tooltipStyle,
} from "../palette";
import {
  isManualYearOnlyChange,
  isYearOnlyChange,
  type FiltersStore,
} from "../filters";
import { setupChartShare } from "../share";
import type { Dimensions, Filters } from "../types";

echarts.use([LineChart, GridComponent, TooltipComponent, LabelLayout]);

const EXPORT_SIZE = { width: EXPORT_WIDTH, height: 620 };
const MIN_ANNUAL_DEATHS_TO_INCLUDE = 20;
const LABEL_FONT_SIZE = 10;
const LABEL_FONT_WEIGHT = 600;
const LABEL_LINE_HEIGHT = 12;
const LABEL_PADDING_Y = 1;
const MIN_AGE_LABEL_SLOT = 40;
const MIN_ROTATED_AGE_LABEL_SLOT = 14;
const ROTATED_LABEL_HEIGHT = 28;
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
    const width = container.clientWidth;
    if (width === 0) return;
    const current = chartLayout(width);
    const rendered = chartLayout(renderedWidth);
    if (
      current.isNarrow !== rendered.isNarrow ||
      current.rotateAgeLabels !== rendered.rotateAgeLabels ||
      current.ageLabelInterval !== rendered.ageLabelInterval
    )
      applyOption();
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
  let renderedWidth = 0;

  interface AgeChartLayout {
    isNarrow: boolean;
    labelWidth: number;
    rightMargin: number;
    gridLeft: number;
    gridBottom: number;
    rotateAgeLabels: boolean;
    ageLabelInterval: number;
    axisNameGap: number;
  }

  function chartLayout(width: number): AgeChartLayout {
    const isNarrow = width < 480;
    const labelWidth = isNarrow ? 80 : 168;
    const rightMargin = labelWidth + 16;
    const gridLeft = isNarrow ? 36 : 48;
    const labelSlot =
      (width - gridLeft - rightMargin) / dimensions.age_groups.length;
    const rotateAgeLabels = labelSlot < MIN_AGE_LABEL_SLOT;
    return {
      isNarrow,
      labelWidth,
      rightMargin,
      gridLeft,
      gridBottom:
        (isNarrow ? 40 : 48) + (rotateAgeLabels ? ROTATED_LABEL_HEIGHT : 0),
      rotateAgeLabels,
      ageLabelInterval:
        rotateAgeLabels && labelSlot < MIN_ROTATED_AGE_LABEL_SLOT ? 1 : 0,
      axisNameGap: 24 + (rotateAgeLabels ? ROTATED_LABEL_HEIGHT : 0),
    };
  }

  function buildOption(
    data: AgeCompositionOptionData,
    width: number,
    forceLight = false,
  ): EChartsOption {
    const {
      filters,
      stackedFromBase,
      deathsByCauseGroup,
      totalByAge,
      animationDuration,
    } = data;
    const axisLabelColor = themeColor("--color-gray-600", { forceLight });
    const {
      labelWidth,
      rightMargin,
      gridLeft,
      gridBottom,
      rotateAgeLabels,
      ageLabelInterval,
      axisNameGap,
    } = chartLayout(width);
    const gridTop = 16;

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
        const color = causeGroupColor(causeGroupIndex, { forceLight });

        return {
          name: causeGroup,
          type: "line" as const,
          stack: "total",
          symbol: "none" as const,
          areaStyle: { opacity: isHighlighted ? 0.9 : 0.25 },
          lineStyle: {
            color: chartSurfaceColor({ forceLight }),
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
            overflow: "break" as const,
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
        left: gridLeft,
        right: rightMargin,
        top: gridTop,
        bottom: gridBottom,
      },
      tooltip: {
        trigger: "axis",
        order: "seriesDesc",
        valueFormatter: (value) => formatPercent(Number(value)),
        ...tooltipStyle(),
      },
      xAxis: {
        type: "category",
        data: dimensions.age_groups,
        name: "Faixa etária (anos)",
        nameLocation: "middle",
        nameGap: axisNameGap,
        nameTextStyle: { color: axisLabelColor },
        axisLabel: {
          interval: ageLabelInterval,
          rotate: rotateAgeLabels ? 90 : 0,
          color: axisLabelColor,
        },
        axisLine: { lineStyle: { color: chartGridColor({ forceLight }) } },
        axisTick: {
          show: true,
          alignWithLabel: true,
          interval: 0,
          length: 5,
          lineStyle: {
            color: themeColor("--color-gray-400", { forceLight }),
            width: 2,
          },
        },
      },
      yAxis: {
        type: "value",
        max: 1,
        splitLine: { lineStyle: { color: chartGridColor({ forceLight }) } },
        axisLabel: {
          formatter: (value: number) => formatPercentInteger(value),
          color: axisLabelColor,
        },
      },
      series,
    };
  }

  function applyOption(): void {
    if (!lastOptionData) return;
    renderedWidth = container.clientWidth;
    chart.setOption(buildOption(lastOptionData, renderedWidth), {
      notMerge: true,
    });
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

  function areaAnimationDuration(
    filters: Filters,
    instant: boolean,
  ): number | undefined {
    if (instant) return 0;
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

  async function render({ instant }: RenderOptions): Promise<void> {
    const filters = store.get();
    setChartTitle(titleEl, ageCompositionChartTitle(filters, dimensions));
    const animationDuration = areaAnimationDuration(filters, instant);
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
    chart.resize();
    applyOption();

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
        ? {
            ...buildOption(lastOptionData, EXPORT_WIDTH, true),
            animation: false,
          }
        : {},
  });

  setupChartFullscreen(card, container);
  setupChartShare(card, store);

  subscribeWhenVisible(card, store, render);
}
