import type { ChartTitle } from "./chart-titles";
import type { EChartsOption } from "./echarts-core";
import { echarts } from "./echarts-core";
import type { Filters } from "./types";
import { buildZip } from "./zip";

export interface ChartExportRows {
  headers: string[];
  rows: (string | number)[][];
}

export interface ChartExportSource {
  getFilenameBase: () => string;
  getRows: () => ChartExportRows;
  getExportOption: () => EChartsOption;
}

export interface ChartExportSize {
  width: number;
  height: number;
}

export const EXPORT_WIDTH = 820;

const TITLE_MIN_FONT_SCALE = 0.8;
const TITLE_FONT_SCALE_STEP = 0.02;
const TITLE_SHORT_LAST_LINE_RATIO = 0.4;

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function slugifyValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function buildFilenameBase(chartSlug: string, filters: Filters): string {
  return [
    "causa-mortis",
    chartSlug,
    slugifyValue(filters.location),
    slugifyValue(filters.sex),
    String(filters.year),
  ].join("-");
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (currentLine && ctx.measureText(testLine).width > maxWidth) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function opticalAscent(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: string,
): number {
  ctx.font = font;
  const capAscent = ctx.measureText(text).actualBoundingBoxAscent;
  const xHeightAscent = ctx.measureText("n").actualBoundingBoxAscent;
  const letters = text.match(/\p{L}/gu) ?? [];
  const uppercaseCount = text.match(/\p{Lu}/gu)?.length ?? 0;
  const uppercaseRatio = letters.length ? uppercaseCount / letters.length : 0;
  return xHeightAscent + (capAscent - xHeightAscent) * uppercaseRatio;
}

function textBaselineForCenter(
  ctx: CanvasRenderingContext2D,
  centerY: number,
  entries: { text: string; font: string }[],
): number {
  let ascent = 0;
  let descent = 0;
  for (const entry of entries) {
    ctx.font = entry.font;
    const metrics = ctx.measureText(entry.text);
    descent = Math.max(descent, metrics.actualBoundingBoxDescent);
    ascent = Math.max(ascent, opticalAscent(ctx, entry.text, entry.font));
  }
  return centerY + (ascent - descent) / 2;
}

function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function captureOffscreen(
  exportSize: ChartExportSize,
  pixelRatio: number,
  option: EChartsOption,
): Promise<HTMLCanvasElement> {
  const offscreen = document.createElement("div");
  offscreen.style.cssText = `position:fixed;left:-9999px;top:0;width:${exportSize.width}px;height:${exportSize.height}px;`;
  document.body.append(offscreen);
  const tempChart = echarts.init(offscreen, undefined, {
    width: exportSize.width,
    height: exportSize.height,
  });

  try {
    await new Promise<void>((resolve) => {
      tempChart.on("finished", () => resolve());
      tempChart.setOption(option, { notMerge: true });
    });
    return tempChart.renderToCanvas({ pixelRatio, backgroundColor: "#fff" });
  } finally {
    tempChart.dispose();
    offscreen.remove();
  }
}

interface FittedText {
  lines: string[];
  fontSize: number;
}

function fitHeadingLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  baseFontSize: number,
  fontFamily: string,
): FittedText {
  const wrapAt = (fontSize: number): string[] => {
    ctx.font = `700 ${fontSize}px ${fontFamily}`;
    return wrapText(ctx, text, maxWidth);
  };

  const baseLines = wrapAt(baseFontSize);
  const lastLine = baseLines[baseLines.length - 1];
  if (baseLines.length < 2 || lastLine === undefined)
    return { lines: baseLines, fontSize: baseFontSize };

  ctx.font = `700 ${baseFontSize}px ${fontFamily}`;
  if (ctx.measureText(lastLine).width >= maxWidth * TITLE_SHORT_LAST_LINE_RATIO)
    return { lines: baseLines, fontSize: baseFontSize };

  for (
    let scale = 1 - TITLE_FONT_SCALE_STEP;
    scale >= TITLE_MIN_FONT_SCALE;
    scale -= TITLE_FONT_SCALE_STEP
  ) {
    const fontSize = baseFontSize * scale;
    const lines = wrapAt(fontSize);
    if (lines.length < baseLines.length) return { lines, fontSize };
  }

  return { lines: baseLines, fontSize: baseFontSize };
}

