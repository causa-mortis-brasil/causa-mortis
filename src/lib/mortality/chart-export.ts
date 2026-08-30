import type { EChartsType } from "./echarts-core";
import type { Filters } from "./types";
import { buildZip } from "./zip";

export interface ChartExportRows {
  headers: string[];
  rows: (string | number)[][];
}

export interface ChartExportSource {
  getFilenameBase: () => string;
  getRows: () => ChartExportRows;
}

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

function wrapText(
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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Falha ao carregar a imagem do gráfico."));
    image.src = src;
  });
}

export async function exportChartImage(
  chart: EChartsType,
  title: string,
  subtitle: string,
  description: string,
  filenameBase: string,
): Promise<void> {
  const pixelRatio = 4;
  await document.fonts.ready;
  const chartImage = await loadImage(
    chart.getDataURL({ type: "png", pixelRatio, backgroundColor: "#fff" }),
  );

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const fontFamily = getComputedStyle(document.body).fontFamily;
  const rootStyle = getComputedStyle(document.documentElement);
  const titleColor = rootStyle.getPropertyValue("--color-gray-800").trim();
  const subtitleColor = rootStyle
    .getPropertyValue("--color-primary-600")
    .trim();
  const descriptionColor = rootStyle
    .getPropertyValue("--color-gray-600")
    .trim();
  const footerColor = rootStyle.getPropertyValue("--color-gray-500").trim();

  const padding = 24 * pixelRatio;
  const width = chartImage.width;
  const contentWidth = width - padding * 2;
  const titleFontSize = 18 * pixelRatio;
  const subtitleFontSize = 14 * pixelRatio;
  const descriptionFontSize = 14 * pixelRatio;
  const footerFontSize = 12 * pixelRatio;
  const lineGap = 6 * pixelRatio;
  const blockGap = 4 * pixelRatio;

  ctx.font = `700 ${titleFontSize}px ${fontFamily}`;
  const titleLines = wrapText(ctx, title.toUpperCase(), contentWidth);

  ctx.font = `400 ${descriptionFontSize}px ${fontFamily}`;
  const descriptionLines = description
    ? wrapText(ctx, description, contentWidth)
    : [];

  const titleHeight = titleLines.length * (titleFontSize + lineGap);
  const subtitleHeight = subtitle ? subtitleFontSize + lineGap + blockGap : 0;
  const descriptionHeight = descriptionLines.length
    ? descriptionLines.length * (descriptionFontSize + lineGap) + blockGap
    : 0;
  const headerHeight =
    padding + titleHeight + subtitleHeight + descriptionHeight + padding;
  const footerHeight = footerFontSize + padding * 1.5;

  canvas.width = width;
  canvas.height = headerHeight + chartImage.height + footerHeight;

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const centerX = width / 2;
  ctx.textBaseline = "top";
  ctx.textAlign = "center";

  let y = padding;
  ctx.fillStyle = titleColor || "#1f2937";
  ctx.font = `700 ${titleFontSize}px ${fontFamily}`;
  for (const line of titleLines) {
    ctx.fillText(line, centerX, y);
    y += titleFontSize + lineGap;
  }

  if (subtitle) {
    y += blockGap;
    ctx.fillStyle = subtitleColor || "#0156d5";
    ctx.font = `500 ${subtitleFontSize}px ${fontFamily}`;
    ctx.fillText(subtitle, centerX, y);
    y += subtitleFontSize + lineGap;
  }

  if (descriptionLines.length) {
    y += blockGap;
    ctx.fillStyle = descriptionColor || "#4b5563";
    ctx.font = `400 ${descriptionFontSize}px ${fontFamily}`;
    for (const line of descriptionLines) {
      ctx.fillText(line, centerX, y);
      y += descriptionFontSize + lineGap;
    }
  }

  ctx.drawImage(chartImage, 0, headerHeight);

  const footerY = headerHeight + chartImage.height + padding / 2;
  ctx.fillStyle = footerColor || "#6b7280";
  ctx.font = `500 ${footerFontSize}px ${fontFamily}`;
  ctx.textAlign = "left";
  ctx.fillText("Fonte: SIM/DATASUS · IBGE", padding, footerY);
  ctx.textAlign = "right";
  ctx.fillText("Do que morremos", width - padding, footerY);
  ctx.textAlign = "left";

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (blob) downloadBlob(blob, `${filenameBase}.png`);
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
  chart: EChartsType,
  source: ChartExportSource,
): void {
  const details = card.querySelector("[data-chart-export]");
  if (!details) return;

  if (details instanceof HTMLDetailsElement) {
    document.addEventListener("click", (event) => {
      if (!details.open) return;
      if (event.target instanceof Node && !details.contains(event.target))
        details.open = false;
    });
  }

  for (const button of details.querySelectorAll<HTMLButtonElement>(
    "[data-export-format]",
  )) {
    button.addEventListener("click", () => {
      const title =
        card.querySelector("[data-chart-title]")?.textContent?.trim() ?? "";
      const subtitle =
        card.querySelector("[data-chart-subtitle]")?.textContent?.trim() ?? "";
      const description =
        card.querySelector("[data-chart-description]")?.textContent?.trim() ??
        "";
      const filenameBase = source.getFilenameBase();
      const format = button.dataset.exportFormat;
      if (format === "png") {
        void exportChartImage(
          chart,
          title,
          subtitle,
          description,
          filenameBase,
        );
      } else if (format === "csv") {
        const { headers, rows } = source.getRows();
        exportCsv(headers, rows, filenameBase);
      } else if (format === "xlsx") {
        const { headers, rows } = source.getRows();
        exportXlsx(headers, rows, filenameBase, title);
      }
      if (details instanceof HTMLDetailsElement) details.open = false;
    });
  }
}
