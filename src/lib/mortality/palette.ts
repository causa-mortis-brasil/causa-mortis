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

const themeColorCache = new Map<string, string>();

function readCssColor(token: string): string {
  let color = themeColorCache.get(token);
  if (!color) {
    color = getComputedStyle(document.documentElement)
      .getPropertyValue(token)
      .trim();
    themeColorCache.set(token, color);
  }
  return color;
}

export function themeColor(token: string): string {
  return readCssColor(token);
}

let causeColors: string[] | null = null;

export function causeGroupColor(causeGroupIndex: number): string {
  causeColors ??= CAUSE_TOKENS.map(readCssColor);
  return causeColors[causeGroupIndex % causeColors.length];
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

let mapScaleEndpoints: [string, string] | null = null;

function getMapScaleEndpoints(): [string, string] {
  mapScaleEndpoints ??= [
    readCssColor("--color-primary-50"),
    readCssColor("--color-primary-800"),
  ];
  return mapScaleEndpoints;
}

export const MAP_SCALE_STEPS = 7;

export function mapScaleSteps(): string[] {
  const [start, end] = getMapScaleEndpoints();
  const startRgb = hexToRgb(start);
  const endRgb = hexToRgb(end);
  return Array.from({ length: MAP_SCALE_STEPS }, (_, i) => {
    const t = i / (MAP_SCALE_STEPS - 1);
    return rgbToHex([
      lerp(startRgb[0], endRgb[0], t),
      lerp(startRgb[1], endRgb[1], t),
      lerp(startRgb[2], endRgb[2], t),
    ]);
  });
}
