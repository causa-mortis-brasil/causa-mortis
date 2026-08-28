import { loadRatePointGetter, resolveCauseLevel } from "../cause-level";
import {
  buildFilenameBase,
  buildFilterContext,
  roundTo,
  setupChartExport,
  type ChartExportRows,
} from "../chart-export";
import { causePathLabel, locationLabel, sexLabel } from "../chart-titles";
import { fetchBrazilStatesGeoJson } from "../data";
import { indexOf } from "../dimensions";
import type { EChartsCoreOption } from "../echarts-core";
import { echarts } from "../echarts-core";
import { formatRate } from "../format";
import { createPillToggle } from "../pill-toggle";
import { MAP_SCALE_STEPS, mapScaleSteps, themeColor } from "../palette";
import type { FiltersStore } from "../filters";
import type { Dimensions } from "../types";

const MAP_NAME = "brazil-states";

type ScaleType = "stepped" | "continuous";

export function init(
  container: HTMLElement,
  store: FiltersStore,
  dimensions: Dimensions,
): void {
  const chart = echarts.init(container);
  new ResizeObserver(() => chart.resize()).observe(container);

  const card = container.closest(".chart-card") ?? document;
  const context = card.querySelector("[data-chart-context]");
  const stableScaleCheckbox = card.querySelector("#map-scale-stable");
  const scaleTypeWrap = card.querySelector("#map-scale-type");

  let scaleType: ScaleType = "continuous";
  let stableScale = true;
  let mapRegistered = false;
  let renderToken = 0;
  let exportRows: ChartExportRows = { headers: [], rows: [] };

  if (scaleTypeWrap) {
    createPillToggle(
      scaleTypeWrap,
      "map-scale-type",
      [
        { value: "stepped", label: "Em etapas" },
        { value: "continuous", label: "Contínuo" },
      ],
      scaleType,
      (value) => {
        scaleType = value as ScaleType;
        void render();
      },
    );
  }

  if (stableScaleCheckbox instanceof HTMLInputElement) {
    stableScaleCheckbox.addEventListener("change", () => {
      stableScale = stableScaleCheckbox.checked;
      void render();
    });
  }

  const stateLocations = dimensions.locations.filter(
    (location) => location !== "BR",
  );

  async function render(): Promise<void> {
    const token = ++renderToken;
    const filters = store.get();
    const level = resolveCauseLevel(filters);

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

    if (context) {
      context.textContent = `${causePathLabel(filters)} · ${sexLabel(filters.sex)} · ${locationLabel(dimensions, filters.location)} · ${filters.year}`;
    }

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

    const option: EChartsCoreOption = {
      tooltip: {
        formatter: (params: { name: string; value: number }) => {
          const { name, value } = params;
          return `${dimensions.location_names[name] ?? name}<br/>${formatRate(value)} por 100 mil hab. (padronizada)`;
        },
      },
      visualMap: {
        min,
        max,
        type: scaleType === "stepped" ? "piecewise" : "continuous",
        splitNumber: MAP_SCALE_STEPS,
        itemGap: 2,
        inRange: { color: mapScaleSteps() },
        orient: "horizontal",
        left: "left",
        bottom: 0,
        text: [formatRate(max), formatRate(min)],
      },
      series: [
        {
          type: "map",
          map: MAP_NAME,
          aspectScale: 0.95,
          roam: true,
          scaleLimit: { min: 1, max: 8 },
          selectedMode: "single",
          select:
            filters.location !== "BR"
              ? {
                  itemStyle: {
                    borderColor: themeColor("--color-primary-500"),
                    borderWidth: 2,
                  },
                }
              : undefined,
          selected:
            filters.location !== "BR"
              ? { [filters.location]: true }
              : undefined,
          itemStyle: { borderColor: "#fff", borderWidth: 0.5 },
          emphasis: {
            itemStyle: {
              borderColor: themeColor("--color-primary-500"),
              borderWidth: 1.5,
            },
          },
          label: {
            show: true,
            formatter: (params: { value: number }) => formatRate(params.value),
            fontSize: 10,
            fontWeight: 600,
            color: "#fff",
            textBorderColor: "rgba(0, 0, 0, 0.35)",
            textBorderWidth: 2,
          },
          data,
        },
      ],
    };

    chart.setOption(option, { notMerge: true });

    exportRows = {
      headers: ["UF", "Território", "Taxa padronizada (por 100 mil hab.)"],
      rows: data.map((entry) => [
        entry.name,
        dimensions.location_names[entry.name] ?? entry.name,
        roundTo(entry.value, 1),
      ]),
    };
  }

  chart.on("click", (params) => {
    if (params.componentType === "series" && typeof params.name === "string") {
      store.setLocation(params.name);
    }
  });

  setupChartExport(card, chart, {
    getFilenameBase: () => buildFilenameBase("mapa", store.get()),
    getContext: () => buildFilterContext(dimensions, store.get()),
    getRows: () => exportRows,
  });

  store.subscribe(() => void render());
}
