import type { PosOrder } from "./pos";
import { formatName, formatPeso } from "./pos-utils";

// All order content is escaped before it enters the standalone HTML document.
function escapeHtml(value: string | number) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

export function buildReceiptHtml(order: PosOrder, logoUrl = "/cs-receipt.svg", footerLogoUrl = "/bottom-header.svg") {
  const text = escapeHtml;
  const money = (value: string | number) => text(formatPeso(value));
  const paid = Math.round(order.payments.reduce((sum, payment) => sum + Number(payment.amount), 0) * 100) / 100;
  const change = Math.max(0, Math.round((paid - Number(order.totalAmount)) * 100) / 100);
  const date = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short",
  }).format(new Date(order.completedAt));
  const row = (label: string, value: string, className = "") => `<div class="row ${className}"><span>${text(label)}</span><span>${value}</span></div>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Receipt ${text(order.displayOrderNumber)} — Café Salvacion</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#edf2f8;color:#232d46;font:12px/1.5 "Courier New",monospace} .receipt{width:80mm;max-width:100%;margin:20px auto;padding:7mm 5mm;background:#fffdf7;box-shadow:0 4px 24px #232d4618}header,footer{text-align:center}header img{display:block;width:42mm;height:42mm;object-fit:contain;margin:0 auto 8px}h1{font:700 15px Georgia,serif;margin:0}p{margin:5px 0}.meta{margin:14px 0;overflow-wrap:anywhere}.status{font-weight:bold;letter-spacing:2px}table{width:100%;border-collapse:collapse;table-layout:fixed}th{font-size:10px;text-align:left;text-transform:uppercase;border-bottom:2px dotted #34445f;padding:8px 0}th:nth-child(2){width:28px;text-align:center}th:last-child{width:76px;text-align:right}td{padding:10px 0;vertical-align:top;border-bottom:2px dotted #34445f;overflow-wrap:anywhere}td:nth-child(2){text-align:center}td:last-child{text-align:right;font-weight:bold;white-space:nowrap}.name{font:700 15px Georgia,serif}.detail{font-size:10px;margin-top:3px}.totals,.payments{padding:12px 0;border-bottom:2px dotted #34445f}.row{display:flex;justify-content:space-between;gap:10px;margin:5px 0}.row span:first-child{overflow-wrap:anywhere}.row span:last-child{white-space:nowrap;text-align:right}.total{font-weight:bold;font-size:16px;margin-top:12px}.notes{overflow-wrap:anywhere;padding:10px 0}footer{padding-top:16px}.reference{overflow-wrap:anywhere;font-size:10px}.toolbar{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:10px;padding:16px;font:14px Arial,sans-serif}.toolbar button{background:#232d46;color:white;border:0;border-radius:8px;padding:12px 18px;cursor:pointer}.toolbar select{padding:10px}.hint{text-align:center;font:12px Arial,sans-serif;padding:0 12px}.preview .toolbar,.preview .hint{display:none}.preview .receipt{margin:0 auto;box-shadow:none}
@page{size:auto;margin:10mm}@media print{body{background:white;color:#000}.toolbar,.hint{display:none!important}.receipt{margin:0 auto;box-shadow:none;background:white;width:80mm;padding:3mm;max-width:100%}tr,.totals,.payments,header,footer{break-inside:avoid}thead{display:table-header-group}}
footer img{display:block;width:55mm;max-width:100%;height:auto;margin:10px auto}
</style></head><body>
<div class="toolbar"><label>Paper <select id="paper"><option value="a4">A4 / PDF</option><option value="thermal">80 mm receipt</option></select></label><button id="print" type="button">Print / Save PDF</button><button id="download" type="button">Download HTML</button></div>
<p class="hint">Choose Save as PDF if no printer is connected. Turn off browser headers and footers in print settings.</p>
<article class="receipt"><header><img src="${text(logoUrl)}" alt="Café Salvacion"><p>Sales Receipt</p><p class="status">${text(order.status)}</p></header>
<div class="meta">${row("Receipt", text(order.displayOrderNumber))}<p>${text(date)} (PH)</p><p>Cashier: ${text(formatName(order.createdBy))}</p></div>
<table aria-label="Purchased items"><thead><tr><th>Purchased items</th><th>Qty</th><th>Amount</th></tr></thead><tbody>${order.items.map((item) => `<tr><td><div class="name">${text(item.productNameSnapshot)}</div><div class="detail">${text(item.variantNameSnapshot)} · ${money(item.unitFinalPrice)} each</div>${item.modifiers.map((modifier) => `<div class="detail">+ ${text(modifier.modifierNameSnapshot)} × ${text(modifier.quantity)}</div>`).join("")}${item.note ? `<div class="detail">Note: ${text(item.note)}</div>` : ""}</td><td>${text(item.quantity)}</td><td>${money(item.lineSubtotal)}</td></tr>`).join("")}</tbody></table>
<section class="totals">${row("Subtotal (VAT inclusive)", money(order.subtotalAmount))}${row(order.discountCode ? `Discount (${order.discountCode})` : "Discount", `− ${money(order.discountAmount)}`)}${row("VAT included (12%)", money(order.taxAmount))}${row("TOTAL PHP", money(order.totalAmount), "total")}</section>
<section class="payments">${order.payments.map((payment) => row(payment.method, money(payment.amount)) + (payment.reference ? `<p class="reference">Reference: ${text(payment.reference)}</p>` : "")).join("")}${row("Amount tendered", money(paid))}${row("Change", money(change))}</section>
${order.notes ? `<div class="notes">Notes: ${text(order.notes)}</div>` : ""}
${order.reversal ? `<div class="notes"><strong>REFUNDED</strong>${row("Refund amount", money(order.reversal.amount))}<p>${text(order.reversal.reasonCode)}</p>${order.reversal.note ? `<p>${text(order.reversal.note)}</p>` : ""}</div>` : ""}
<footer><strong>Thank you for visiting!</strong><img src="${text(footerLogoUrl)}" alt="Café Salvacion"><p class="reference">Transaction ID: ${text(order.id)}</p></footer></article>
</body></html>`;
}

