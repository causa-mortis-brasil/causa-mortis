const DESKTOP_QUERY = "(min-width: 768px)";

interface PinnedFloatingBars {
  offset: number;
  restore: () => void;
}

function pinFloatingBars(
  miniHeader: HTMLElement | null,
  filtersFloating: HTMLElement | null,
): PinnedFloatingBars {
  const restoreFns: (() => void)[] = [];
  let offset = 0;

  if (miniHeader) {
    const hadVisible = miniHeader.hasAttribute("data-visible");
    const wasInert = miniHeader.inert;
    miniHeader.setAttribute("data-visible", "");
    miniHeader.inert = false;
    offset += miniHeader.offsetHeight;
    restoreFns.push(() => {
      miniHeader.toggleAttribute("data-visible", hadVisible);
      miniHeader.inert = wasInert;
    });
  }

  if (filtersFloating) {
    const previousTransform = filtersFloating.style.transform;
    const wasInert = filtersFloating.inert;
    filtersFloating.style.transform = `translateY(${offset}px)`;
    filtersFloating.inert = false;
    offset += filtersFloating.offsetHeight;
    restoreFns.push(() => {
      filtersFloating.style.transform = previousTransform;
      filtersFloating.inert = wasInert;
    });
  }

  return {
    offset,
    restore: () => {
      for (const restoreFn of restoreFns) restoreFn();
    },
  };
}

interface SidebarBundle {
  sidebar: HTMLElement;
  content: HTMLElement;
  nav: HTMLElement;
  filtersPanelWrap: HTMLElement;
  yearControl: HTMLElement;
}

function getSidebarBundle(): SidebarBundle | null {
  const sidebar = document.getElementById("chart-fullscreen-sidebar");
  const content = sidebar?.querySelector<HTMLElement>(
    "[data-fullscreen-sidebar-content]",
  );
  const nav = document.getElementById("chart-tabs-nav");
  const filtersPanelWrap = document.getElementById("filters-panel-wrap");
  const yearControl = document.getElementById("filter-year-wrap");

  if (!sidebar || !content || !nav || !filtersPanelWrap || !yearControl)
    return null;

  return { sidebar, content, nav, filtersPanelWrap, yearControl };
}

function overrideStyle(
  el: HTMLElement,
  styles: Partial<CSSStyleDeclaration>,
): () => void {
  const previousStyle = el.getAttribute("style");
  Object.assign(el.style, styles);
  return () => {
    if (previousStyle === null) el.removeAttribute("style");
    else el.setAttribute("style", previousStyle);
  };
}

function applySidebarNavLayout(nav: HTMLElement): () => void {
  const restores = [
    overrideStyle(nav, {
      width: "100%",
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(2.75rem, 1fr))",
      gap: "0.75rem",
    }),
  ];
  for (const child of nav.children)
    if (child instanceof HTMLElement)
      restores.push(overrideStyle(child, { width: "100%", padding: "0px" }));

  return () => {
    for (const restore of restores) restore();
  };
}

function applySidebarYearLayout(yearControl: HTMLElement): () => void {
  const row = yearControl.querySelector<HTMLElement>("[data-year-control]");
  const playbackGroup = yearControl.querySelector<HTMLElement>(
    "[data-year-playback-group]",
  );
  const range = yearControl.querySelector<HTMLElement>('input[type="range"]');
  if (!row || !playbackGroup || !range) return () => {};

  const restores = [
    overrideStyle(row, { flexWrap: "wrap", padding: "1rem" }),
    overrideStyle(playbackGroup, { width: "100%" }),
    overrideStyle(range, {
      flexGrow: "1",
      flexShrink: "1",
      flexBasis: "0%",
    }),
  ];
  for (const child of playbackGroup.children)
    if (child instanceof HTMLElement)
      restores.push(
        overrideStyle(child, {
          flexGrow: "1",
          flexShrink: "1",
          flexBasis: "0%",
        }),
      );

  return () => {
    for (const restore of restores) restore();
  };
}

function applySidebarFilterLayout(filtersPanelWrap: HTMLElement): () => void {
  const restores = [
    overrideStyle(filtersPanelWrap, { width: "100%", minWidth: "0px" }),
  ];
  for (const el of filtersPanelWrap.querySelectorAll<HTMLElement>("*"))
    restores.push(overrideStyle(el, { minWidth: "0px" }));

  const filterBarRoot =
    filtersPanelWrap.querySelector<HTMLElement>("[data-filter-bar]");
  if (filterBarRoot) {
    restores.push(overrideStyle(filterBarRoot, { width: "100%" }));
    for (const child of filterBarRoot.children)
      if (child instanceof HTMLElement)
        restores.push(overrideStyle(child, { width: "100%" }));
  }

  return () => {
    for (const restore of restores) restore();
  };
}

function showFullscreenSidebar(
  bundle: SidebarBundle,
  topOffset: number,
): () => void {
  const { sidebar, content, nav, filtersPanelWrap, yearControl } = bundle;

  const navAnchor = document.createComment("");
  const filtersAnchor = document.createComment("");
  const yearAnchor = document.createComment("");
  nav.before(navAnchor);
  filtersPanelWrap.before(filtersAnchor);
  yearControl.before(yearAnchor);

  content.append(yearControl, filtersPanelWrap, nav);

  const restoreNavLayout = applySidebarNavLayout(nav);
  const restoreFilterLayout = applySidebarFilterLayout(filtersPanelWrap);
  const restoreYearLayout = applySidebarYearLayout(yearControl);

  sidebar.style.top = `${topOffset}px`;
  sidebar.hidden = false;
  sidebar.inert = false;

  return () => {
    restoreNavLayout();
    restoreFilterLayout();
    restoreYearLayout();
    navAnchor.replaceWith(nav);
    filtersAnchor.replaceWith(filtersPanelWrap);
    yearAnchor.replaceWith(yearControl);
    sidebar.hidden = true;
    sidebar.inert = true;
    sidebar.style.top = "";
  };
}

