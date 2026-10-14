const fs = require('node:fs');
const { buildReportPdfDocument } = require('../../src/lib/report-pdf.ts');
const pdf = buildReportPdfDocument({title:'POS Sales Analytics',metadata:['Generated: Oct 13, 2026, 6:30 PM (Manila)','From: 2026-10-01 | To: 2026-10-12','Grouping: daily | Staff Filter: All | Payment Method: All'],sections:[
{title:'Summary',headers:['Metric','Value'],rows:[['Gross Sales','PHP 125,000.00'],['Net Sales','PHP 118,750.00'],['COGS','PHP 47,500.00'],['Gross Profit','PHP 71,250.00'],['Transactions','423'],['Average Ticket','PHP 280.73'],['Growth vs Previous Period','12.5%'],['Inventory Turnover','N/A']]},
{title:'Grouped Sales Analytics',headers:['Bucket','Gross Sales','Net Sales','Discounts','Sales Refunds','VAT','COGS','Gross Profit','Net Collected','Transactions','Average Ticket'],rows:Array.from({length:12},(_,i)=>[`Oct ${i+1}, 2026`,'PHP 12,000.00',`PHP ${9500+i*140}.00`,'PHP 500.00','PHP 100.00','PHP 1,200.00','PHP 4,200.00','PHP 7,000.00','PHP 12,300.00',String(35+i),'PHP 280.00'])},
{title:'Payment Breakdown',headers:['Method','Amount','Orders','Payments','Share of Collected'],rows:[['Cash','PHP 70,000.00','250','250','59.0%'],['Card','PHP 30,000.00','110','110','25.3%'],['E-Wallet','PHP 18,750.00','63','63','15.7%']]},
{title:'Product Table',headers:['Product','Category','Variants','Orders','Qty Sold','Revenue','COGS','Gross Margin','Contribution','Margin Rate'],rows:Array.from({length:20},(_,i)=>[`Cafe Latte ${i+1}`,'Coffee','3','40','50',`PHP ${5000+i*30}.00`,'PHP 1,800.00','PHP 3,200.00','4.2%','64.0%'])}
]});
fs.writeFileSync('tmp/report-export-review/professional-layout.pdf',Buffer.from(pdf.output('arraybuffer')));
console.log('Layout pages:',pdf.getNumberOfPages());
