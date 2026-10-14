import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { reportPdfLogo } from "./report-pdf-logo";

export type ReportPdfSection = {
  title: string;
  headers: string[];
  rows: string[][];
  summary?: boolean;
};

// Reuse the report's HTML content so printable and downloaded reports stay in sync.
export function readReportPdfContent(html: string) {
  const report = new DOMParser().parseFromString(html, "text/html");
  const text = (element: Element | null) => element?.textContent?.trim() ?? "";
  const sections: ReportPdfSection[] = Array.from(report.querySelectorAll(".section"))
    .map((section) => {
      const cards = Array.from(section.querySelectorAll(".summary-card"));
      return {
        title: text(section.querySelector("h2")),
        summary: cards.length > 0,
        headers: cards.length ? ["Metric", "Value"] :
          Array.from(section.querySelectorAll("thead th")).map(text),
        rows: cards.length ? cards.map((card) => [
          text(card.querySelector(".summary-label")),
          text(card.querySelector(".summary-value")),
        ]) : Array.from(section.querySelectorAll("tbody tr"))
          .map((row) => Array.from(row.querySelectorAll("td")).map(text)),
      };
    });
  return {
    title: text(report.querySelector("h1")),
    metadata: Array.from(report.querySelectorAll(".meta > div")).map(text),
    sections,
  };
}

// Only compare like-for-like values; quantities with mixed units are left in tables.
export function readReportChart(section: ReportPdfSection) {
  if (section.summary || /Metric/i.test(section.headers[0] ?? "")) return null;
  if (!/sales|usage|stockout|selling|payment|categor|product|variant|staff|hour|waste|reason/i.test(section.title)
    || /movement|transaction|audit|split payment/i.test(section.title)) return null;
  const preferredIndex = section.headers.findIndex(label => /^net sales$/i.test(label));
  const valueIndex = preferredIndex >= 0 ? preferredIndex : section.headers.findIndex(label => /^(revenue|consumption cost|consumed cost|cost|waste cost|gross sales|collected amount|amount|completed sales.*|stockout rate.*|availability.*)$/i.test(label));
  if (valueIndex < 0) return null;
  const points = section.rows.flatMap(row => {
    const raw = row[valueIndex]?.replace(/PHP|\u20b1|,|%/g, "").trim();
    if (!raw || !/^-?\d+(\.\d+)?$/.test(raw)) return [];
    const value = Number(raw);
    const variantIndex = section.headers.findIndex(label => /^variant$/i.test(label));
    const accountIndex = section.headers.findIndex(label => /^staff account$/i.test(label));
    const label = accountIndex >= 0 ? row[accountIndex] : variantIndex > 0 ? `${row[0]} - ${row[variantIndex]}` : row[0];
    return Number.isFinite(value) ? [{ label, value }] : [];
  });
  if (!points.length) return null;
  const chronological = /hour|grouped|trend/i.test(section.title);
  const sorted = chronological ? points : [...points].sort((a, b) => b.value - a.value);
  const metric = section.headers[valueIndex];
  const currency = section.rows.some(row => /PHP|\u20b1/.test(row[valueIndex] ?? ""));
  return { metric, currency, percent: /%|rate|availability/i.test(metric), points: sorted.slice(0, 8), total: points.length, chronological };
}

