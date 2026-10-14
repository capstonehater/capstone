const fs = require('node:fs');
global.DOMParser = require('linkedom').DOMParser;

const pdfModule = require('../../src/lib/report-pdf.ts');
global.window = {};
const original = pdfModule.buildReportPdfDocument;
pdfModule.buildReportPdfDocument = content => {
 const pdf = original(content);
 pdf.save = async () => fs.writeFileSync('tmp/report-export-review/transaction-kpis.pdf',Buffer.from(pdf.output('arraybuffer')));
 return pdf;
};
const { exportPosTransactionHistoryPdf } = require('../../src/lib/report-exports.ts');
const names = ['Anna','Ben','Carla','David'];
exportPosTransactionHistoryPdf({scope:'all',filters:{from:'2026-10-01',to:'2026-10-31',page:1,pageSize:100},report:{pagination:{total:205,totalPages:3,page:1,pageSize:100},orders:Array.from({length:205},(_,i)=>({id:`ORDER-${i}`,displayOrderNumber:`ORD-${i}`,status:i%10===0?'REFUNDED':'COMPLETED',subtotalAmount:'450.00',totalAmount:'420.00',discountAmount:'30.00',taxAmount:'45.00',completedAt:'2026-10-13T10:00:00Z',createdBy:{id:String(i%4),email:`${names[i%4].toLowerCase()}@salvacion.test`,firstName:names[i%4],lastName:'Santos'},items:[],payments:[{method:'CASH',amount:'420.00'}]}))}}).catch(error=>{console.error(error);process.exitCode=1;});

