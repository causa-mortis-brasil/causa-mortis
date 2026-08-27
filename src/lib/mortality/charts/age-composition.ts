import { getCauseGroupAgeSeries } from "../access";
import { fetchDeathsByCauseGroupAge } from "../data";
import { indexOf } from "../dimensions";
import type { EChartsCoreOption } from "../echarts-core";
import { echarts } from "../echarts-core";
import { formatPercent } from "../format";
import { causeGroupColor } from "../palette";
import type { FiltersStore } from "../filters";
import type { Dimensions } from "../types";

export function init(
  container: HTMLElement,
  store: FiltersStore,
  dimensions: Dimensions,
): void {
  const chart = echarts.init(container);
  new ResizeObserver(() => chart.resize()).observe(container);

  const card = container.closest(".chart-card") ?? document;
  const warning = card.querySelector("#age-composition-warning");

  async function render(): Promise<void> {
    const filters = store.get();
    warning?.toggleAttribute(
      "hidden",
      !(
        filters.detailedSubgroup ||
        filters.externalCauseType ||
        filters.assaultMeans
      ),
    );

    const table = await fetchDeathsByCauseGroupAge();
    const locationIndex = indexOf(dimensions.locations, filters.location);
    const sexIndex = indexOf(dimensions.sexes, filters.sex);
    const yearIndex = indexOf(dimensions.years, filters.year);

    const deathsByCauseGroup = dimensions.cause_groups.map(
      (_, causeGroupIndex) =>
        getCauseGroupAgeSeries(
          table,
          locationIndex,
          sexIndex,
          yearIndex,
          causeGroupIndex,
        ) ?? [],
    );

    const totalByAge = dimensions.age_groups.map((_, ageIndex) =>
      deathsByCauseGroup.reduce(
        (sum, series) => sum + (series[ageIndex] ?? 0),
        0,
      ),
    );
    const totalOverall = totalByAge.reduce((sum, value) => sum + value, 0);

    const includedIndices = dimensions.cause_groups
      .map((_, causeGroupIndex) => causeGroupIndex)
      .filter((causeGroupIndex) =>
        deathsByCauseGroup[causeGroupIndex]?.some(
          (deaths) => (deaths ?? 0) > 0,
        ),
      );

    const stackedFromBase = [...includedIndices].reverse();

    const series = stackedFromBase.map((causeGroupIndex) => {
      const causeGroup = dimensions.cause_groups[causeGroupIndex];
      const isHighlighted =
        !filters.causeGroup || filters.causeGroup === causeGroup;
      const shares = dimensions.age_groups.map((_, ageIndex) => {
        const deaths = deathsByCauseGroup[causeGroupIndex]?.[ageIndex] ?? 0;
        const total = totalByAge[ageIndex] ?? 0;
        return total > 0 ? deaths / total : 0;
      });

      return {
        name: causeGroup,
        type: "line" as const,
        stack: "total",
        symbol: "none" as const,
        areaStyle: { opacity: isHighlighted ? 0.9 : 0.25 },
        lineStyle: { opacity: isHighlighted ? 1 : 0.25, width: 0.5 },
        color: causeGroupColor(causeGroupIndex),
        data: shares,
      };
    });

    const percentByGroup = new Map(
      includedIndices.map((causeGroupIndex) => {
        const causeGroup = dimensions.cause_groups[causeGroupIndex];
        const total =
          deathsByCauseGroup[causeGroupIndex]?.reduce(
            (sum: number, v: number | null) => sum + (v ?? 0),
            0,
          ) ?? 0;
        return [causeGroup, totalOverall > 0 ? total / totalOverall : 0];
      }),
    );

    const option: EChartsCoreOption = {
      grid: { left: 48, right: 16, top: 16, bottom: 72 },
      tooltip: {
        trigger: "axis",
        valueFormatter: (value: number | string) =>
          formatPercent(Number(value)),
      },
      legend: {
        bottom: 0,
        data: includedIndices.map(
          (causeGroupIndex) => dimensions.cause_groups[causeGroupIndex],
        ),
        formatter: (name: string) =>
          `${name} ${formatPercent(percentByGroup.get(name) ?? 0)}`,
      },
      xAxis: {
        type: "category",
        data: dimensions.age_groups,
        name: "Faixa de idade (anos)",
        nameLocation: "middle",
        nameGap: 28,
      },
      yAxis: {
        type: "value",
        max: 1,
        axisLabel: { formatter: (value: number) => formatPercent(value) },
      },
      series,
    };

    chart.setOption(option, { notMerge: true });
  }

  store.subscribe(() => void render());
}
