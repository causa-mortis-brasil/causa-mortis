export interface CustomSelectOption {
  value: string;
  label: string;
}

export interface CustomSelect {
  setOptions(options: CustomSelectOption[]): void;
  setValue(value: string): void;
  getValue(): string;
}

function optionId(baseId: string, value: string): string {
  return `${baseId}-option-${value.replace(/[^a-zA-Z0-9]+/g, "-")}`;
}

export function createCustomSelect(
  root: HTMLElement,
  onChange: (value: string) => void,
): CustomSelect {
  const triggerEl = root.querySelector<HTMLButtonElement>(
    "[data-select-trigger]",
  );
  const valueElEl = root.querySelector<HTMLElement>("[data-select-value]");
  const listboxEl = root.querySelector<HTMLElement>("[data-select-listbox]");
  if (!triggerEl || !valueElEl || !listboxEl) {
    return {
      setOptions: () => {},
      setValue: () => {},
      getValue: () => "",
    };
  }
  const button = triggerEl;
  const valueEl = valueElEl;
  const listbox = listboxEl;

  const listboxId = listbox.id;
  let options: CustomSelectOption[] = [];
  let value = "";
  let activeIndex = -1;
  let typeaheadBuffer = "";
  let typeaheadTimeout: ReturnType<typeof setTimeout> | undefined;

  function renderOptions(): void {
    listbox.replaceChildren(
      ...options.map((option, index) => {
        const li = document.createElement("li");
        li.id = optionId(listboxId, option.value);
        li.role = "option";
        li.className = "custom-select-option";
        li.textContent = option.label;
        li.dataset.value = option.value;
        li.setAttribute("aria-selected", String(option.value === value));
        li.addEventListener("click", () => {
          select(index);
          close(true);
        });
        return li;
      }),
    );
  }

  function updateValueDisplay(): void {
    const selected = options.find((option) => option.value === value);
    valueEl.textContent = selected?.label ?? "";
  }

  function setActive(index: number): void {
    const items = [...listbox.children] as HTMLElement[];
    for (const item of items) item.removeAttribute("data-active");
    activeIndex = index;
    const active = items[index];
    if (active) {
      active.setAttribute("data-active", "true");
      button.setAttribute("aria-activedescendant", active.id);
      active.scrollIntoView({ block: "nearest" });
    }
  }

  function select(index: number): void {
    const option = options[index];
    if (!option) return;
    const changed = option.value !== value;
    value = option.value;
    for (const li of [...listbox.children] as HTMLElement[]) {
      li.setAttribute("aria-selected", String(li.dataset.value === value));
    }
    updateValueDisplay();
    if (changed) onChange(value);
  }

  function isOpen(): boolean {
    return !listbox.hasAttribute("hidden");
  }

  function open(): void {
    if (isOpen() || options.length === 0) return;
    listbox.removeAttribute("hidden");
    root.setAttribute("data-open", "");
    button.setAttribute("aria-expanded", "true");
    const initialIndex = Math.max(
      options.findIndex((option) => option.value === value),
      0,
    );
    setActive(initialIndex);
    listbox.focus();
  }

  function close(returnFocus: boolean): void {
    if (!isOpen()) return;
    listbox.setAttribute("hidden", "");
    root.removeAttribute("data-open");
    button.setAttribute("aria-expanded", "false");
    button.removeAttribute("aria-activedescendant");
    if (returnFocus) button.focus();
  }

  function moveActive(delta: number): void {
    if (options.length === 0) return;
    const next = (activeIndex + delta + options.length) % options.length;
    setActive(next);
  }

  function typeahead(char: string): void {
    clearTimeout(typeaheadTimeout);
    typeaheadBuffer += char.toLowerCase();
    typeaheadTimeout = setTimeout(() => {
      typeaheadBuffer = "";
    }, 500);
    const match = options.findIndex((option) =>
      option.label.toLowerCase().startsWith(typeaheadBuffer),
    );
    if (match >= 0) setActive(match);
  }

  button.addEventListener("click", () => {
    if (isOpen()) close(true);
    else open();
  });

  button.addEventListener("keydown", (event) => {
    if (isOpen()) return;
    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      open();
    }
  });

  listbox.addEventListener("keydown", (event) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveActive(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveActive(-1);
        break;
      case "Home":
        event.preventDefault();
        setActive(0);
        break;
      case "End":
        event.preventDefault();
        setActive(options.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (activeIndex >= 0) select(activeIndex);
        close(true);
        break;
      case "Escape":
        event.preventDefault();
        close(true);
        break;
      case "Tab":
        close(false);
        break;
      default:
        if (event.key.length === 1) typeahead(event.key);
    }
  });

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Node)) return;
    if (!root.contains(event.target)) close(false);
  });

  return {
    setOptions(nextOptions: CustomSelectOption[]): void {
      options = nextOptions;
      if (!options.some((option) => option.value === value)) {
        value = options[0]?.value ?? "";
      }
      renderOptions();
      updateValueDisplay();
    },
    setValue(nextValue: string): void {
      if (nextValue === value) return;
      const index = options.findIndex((option) => option.value === nextValue);
      if (index === -1) return;
      value = nextValue;
      for (const li of [...listbox.children] as HTMLElement[]) {
        li.setAttribute("aria-selected", String(li.dataset.value === value));
      }
      updateValueDisplay();
    },
    getValue(): string {
      return value;
    },
  };
}
