import { getCauseGroupAgeSeries } from "../access";
import { ageCompositionChartTitle } from "../chart-titles";
import {
  buildFilenameBase,
  roundTo,
  setupChartExport,
  wrapText,
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

const EXPORT_SIZE = { width: 980, height: 560 };
const MIN_ANNUAL_DEATHS_TO_INCLUDE = 20;
const LABEL_FONT_SIZE = 10;
const LABEL_FONT_WEIGHT = 600;
const LABEL_LINE_HEIGHT = 12;
const LABEL_PADDING_Y = 4;
const LABEL_LINE_STUB = 8;
const LABEL_LINE_DY_THRESHOLD = 2;

const labelMeasureContext = document.createElement("canvas").getContext("2d");

function measureLabelHeight(
  text: string,
  maxWidth: number,
  fontFamily: string,
): number {
  if (!labelMeasureContext) return LABEL_LINE_HEIGHT + LABEL_PADDING_Y * 2;
  labelMeasureContext.font = `${LABEL_FONT_WEIGHT} ${LABEL_FONT_SIZE}px ${fontFamily}`;
  const lineCount = wrapText(labelMeasureContext, text, maxWidth).length;
  return lineCount * LABEL_LINE_HEIGHT + LABEL_PADDING_Y * 2;
}

function measureLongestWordWidth(words: string[], fontFamily: string): number {
  if (!labelMeasureContext) return 0;
  labelMeasureContext.font = `${LABEL_FONT_WEIGHT} ${LABEL_FONT_SIZE}px ${fontFamily}`;
  return words.reduce(
    (max, word) => Math.max(max, labelMeasureContext.measureText(word).width),
    0,
  );
}

interface LabelOffset {
  anchorY: number;
  dy: number;
}

function declutterLabelPositions(
  naturalPositions: number[],
  minGaps: number[],
  minY: number,
  maxY: number,
): number[] {
  const positions = [...naturalPositions];
  for (let i = 1; i < positions.length; i++) {
    positions[i] = Math.max(
      positions[i] ?? 0,
      (positions[i - 1] ?? 0) + (minGaps[i - 1] ?? 0),
    );
  }
  const lastIndex = positions.length - 1;
  if (lastIndex >= 0 && (positions[lastIndex] ?? 0) > maxY) {
    positions[lastIndex] = maxY;
    for (let i = lastIndex - 1; i >= 0; i--) {
      positions[i] = Math.min(
        positions[i] ?? 0,
        (positions[i + 1] ?? 0) - (minGaps[i] ?? 0),
      );
    }
  }
  if ((positions[0] ?? 0) < minY) {
    positions[0] = minY;
    for (let i = 1; i < positions.length; i++) {
      positions[i] = Math.max(
        positions[i] ?? 0,
        (positions[i - 1] ?? 0) + (minGaps[i - 1] ?? 0),
      );
    }
  }
  return positions;
}

export function init(
  container: HTMLElement,
  store: FiltersStore,
  dimensions: Dimensions,
): void {
  const chart = echarts.init(container);
  let updateLabelConnectors = (): void => {};
  new ResizeObserver(() => {
    chart.resize();
    updateLabelConnectors();
  }).observe(container);

  const card = container.closest(".chart-card") ?? document;
  const titleEl = card.querySelector("[data-chart-title]");
  let exportRows: ChartExportRows = { headers: [], rows: [] };
  let seriesOrder: string[] = [];
  let sharesByAge: number[][] = [];
  let forceWideLayout = false;
  let previousFilters: Filters | null = null;

  const fontFamily = getComputedStyle(document.body).fontFamily;
  const longestLabelWordWidth = measureLongestWordWidth(
    dimensions.cause_groups.flatMap((name) => name.split(" ")),
    fontFamily,
  );

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
    const baseRightMargin = forceWideLayout ? 240 : isNarrow ? 96 : 132;
    const labelWidth = Math.max(
      baseRightMargin - 16,
      Math.ceil(longestLabelWordWidth) + 4,
    );
    const rightMargin = labelWidth + 16;
    const gridTop = 16;
    const gridBottom = isNarrow ? 40 : 48;
    const lastAgeIndex = dimensions.age_groups.length - 1;

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

    let cumulativeShareAtEnd = 0;
    const cumulativeShareAtEndByStackIndex = stackedSeriesData.map(
      ({ shares }) => {
        cumulativeShareAtEnd += shares[lastAgeIndex] ?? 0;
        return cumulativeShareAtEnd;
      },
    );

    function computeLabelOffsets(): Map<number, LabelOffset> {
      const offsets = new Map<number, LabelOffset>();
      const plotHeight = chart.getHeight() - gridTop - gridBottom;
      const pixelYForShare = (share: number) =>
        gridTop + (1 - share) * plotHeight;

      const visibleStackIndices = stackedSeriesData
        .map((_, index) => index)
        .filter((index) => stackedSeriesData[index]?.isHighlighted);

      const naturalY = new Map<number, number>();
      for (const index of visibleStackIndices) {
        naturalY.set(
          index,
          pixelYForShare(cumulativeShareAtEndByStackIndex[index] ?? 0),
        );
      }

      const orderedIndices = [...visibleStackIndices].sort(
        (a, b) => (naturalY.get(a) ?? 0) - (naturalY.get(b) ?? 0),
      );
      if (orderedIndices.length === 0) return offsets;

      const heights = orderedIndices.map((index) =>
        measureLabelHeight(
          stackedSeriesData[index]?.causeGroup ?? "",
          labelWidth,
          fontFamily,
        ),
      );
      const gaps = heights
        .slice(1)
        .map((height, i) => (height + (heights[i] ?? 0)) / 2);

      const declutteredY = declutterLabelPositions(
        orderedIndices.map((index) => naturalY.get(index) ?? 0),
        gaps,
        gridTop + (heights[0] ?? 0) / 2,
        gridTop + plotHeight - (heights[heights.length - 1] ?? 0) / 2,
      );

      orderedIndices.forEach((index, position) => {
        const anchorY = naturalY.get(index) ?? 0;
        offsets.set(index, {
          anchorY,
          dy: (declutteredY[position] ?? 0) - anchorY,
        });
      });

      return offsets;
    }

    function buildLabelConnectors(
      offsets: Map<number, LabelOffset>,
    ): NonNullable<EChartsCoreOption["graphic"]> {
      const anchorX = chart.getWidth() - rightMargin;

      return {
        elements: stackedSeriesData.map(({ causeGroupIndex }, stackIndex) => {
          const offset = offsets.get(stackIndex);
          const isVisible =
            !!offset && Math.abs(offset.dy) > LABEL_LINE_DY_THRESHOLD;

          return {
            id: `label-connector-${stackIndex}`,
            type: "polyline",
            silent: true,
            invisible: !isVisible,
            shape: {
              points: isVisible
                ? [
                    [anchorX, offset.anchorY],
                    [anchorX + LABEL_LINE_STUB, offset.anchorY],
                    [anchorX + LABEL_LINE_STUB, offset.anchorY + offset.dy],
                  ]
                : [],
            },
            style: {
              stroke: causeGroupColor(causeGroupIndex),
              lineWidth: 1,
              opacity: 0.5,
            },
          };
        }),
      };
    }

    const labelOffsets = computeLabelOffsets();

    const series = stackedSeriesData.map(
      ({ causeGroupIndex, causeGroup, isHighlighted, shares }, stackIndex) => {
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
            overflow: "break" as const,
            lineHeight: LABEL_LINE_HEIGHT,
            padding: [LABEL_PADDING_Y, 0] as [number, number],
          },
          labelLayout: { dy: labelOffsets.get(stackIndex)?.dy ?? 0 },
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
      graphic: buildLabelConnectors(labelOffsets),
    };

    chart.setOption(option, { notMerge: true });
    updateLabelConnectors = () => {
      const offsets = computeLabelOffsets();
      chart.setOption({
        series: stackedSeriesData.map((_, stackIndex) => ({
          labelLayout: { dy: offsets.get(stackIndex)?.dy ?? 0 },
        })),
        graphic: buildLabelConnectors(offsets),
      });
    };

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
