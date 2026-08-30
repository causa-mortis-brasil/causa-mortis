import { sexLabel } from "./chart-titles";
import { createCustomSelect, type CustomSelect } from "./custom-select";
import { fetchDimensions } from "./dimensions";
import { FiltersStore } from "./filters";
import { initSummaryStats } from "./summary-stats";
import type { Dimensions, Filters, Sex } from "./types";

interface ChartModule {
  init(
    container: HTMLElement,
    store: FiltersStore,
    dimensions: Dimensions,
  ): void;
}

const CHART_LOADERS: Record<string, () => Promise<ChartModule>> = {
  evolution: () => import("./charts/evolution"),
  causes: () => import("./charts/causes"),
  map: () => import("./charts/map"),
  "age-composition": () => import("./charts/age-composition"),
  pyramid: () => import("./charts/pyramid"),
};

function customSelect(
  root: ParentNode,
  selector: string,
  onChange: (value: string) => void,
): CustomSelect {
  const el = root.querySelector(selector);
  if (!(el instanceof HTMLElement))
    throw new Error(`Select "${selector}" não encontrado.`);
  return createCustomSelect(el, onChange);
}

function setupSexSelect(
  root: ParentNode,
  dimensions: Dimensions,
  initial: Sex,
  onChange: (sex: Sex) => void,
): (sex: Sex) => void {
  const sexSelect = customSelect(root, "#filter-sex", (value) =>
    onChange(value as Sex),
  );
  sexSelect.setOptions(
    dimensions.sexes.map((sex) => ({
      value: sex,
      label: sexLabel(sex as Sex),
    })),
  );
  sexSelect.setValue(initial);
  return (sex: Sex) => sexSelect.setValue(sex);
}

const YEAR_PLAYBACK_INTERVAL_MS = 900;

interface YearControl {
  sync: (year: number) => void;
  stopPlayback: () => void;
}

function setupYearControl(
  root: ParentNode,
  dimensions: Dimensions,
  initial: number,
  onChange: (year: number) => void,
): YearControl {
  const input = root.querySelector("#filter-year");
  const output = root.querySelector("#filter-year-value");
  const toggleButton = root.querySelector("#filter-year-toggle");
  const playIcon = root.querySelector("#filter-year-icon-play");
  const pauseIcon = root.querySelector("#filter-year-icon-pause");
  if (!(input instanceof HTMLInputElement) || !output)
    return { sync: () => {}, stopPlayback: () => {} };

  const years = dimensions.years;
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  input.min = String(minYear);
  input.max = String(maxYear);
  input.step = "1";

  const sync = (year: number): void => {
    input.value = String(year);
    output.textContent = String(year);
  };
  sync(initial);

  input.addEventListener("input", () => onChange(Number(input.value)));

  let stopPlayback = (): void => {};

  if (toggleButton instanceof HTMLButtonElement && playIcon && pauseIcon) {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const stop = (): void => {
      if (intervalId === null) return;
      clearInterval(intervalId);
      intervalId = null;
      toggleButton.setAttribute("aria-pressed", "false");
      toggleButton.setAttribute("aria-label", "Reproduzir evolução dos anos");
      playIcon.toggleAttribute("hidden", false);
      pauseIcon.toggleAttribute("hidden", true);
      input.disabled = false;
    };
    stopPlayback = stop;

    const start = (): void => {
      toggleButton.setAttribute("aria-pressed", "true");
      toggleButton.setAttribute("aria-label", "Pausar evolução dos anos");
      playIcon.toggleAttribute("hidden", true);
      pauseIcon.toggleAttribute("hidden", false);
      input.disabled = true;
      if (Number(input.value) >= maxYear) onChange(minYear);
      intervalId = setInterval(() => {
        const nextYear = Number(input.value) + 1;
        if (nextYear > maxYear) {
          stop();
          return;
        }
        onChange(nextYear);
      }, YEAR_PLAYBACK_INTERVAL_MS);
    };

    toggleButton.addEventListener("click", () => {
      if (intervalId === null) start();
      else stop();
    });
  }

  return { sync, stopPlayback };
}