/** Open synchronously from a click so popup blocking does not lose the receipt. */
export function openReceipt(order: PosOrder) {
  const receiptWindow = window.open("", "_blank");
  if (!receiptWindow) throw new Error("Allow pop-ups for this site to open the printable receipt.");
  receiptWindow.opener = null;
  receiptWindow.document.open();
  receiptWindow.document.write(buildReceiptHtml(order,
    new URL("/cs-receipt.svg", window.location.origin).href,
    new URL("/bottom-header.svg", window.location.origin).href));
  receiptWindow.document.close();
  const doc = receiptWindow.document;
  doc.getElementById("paper")?.addEventListener("change", (event) => {
    let style = doc.getElementById("paper-size");
    if (!style) { style = doc.createElement("style"); style.id = "paper-size"; doc.head.appendChild(style); }
    style.textContent = (event.target as HTMLSelectElement).value === "thermal"
      ? "@page{size:auto;margin:0}@media print{.receipt{margin:0;padding:4mm;width:80mm}}"
      : "@page{size:A4;margin:10mm}";
  });
  doc.getElementById("print")?.addEventListener("click", async () => {
    await Promise.all(Array.from(doc.images).map((image) => image.decode().catch(() => undefined)));
    receiptWindow.focus();
    receiptWindow.print();
  });
  doc.getElementById("download")?.addEventListener("click", async () => {
    // Embed both logos so downloaded receipts remain usable without the server.
    const embedLogo = async (asset: string) => {
      const url = new URL(asset, window.location.origin).href;
      try {
        const response = await fetch(url);
        if (response.ok) return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(await response.text())}`;
      } catch { /* Keep the hosted logo if the asset cannot be fetched. */ }
      return url;
    };
    const [logoUrl, footerLogoUrl] = await Promise.all([
      embedLogo("/cs-receipt.svg"), embedLogo("/bottom-header.svg"),
    ]);
    const html = buildReceiptHtml(order, logoUrl, footerLogoUrl)
      .replace('<div class="toolbar">', '<div class="toolbar" style="display:none">')
      .replace("Choose Save as PDF if no printer is connected.", "Use your browser’s Print command (Ctrl+P / ⌘P) to print or save as PDF.");
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const link = doc.createElement("a");
    link.href = url;
    link.download = `receipt-${order.displayOrderNumber.replace(/[^a-zA-Z0-9_-]/g, "-")}.html`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  });
}