export async function exportChartImage(
  exportSize: ChartExportSize,
  title: ChartTitle,
  subtitle: string,
  description: string,
  filenameBase: string,
  getExportOption: () => EChartsOption,
): Promise<void> {
  const pixelRatio = 3;
  await nextPaint();
  await document.fonts.ready;

  const chartCanvas = await captureOffscreen(
    exportSize,
    pixelRatio,
    getExportOption(),
  );

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Falha ao criar o canvas de exportação.");

  const fontFamily = getComputedStyle(document.body).fontFamily;
  const rootStyle = getComputedStyle(document.documentElement);
  const titleColor = rootStyle.getPropertyValue("--color-gray-800").trim();
  const titleMetaColor =
    rootStyle.getPropertyValue("--color-gray-500").trim() || "#5e6e8c";
  const secondaryTextColor =
    rootStyle.getPropertyValue("--color-gray-600").trim() || "#445269";
  const canvasBackgroundColor =
    rootStyle.getPropertyValue("--color-gray-100").trim() || "#f3f4f6";

  const padding = 24 * pixelRatio;
  const blockWidth = chartCanvas.width;
  const contentWidth = blockWidth - padding * 2;
  const titleFontSize = 22 * pixelRatio;
  const metaFontSize = 15 * pixelRatio;
  const descriptionFontSize = 14 * pixelRatio;
  const footerFontSize = 12 * pixelRatio;
  const lineGap = 6 * pixelRatio;
  const blockGap = 4 * pixelRatio;
  const headerToChartGap = padding;
  const chartToFooterGap = padding;
  const chartStripGap = 16 * pixelRatio;

  const { lines: headingLines, fontSize: headingFontSize } = fitHeadingLines(
    ctx,
    title.line1.toUpperCase(),
    contentWidth,
    titleFontSize,
    fontFamily,
  );

  ctx.font = `400 ${metaFontSize}px ${fontFamily}`;
  const titleMetaLines = title.line2
    ? wrapText(ctx, title.line2.toUpperCase(), contentWidth)
    : [];

  ctx.font = `400 ${descriptionFontSize}px ${fontFamily}`;
  const descriptionLines = description
    ? wrapText(ctx, description, contentWidth)
    : [];

  const titleHeight =
    headingLines.length * (headingFontSize + lineGap) +
    titleMetaLines.length * (metaFontSize + lineGap);
  const subtitleHeight = subtitle ? metaFontSize + lineGap + blockGap : 0;
  const descriptionHeight = descriptionLines.length
    ? descriptionLines.length * (descriptionFontSize + lineGap) + blockGap
    : 0;
  const headerContentHeight = titleHeight + subtitleHeight + descriptionHeight;

  const naturalBlockHeight =
    padding +
    headerContentHeight +
    headerToChartGap +
    chartCanvas.height +
    chartToFooterGap +
    footerFontSize +
    padding;

  const squareSize = Math.max(blockWidth, naturalBlockHeight);
  const offsetX = (squareSize - blockWidth) / 2;
  const extraVerticalSpace = (squareSize - naturalBlockHeight) / 2;
  const effectiveHeaderToChartGap = headerToChartGap + extraVerticalSpace;
  const effectiveChartToFooterGap = chartToFooterGap + extraVerticalSpace;

  canvas.width = squareSize;
  canvas.height = squareSize;

  ctx.fillStyle = canvasBackgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const chartStripTop = padding + headerContentHeight + chartStripGap;
  const chartStripBottom =
    padding +
    headerContentHeight +
    effectiveHeaderToChartGap +
    chartCanvas.height +
    effectiveChartToFooterGap -
    chartStripGap;
  ctx.fillStyle = "#fff";
  ctx.fillRect(
    0,
    chartStripTop,
    canvas.width,
    chartStripBottom - chartStripTop,
  );

  const centerX = offsetX + blockWidth / 2;
  ctx.textBaseline = "top";
  ctx.textAlign = "center";

  let y = padding;
  ctx.fillStyle = titleColor || "#1f2937";
  ctx.font = `700 ${headingFontSize}px ${fontFamily}`;
  for (const line of headingLines) {
    ctx.fillText(line, centerX, y);
    y += headingFontSize + lineGap;
  }

  ctx.fillStyle = titleMetaColor;
  ctx.font = `400 ${metaFontSize}px ${fontFamily}`;
  for (const line of titleMetaLines) {
    ctx.fillText(line, centerX, y);
    y += metaFontSize + lineGap;
  }

  if (subtitle) {
    y += blockGap;
    ctx.fillStyle = titleMetaColor;
    ctx.font = `400 ${metaFontSize}px ${fontFamily}`;
    ctx.fillText(subtitle, centerX, y);
    y += metaFontSize + lineGap;
  }

  if (descriptionLines.length) {
    y += blockGap;
    ctx.fillStyle = secondaryTextColor;
    ctx.font = `400 ${descriptionFontSize}px ${fontFamily}`;
    for (const line of descriptionLines) {
      ctx.fillText(line, centerX, y);
      y += descriptionFontSize + lineGap;
    }
  }

  const chartY = padding + headerContentHeight + effectiveHeaderToChartGap;
  ctx.drawImage(chartCanvas, offsetX, chartY);

  const footerCenterY = (chartStripBottom + squareSize) / 2;
  ctx.textBaseline = "alphabetic";

  const brandFontSize = footerFontSize * 1.35;
  const brandFontLight = `300 ${brandFontSize}px ${fontFamily}`;
  const brandFontBold = `800 ${brandFontSize}px ${fontFamily}`;
  const brandBaselineY = textBaselineForCenter(ctx, footerCenterY, [
    { text: "causa", font: brandFontLight },
    { text: "mortis", font: brandFontBold },
    { text: ".net", font: brandFontLight },
  ]);

  const brandLeftX = offsetX + padding;
  ctx.textAlign = "left";
  ctx.fillStyle = secondaryTextColor;
  ctx.font = brandFontLight;
  ctx.fillText("causa", brandLeftX, brandBaselineY);
  const brandCausaWidth = ctx.measureText("causa").width;

  ctx.fillStyle = titleColor || "#1f2937";
  ctx.font = brandFontBold;
  ctx.fillText("mortis", brandLeftX + brandCausaWidth, brandBaselineY);
  const brandMortisWidth = ctx.measureText("mortis").width;

  ctx.fillStyle = secondaryTextColor;
  ctx.font = brandFontLight;
  ctx.fillText(
    ".net",
    brandLeftX + brandCausaWidth + brandMortisWidth,
    brandBaselineY,
  );

  const sourceFont = `500 ${footerFontSize}px ${fontFamily}`;
  const sourceText = "Fonte: SIM/DATASUS · IBGE";
  const sourceBaselineY = textBaselineForCenter(ctx, footerCenterY, [
    { text: sourceText, font: sourceFont },
  ]);
  ctx.fillStyle = secondaryTextColor;
  ctx.font = sourceFont;
  ctx.textAlign = "right";
  ctx.fillText(sourceText, offsetX + blockWidth - padding, sourceBaselineY);
  ctx.textBaseline = "top";

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("Falha ao gerar o arquivo de imagem.");
  downloadBlob(blob, `${filenameBase}.png`);
}

