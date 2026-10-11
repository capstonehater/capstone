const fs = require('node:fs');
const { buildReportPdfDocument } = require('../../src/lib/report-pdf.ts');
const pdf = buildReportPdfDocument({
  title: 'Inventory Reports',
  metadata: ['Generated: Oct 11, 2026, 10:30 AM (Manila)', 'From: 2026-10-01 | To: 2026-10-11', 'Scope: Selected dates and filters | Material Search: All'],
  sections: [
    { title: 'Summary', headers: ['Metric', 'Value'], rows: [['Material Cost Used', 'PHP 7,281.83'], ['Waste Events', '20'], ['Inventory Turnover', 'N/A']] },
    { title: 'Recent Sales-Linked Stock Movements', headers: ['Order ID', 'Transaction UID', 'Date / Time', 'Material Lines', 'Ingredients Used', 'Product Variants', 'Quantity Used', 'Material Cost Used'], rows: Array.from({ length: 35 }, (_, i) => ['ORD-CFB14BA4', 'c92c394b-0cd4-4882-8826-0efc3a56ff0e', 'Oct 11, 2026, 1:18 AM', '17', '10', '1', '176', 'PHP 1,205.43']) },
    { title: 'Waste Insight Breakdown', headers: ['Material', 'SKU', 'Reason', 'Events', 'Quantity', 'Cost'], rows: [['Magnolia Gold Butter Salted 225g', 'RM-MGBS2-001', 'EXPIRED', '2', '176', 'PHP 112.69'], ['Fresh Philippine Red Chili Peppers 1kg', 'RM-FPRCP1-001', 'EXPIRED', '5', '197', 'PHP 78.74']] }
  ]
});
fs.writeFileSync('tmp/report-export-review/preview.pdf', Buffer.from(pdf.output('arraybuffer')));
console.log('Preview pages:', pdf.getNumberOfPages());
