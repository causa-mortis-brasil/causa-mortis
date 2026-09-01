import { sexLabel } from "./chart-titles";
import { createCustomSelect, type CustomSelect } from "./custom-select";
import { fetchDimensions } from "./dimensions";
import { DEFAULT_YEAR, FiltersStore } from "./filters";
import { parseSharedState } from "./share";
import { initSummaryStats } from "./summary-stats";
import type { Dimensions, Filters, PyramidMeasure, Sex } from "./types";

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
  quality: () => import("./charts/quality"),
};

const FILTER_ID_SUFFIXES = ["", "-floating"] as const;

function customSelect(
  scope: ParentNode,
  selector: string,
  onChange: (value: string) => void,
): CustomSelect {
  const el = scope.querySelector(selector);
  if (!(el instanceof HTMLElement))
    throw new Error(`Select "${selector}" não encontrado.`);
  return createCustomSelect(el, onChange);
}

function setupLocationSelect(
  scope: ParentNode,
  dimensions: Dimensions,
  store: FiltersStore,
  suffix: string,
): void {
  const select = customSelect(scope, `#filter-location${suffix}`, (value) =>
    store.setLocation(value),
  );
  select.setOptions(
    dimensions.locations.map((location) => ({
      value: location,
      label: dimensions.location_names[location] ?? location,
    })),
  );
  store.subscribe((filters) => select.setValue(filters.location));
}

function setupSexSelect(
  scope: ParentNode,
  dimensions: Dimensions,
  store: FiltersStore,
  suffix: string,
): void {
  const select = customSelect(scope, `#filter-sex${suffix}`, (value) =>
    store.setSex(value as Sex),
  );
  select.setOptions(
    dimensions.sexes.map((sex) => ({
      value: sex,
      label: sexLabel(sex as Sex),
    })),
  );
  store.subscribe((filters) => select.setValue(filters.sex));
}

function setupPyramidMeasureSelect(
  scope: ParentNode,
  store: FiltersStore,
  suffix: string,
): void {
  const select = customSelect(
    scope,
    `#filter-pyramid-measure${suffix}`,
    (value) => store.setPyramidMeasure(value as PyramidMeasure),
  );
  select.setOptions([
    { value: "rate", label: "Taxa relativa" },
    { value: "deaths", label: "Óbitos absolutos" },
  ]);
  store.subscribe((filters) => select.setValue(filters.pyramidMeasure));
}

const YEAR_PLAYBACK_INTERVAL_MS = 900;
const YEAR_PLAYBACK_SPEEDS = [1, 2, 3];
const RANDOM_TAB_EXCLUDED_CHARTS = ["quality"];

export interface YearPlayback {
  toggle: () => void;
  stop: () => void;
  cycleSpeed: () => void;
  subscribe: (listener: (playing: boolean) => void) => void;
  subscribeSpeed: (listener: (speed: number) => void) => void;
}

export function createYearPlayback(
  dimensions: Dimensions,
  store: FiltersStore,
): YearPlayback {
  const minYear = Math.min(...dimensions.years);
  const maxYear = Math.max(...dimensions.years);
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let speedIndex = 0;
  const listeners = new Set<(playing: boolean) => void>();
  const speedListeners = new Set<(speed: number) => void>();

  function notify(playing: boolean): void {
    for (const listener of listeners) listener(playing);
  }

  function notifySpeed(): void {
    const speed = YEAR_PLAYBACK_SPEEDS[speedIndex] ?? 1;
    for (const listener of speedListeners) listener(speed);
  }

  function stop(): void {
    if (intervalId === null) return;
    clearInterval(intervalId);
    intervalId = null;
    notify(false);
  }

  function tick(): void {
    const nextYear = store.get().year + 1;
    if (nextYear > maxYear) {
      stop();
      return;
    }
    const speed = YEAR_PLAYBACK_SPEEDS[speedIndex] ?? 1;
    store.setYear(nextYear, "playback", YEAR_PLAYBACK_INTERVAL_MS / speed);
  }

  function start(): void {
    if (store.get().year >= maxYear) store.setYear(minYear, "playback");
    const speed = YEAR_PLAYBACK_SPEEDS[speedIndex] ?? 1;
    intervalId = setInterval(tick, YEAR_PLAYBACK_INTERVAL_MS / speed);
    notify(true);
  }

  return {
    toggle(): void {
      if (intervalId === null) start();
      else stop();
    },
    stop,
    cycleSpeed(): void {
      speedIndex = (speedIndex + 1) % YEAR_PLAYBACK_SPEEDS.length;
      notifySpeed();
      if (intervalId !== null) {
        stop();
        start();
      }
    },
    subscribe(listener): void {
      listeners.add(listener);
      listener(intervalId !== null);
    },
    subscribeSpeed(listener): void {
      speedListeners.add(listener);
      listener(YEAR_PLAYBACK_SPEEDS[speedIndex] ?? 1);
    },
  };
}

