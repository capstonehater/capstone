import { strToU8, zipSync } from "fflate";

type Section = { title: string; headers: string[]; rows: string[][] };
const MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

function xml(value: unknown) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

/** Read the existing report section data without losing quoted commas or line breaks. */
export function readReportSections(content: string) {
  const records: string[][] = [];
  let row: string[] = [], value = "", quoted = false;
  const source = content.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') { value += '"'; index++; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(value); value = ""; }
    else if ((char === "\r" || char === "\n") && !quoted) {
      if (char === "\r" && source[index + 1] === "\n") index++;
      records.push([...row, value]); row = []; value = "";
    } else value += char;
  }
  if (value || row.length) records.push([...row, value]);
  const groups: string[][][] = [[]];
  for (const record of records) {
    if (record.every(cell => !cell)) { if (groups.at(-1)?.length) groups.push([]); }
    else groups.at(-1)!.push(record);
  }
  const metadata = groups.shift() ?? [];
  const sections: Section[] = groups.filter(group => group.length >= 2).map(group => ({
    title: group[0][0], headers: group[1],
    rows: group.slice(2).filter(row => row[0] !== "No rows match the current report view."),
  }));
  return { title: (metadata[0]?.[0] ?? "Report").replace(/ Export$/, ""), metadata: metadata.slice(1), sections };
}

function column(index: number) {
  let result = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + (n - 1) % 26) + result;
  return result;
}

function typed(value: string, label: string): { value: string | number; style: number } {
  if (!value || /^(N\/A|None|None selected)$/i.test(value)) return { value: value || "—", style: 0 };
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return { value: (Date.parse(value) + 8 * 60 * 60 * 1000 - Date.UTC(1899, 11, 30)) / 86400000, style: 6 };
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) && /date|from|to|expiry|expired/i.test(label)) return { value: (Date.parse(value + "T00:00:00Z") - Date.UTC(1899, 11, 30)) / 86400000, style: 7 };
  const numeric = value.replace(/[₱,%]/g, "").trim();
  if (/^-?\d+(\.\d+)?$/.test(numeric) && !/SKU|\bID\b|reference|phone|order number|transaction$|^order$|^hour$/i.test(label)) {
    if (/%|percentage|rate|availability/i.test(label) && value.endsWith("%")) return { value: Number(numeric) / 100, style: 5 };
    if (/cost|sales|revenue|amount|refund|discount|ticket|spend|margin|cogs|average inventory/i.test(label) && !/%|rate|percentage/.test(label)) return { value: Number(numeric), style: 4 };
    if (/qty|quantity|count|events|orders|variants|transactions|materials|units|point|rate|turnover|sold|value/i.test(label)) return { value: Number(numeric), style: 3 };
  }
  return { value, style: 0 };
}

