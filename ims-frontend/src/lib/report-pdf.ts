import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

export type ReportPdfSection = {
  title: string;
  headers: string[];
  rows: string[][];
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

export function buildReportPdfDocument(content: {
  title: string;
  metadata: string[];
  sections: ReportPdfSection[];
}) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  pdf.setProperties({ title: content.title, subject: "Inventory report", creator: "Salvacion IMS" });
  const margin = 14;
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  // Built-in PDF fonts do not contain the peso glyph; keep currency explicit.
  const printable = (value: string) => value.replaceAll("₱", "PHP ").replaceAll("\u00a0", " ");
  let y = 20;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(19);
  pdf.text(content.title, margin, y);
  y += 8;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  for (const line of content.metadata) {
    const wrapped: string[] = pdf.splitTextToSize(printable(line), width - margin * 2);
    for (const part of wrapped) {
      if (y > height - 20) {
        pdf.addPage();
        y = 22;
      }
      pdf.text(part, margin, y);
      y += 4.5;
    }
  }
  for (const section of content.sections) {
    y += 8;
    if (y > height - 35) {
      pdf.addPage();
      y = 22;
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text(section.title, margin, y);
    autoTable(pdf, {
      startY: y + 4,
      head: [section.headers.map(printable)],
      body: section.rows.map((row) => row.map(printable)),
      margin: { top: 18, bottom: 18, left: margin, right: margin },
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2.5, overflow: "linebreak" },
      headStyles: { fillColor: [22, 75, 55], fontSize: 8 },
      rowPageBreak: "avoid",
      showHead: "everyPage",
      didDrawPage: (data) => { y = data.cursor?.y ?? 22; },
    });
  }
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(100);
    pdf.text(content.title, margin, height - 8);
    pdf.text(`Page ${page} of ${pages}`, width - margin, height - 8, { align: "right" });
  }
  return pdf;
}
