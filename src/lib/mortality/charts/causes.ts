import {
  getAssaultMeansEntry,
  getCauseGroupEntry,
  getDetailedSubgroupEntry,
  getExternalCauseEntry,
} from "../access";
import {
  buildFilenameBase,
  EXPORT_WIDTH,
  roundTo,
  setupChartExport,
  type ChartExportRows,
} from "../chart-export";
import { setupChartFullscreen } from "../chart-fullscreen";
import { subscribeWhenVisible } from "../chart-visibility";
import { causesChartTitle, setChartTitle } from "../chart-titles";
import { causeGroupsForDetail, indexOf } from "../dimensions";
import {
  fetchDeathsByAssaultMeansForLocation,
  fetchDeathsByCauseGroupForLocation,
  fetchDeathsByDetailedSubgroupForLocation,
  fetchDeathsByExternalCauseForLocation,
} from "../data";
import type { ECElementEvent, EChartsCoreOption } from "../echarts-core";
import { echarts } from "../echarts-core";
import { causeGroupColor } from "../palette";
import { formatInteger, formatPercent, formatRate } from "../format";
import {
  isManualYearOnlyChange,
  isYearOnlyChange,
  type FiltersStore,
} from "../filters";
import { setupChartShare } from "../share";
import type { CauseFilter, Dimensions, Filters } from "../types";

const EXPORT_CHART_HEIGHT = 480;
const EXPORT_LEGEND_GAP = 16;
const EXPORT_LEGEND_HEIGHT = 160;
const EXPORT_SIZE = {
  width: EXPORT_WIDTH,
  height: EXPORT_CHART_HEIGHT + EXPORT_LEGEND_HEIGHT,
};
const NORMAL_TREEMAP_DURATION = 900;
const FAST_TREEMAP_DURATION = 200;
const PLAYBACK_ANIMATION_BUFFER_MS = 80;

interface CauseNode {
  id: string;
  name: string;
  value: number;
  stdRate: number;
  percent: number;
  itemStyle?: { color: string };
  children?: CauseNode[];
}

function withPercent(nodes: Omit<CauseNode, "id" | "percent">[]): CauseNode[] {
  const total = nodes.reduce((sum, node) => sum + node.value, 0);
  return nodes.map((node) => ({
    ...node,
    id: node.name,
    percent: total > 0 ? (node.value / total) * 100 : 0,
  }));
}

function causePath(filters: CauseFilter): string[] {
  return [
    filters.causeGroup,
    filters.externalCauseType ?? filters.detailedSubgroup,
    filters.assaultMeans,
  ].filter((value): value is string => value != null);
}

function findDisplayNodes(level1: CauseNode[], path: string[]): CauseNode[] {
  let nodes = level1;
  let node: CauseNode | undefined;
  for (const name of path) {
    node = nodes.find((candidate) => candidate.name === name);
    if (!node) return level1;
    nodes = node.children ?? [];
  }
  if (path.length === 0) return level1;
  return node && node.children && node.children.length > 0
    ? node.children
    : node
      ? [node]
      : level1;
}

interface TreePathEntry {
  name: string;
}

function isTreePathInfo(value: unknown): value is TreePathEntry[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as { name?: unknown }).name === "string",
    )
  );
}

function applyCauseSelection(store: FiltersStore, names: string[]): void {
  const [causeGroup, subLevel, assaultMeans] = names;
  if (!causeGroup) {
    store.setCauseGroup(null);
    return;
  }
  if (causeGroup === "Causas externas") {
    store.setCauseSelection({
      causeGroup,
      externalCauseType: subLevel,
      assaultMeans,
    });
  } else {
    store.setCauseSelection({ causeGroup, detailedSubgroup: subLevel });
  }
}

function createBreadcrumb(container: HTMLElement): HTMLElement {
  const breadcrumb = document.createElement("div");
  breadcrumb.className =
    "flex flex-wrap items-center justify-center gap-2 text-xs";
  container.insertAdjacentElement("afterend", breadcrumb);
  return breadcrumb;
}

