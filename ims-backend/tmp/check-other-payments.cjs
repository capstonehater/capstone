require('dotenv').config({quiet:true});
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
(async()=>{const [methods,audit,remaining]=await Promise.all([db.$queryRaw`SELECT enumlabel FROM pg_enum WHERE enumtypid = '"PaymentMethod"'::regtype ORDER BY enumsortorder`,db.paymentMethodMigrationAudit.count(),db.$queryRaw`SELECT count(*)::int AS count FROM order_payments WHERE method::text = 'OTHER'`]); console.log(JSON.stringify({methods:methods.map(m=>m.enumlabel),migrated:audit,remaining:remaining[0].count}));})().catch(e=>{console.error(e.code||e.name);process.exitCode=1;}).finally(()=>db.$disconnect());