function escapeCsvValue(value: string | number): string {
  const text = String(value);
  return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function rowsToCsv(headers: string[], rows: (string | number)[][]): string {
  return [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(";"))
    .join("\r\n");
}

export function exportCsv(
  headers: string[],
  rows: (string | number)[][],
  filenameBase: string,
): void {
  const csv = rowsToCsv(headers, rows);
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8",
  });
  downloadBlob(blob, `${filenameBase}.csv`);
}

function columnLetter(index: number): string {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cellXml(
  rowNumber: number,
  colIndex: number,
  value: string | number,
): string {
  const ref = `${columnLetter(colIndex)}${rowNumber}`;
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`;
}

function buildSheetXml(headers: string[], rows: (string | number)[][]): string {
  const headerRow = `<row r="1">${headers.map((value, colIndex) => cellXml(1, colIndex, value)).join("")}</row>`;
  const dataRows = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 2;
      const cells = row
        .map((value, colIndex) => cellXml(rowNumber, colIndex, value))
        .join("");
      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${headerRow}${dataRows}</sheetData></worksheet>`;
}

export function exportXlsx(
  headers: string[],
  rows: (string | number)[][],
  filenameBase: string,
  sheetName: string,
): void {
  const encoder = new TextEncoder();
  const safeSheetName =
    escapeXml(sheetName.replace(/[[\]:*?/\\]/g, " ").trim()).slice(0, 31) ||
    "Dados";

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${safeSheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;

  const sheetXml = buildSheetXml(headers, rows);

  const zip = buildZip([
    { name: "[Content_Types].xml", data: encoder.encode(contentTypes) },
    { name: "_rels/.rels", data: encoder.encode(rootRels) },
    { name: "xl/workbook.xml", data: encoder.encode(workbookXml) },
    { name: "xl/_rels/workbook.xml.rels", data: encoder.encode(workbookRels) },
    { name: "xl/worksheets/sheet1.xml", data: encoder.encode(sheetXml) },
  ]);

  downloadBlob(
    new Blob([zip], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${filenameBase}.xlsx`,
  );
}

export function setupChartExport(
  card: ParentNode,
  exportSize: ChartExportSize,
  source: ChartExportSource,
): void {
  const details = card.querySelector("[data-chart-export]");
  if (!details) return;

  const trigger = details.querySelector("[data-chart-export-trigger]");
  const defaultIcon = trigger?.querySelector("[data-export-icon-default]");
  const loadingIcon = trigger?.querySelector("[data-export-icon-loading]");
  const errorIcon = trigger?.querySelector("[data-export-icon-error]");
  const formatButtons = details.querySelectorAll<HTMLButtonElement>(
    "[data-export-format]",
  );
  let errorResetTimeout: ReturnType<typeof setTimeout> | undefined;

  function setBusy(busy: boolean): void {
    clearTimeout(errorResetTimeout);
    for (const button of formatButtons) button.disabled = busy;
    defaultIcon?.toggleAttribute("hidden", busy);
    loadingIcon?.toggleAttribute("hidden", !busy);
    errorIcon?.toggleAttribute("hidden", true);
  }

  function flashError(): void {
    clearTimeout(errorResetTimeout);
    defaultIcon?.toggleAttribute("hidden", true);
    errorIcon?.toggleAttribute("hidden", false);
    errorResetTimeout = setTimeout(() => {
      defaultIcon?.toggleAttribute("hidden", false);
      errorIcon?.toggleAttribute("hidden", true);
    }, 2000);
  }

  if (details instanceof HTMLDetailsElement) {
    const menu = details.querySelector<HTMLElement>(".chart-export-menu");

    details.addEventListener("toggle", () => {
      if (!details.open || !menu || !trigger) return;
      const triggerRect = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - triggerRect.bottom;
      const spaceAbove = triggerRect.top;
      const flipUp = spaceBelow < menu.offsetHeight && spaceAbove > spaceBelow;
      menu.toggleAttribute("data-flip-up", flipUp);
    });

    document.addEventListener("click", (event) => {
      if (!details.open) return;
      if (event.target instanceof Node && !details.contains(event.target))
        details.open = false;
    });
  }

  for (const button of formatButtons) {
    button.addEventListener("click", () => {
      const titleLine1 =
        card.querySelector("[data-chart-title-line1]")?.textContent?.trim() ??
        card.querySelector("[data-chart-title]")?.textContent?.trim() ??
        "";
      const titleLine2 =
        card.querySelector("[data-chart-title-line2]")?.textContent?.trim() ??
        "";
      const title = { line1: titleLine1, line2: titleLine2 };
      const sheetTitle = [titleLine1, titleLine2].filter(Boolean).join(" ");
      const subtitle =
        card.querySelector("[data-chart-subtitle]")?.textContent?.trim() ?? "";
      const description =
        card.querySelector("[data-chart-description]")?.textContent?.trim() ??
        "";
      const filenameBase = source.getFilenameBase();
      const format = button.dataset.exportFormat;
      if (details instanceof HTMLDetailsElement) details.open = false;

      if (format === "png") {
        setBusy(true);
        exportChartImage(
          exportSize,
          title,
          subtitle,
          description,
          filenameBase,
          source.getExportOption,
        )
          .catch((error: unknown) => {
            console.error("Falha ao exportar imagem do gráfico.", error);
            flashError();
          })
          .finally(() => setBusy(false));
      } else if (format === "csv") {
        const { headers, rows } = source.getRows();
        exportCsv(headers, rows, filenameBase);
      } else if (format === "xlsx") {
        const { headers, rows } = source.getRows();
        exportXlsx(headers, rows, filenameBase, sheetTitle);
      }
    });
  }
}
