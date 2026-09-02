import { getCoverage } from "../access";
import {
  buildFilenameBase,
  EXPORT_WIDTH,
  roundTo,
  setupChartExport,
  type ChartExportRows,
} from "../chart-export";
import { setupChartFullscreen } from "../chart-fullscreen";
import { subscribeWhenVisible } from "../chart-visibility";
import { qualityChartTitle, setChartTitle } from "../chart-titles";
import { fetchBrazilStatesGeoJson, fetchCoverage } from "../data";
import { indexOf } from "../dimensions";
import type { EChartsCoreOption } from "../echarts-core";
import { echarts } from "../echarts-core";
import { formatRate } from "../format";
import { MAP_SCALE_STEPS, mapScaleSteps, themeColor } from "../palette";
import type { FiltersStore } from "../filters";
import { setupChartShare } from "../share";
import type { CoverageTable, Dimensions } from "../types";

const MAP_NAME = "brazil-states";
const MAX_COVERAGE = 100;
const EXPORT_SIZE = { width: EXPORT_WIDTH, height: 620 };
const SUBTITLE =
  "Estimativa de óbitos captados pelo SIM (indicador DEM.4.02/RIPSA)";

function clampCoverage(value: number | null): number | null {
  return value == null ? null : Math.min(value, MAX_COVERAGE);
}

function hasValue(value: number | null): value is number {
  return value != null && !Number.isNaN(value);
}

export function findLatestCoverageYear(
  dimensions: Dimensions,
  coverageTable: CoverageTable,
): number {
  for (
    let yearIndex = dimensions.years.length - 1;
    yearIndex >= 0;
    yearIndex--
  ) {
    for (const location of dimensions.locations) {
      const locationIndex = indexOf(dimensions.locations, location);
      if (getCoverage(coverageTable, locationIndex, yearIndex) != null)
        return dimensions.years[yearIndex] ?? Math.max(...dimensions.years);
    }
  }
  return Math.max(...dimensions.years);
}

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
  const stableScaleCheckbox = card.querySelector("#quality-scale-stable");

  let stableScale = true;
  let mapRegistered = false;
  let renderToken = 0;
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

  function computeDomainMin(
    table: CoverageTable,
    yearIndices: number[],
  ): number {
    let min = Infinity;
    for (const location of stateLocations) {
      const locationIndex = indexOf(dimensions.locations, location);
      for (const yearIndex of yearIndices) {
        const coverage = getCoverage(table, locationIndex, yearIndex);
        if (coverage == null) continue;
        if (coverage < min) min = coverage;
      }
    }
    return min === Infinity ? 0 : min;
  }

  interface QualityOptionData {
    data: { name: string; value: number | null }[];
    domainMin: number;
  }

  interface RoamState {
    center?: [number, number];
    zoom?: number;
  }

  let lastOptionData: QualityOptionData | null = null;

  function readRoamState(): RoamState {
    const option = chart.getOption();
    const series = option?.series;
    const first = Array.isArray(series) ? series[0] : undefined;
    if (!first || typeof first !== "object") return {};
    const { center, zoom } = first as { center?: unknown; zoom?: unknown };
    return {
      center:
        Array.isArray(center) && center.length === 2
          ? (center as [number, number])
          : undefined,
      zoom: typeof zoom === "number" ? zoom : undefined,
    };
  }

  function buildOption(
    optionData: QualityOptionData,
    roam: RoamState,
  ): EChartsCoreOption {
    const { data, domainMin } = optionData;
    return {
      tooltip: {
        formatter: (params: { name: string; value: number | null }) => {
          const { name, value } = params;
          const label = dimensions.location_names[name] ?? name;
          return hasValue(value)
            ? `${label}<br/>${formatRate(value)}% dos óbitos captados`
            : `${label}<br/>sem dado publicado`;
        },
      },
      visualMap: {
        min: domainMin,
        max: MAX_COVERAGE,
        type: "continuous",
        splitNumber: MAP_SCALE_STEPS,
        itemGap: 2,
        inRange: { color: mapScaleSteps() },
        orient: "horizontal",
        left: "left",
        bottom: 0,
        text: [`${formatRate(MAX_COVERAGE)}%`, `${formatRate(domainMin)}%`],
      },
      series: [
        {
          type: "map",
          map: MAP_NAME,
          aspectScale: 0.95,
          roam: true,
          scaleLimit: { min: 1, max: 8 },
          ...(roam.center ? { center: roam.center } : {}),
          ...(roam.zoom ? { zoom: roam.zoom } : {}),
          itemStyle: { borderColor: "#fff", borderWidth: 0.5 },
          emphasis: {
            itemStyle: {
              borderColor: themeColor("--color-primary-500"),
              borderWidth: 1.5,
            },
          },
          label: {
            show: true,
            formatter: (params: { value: number | null }) =>
              hasValue(params.value) ? `${formatRate(params.value)}%` : "—",
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
  }

  async function render(): Promise<void> {
    const token = ++renderToken;
    const filters = store.get();

    const [geoJson, coverageTable] = await Promise.all([
      fetchBrazilStatesGeoJson(),
      fetchCoverage(),
    ]);
    if (token !== renderToken) return;

    if (!mapRegistered) {
      echarts.registerMap(
        MAP_NAME,
        geoJson as Parameters<typeof echarts.registerMap>[1],
      );
      mapRegistered = true;
    }

    setChartTitle(titleEl, qualityChartTitle(filters));

    const yearIndex = indexOf(dimensions.years, filters.year);
    const yearIndicesForDomain = stableScale
      ? dimensions.years.map((_, i) => i)
      : [yearIndex];
    const domainMin = computeDomainMin(coverageTable, yearIndicesForDomain);

    const data = stateLocations.map((location) => {
      const locationIndex = indexOf(dimensions.locations, location);
      return {
        name: location,
        value: clampCoverage(
          getCoverage(coverageTable, locationIndex, yearIndex),
        ),
      };
    });

    const dataHasValues = data.some((entry) => hasValue(entry.value));
    if (subtitleEl)
      subtitleEl.textContent = dataHasValues
        ? SUBTITLE
        : "Cobertura ainda não publicada para este ano";

    lastOptionData = { data, domainMin };
    chart.setOption(buildOption(lastOptionData, {}), { notMerge: true });

    exportRows = {
      headers: ["UF", "Território", "Cobertura do SIM (%)"],
      rows: data.map((entry) => [
        entry.name,
        dimensions.location_names[entry.name] ?? entry.name,
        hasValue(entry.value) ? roundTo(entry.value, 1) : "",
      ]),
    };
  }

  setupChartExport(card, EXPORT_SIZE, {
    getFilenameBase: () => buildFilenameBase("cobertura-sim", store.get()),
    getRows: () => exportRows,
    getExportOption: () =>
      lastOptionData
        ? {
            ...buildOption(lastOptionData, readRoamState()),
            animation: false,
          }
        : {},
  });

  setupChartFullscreen(card, container);
  setupChartShare(card, store);

  subscribeWhenVisible(card, store, render);
}
