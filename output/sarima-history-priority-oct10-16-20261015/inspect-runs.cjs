const fs=require('fs'),path=require('path');
const backend=path.resolve(__dirname,'../../ims-backend');
require(path.join(backend,'node_modules/dotenv')).config({path:path.join(backend,'.env'),quiet:true});
const {PrismaClient}=require(path.join(backend,'node_modules/@prisma/client')); const db=new PrismaClient();
(async()=>{const runs=await db.forecastRun.findMany({orderBy:{startDate:'desc'},include:{_count:{select:{series:true}}}}); console.log(JSON.stringify(runs,null,2));})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect());
