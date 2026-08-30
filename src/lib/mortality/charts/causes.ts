import {
  getAssaultMeansEntry,
  getCauseGroupEntry,
  getDetailedSubgroupEntry,
  getExternalCauseEntry,
} from "../access";
import {
  buildFilenameBase,
  buildFilterContext,
  roundTo,
  setupChartExport,
  type ChartExportRows,
} from "../chart-export";
import { setupChartFullscreen } from "../chart-fullscreen";
import { subscribeWhenVisible } from "../chart-visibility";
import { causesChartTitle } from "../chart-titles";
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
import type { FiltersStore } from "../filters";
import type { CauseFilter, Dimensions } from "../types";

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

function targetNodeId(filters: CauseFilter): string | null {
  return (
    filters.assaultMeans ??
    filters.externalCauseType ??
    filters.detailedSubgroup ??
    filters.causeGroup
  );
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
  store.setCauseGroup(causeGroup);
  if (causeGroup === "Causas externas") {
    if (subLevel) store.setExternalCauseType(subLevel);
    if (assaultMeans) store.setAssaultMeans(assaultMeans);
  } else if (subLevel) {
    store.setDetailedSubgroup(subLevel);
  }
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

  let lastCauseKey = "";
  let currentOption: EChartsCoreOption | null = null;

  function syncZoom(filters: CauseFilter): void {
    const target = targetNodeId(filters);
    const key = target ?? "";
    if (key === lastCauseKey) return;
    lastCauseKey = key;
    if (target) {
      chart.dispatchAction({ type: "treemapRootToNode", targetNode: target });
    } else if (currentOption) {
      chart.setOption(currentOption, { notMerge: true });
    }
  }

  chart.on("click", (params: ECElementEvent) => {
    const treePathInfo: unknown = params.treePathInfo;
    if (!isTreePathInfo(treePathInfo)) return;
    const names = treePathInfo.slice(1).map((entry) => entry.name);
    lastCauseKey = names[names.length - 1] ?? "";
    applyCauseSelection(store, names);
  });

  const card = container.closest(".chart-card") ?? document;
  const titleEl = card.querySelector("[data-chart-title]");
  let renderKey = "";
  let exportRows: ChartExportRows = { headers: [], rows: [] };

  async function render(): Promise<void> {
    const filters = store.get();

    if (titleEl) titleEl.textContent = causesChartTitle(filters, dimensions);

    const key = `${filters.location}|${filters.sex}|${filters.year}`;
    if (key === renderKey) return;
    renderKey = key;

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
    if (key !== renderKey) return;

    const level1 = withPercent(
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

    const option: EChartsCoreOption = {
      tooltip: {
        formatter: (params: { data: CauseNode }) => {
          const node = params.data;
          return `${node.name}<br/>${formatInteger(node.value)} óbitos · ${formatPercent(node.percent / 100)} do nível · taxa padronizada ${formatRate(node.stdRate)}`;
        },
      },
      series: [
        {
          name: "Todas as causas",
          type: "treemap",
          top: 8,
          roam: false,
          nodeClick: "zoomToNode",
          leafDepth: 1,
          breadcrumb: { show: true, height: 24 },
          upperLabel: { show: true, height: 24, color: "#fff" },
          label: {
            formatter: (params: { name: string; data: CauseNode }) =>
              `${params.name}\n${formatPercent((params.data.percent ?? 0) / 100)}`,
          },
          itemStyle: { borderColor: "#fff", gapWidth: 3 },
          levels: [
            {},
            { itemStyle: { borderColorSaturation: 0.4, gapWidth: 5 } },
            { colorSaturation: [0.3, 0.6], itemStyle: { gapWidth: 3 } },
          ],
          data: level1,
        },
      ],
    };

    currentOption = option;
    chart.setOption(option, { notMerge: true });
    lastCauseKey = "";

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

  setupChartExport(card, chart, {
    getFilenameBase: () => buildFilenameBase("causas", store.get()),
    getContext: () => buildFilterContext(dimensions, store.get()),
    getRows: () => exportRows,
  });

  setupChartFullscreen(card, container);

  subscribeWhenVisible(card, store, () =>
    render().then(() => syncZoom(store.get())),
  );
}
