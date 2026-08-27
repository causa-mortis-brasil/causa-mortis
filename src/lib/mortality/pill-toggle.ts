export function createPillToggle(
  wrap: Element,
  name: string,
  options: { value: string; label: string }[],
  initial: string,
  onChange: (value: string) => void,
): void {
  wrap.replaceChildren(
    ...options.map((option) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = name;
      input.value = option.value;
      input.className = "sr-only peer";
      input.checked = option.value === initial;
      input.addEventListener("change", () => onChange(option.value));
      const span = document.createElement("span");
      span.className = "pill-toggle-option";
      span.textContent = option.label;
      label.append(input, span);
      return label;
    }),
  );
}
