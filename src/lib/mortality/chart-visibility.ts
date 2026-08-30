import type { FiltersStore } from "./filters";

export function subscribeWhenVisible(
  card: ParentNode,
  store: FiltersStore,
  render: () => void | Promise<void>,
): void {
  if (!(card instanceof HTMLElement)) {
    store.subscribe(() => void render());
    return;
  }

  let dirty = false;
  const isVisible = (): boolean => !card.hasAttribute("hidden");

  const run = (): void => {
    dirty = false;
    void render();
  };

  new MutationObserver(() => {
    if (isVisible() && dirty) run();
  }).observe(card, { attributes: true, attributeFilter: ["hidden"] });

  store.subscribe(() => {
    if (isVisible()) run();
    else dirty = true;
  });
}