export function setupYearControl(
  scope: ParentNode,
  dimensions: Dimensions,
  store: FiltersStore,
  playback: YearPlayback,
  suffix: string,
): void {
  const input = scope.querySelector(`#filter-year${suffix}`);
  const output = scope.querySelector(`#filter-year-value${suffix}`);
  const toggleButton = scope.querySelector(`#filter-year-toggle${suffix}`);
  const playIcon = scope.querySelector(`#filter-year-icon-play${suffix}`);
  const pauseIcon = scope.querySelector(`#filter-year-icon-pause${suffix}`);
  const speedButton = scope.querySelector(`#filter-year-speed${suffix}`);
  if (!(input instanceof HTMLInputElement) || !output) return;

  const years = dimensions.years;
  input.min = String(Math.min(...years));
  input.max = String(Math.max(...years));
  input.step = "1";

  const sync = (year: number): void => {
    input.value = String(year);
    output.textContent = String(year);
  };
  sync(store.get().year);
  store.subscribe((filters) => sync(filters.year));

  input.addEventListener("input", () => store.setYear(Number(input.value)));

  if (toggleButton instanceof HTMLButtonElement && playIcon && pauseIcon) {
    playback.subscribe((playing) => {
      toggleButton.setAttribute("aria-pressed", String(playing));
      toggleButton.setAttribute(
        "aria-label",
        playing ? "Pausar evolução dos anos" : "Reproduzir evolução dos anos",
      );
      playIcon.toggleAttribute("hidden", playing);
      pauseIcon.toggleAttribute("hidden", !playing);
      input.disabled = playing;
    });
    toggleButton.addEventListener("click", () => playback.toggle());
  }

  if (speedButton instanceof HTMLButtonElement) {
    playback.subscribeSpeed((speed) => {
      speedButton.textContent = `${speed}x`;
      speedButton.setAttribute(
        "aria-label",
        `Velocidade de reprodução: ${speed}x`,
      );
    });
    speedButton.addEventListener("click", () => playback.cycleSpeed());
  }
}

interface CauseFilters {
  setDetailFiltersEnabled: (enabled: boolean) => void;
}

