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

export function setupChartFullscreen(
  card: ParentNode,
  chartMount: HTMLElement,
): void {
  const button = card.querySelector<HTMLButtonElement>(
    "[data-chart-fullscreen-toggle]",
  );
  if (!button || !(card instanceof HTMLElement)) return;

  const enterIcon = button.querySelector("[data-icon-enter]");
  const exitIcon = button.querySelector("[data-icon-exit]");
  const miniHeader = document.getElementById("app-header-mini");
  const filtersFloating = document.getElementById("filters-floating");

  let restoreFloatingBars: (() => void) | null = null;

  const setFullscreen = (fullscreen: boolean): void => {
    card.classList.toggle("fixed", fullscreen);
    card.classList.toggle("inset-0", fullscreen);
    card.classList.toggle("rounded-none", fullscreen);
    card.classList.toggle("overflow-y-auto", fullscreen);
    chartMount.classList.toggle("flex-1", fullscreen);
    chartMount.classList.toggle("min-h-0", fullscreen);
    document.body.classList.toggle("overflow-hidden", fullscreen);

    button.setAttribute("aria-pressed", String(fullscreen));
    button.setAttribute(
      "aria-label",
      fullscreen ? "Sair da tela cheia" : "Ver em tela cheia",
    );
    enterIcon?.toggleAttribute("hidden", fullscreen);
    exitIcon?.toggleAttribute("hidden", !fullscreen);

    if (fullscreen) {
      const { offset, restore } = pinFloatingBars(miniHeader, filtersFloating);
      card.style.paddingTop = `calc(var(--spacing) * 4 + ${offset}px)`;
      restoreFloatingBars = restore;
    } else {
      restoreFloatingBars?.();
      restoreFloatingBars = null;
      card.style.paddingTop = "";
    }
  };

  button.addEventListener("click", () => {
    setFullscreen(button.getAttribute("aria-pressed") !== "true");
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      button.getAttribute("aria-pressed") === "true"
    ) {
      setFullscreen(false);
    }
  });
}
