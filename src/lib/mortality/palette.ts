import { currentTheme } from "../theme";

const CAUSE_TOKENS = [
  "--color-cause-1",
  "--color-cause-2",
  "--color-cause-3",
  "--color-cause-4",
  "--color-cause-5",
  "--color-cause-6",
  "--color-cause-7",
  "--color-cause-8",
  "--color-cause-9",
  "--color-cause-10",
  "--color-cause-11",
];

const DARK_TOKEN_OVERRIDES: Record<string, string> = {
  "--color-gray-400": "--color-gray-600",
  "--color-gray-500": "--color-gray-400",
  "--color-gray-600": "--color-gray-300",
  "--color-gray-700": "--color-gray-200",
  "--color-gray-800": "--color-gray-100",
};

export function isDarkTheme(): boolean {
  return currentTheme() === "dark";
}

const themeColorCache = new Map<string, string>();

let hexColorContext: CanvasRenderingContext2D | null | undefined;

function toHexColor(value: string): string {
  if (hexColorContext === undefined)
    hexColorContext = document.createElement("canvas").getContext("2d");
  if (!hexColorContext || !value) return value;
  hexColorContext.fillStyle = value;
  return hexColorContext.fillStyle;
}

function readCssColor(token: string): string {
  let color = themeColorCache.get(token);
  if (!color) {
    color = toHexColor(
      getComputedStyle(document.documentElement).getPropertyValue(token).trim(),
    );
    themeColorCache.set(token, color);
  }
  return color;
}

export interface ThemeColorOptions {
  forceLight?: boolean;
}

function usesDark({ forceLight = false }: ThemeColorOptions): boolean {
  return !forceLight && isDarkTheme();
}

export function themeColor(
  token: string,
  options: ThemeColorOptions = {},
): string {
  if (usesDark(options)) {
    return readCssColor(DARK_TOKEN_OVERRIDES[token] ?? token);
  }
  return readCssColor(token);
}

export function chartSurfaceColor(options: ThemeColorOptions = {}): string {
  return readCssColor(usesDark(options) ? "--color-gray-800" : "--color-white");
}

export function chartGridColor(options: ThemeColorOptions = {}): string {
  return readCssColor(
    usesDark(options) ? "--color-gray-700" : "--color-gray-200",
  );
}

export interface MapLabelStyle {
  color: string;
  textBorderColor: string;
}

export function mapLabelStyle(
  fillRatio: number,
  options: ThemeColorOptions = {},
): MapLabelStyle {
  const brightFill = usesDark(options) ? fillRatio > 0.55 : fillRatio < 0.55;
  return {
    color: readCssColor(brightFill ? "--color-gray-800" : "--color-white"),
    textBorderColor: readCssColor(
      brightFill ? "--color-white" : "--color-gray-900",
    ),
  };
}

export function noDataColor(options: ThemeColorOptions = {}): string {
  return readCssColor(
    usesDark(options) ? "--color-gray-700" : "--color-gray-200",
  );
}

export function tooltipStyle(): {
  backgroundColor: string;
  borderColor: string;
  textStyle: { color: string };
} {
  const dark = isDarkTheme();
  return {
    backgroundColor: readCssColor(dark ? "--color-gray-800" : "--color-white"),
    borderColor: dark
      ? readCssColor("--color-gray-700")
      : readCssColor("--color-gray-200"),
    textStyle: {
      color: dark
        ? readCssColor("--color-gray-100")
        : readCssColor("--color-gray-700"),
    },
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mixColors(from: string, to: string, amount: number): string {
  const fromRgb = hexToRgb(from);
  const toRgb = hexToRgb(to);
  return rgbToHex([
    lerp(fromRgb[0], toRgb[0], amount),
    lerp(fromRgb[1], toRgb[1], amount),
    lerp(fromRgb[2], toRgb[2], amount),
  ]);
}

const CAUSE_DARK_MIX = 0.16;

export function causeGroupColor(
  causeGroupIndex: number,
  options: ThemeColorOptions = {},
): string {
  const color = readCssColor(
    CAUSE_TOKENS[causeGroupIndex % CAUSE_TOKENS.length],
  );
  if (!usesDark(options)) return color;
  return mixColors(color, readCssColor("--color-gray-900"), CAUSE_DARK_MIX);
}

export const MAP_SCALE_STEPS = 7;

const MAP_SCALE_ENDPOINT_TOKENS = {
  light: ["--color-primary-50", "--color-primary-800"],
  dark: ["--color-primary-900", "--color-primary-300"],
} as const;

export function mapScaleSteps(options: ThemeColorOptions = {}): string[] {
  const [start, end] =
    MAP_SCALE_ENDPOINT_TOKENS[usesDark(options) ? "dark" : "light"];
  const startColor = readCssColor(start);
  const endColor = readCssColor(end);
  return Array.from({ length: MAP_SCALE_STEPS }, (_, i) =>
    mixColors(startColor, endColor, i / (MAP_SCALE_STEPS - 1)),
  );
}