interface FullscreenTarget {
  card: HTMLElement;
  chartMount: HTMLElement;
  button: HTMLButtonElement;
  enterIcon: Element | null;
  exitIcon: Element | null;
}

const targets = new Map<HTMLElement, FullscreenTarget>();
let activeTarget: FullscreenTarget | null = null;
let pendingPanelName: string | null = null;

let chromeRestore: (() => void) | null = null;
let chromeSidebarMode = false;
let chromeOffset = 0;

function ensureChrome(): void {
  if (chromeRestore) return;

  const desktop = window.matchMedia(DESKTOP_QUERY).matches;
  const sidebarBundle = desktop ? getSidebarBundle() : null;
  chromeSidebarMode = sidebarBundle !== null;

  document.body.classList.add("overflow-hidden");

  if (!desktop) {
    chromeOffset = 0;
    chromeRestore = () => {};
    return;
  }

  const miniHeader = document.getElementById("app-header-mini");
  const filtersFloating = document.getElementById("filters-floating");

  const { offset, restore: restoreBars } = pinFloatingBars(
    miniHeader,
    chromeSidebarMode ? null : filtersFloating,
  );
  const restoreSidebar = sidebarBundle
    ? showFullscreenSidebar(sidebarBundle, offset)
    : null;

  chromeOffset = offset;
  chromeRestore = () => {
    restoreBars();
    restoreSidebar?.();
  };
}

function teardownChrome(): void {
  chromeRestore?.();
  chromeRestore = null;
  document.body.classList.remove("overflow-hidden");
}

function showCard(target: FullscreenTarget): void {
  const { card, chartMount, button, enterIcon, exitIcon } = target;

  card.classList.add(
    "fixed",
    "rounded-none",
    "overflow-y-auto",
    "justify-between",
  );
  card.classList.toggle("inset-0", !chromeSidebarMode);
  card.classList.toggle("inset-y-0", chromeSidebarMode);
  card.classList.toggle("right-0", chromeSidebarMode);
  card.classList.toggle("left-72", chromeSidebarMode);
  card.style.paddingTop = `calc(var(--spacing) * 4 + ${chromeOffset}px)`;
  chartMount.classList.add("flex-1", "min-h-0");

  button.setAttribute("aria-pressed", "true");
  button.setAttribute("aria-label", "Sair da tela cheia");
  enterIcon?.toggleAttribute("hidden", true);
  exitIcon?.toggleAttribute("hidden", false);
}

function hideCard(target: FullscreenTarget): void {
  const { card, chartMount, button, enterIcon, exitIcon } = target;
  card.classList.remove(
    "fixed",
    "rounded-none",
    "overflow-y-auto",
    "justify-between",
    "inset-0",
    "inset-y-0",
    "right-0",
    "left-72",
  );
  card.style.paddingTop = "";
  chartMount.classList.remove("flex-1", "min-h-0");

  button.setAttribute("aria-pressed", "false");
  button.setAttribute("aria-label", "Ver em tela cheia");
  enterIcon?.toggleAttribute("hidden", false);
  exitIcon?.toggleAttribute("hidden", true);
}

function enter(target: FullscreenTarget): void {
  pendingPanelName = null;
  if (activeTarget === target) return;
  if (activeTarget) hideCard(activeTarget);
  ensureChrome();
  activeTarget = target;
  showCard(target);
}

function exit(): void {
  pendingPanelName = null;
  if (activeTarget) hideCard(activeTarget);
  activeTarget = null;
  teardownChrome();
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && (activeTarget || pendingPanelName)) exit();
});

export function setupChartFullscreen(
  card: ParentNode,
  chartMount: HTMLElement,
): void {
  const button = card.querySelector<HTMLButtonElement>(
    "[data-chart-fullscreen-toggle]",
  );
  if (!button || !(card instanceof HTMLElement)) return;

  const target: FullscreenTarget = {
    card,
    chartMount,
    button,
    enterIcon: button.querySelector("[data-icon-enter]"),
    exitIcon: button.querySelector("[data-icon-exit]"),
  };
  targets.set(card, target);

  button.addEventListener("click", () => {
    if (activeTarget === target) exit();
    else enter(target);
  });

  if (pendingPanelName && card.dataset.chartPanel === pendingPanelName)
    enter(target);
}

export function isChartFullscreenActive(): boolean {
  return activeTarget !== null || pendingPanelName !== null;
}

export function switchChartFullscreenTo(panelName: string): void {
  if (!activeTarget && !pendingPanelName) return;

  const nextCard = document.querySelector<HTMLElement>(
    `[data-chart-panel="${panelName}"]`,
  );
  const nextTarget = nextCard ? targets.get(nextCard) : undefined;

  if (nextTarget) {
    enter(nextTarget);
    return;
  }

  if (activeTarget) {
    hideCard(activeTarget);
    activeTarget = null;
  }

  const supportsFullscreen = !!nextCard?.querySelector(
    "[data-chart-fullscreen-toggle]",
  );
  if (supportsFullscreen) pendingPanelName = panelName;
  else exit();
}
