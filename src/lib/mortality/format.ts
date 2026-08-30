const integerFormatter = new Intl.NumberFormat("pt-BR");
const rateFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const percentIntegerFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 0,
});
const compactFormatter = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 0,
});

export function formatInteger(value: number): string {
  return integerFormatter.format(value);
}

export function formatRate(value: number): string {
  return rateFormatter.format(value);
}

export function formatRateLabel(value: number): string {
  return Math.abs(value) > 10
    ? integerFormatter.format(Math.round(value))
    : rateFormatter.format(value);
}

export function formatPercent(fraction: number): string {
  return percentFormatter.format(fraction);
}

export function formatPercentInteger(fraction: number): string {
  return percentIntegerFormatter.format(fraction);
}

export function formatSignedPercent(fraction: number): string {
  const formatted = percentFormatter.format(fraction);
  return fraction > 0 ? `+${formatted}` : formatted;
}

export function formatCompact(value: number): string {
  return compactFormatter.format(value);
}