function renderBreadcrumb(
  breadcrumb: HTMLElement,
  store: FiltersStore,
  path: string[],
): void {
  const crumbs: HTMLElement[] = [];
  for (let depth = 0; depth <= path.length; depth++) {
    const isCurrent = depth === path.length;
    const label = depth === 0 ? "Todas as causas" : path[depth - 1];

    if (isCurrent) {
      const span = document.createElement("span");
      span.textContent = label;
      span.setAttribute("aria-current", "true");
      span.className =
        "rounded-full bg-primary-100 px-3 py-1 font-medium text-primary-700";
      crumbs.push(span);
      continue;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.className =
      "cursor-pointer rounded-full bg-gray-100 px-3 py-1 text-gray-600 hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500";
    button.addEventListener("click", () => {
      applyCauseSelection(store, path.slice(0, depth));
    });
    crumbs.push(button);
  }
  breadcrumb.replaceChildren(...crumbs);
}

function flattenCauseNodes(
  nodes: CauseNode[],
  parents: string[] = [],
): { levels: string[]; deaths: number; percent: number; stdRate: number }[] {
  return nodes.flatMap((node) => {
    const levels = [...parents, node.name];
    const row = {
      levels,
      deaths: node.value,
      percent: node.percent,
      stdRate: node.stdRate,
    };
    return node.children
      ? [row, ...flattenCauseNodes(node.children, levels)]
      : [row];
  });
}

export function init(
  container: HTMLElement,
  store: FiltersStore,
  dimensions: Dimensions,
): void {
  const chart = echarts.init(container);
  new ResizeObserver(() => chart.resize()).observe(container);
  const breadcrumb = createBreadcrumb(container);

  chart.on("click", (params: ECElementEvent) => {
    const treePathInfo: unknown = params.treePathInfo;
    if (!isTreePathInfo(treePathInfo)) return;
    const clickedNames = treePathInfo.slice(1).map((entry) => entry.name);
    if (clickedNames.length === 0) return;
    const currentPath = causePath(store.get());
    applyCauseSelection(store, [...currentPath, ...clickedNames]);
  });

  const card = container.closest(".chart-card") ?? document;
  const titleEl = card.querySelector("[data-chart-title]");
  let dataKey = "";
  let cachedLevel1: CauseNode[] | null = null;
  let previousFilters: Filters | null = null;
  let exportRows: ChartExportRows = { headers: [], rows: [] };

  async function fetchLevel1(filters: Filters): Promise<CauseNode[]> {
    const sexIndex = indexOf(dimensions.sexes, filters.sex);
    const yearIndex = indexOf(dimensions.years, filters.year);

    const [
      causeGroupTable,
      detailedSubgroupTable,
      externalTable,
      assaultTable,
    ] = await Promise.all([
      fetchDeathsByCauseGroupForLocation(filters.location),
      fetchDeathsByDetailedSubgroupForLocation(filters.location),
      fetchDeathsByExternalCauseForLocation(filters.location),
      fetchDeathsByAssaultMeansForLocation(filters.location),
    ]);

    return withPercent(
      dimensions.cause_groups
        .map((causeGroup, causeGroupIndex) => {
          const [deaths, stdRate] = getCauseGroupEntry(
            causeGroupTable,
            sexIndex,
            yearIndex,
            causeGroupIndex,
          );
          const color = causeGroupColor(causeGroupIndex);

          const detailIndices = causeGroupsForDetail(
            dimensions,
            causeGroupIndex,
          );
          let children: CauseNode[] | undefined;

          if (detailIndices.length > 0) {
            children = withPercent(
              detailIndices
                .map((detailIndex) => {
                  const [subDeaths, , subStdRate] = getDetailedSubgroupEntry(
                    detailedSubgroupTable,
                    sexIndex,
                    yearIndex,
                    detailIndex,
                  );
                  return {
                    name: dimensions.detailed_subgroups[detailIndex],
                    value: subDeaths,
                    stdRate: subStdRate,
                    itemStyle: { color },
                  };
                })
                .filter((node) => node.value > 0),
            );
          } else if (causeGroup === "Causas externas") {
            children = withPercent(
              dimensions.external_cause_types
                .map((externalCauseType, externalIndex) => {
                  const [extDeaths, , extStdRate] = getExternalCauseEntry(
                    externalTable,
                    sexIndex,
                    yearIndex,
                    externalIndex,
                  );
                  const node: Omit<CauseNode, "id" | "percent"> = {
                    name: externalCauseType,
                    value: extDeaths,
                    stdRate: extStdRate,
                    itemStyle: { color },
                  };
                  if (externalCauseType === "Agressão") {
                    const assaultChildren = withPercent(
                      dimensions.assault_means
                        .map((means, meansIndex) => {
                          const [meansDeaths, , meansStdRate] =
                            getAssaultMeansEntry(
                              assaultTable,
                              sexIndex,
                              yearIndex,
                              meansIndex,
                            );
                          return {
                            name: means,
                            value: meansDeaths,
                            stdRate: meansStdRate,
                            itemStyle: { color },
                          };
                        })
                        .filter((child) => child.value > 0),
                    );
                    if (assaultChildren.length > 0)
                      return { ...node, children: assaultChildren };
                  }
                  return node;
                })
                .filter((node) => node.value > 0),
            );
          }

          return {
            name: causeGroup,
            value: deaths,
            stdRate,
            itemStyle: { color },
            children,
          };
        })
        .filter((node) => node.value > 0),
    );
  }

  function treemapLabelFormatter(params: {
    name: string;
    data: CauseNode;
  }): string {
    return `${params.name}\n${formatPercent((params.data.percent ?? 0) / 100)}`;
  }

  function buildTreemapSeries(displayNodes: CauseNode[], bottom: number) {
    return {
      name: "Todas as causas",
      type: "treemap" as const,
      top: 8,
      bottom,
      roam: false,
      nodeClick: false as const,
      leafDepth: 1,
      breadcrumb: { show: false },
      upperLabel: { show: true, height: 24, color: "#fff" },
      label: { formatter: treemapLabelFormatter },
      itemStyle: { borderColor: "#fff", gapWidth: 3 },
      levels: [
        {},
        { itemStyle: { borderColorSaturation: 0.4, gapWidth: 5 } },
        { colorSaturation: [0.3, 0.6], itemStyle: { gapWidth: 3 } },
      ],
      data: displayNodes,
    };
  }

  function treemapTooltip(): EChartsCoreOption["tooltip"] {
    return {
      formatter: (params: { data: CauseNode }) => {
        const node = params.data;
        const stats = [`${formatInteger(node.value)} óbitos`];
        if (Number.isFinite(node.percent))
          stats.push(`${formatPercent(node.percent / 100)} do nível`);
        if (Number.isFinite(node.stdRate))
          stats.push(
            `Taxa padronizada ${formatRate(node.stdRate)} por 100 mil hab.`,
          );
        return `${node.name}<br/>${stats.join(" · ")}`;
      },
    };
  }

  function legendLabel(node: CauseNode): string {
    return `${node.name} (${formatPercent((node.percent ?? 0) / 100)})`;
  }

  function buildExportOption(
    filters: Filters,
    level1: CauseNode[],
  ): EChartsCoreOption {
    const displayNodes = findDisplayNodes(level1, causePath(filters)).map(
      (node) => ({ ...node, children: undefined }),
    );

    const legendReferenceSeries = {
      name: "legend-reference",
      type: "pie" as const,
      radius: 0,
      center: ["-100%", "-100%"],
      silent: true,
      animation: false,
      label: { show: false },
      tooltip: { show: false },
      data: displayNodes.map((node) => ({
        name: legendLabel(node),
        value: 1,
        itemStyle: { color: node.itemStyle?.color ?? "#999" },
      })),
    };

    return {
      animation: false,
      tooltip: treemapTooltip(),
      legend: {
        show: true,
        top: EXPORT_CHART_HEIGHT + EXPORT_LEGEND_GAP,
        left: "center",
        itemWidth: 12,
        itemHeight: 12,
        itemGap: 12,
        selectedMode: false,
        textStyle: { fontSize: 11 },
        data: displayNodes.map(legendLabel),
      },
      series: [
        buildTreemapSeries(displayNodes, EXPORT_LEGEND_HEIGHT),
        legendReferenceSeries,
      ],
    };
  }

  function applyOption(
    filters: Filters,
    level1: CauseNode[],
    animationDurationUpdate: number,
  ): void {
    const path = causePath(filters);
    const displayNodes = findDisplayNodes(level1, path);
    renderBreadcrumb(breadcrumb, store, path);

    chart.setOption(
      {
        tooltip: treemapTooltip(),
        series: [
          {
            ...buildTreemapSeries(displayNodes, 0),
            animationDurationUpdate,
          },
        ],
      },
      { notMerge: true },
    );

    exportRows = {
      headers: [
        "Grupo de causa",
        "Subcategoria",
        "Detalhe",
        "Óbitos",
        "% do nível",
        "Taxa padronizada (por 100 mil hab.)",
      ],
      rows: flattenCauseNodes(level1).map((row) => [
        row.levels[0] ?? "",
        row.levels[1] ?? "",
        row.levels[2] ?? "",
        Math.round(row.deaths),
        roundTo(row.percent, 1),
        roundTo(row.stdRate, 1),
      ]),
    };
  }

  function treemapAnimationDuration(filters: Filters): number {
    const origin = store.getLastYearOrigin();
    if (isManualYearOnlyChange(origin, previousFilters, filters))
      return FAST_TREEMAP_DURATION;

    if (origin === "playback" && isYearOnlyChange(previousFilters, filters)) {
      const intervalMs = store.getLastYearIntervalMs();
      if (intervalMs !== null)
        return Math.min(
          NORMAL_TREEMAP_DURATION,
          Math.max(
            FAST_TREEMAP_DURATION,
            intervalMs - PLAYBACK_ANIMATION_BUFFER_MS,
          ),
        );
    }

    return NORMAL_TREEMAP_DURATION;
  }

  async function render(): Promise<void> {
    const filters = store.get();
    const animationDurationUpdate = treemapAnimationDuration(filters);
    previousFilters = filters;

    setChartTitle(titleEl, causesChartTitle(filters, dimensions));

    const key = `${filters.location}|${filters.sex}|${filters.year}`;
    if (key !== dataKey) {
      dataKey = key;
      const level1 = await fetchLevel1(filters);
      if (key !== dataKey) return;
      cachedLevel1 = level1;
    }
    if (!cachedLevel1) return;

    chart.resize();
    applyOption(filters, cachedLevel1, animationDurationUpdate);
  }

  setupChartExport(card, EXPORT_SIZE, {
    getFilenameBase: () => buildFilenameBase("causas", store.get()),
    getRows: () => exportRows,
    getExportOption: () => buildExportOption(store.get(), cachedLevel1 ?? []),
  });

  setupChartFullscreen(card, container);
  setupChartShare(card, store);

  subscribeWhenVisible(card, store, () => render());
}