interface CauseFilters {
  setDetailFiltersEnabled: (enabled: boolean) => void;
}

function setupCauseFilters(
  root: ParentNode,
  dimensions: Dimensions,
  store: FiltersStore,
): CauseFilters {
  const causeGroupSelect = customSelect(root, "#filter-cause-group", (value) =>
    store.setCauseGroup(value || null),
  );
  const detailWrap = root.querySelector("#filter-detail-wrap");
  const detailSelect = customSelect(root, "#filter-detail", (value) =>
    store.setDetailedSubgroup(value || null),
  );
  const externalWrap = root.querySelector("#filter-external-wrap");
  const externalSelect = customSelect(root, "#filter-external", (value) =>
    store.setExternalCauseType(value || null),
  );
  const assaultWrap = root.querySelector("#filter-assault-wrap");
  const assaultSelect = customSelect(root, "#filter-assault", (value) =>
    store.setAssaultMeans(value || null),
  );

  causeGroupSelect.setOptions([
    { value: "", label: "Todas as causas" },
    ...dimensions.cause_groups.map((causeGroup) => ({
      value: causeGroup,
      label: causeGroup,
    })),
  ]);
  externalSelect.setOptions([
    { value: "", label: "Todos os tipos" },
    ...dimensions.external_cause_types.map((type) => ({
      value: type,
      label: type,
    })),
  ]);
  assaultSelect.setOptions([
    { value: "", label: "Todos os meios" },
    ...dimensions.assault_means.map((means) => ({
      value: means,
      label: means,
    })),
  ]);

  let detailFiltersEnabled = true;

  function syncControls(filters: Filters): void {
    causeGroupSelect.setValue(filters.causeGroup ?? "");

    const causeGroupIndex = dimensions.cause_groups.indexOf(
      filters.causeGroup ?? "",
    );
    const detailedSubgroupIndices =
      dimensions.detailed_subgroups_by_cause_group[String(causeGroupIndex)] ??
      [];
    const showDetail =
      detailFiltersEnabled && detailedSubgroupIndices.length > 0;
    const showExternal =
      detailFiltersEnabled && filters.causeGroup === "Causas externas";
    const showAssault =
      showExternal && filters.externalCauseType === "Agressão";

    detailWrap?.toggleAttribute("hidden", !showDetail);
    externalWrap?.toggleAttribute("hidden", !showExternal);
    assaultWrap?.toggleAttribute("hidden", !showAssault);

    if (showDetail) {
      detailSelect.setOptions([
        { value: "", label: "Todos os detalhes" },
        ...detailedSubgroupIndices.map((i) => ({
          value: dimensions.detailed_subgroups[i],
          label: dimensions.detailed_subgroups[i],
        })),
      ]);
      detailSelect.setValue(filters.detailedSubgroup ?? "");
    }
    if (showExternal) externalSelect.setValue(filters.externalCauseType ?? "");
    if (showAssault) assaultSelect.setValue(filters.assaultMeans ?? "");
  }

  store.subscribe(syncControls);

  return {
    setDetailFiltersEnabled(enabled: boolean): void {
      if (detailFiltersEnabled === enabled) return;
      detailFiltersEnabled = enabled;
      syncControls(store.get());
    },
  };
}

