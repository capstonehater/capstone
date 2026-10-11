require('dotenv').config({quiet:true});
require('ts-node/register/transpile-only');
const {PrismaClient}=require('@prisma/client');
const {ReportsService}=require('../src/reports/reports.service');
const p=new PrismaClient();
(async()=>{
const s=new ReportsService(p,{},{});
const f={from:'2026-10-01T00:00:00+08:00',to:'2026-10-11T23:59:59.999+08:00'};
const [k,l]=await Promise.all([s.getInventoryKpiSummary(f),s.getPosInventoryLinked(f)]);
console.log(JSON.stringify({savedCogs:k.totals.cogs,ledgerCost:l.summary.totalConsumptionCost,kpiCheckoutCost:k.totals.checkoutCost}));
const r=await p.$queryRaw`SELECT COUNT(*)::int AS orders, SUM(o.total_cogs_amount) AS saved, SUM(c.cost) AS ledger FROM orders o LEFT JOIN (SELECT t.source_id, SUM(-l.total_cost_delta) cost FROM inventory_transactions t JOIN inventory_transaction_lines l ON l.inventory_transaction_id=t.id WHERE t.type='CHECKOUT' AND t.source_type='ORDER' GROUP BY t.source_id) c ON c.source_id=o.id WHERE o.completed_at >= '2026-09-30 16:00'::timestamp AND o.completed_at <= '2026-10-11 15:59:59.999'::timestamp AND o.total_cogs_amount <> c.cost`;
console.log(JSON.stringify(r));
})().catch(e=>console.log(e.code||e.name)).finally(()=>p.$disconnect());