function setupCauseFilters(
  scope: ParentNode,
  dimensions: Dimensions,
  store: FiltersStore,
  suffix: string,
): CauseFilters {
  const causeGroupSelect = customSelect(
    scope,
    `#filter-cause-group${suffix}`,
    (value) => store.setCauseGroup(value || null),
  );
  const detailWrap = scope.querySelector(`#filter-detail-wrap${suffix}`);
  const detailSelect = customSelect(scope, `#filter-detail${suffix}`, (value) =>
    store.setDetailedSubgroup(value || null),
  );
  const externalWrap = scope.querySelector(`#filter-external-wrap${suffix}`);
  const externalSelect = customSelect(
    scope,
    `#filter-external${suffix}`,
    (value) => store.setExternalCauseType(value || null),
  );
  const assaultWrap = scope.querySelector(`#filter-assault-wrap${suffix}`);
  const assaultSelect = customSelect(
    scope,
    `#filter-assault${suffix}`,
    (value) => store.setAssaultMeans(value || null),
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

function setWrapsHidden(wraps: HTMLElement[], shouldHide: boolean): void {
  for (const wrap of wraps) {
    const clip = wrap.querySelector<HTMLElement>("[data-filters-panel-clip]");
    if (shouldHide) {
      if (wrap.hidden || wrap.hasAttribute("data-hiding")) continue;
      clip?.classList.add("overflow-hidden");
      wrap.setAttribute("data-hiding", "");
      wrap.addEventListener(
        "transitionend",
        () => {
          if (wrap.hasAttribute("data-hiding")) wrap.hidden = true;
        },
        { once: true },
      );
    } else {
      if (!wrap.hidden && !wrap.hasAttribute("data-hiding")) {
        clip?.classList.remove("overflow-hidden");
        continue;
      }
      wrap.hidden = false;
      void wrap.offsetWidth;
      wrap.removeAttribute("data-hiding");
      wrap.addEventListener(
        "transitionend",
        () => clip?.classList.remove("overflow-hidden"),
        { once: true },
      );
    }
  }
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
  const filtersPanelWraps = [
    ...document.querySelectorAll<HTMLElement>('[id^="filters-panel-wrap"]'),
  ];
  const yearWraps = [
    ...document.querySelectorAll<HTMLElement>('[id^="filter-year-wrap"]'),
  ];
  const sexWraps = [
    ...document.querySelectorAll<HTMLElement>('[id^="filter-sex-wrap"]'),
  ];
  const locationWraps = [
    ...document.querySelectorAll<HTMLElement>('[id^="filter-location-wrap"]'),
  ];
  const causeGroupWraps = [
    ...document.querySelectorAll<HTMLElement>(
      '[id^="filter-cause-group-wrap"]',
    ),
  ];
  const pyramidMeasureWraps = [
    ...document.querySelectorAll<HTMLElement>(
      '[id^="filter-pyramid-measure-wrap"]',
    ),
  ];

  let panelsHeight: number | null = null;
  let settlePanelsHeight: (() => void) | null = null;

  function syncPanelsHeight(): void {
    if (!panelsWrap) return;
    if (settlePanelsHeight) {
      panelsWrap.removeEventListener("transitionend", settlePanelsHeight);
      settlePanelsHeight = null;
    }

    const startHeight =
      panelsHeight ?? panelsWrap.getBoundingClientRect().height;
    const endHeight = panelsWrap.scrollHeight;
    panelsHeight = endHeight;

    if (Math.round(startHeight) === Math.round(endHeight)) {
      if (panelsWrap.style.height) {
        panelsWrap.style.height = "";
        panelsWrap.classList.remove("overflow-hidden");
      }
      return;
    }

    panelsWrap.classList.add("overflow-hidden");
    panelsWrap.style.height = `${startHeight}px`;
    void panelsWrap.offsetHeight;
    panelsWrap.style.height = `${endHeight}px`;

    const settle = (): void => {
      panelsWrap.style.height = "";
      panelsWrap.classList.remove("overflow-hidden");
      panelsWrap.removeEventListener("transitionend", settle);
      settlePanelsHeight = null;
    };
    panelsWrap.addEventListener("transitionend", settle);
    settlePanelsHeight = settle;
  }

  panelsWrap?.addEventListener("chart-title-change", syncPanelsHeight);

  function activate(target: string): void {
    for (const tab of tabs)
      tab.setAttribute(
        "aria-selected",
        String(tab.dataset.chartTab === target),
      );

    for (const panel of panels)
      panel.toggleAttribute("hidden", panel.dataset.chartPanel !== target);
    syncPanelsHeight();

    setWrapsHidden(filtersPanelWraps, target === "quality");

    const hidesYear = target === "evolution";
    setWrapsHidden(yearWraps, hidesYear);
    if (hidesYear) stopYearPlayback();

    if (target !== "quality") {
      for (const wrap of sexWraps)
        wrap.toggleAttribute("hidden", target === "pyramid");
      for (const wrap of locationWraps)
        wrap.toggleAttribute("hidden", target === "map");
      for (const wrap of causeGroupWraps) wrap.hidden = false;
      for (const wrap of pyramidMeasureWraps)
        wrap.toggleAttribute("hidden", target !== "pyramid");
      setDetailFiltersEnabled(target !== "age-composition");
    }
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
  const { filters: initialFilters, tab: sharedTab } = parseSharedState(
    window.location.search,
    dimensions,
    DEFAULT_YEAR,
  );

  const store = new FiltersStore(initialFilters);

  const playback = createYearPlayback(dimensions, store);
  const causeFilterControllers: CauseFilters[] = [];

  for (const suffix of FILTER_ID_SUFFIXES) {
    const scope: ParentNode = suffix ? document : root;
    setupLocationSelect(scope, dimensions, store, suffix);
    setupSexSelect(scope, dimensions, store, suffix);
    setupPyramidMeasureSelect(scope, store, suffix);
    setupYearControl(scope, dimensions, store, playback, suffix);
    causeFilterControllers.push(
      setupCauseFilters(scope, dimensions, store, suffix),
    );
  }

  const setDetailFiltersEnabled = (enabled: boolean): void => {
    for (const controller of causeFilterControllers)
      controller.setDetailFiltersEnabled(enabled);
  };

  const activateChartTab = setupChartTabs(
    root,
    playback.stop,
    setDetailFiltersEnabled,
  );
  const chartNames = Object.keys(CHART_LOADERS);
  const validSharedTab =
    sharedTab && ["stats", ...chartNames].includes(sharedTab)
      ? sharedTab
      : null;
  const randomTabChoices = chartNames.filter(
    (name) => !RANDOM_TAB_EXCLUDED_CHARTS.includes(name),
  );
  activateChartTab(
    validSharedTab ??
      randomTabChoices[Math.floor(Math.random() * randomTabChoices.length)] ??
      "map",
  );
  observeChartCards(root, store, dimensions);
  initSummaryStats(root, store, dimensions);
}
