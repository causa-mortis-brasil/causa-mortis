import { loadRatePointGetter, resolveCauseLevel } from "../cause-level";
import {
  buildFilenameBase,
  EXPORT_WIDTH,
  roundTo,
  setupChartExport,
  type ChartExportRows,
} from "../chart-export";
import { setupChartFullscreen } from "../chart-fullscreen";
import { subscribeWhenVisible } from "../chart-visibility";
import { mapChartTitle, setChartTitle } from "../chart-titles";
import { fetchBrazilStatesGeoJson } from "../data";
import { indexOf } from "../dimensions";
import { MapChart } from "echarts/charts";
import { TooltipComponent, VisualMapComponent } from "echarts/components";
import type {
  CallbackDataParams,
  EChartsOption,
  TopLevelFormatterParams,
} from "../echarts-core";
import { echarts } from "../echarts-core";
import { formatRate, formatRateLabel } from "../format";
import {
  MAP_SCALE_STEPS,
  chartSurfaceColor,
  mapLabelStyle,
  mapScaleSteps,
  themeColor,
  tooltipStyle,
} from "../palette";
import { isManualYearOnlyChange, type FiltersStore } from "../filters";
import { setupChartShare } from "../share";
import type { Dimensions, Filters } from "../types";

echarts.use([MapChart, TooltipComponent, VisualMapComponent]);

const MAP_NAME = "brazil-states";
const EXPORT_SIZE = { width: EXPORT_WIDTH, height: 620 };

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
  const stableScaleCheckbox = card.querySelector("#map-scale-stable");

  if (subtitleEl)
    subtitleEl.textContent = "Taxa/100 mil habitantes (padronizada por idade)";

  let stableScale = false;
  let mapRegistered = false;
  let renderToken = 0;
  let previousFilters: Filters | null = null;
  let exportRows: ChartExportRows = { headers: [], rows: [] };

  if (stableScaleCheckbox instanceof HTMLInputElement) {
    stableScaleCheckbox.addEventListener("change", () => {
      stableScale = stableScaleCheckbox.checked;
      void render();
    });
  }

  const stateLocations = dimensions.locations.filter(
    (location) => location !== "BR",
  );

  interface MapOptionData {
    data: { name: string; value: number }[];
    min: number;
    max: number;
  }

  let lastOptionData: MapOptionData | null = null;

  function buildOption(
    optionData: MapOptionData,
    useFastAnimation: boolean,
    forceLight = false,
  ): EChartsOption {
    const { data, min, max } = optionData;
    const seriesData = data.map((entry) => {
      const label = mapLabelStyle((entry.value - min) / (max - min));
      return { ...entry, label, emphasis: { label }, select: { label } };
    });
    return {
      tooltip: {
        formatter: (raw: TopLevelFormatterParams) => {
          const params = Array.isArray(raw) ? raw[0] : raw;
          if (!params) return "";
          const { name } = params;
          const value = Number(params.value);
          return `${dimensions.location_names[name] ?? name}<br/>${formatRate(value)} por 100 mil hab. (padronizada por idade)`;
        },
        ...tooltipStyle(),
      },
      visualMap: {
        min,
        max,
        type: "continuous",
        splitNumber: MAP_SCALE_STEPS,
        itemGap: 2,
        inRange: { color: mapScaleSteps("rate", { forceLight }) },
        orient: "horizontal",
        left: "left",
        bottom: 0,
        text: [formatRate(max), formatRate(min)],
        textStyle: { color: themeColor("--color-gray-600", { forceLight }) },
      },
      series: [
        {
          type: "map",
          map: MAP_NAME,
          aspectScale: 0.95,
          layoutCenter: ["50%", "46%"],
          layoutSize: "88%",
          roam: false,
          ...(useFastAnimation ? { animationDurationUpdate: 200 } : {}),
          itemStyle: {
            borderColor: chartSurfaceColor({ forceLight }),
            borderWidth: 0.5,
          },
          emphasis: {
            itemStyle: {
              borderColor: themeColor("--color-rate-500", { forceLight }),
              borderWidth: 1.5,
            },
          },
          label: {
            show: true,
            formatter: (params: CallbackDataParams) =>
              formatRateLabel(Number(params.value)),
            fontSize: 10,
            fontWeight: 600,
            textBorderWidth: 2,
          },
          data: seriesData,
        },
      ],
    };
  }

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

    const geoJson = await fetchBrazilStatesGeoJson();
    if (!mapRegistered) {
      echarts.registerMap(
        MAP_NAME,
        geoJson as Parameters<typeof echarts.registerMap>[1],
      );
      mapRegistered = true;
    }

    const pointGetter = await loadRatePointGetter(level, dimensions);
    if (token !== renderToken) return;

    setChartTitle(titleEl, mapChartTitle(filters, dimensions));

    const sexIndex = indexOf(dimensions.sexes, filters.sex);
    const yearIndex = indexOf(dimensions.years, filters.year);
    const yearIndicesForDomain = stableScale
      ? dimensions.years.map((_, i) => i)
      : [yearIndex];

    let min = Infinity;
    let max = -Infinity;
    for (const location of stateLocations) {
      const locationIndex = indexOf(dimensions.locations, location);
      for (const yi of yearIndicesForDomain) {
        const rate = pointGetter(locationIndex, sexIndex, yi).stdRate;
        if (rate < min) min = rate;
        if (rate > max) max = rate;
      }
    }
    if (min === max) max = min + 1;

    const data = stateLocations.map((location) => {
      const locationIndex = indexOf(dimensions.locations, location);
      return {
        name: location,
        value: pointGetter(locationIndex, sexIndex, yearIndex).stdRate,
      };
    });

    lastOptionData = { data, min, max };
    chart.resize();
    chart.setOption(buildOption(lastOptionData, useFastAnimation), {
      notMerge: true,
    });

    exportRows = {
      headers: ["UF", "Território", "Taxa padronizada (por 100 mil hab.)"],
      rows: data.map((entry) => [
        entry.name,
        dimensions.location_names[entry.name] ?? entry.name,
        roundTo(entry.value, 1),
      ]),
    };
  }

  setupChartExport(card, EXPORT_SIZE, {
    getFilenameBase: () => buildFilenameBase("mapa", store.get()),
    getRows: () => exportRows,
    getExportOption: () =>
      lastOptionData
        ? {
            ...buildOption(lastOptionData, false, true),
            animation: false,
          }
        : {},
  });

  setupChartFullscreen(card, container);
  setupChartShare(card, store);

  subscribeWhenVisible(card, store, render);
}
