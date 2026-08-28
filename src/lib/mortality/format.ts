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

export function formatPercent(fraction: number): string {
  return percentFormatter.format(fraction);
}

export function formatCompact(value: number): string {
  return compactFormatter.format(value);
}