function setupChartTabs(
  root: ParentNode,
  stopYearPlayback: () => void,
  setDetailFiltersEnabled: (enabled: boolean) => void,
): (target: string) => void {
  const tabs = [
    ...root.querySelectorAll<HTMLButtonElement>("[data-chart-tab]"),
  ];
  const panels = [...root.querySelectorAll<HTMLElement>("[data-chart-panel]")];
  const panelsWrap = root.querySelector<HTMLElement>("[data-chart-panels]");
  const yearWrap = root.querySelector("#filter-year-wrap");
  const sexWrap = root.querySelector("#filter-sex-wrap");

  function activate(target: string): void {
    for (const tab of tabs)
      tab.setAttribute(
        "aria-selected",
        String(tab.dataset.chartTab === target),
      );

    const startHeight = panelsWrap?.getBoundingClientRect().height ?? 0;
    for (const panel of panels)
      panel.toggleAttribute("hidden", panel.dataset.chartPanel !== target);

    if (panelsWrap) {
      const endHeight = panelsWrap.scrollHeight;
      if (Math.round(startHeight) !== Math.round(endHeight)) {
        panelsWrap.classList.add("overflow-hidden");
        panelsWrap.style.height = `${startHeight}px`;
        void panelsWrap.offsetHeight;
        panelsWrap.style.height = `${endHeight}px`;
        panelsWrap.addEventListener(
          "transitionend",
          () => {
            panelsWrap.style.height = "";
            panelsWrap.classList.remove("overflow-hidden");
          },
          { once: true },
        );
      }
    }

    const hidesYear = target === "evolution" || target === "age-composition";
    yearWrap?.toggleAttribute("hidden", hidesYear);
    if (hidesYear) stopYearPlayback();

    sexWrap?.toggleAttribute("hidden", target === "pyramid");
    setDetailFiltersEnabled(target !== "age-composition");
  }

  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      const target = tab.dataset.chartTab;
      if (target) activate(target);
    });
  }

  return activate;
}

function observeChartCards(
  root: ParentNode,
  store: FiltersStore,
  dimensions: Dimensions,
): void {
  const cards = root.querySelectorAll<HTMLElement>("[data-chart]");
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const container = entry.target as HTMLElement;
        const chartName = container.dataset.chart;
        if (!chartName) continue;
        observer.unobserve(container);
        const load = CHART_LOADERS[chartName];
        if (!load) continue;
        void load().then((module) => {
          container.querySelector(".chart-placeholder")?.remove();
          module.init(container, store, dimensions);
        });
      }
    },
    { rootMargin: "150px" },
  );
  for (const card of cards) observer.observe(card);
}

export async function mountMortalityExplorer(root: HTMLElement): Promise<void> {
  const dimensions = await fetchDimensions();
  const maxYear = Math.max(...dimensions.years);

  const store = new FiltersStore({
    location: "BR",
    sex: "Ambos",
    year: maxYear,
    causeGroup: null,
    detailedSubgroup: null,
    externalCauseType: null,
    assaultMeans: null,
  });

  const locationSelect = customSelect(root, "#filter-location", (value) =>
    store.setLocation(value),
  );
  locationSelect.setOptions(
    dimensions.locations.map((location) => ({
      value: location,
      label: dimensions.location_names[location] ?? location,
    })),
  );
  locationSelect.setValue(store.get().location);

  const syncSexSelect = setupSexSelect(
    root,
    dimensions,
    store.get().sex,
    (sex) => store.setSex(sex),
  );
  const { sync: syncYearControl, stopPlayback: stopYearPlayback } =
    setupYearControl(root, dimensions, store.get().year, (year) =>
      store.setYear(year),
    );
  const { setDetailFiltersEnabled } = setupCauseFilters(
    root,
    dimensions,
    store,
  );
  const activateChartTab = setupChartTabs(
    root,
    stopYearPlayback,
    setDetailFiltersEnabled,
  );
  const chartNames = Object.keys(CHART_LOADERS);
  activateChartTab(
    chartNames[Math.floor(Math.random() * chartNames.length)] ?? "map",
  );
  observeChartCards(root, store, dimensions);
  initSummaryStats(root, store, dimensions);

  store.subscribe((filters) => {
    locationSelect.setValue(filters.location);
    syncSexSelect(filters.sex);
    syncYearControl(filters.year);
  });
}
