import { fetchDimensions } from "./dimensions";
import { FiltersStore } from "./filters";
import { createPillToggle } from "./pill-toggle";
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

function selectEl(root: ParentNode, selector: string): HTMLSelectElement {
  const el = root.querySelector(selector);
  if (!(el instanceof HTMLSelectElement))
    throw new Error(`Select "${selector}" não encontrado.`);
  return el;
}

function fillOptions(
  select: HTMLSelectElement,
  options: { value: string; label: string }[],
): void {
  select.replaceChildren(
    ...options.map((option) => {
      const el = document.createElement("option");
      el.value = option.value;
      el.textContent = option.label;
      return el;
    }),
  );
}

function setupSexToggle(
  root: ParentNode,
  dimensions: Dimensions,
  initial: Sex,
  onChange: (sex: Sex) => void,
): (sex: Sex) => void {
  const wrap = root.querySelector("#filter-sex");
  if (!wrap) return () => {};
  createPillToggle(
    wrap,
    "sex",
    dimensions.sexes.map((sex) => ({ value: sex, label: sex })),
    initial,
    (value) => onChange(value as Sex),
  );
  return (sex: Sex) => {
    for (const input of wrap.querySelectorAll("input")) {
      if (input instanceof HTMLInputElement)
        input.checked = input.value === sex;
    }
  };
}

const YEAR_PLAYBACK_INTERVAL_MS = 900;

function setupYearControl(
  root: ParentNode,
  dimensions: Dimensions,
  initial: number,
  onChange: (year: number) => void,
): (year: number) => void {
  const input = root.querySelector("#filter-year");
  const output = root.querySelector("#filter-year-value");
  const preliminaryBadge = root.querySelector("#filter-year-preliminary");
  const toggleButton = root.querySelector("#filter-year-toggle");
  const playIcon = root.querySelector("#filter-year-icon-play");
  const pauseIcon = root.querySelector("#filter-year-icon-pause");
  if (!(input instanceof HTMLInputElement) || !output || !preliminaryBadge)
    return () => {};

  const years = dimensions.years;
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  input.min = String(minYear);
  input.max = String(maxYear);
  input.step = "1";

  const sync = (year: number): void => {
    input.value = String(year);
    output.textContent = String(year);
    preliminaryBadge.toggleAttribute("hidden", year !== maxYear);
  };
  sync(initial);

  input.addEventListener("input", () => onChange(Number(input.value)));

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

    const start = (): void => {
      toggleButton.setAttribute("aria-pressed", "true");
      toggleButton.setAttribute("aria-label", "Pausar evolução dos anos");
      playIcon.toggleAttribute("hidden", true);
      pauseIcon.toggleAttribute("hidden", false);
      input.disabled = true;
      intervalId = setInterval(() => {
        const nextYear = Number(input.value) + 1;
        onChange(nextYear > maxYear ? minYear : nextYear);
      }, YEAR_PLAYBACK_INTERVAL_MS);
    };

    toggleButton.addEventListener("click", () => {
      if (intervalId === null) start();
      else stop();
    });
  }

  return sync;
}

function setupCauseFilters(
  root: ParentNode,
  dimensions: Dimensions,
  store: FiltersStore,
): void {
  const causeGroupSelect = selectEl(root, "#filter-cause-group");
  const detailWrap = root.querySelector("#filter-detail-wrap");
  const detailSelect = selectEl(root, "#filter-detail");
  const externalWrap = root.querySelector("#filter-external-wrap");
  const externalSelect = selectEl(root, "#filter-external");
  const assaultWrap = root.querySelector("#filter-assault-wrap");
  const assaultSelect = selectEl(root, "#filter-assault");

  fillOptions(causeGroupSelect, [
    { value: "", label: "Todas as causas" },
    ...dimensions.cause_groups.map((causeGroup) => ({
      value: causeGroup,
      label: causeGroup,
    })),
  ]);
  fillOptions(
    externalSelect,
    dimensions.external_cause_types.map((type) => ({
      value: type,
      label: type,
    })),
  );
  fillOptions(
    assaultSelect,
    dimensions.assault_means.map((means) => ({ value: means, label: means })),
  );

  function syncControls(filters: Filters): void {
    causeGroupSelect.value = filters.causeGroup ?? "";

    const causeGroupIndex = dimensions.cause_groups.indexOf(
      filters.causeGroup ?? "",
    );
    const detailedSubgroupIndices =
      dimensions.detailed_subgroups_by_cause_group[String(causeGroupIndex)] ??
      [];
    const showDetail = detailedSubgroupIndices.length > 0;
    const showExternal = filters.causeGroup === "Causas externas";
    const showAssault =
      showExternal && filters.externalCauseType === "Agressão";

    detailWrap?.toggleAttribute("hidden", !showDetail);
    externalWrap?.toggleAttribute("hidden", !showExternal);
    assaultWrap?.toggleAttribute("hidden", !showAssault);

    if (showDetail) {
      fillOptions(
        detailSelect,
        detailedSubgroupIndices.map((i) => ({
          value: dimensions.detailed_subgroups[i],
          label: dimensions.detailed_subgroups[i],
        })),
      );
      detailSelect.value = filters.detailedSubgroup ?? "";
    }
    if (showExternal) externalSelect.value = filters.externalCauseType ?? "";
    if (showAssault) assaultSelect.value = filters.assaultMeans ?? "";
  }

  causeGroupSelect.addEventListener("change", () =>
    store.setCauseGroup(causeGroupSelect.value || null),
  );
  detailSelect.addEventListener("change", () =>
    store.setDetailedSubgroup(detailSelect.value || null),
  );
  externalSelect.addEventListener("change", () =>
    store.setExternalCauseType(externalSelect.value || null),
  );
  assaultSelect.addEventListener("change", () =>
    store.setAssaultMeans(assaultSelect.value || null),
  );

  store.subscribe(syncControls);
}

function setupChartTabs(root: ParentNode): void {
  const tabs = [
    ...root.querySelectorAll<HTMLButtonElement>("[data-chart-tab]"),
  ];
  const panels = [...root.querySelectorAll<HTMLElement>("[data-chart-panel]")];

  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      const target = tab.dataset.chartTab;
      for (const otherTab of tabs)
        otherTab.setAttribute("aria-selected", String(otherTab === tab));
      for (const panel of panels)
        panel.toggleAttribute("hidden", panel.dataset.chartPanel !== target);
    });
  }
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

  const locationSelect = selectEl(root, "#filter-location");
  fillOptions(
    locationSelect,
    dimensions.locations.map((location) => ({
      value: location,
      label: dimensions.location_names[location] ?? location,
    })),
  );
  locationSelect.value = store.get().location;
  locationSelect.addEventListener("change", () =>
    store.setLocation(locationSelect.value),
  );

  const syncSexToggle = setupSexToggle(
    root,
    dimensions,
    store.get().sex,
    (sex) => store.setSex(sex),
  );
  const syncYearControl = setupYearControl(
    root,
    dimensions,
    store.get().year,
    (year) => store.setYear(year),
  );
  setupCauseFilters(root, dimensions, store);
  setupChartTabs(root);
  observeChartCards(root, store, dimensions);

  store.subscribe((filters) => {
    locationSelect.value = filters.location;
    syncSexToggle(filters.sex);
    syncYearControl(filters.year);
  });
}
