import { THEME_CHANGE_EVENT } from "../theme";
import type { FiltersStore } from "./filters";

export interface RenderOptions {
  instant: boolean;
}

export function subscribeWhenVisible(
  card: ParentNode,
  store: FiltersStore,
  render: (options: RenderOptions) => void | Promise<void>,
): void {
  if (!(card instanceof HTMLElement)) {
    store.subscribe(() => void render({ instant: false }));
    document.addEventListener(
      THEME_CHANGE_EVENT,
      () => void render({ instant: false }),
    );
    return;
  }

  const isVisible = (): boolean => !card.hasAttribute("hidden");

  const renderIfVisible = (): void => {
    if (isVisible()) void render({ instant: false });
  };

  new MutationObserver(() => {
    if (isVisible()) void render({ instant: true });
  }).observe(card, { attributes: true, attributeFilter: ["hidden"] });

  store.subscribe(renderIfVisible);
  document.addEventListener(THEME_CHANGE_EVENT, renderIfVisible);
}