function cell(ref: string, value: string | number, style = 0) {
  return typeof value === "number"
    ? `<c r="${ref}" s="${style}"><v>${value}</v></c>`
    : `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}

const styles = `<styleSheet xmlns="${MAIN}"><numFmts count="5"><numFmt numFmtId="164" formatCode="#,##0.####"/><numFmt numFmtId="165" formatCode="&quot;₱&quot;#,##0.00;[Red](&quot;₱&quot;#,##0.00)"/><numFmt numFmtId="166" formatCode="0.00%"/><numFmt numFmtId="167" formatCode="mmm d, yyyy h:mm AM/PM"/><numFmt numFmtId="168" formatCode="mmm d, yyyy"/></numFmts><fonts count="3"><font><sz val="11"/><color rgb="FF232D46"/><name val="Century Gothic"/></font><font><b/><sz val="20"/><color rgb="FF232D46"/><name val="Century Gothic"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Century Gothic"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF232D46"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="167" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="168" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

const names: Record<string, string> = {
  "KPI Summary": "Inventory Summary", "Availability & Stock Risk Summary": "Stock Risk Summary",
  "Availability & Stock Risk Definitions": "Metric Guide", "Materials With Recorded Stockout Time": "Stockouts",
  "Top-Selling Item Availability": "Product Availability", "Inventory-Linked Sales Consumption Summary": "Material Use Summary",
  "Top Variants by Sales-Linked Consumption": "Product Material Use", "Recent Sales-Linked Stock Movements": "Sales Stock Movements",
  "Low-Stock or Reorder-Oriented Materials": "Low Stock Materials", "Selected Variant Material Breakdown": "Variant Material Breakdown",
  "Waste Insight Breakdown": "Waste Breakdown",
};
const labels: Record<string, string> = { COGS: "Cost of Goods Sold", "Consumed Qty": "Quantity Used", "Consumption Cost": "Material Cost Used (PHP)", "Raw Materials": "Ingredients Used", "Occurred At": "Date / Time", Transaction: "Stock Transaction ID", Order: "Order ID", "Qty Sold": "Quantity Sold", "Usable Qty": "Usable Stock", "COGS %": "Cost of Goods Sold (%)" };

/** Produce a real Office Open XML workbook using the app's existing ZIP library. */
export function buildReportExcel(content: string) {
  const report = readReportSections(content);
  const summaryRows = report.sections.filter(section => section.headers[0] === "Metric" && section.headers[1] === "Value")
    .flatMap(section => section.rows);
  const details = report.sections.filter(section => !(section.headers[0] === "Metric" && section.headers[1] === "Value"));
  const overview: Section = { title: report.title, headers: ["Report Information", "Details"], rows: [
    ...report.metadata.map(([key, value]) => [key === "Generated At" ? "Generated (Manila time)" : key, value || "All"]),
    ["How to use", "Choose a sheet tab below. Use the heading arrows to filter records. Amounts are in Philippine pesos (PHP)."],
    ["Report scope", "This file is a snapshot of the selected dates and report filters. Export again after changing the dates."],
    ...summaryRows,
  ] };
  const sections = [overview, ...details];
  const used = new Set<string>();
  const sheetNames = sections.map((section, index) => {
    const base = index === 0 ? "Overview" : (names[section.title] ?? section.title).replace(/[\\/?*\[\]:]/g, " ").slice(0, 31);
    let name = base, suffix = 2;
    while (used.has(name.toLowerCase())) name = `${base.slice(0, 27)} ${suffix++}`;
    used.add(name.toLowerCase()); return name;
  });
  const files: Record<string, Uint8Array> = {};
  const put = (name: string, value: string) => { files[name] = strToU8(declaration + value); };
  put("[Content_Types].xml", `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sections.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`);
  put("_rels/.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  put("xl/workbook.xml", `<workbook xmlns="${MAIN}" xmlns:r="${REL}"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheetNames.map((name, index) => `<sheet name="${xml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets></workbook>`);
  put("xl/_rels/workbook.xml.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sections.map((_, index) => `<Relationship Id="rId${index + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}<Relationship Id="styles" Type="${REL}/styles" Target="styles.xml"/></Relationships>`);
  put("xl/styles.xml", styles);
  sections.forEach((section, index) => {
    const lastCol = column(section.headers.length - 1);
    const rows = [`<row r="1" ht="34" customHeight="1">${cell("A1", section.title, 1)}</row>`,
      `<row r="2" ht="26" customHeight="1">${cell("A2", `Reporting dates: ${report.metadata.find(row => row[0] === "From")?.[1] ?? "All"} to ${report.metadata.find(row => row[0] === "To")?.[1] ?? "All"}`)}</row>`,
      `<row r="3" ht="28" customHeight="1">${cell("A3", index === 0 ? "Start here for report dates and key totals. Detailed records are on the other sheet tabs." : "Use the column heading arrows to find records. Currency amounts are in PHP.")}</row>`,
      `<row r="5" ht="36" customHeight="1">${section.headers.map((header, col) => cell(`${column(col)}5`, labels[header] ?? header, 2)).join("")}</row>`];
    if (!section.rows.length) rows.push(`<row r="6" ht="30" customHeight="1">${cell("A6", "No records for the selected dates and filters.")}</row>`);
    section.rows.forEach((record, rowIndex) => {
      const height = Math.min(409, Math.max(30, ...record.map(value => 16 * Math.ceil(value.length / (index === 0 ? 65 : 32)))));
      rows.push(`<row r="${rowIndex + 6}" ht="${height}" customHeight="1">${record.map((value, col) => {
        const label = index === 0 && col === 1 ? record[0] : section.headers[col] ?? "";
        const result = typed(value, label);
        if (index === 0 && col === 1 && record[0] === "Total Waste Cost") {
          const wasteIndex = sections.findIndex(section => section.title === "Waste Insight Breakdown");
          const waste = sections[wasteIndex];
          if (waste?.rows.length) {
            const costCol = column(waste.headers.indexOf("Cost"));
            return `<c r="B${rowIndex + 6}" s="4"><f>SUM('${xml(sheetNames[wasteIndex].replaceAll("'", "''"))}'!${costCol}6:${costCol}${waste.rows.length + 5})</f><v>${result.value}</v></c>`;
          }
        }
        return cell(`${column(col)}${rowIndex + 6}`, result.value, result.style);
      }).join("")}</row>`);
    });
    if (section.title === "Waste Insight Breakdown" && section.rows.length) {
      const costIndex = section.headers.indexOf("Cost");
      const costCol = column(costIndex);
      const total = section.rows.reduce((sum, row) => sum + Number(row[costIndex]), 0);
      rows.push(`<row r="${section.rows.length + 7}" ht="30" customHeight="1">${cell(`A${section.rows.length + 7}`, "Total Waste Cost", 2)}<c r="${costCol}${section.rows.length + 7}" s="4"><f>SUM(${costCol}6:${costCol}${section.rows.length + 5})</f><v>${total}</v></c></row>`);
    }
    const cols = section.headers.map((header, col) => {
      const width = index === 0 ? (col === 0 ? 38 : 96) : /ID|Transaction|Order$/.test(labels[header] ?? header) ? 40 : /Definition|Context|Note|Items|Reason/.test(header) ? 42 : /Material|Product|Variant|Staff/.test(header) ? 30 : 22;
      return `<col min="${col + 1}" max="${col + 1}" width="${width}" customWidth="1"/>`;
    }).join("");
    put(`xl/worksheets/sheet${index + 1}.xml`, `<worksheet xmlns="${MAIN}"><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="24"/><cols>${cols}</cols><sheetData>${rows.join("")}</sheetData>${section.rows.length ? `<autoFilter ref="A5:${lastCol}${section.rows.length + 5}"/>` : ""}<mergeCells count="3"><mergeCell ref="A1:${lastCol}1"/><mergeCell ref="A2:${lastCol}2"/><mergeCell ref="A3:${lastCol}3"/></mergeCells><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`);
  });
  return zipSync(files, { level: 6 });
}

export async function downloadReportExcel(filename: string, content: string) {
  if (typeof window === "undefined") throw new Error("Exports are only available in the browser.");
  const bytes = buildReportExcel(content);
  const blob = new Blob([new Uint8Array(bytes).buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
