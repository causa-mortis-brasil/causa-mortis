import {
  getAssaultMeansEntry,
  getCauseGroupEntry,
  getDetailedSubgroupEntry,
  getExternalCauseEntry,
} from "../access";
import { causeGroupsForDetail, indexOf } from "../dimensions";
import {
  fetchDeathsByAssaultMeans,
  fetchDeathsByCauseGroup,
  fetchDeathsByDetailedSubgroup,
  fetchDeathsByExternalCause,
} from "../data";
import type { EChartsCoreOption } from "../echarts-core";
import { echarts } from "../echarts-core";
import { causeGroupColor } from "../palette";
import { formatInteger, formatPercent, formatRate } from "../format";
import type { FiltersStore } from "../filters";
import type { Dimensions } from "../types";

interface CauseNode {
  name: string;
  value: number;
  stdRate: number;
  percent: number;
  itemStyle?: { color: string };
  children?: CauseNode[];
}

function withPercent(nodes: Omit<CauseNode, "percent">[]): CauseNode[] {
  const total = nodes.reduce((sum, node) => sum + node.value, 0);
  return nodes.map((node) => ({
    ...node,
    percent: total > 0 ? (node.value / total) * 100 : 0,
  }));
}

export function init(
  container: HTMLElement,
  store: FiltersStore,
  dimensions: Dimensions,
): void {
  const chart = echarts.init(container);
  new ResizeObserver(() => chart.resize()).observe(container);

  let renderKey = "";

  async function render(): Promise<void> {
    const filters = store.get();
    const key = `${filters.location}|${filters.sex}|${filters.year}`;
    if (key === renderKey) return;
    renderKey = key;

    const locationIndex = indexOf(dimensions.locations, filters.location);
    const sexIndex = indexOf(dimensions.sexes, filters.sex);
    const yearIndex = indexOf(dimensions.years, filters.year);

    const [
      causeGroupTable,
      detailedSubgroupTable,
      externalTable,
      assaultTable,
    ] = await Promise.all([
      fetchDeathsByCauseGroup(),
      fetchDeathsByDetailedSubgroup(),
      fetchDeathsByExternalCause(),
      fetchDeathsByAssaultMeans(),
    ]);
    if (key !== renderKey) return;

    const level1 = withPercent(
      dimensions.cause_groups
        .map((causeGroup, causeGroupIndex) => {
          const [deaths, stdRate] = getCauseGroupEntry(
            causeGroupTable,
            locationIndex,
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
                    locationIndex,
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
                    locationIndex,
                    sexIndex,
                    yearIndex,
                    externalIndex,
                  );
                  const node: Omit<CauseNode, "percent"> = {
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
                              locationIndex,
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

    chart.setOption(option, { notMerge: true });
  }

  store.subscribe(() => void render());
}