export function buildReportPdfDocument(content: {
  title: string;
  metadata: string[];
  sections: ReportPdfSection[];
}) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  pdf.setProperties({ title: content.title, subject: "Management report", author: "Cafe Salvacion", creator: "Salvacion IMS" });
  const margin = 14;
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const usable = width - margin * 2;
  const ink: [number, number, number] = [31, 49, 64];
  const accent: [number, number, number] = [24, 112, 112];
  const printable = (value: string) => value.replaceAll("\u20b1", "PHP ").replaceAll("\u00a0", " ").replace(/[\u2013\u2014]/g, "-");
  let y = 24;
  const newPage = () => { pdf.addPage(); y = 24; };
  const ensure = (space: number) => { if (y + space > height - 18) newPage(); };
  const lines = (value: string, size: number, available = usable): string[] => {
    pdf.setFontSize(size);
    return pdf.splitTextToSize(printable(value), available);
  };
  const paragraph = (value: string, size = 9, available = usable) => {
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...ink);
    for (const line of lines(value, size, available)) {
      ensure(5);
      pdf.text(line, margin, y);
      y += 4.5;
    }
  };
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...ink);
  // Reserve the upper-right corner for the same logo used on receipts.
  const titleLines = lines(content.title, 22, usable - 38);
  pdf.text(titleLines, margin, y);
  y += titleLines.length * 9 + 3;
  pdf.setDrawColor(...accent);
  pdf.setLineWidth(0.8);
  pdf.line(margin, y, width - margin, y);
  y += 7;
  for (const line of content.metadata) paragraph(line, 8.5);
  y += 5;
  paragraph("REPORT GUIDE  |  Summary metrics describe the selected period and filters. Charts highlight comparisons; the tables retain every row supplied by the report view. N/A means unavailable, not zero.", 9);
  if (content.metadata.some(line => /^Page:/i.test(line))) {
    paragraph("EXPORT SCOPE  |  This is the displayed page of results, not the complete transaction history. Summary totals may cover the full filtered period.", 9);
  }
  y += 5;

  for (const section of content.sections) {
    const summary = section.summary ?? (section.headers.length === 2 && section.headers[0] === "Metric");
    const chart = readReportChart(section);
    pdf.setFont("helvetica", "bold");
    const headingLines = lines(section.title, 12);
    ensure(headingLines.length * 5 + (summary ? 33 : chart ? chart.points.length * 8 + 43 : 27));
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(...ink);
    pdf.text(headingLines, margin, y);
    y += headingLines.length * 5 + 3;

    if (summary) {
      const columns = 4;
      const gap = 4;
      const cardWidth = (usable - gap * (columns - 1)) / columns;
      for (let offset = 0; offset < section.rows.length; offset += columns) {
        const row = section.rows.slice(offset, offset + columns);
        pdf.setFont("helvetica", "normal");
        const cards = row.map(([label, value]) => ({ label: lines(label, 8, cardWidth - 8), value: lines(value, 13, cardWidth - 8) }));
        const cardHeight = Math.max(25, ...cards.map(card => 10 + card.label.length * 3.5 + card.value.length * 5));
        ensure(cardHeight + gap);
        cards.forEach((card, i) => {
          const x = margin + i * (cardWidth + gap);
          pdf.setFillColor(242, 247, 248);
          pdf.rect(x, y, cardWidth, cardHeight, "F");
          pdf.setFillColor(...accent);
          pdf.rect(x, y, 1, cardHeight, "F");
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(80, 96, 108);
          pdf.setFontSize(8);
          pdf.text(card.label, x + 4, y + 6);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(...ink);
          pdf.setFontSize(13);
          pdf.text(card.value, x + 4, y + 10 + card.label.length * 3.5);
        });
        y += cardHeight + gap;
      }
      y += 5;
      continue;
    }

    if (chart) {
      paragraph(`${chart.metric}${chart.currency ? " (PHP)" : chart.percent ? " (%)" : ""} | ${chart.chronological ? "Report order" : "Highest values first"}. Showing ${chart.points.length} of ${chart.total} rows; see the full table below.`, 8);
      const labelWidth = 75;
      const plotX = margin + labelWidth;
      const plotWidth = usable - labelWidth - 43;
      const max = Math.max(...chart.points.map(point => Math.abs(point.value)), 1);
      const negative = chart.points.some(point => point.value < 0);
      const zeroX = negative ? plotX + plotWidth / 2 : plotX;
      const scale = (negative ? plotWidth / 2 : plotWidth) / max;
      pdf.setDrawColor(210, 220, 224);
      pdf.line(zeroX, y, zeroX, y + chart.points.length * 8);
      chart.points.forEach(point => {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(...ink);
        let label = printable(point.label);
        while (pdf.getTextWidth(label) > labelWidth - 5) label = label.slice(0, -4) + "...";
        pdf.text(label, margin, y + 5);
        const length = Math.abs(point.value) * scale;
        pdf.setFillColor(...(point.value < 0 ? [176, 77, 63] as [number, number, number] : accent));
        if (length > 0) pdf.rect(point.value < 0 ? zeroX - length : zeroX, y + 1, length, 5, "F");
        pdf.text(`${chart.currency ? "PHP " : ""}${point.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}${chart.percent ? "%" : ""}`, width - margin, y + 5, { align: "right" });
        y += 8;
      });
      y += 6;
    }
    ensure(22);
    const numericColumns = Object.fromEntries(section.headers.flatMap((label, index) =>
      /cost|amount|sales|revenue|margin|profit|quantity|qty|count|events|orders|ingredients used|material lines|variants|percentage|rate|%|discount|tax|vat|cogs|ticket|total|collected|contribution|share|reorder point/i.test(label)
        && !/id|name|date|status|note|definition|context|account|email/i.test(label)
        ? [[index, { halign: "right" as const }]] : []));
    autoTable(pdf, {
      startY: y,
      head: [section.headers.map(printable)],
      body: section.rows.length ? section.rows.map(row => row.length === 1 && section.headers.length > 1
        ? [{ content: printable(row[0]), colSpan: section.headers.length }] : row.map(printable))
        : [[{ content: "No rows match the current report view.", colSpan: section.headers.length }]],
      margin: { top: 24, bottom: 18, left: margin, right: margin },
      theme: "plain",
      styles: { fontSize: section.headers.length > 10 ? 7 : 8, cellPadding: 2.5, overflow: "linebreak", textColor: ink,
        lineColor: [221, 230, 233], lineWidth: { bottom: 0.15 } },
      headStyles: { fillColor: ink, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [244, 247, 248] },
      columnStyles: numericColumns,
      rowPageBreak: "avoid",
      showHead: "everyPage",
      didDrawPage: data => { y = data.cursor?.y ?? 24; },
    });
    y += 10;
  }
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    const logoSize = page === 1 ? 28 : 10;
    pdf.addImage(reportPdfLogo, "PNG", width - margin - logoSize,
      page === 1 ? 5 : 3, logoSize, logoSize, "receipt-header-logo", "FAST");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(...accent);
    pdf.text("CAFE SALVACION  /  MANAGEMENT REPORT", margin, 11);
    pdf.setDrawColor(221, 230, 233);
    pdf.setLineWidth(0.2);
    pdf.line(margin, 15, width - margin - (page === 1 ? logoSize + 4 : 0), 15);
    pdf.line(margin, height - 13, width - margin, height - 13);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(100);
    let footer = printable(content.title);
    while (pdf.getTextWidth(footer) > usable - 45) footer = footer.slice(0, -4) + "...";
    pdf.text(footer, margin, height - 8);
    pdf.text(`Page ${page} of ${pages}`, width - margin, height - 8, { align: "right" });
  }
  return pdf;
}
