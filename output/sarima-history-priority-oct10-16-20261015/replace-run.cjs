const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const backend=path.resolve(__dirname,'../../ims-backend');
require(path.join(backend,'node_modules/dotenv')).config({path:path.join(backend,'.env'),quiet:true});
require(path.join(backend,'node_modules/ts-node/register'));
const {PrismaClient,Prisma}=require(path.join(backend,'node_modules/@prisma/client'));
const {validateWorkerResult}=require(path.join(backend,'src/forecasting/forecasting.types'));
const db=new PrismaClient();
const startDate='2026-10-10',endDate='2026-10-16';
const result=validateWorkerResult(JSON.parse(fs.readFileSync(path.join(__dirname,'worker-result.json'),'utf8')),startDate,7);
const input=JSON.parse(fs.readFileSync(path.join(__dirname,'input.json'),'utf8'));
result.warnings.push(`SARIMA-only forced retraining; historical data priority with POS fallback for zero/absent material/day consumption. Stock snapshot captured ${input.capturedAt}; stock is not an October 9 historical snapshot.`);
(async()=>{
 assert.equal(result.series.length,79); assert(result.series.every(s=>s.metadata.model==='SARIMA'));
 const output=await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(728194)`;
  assert.equal(await tx.forecastRun.count({where:{activeKey:'forecast'}}),0,'An active forecast is running; do not replace it');
  const targets=await tx.forecastRun.findMany({where:{startDate:new Date(startDate),endDate:new Date(endDate),status:'COMPLETED'},include:{series:{include:{points:true,recommendation:true}}}});
  assert.equal(targets.length,1,'Expected exactly one completed October 10-16 run');
  const prior=targets[0];
  assert.equal(prior.id,'bdacf49e-cfa3-4429-9400-646f5a4c553a');
  const activeMaterials=await tx.rawMaterial.findMany({where:{isActive:true},select:{id:true}}); const ids=new Set(activeMaterials.map(m=>m.id));
  assert(result.series.every(s=>ids.has(s.materialId)),'Unknown or inactive material');
  const backup=path.join(__dirname,'replaced-run-backup.json'); assert(!fs.existsSync(backup),'Replacement already attempted; inspect existing backup');
  fs.writeFileSync(backup,JSON.stringify(prior,null,2));
  await tx.forecastSeries.deleteMany({where:{runId:prior.id}});
  await tx.forecastRun.update({where:{id:prior.id},data:{status:'COMPLETED',activeKey:null,historyEnd:new Date(result.historyEnd),sourceHash:result.sourceHash,warnings:result.warnings,error:null,completedAt:new Date()}});
  for(const s of result.series) await tx.forecastSeries.create({data:{runId:prior.id,materialId:s.materialId,name:s.name,unit:s.unit,metadata:s.metadata,points:{create:s.points.map(p=>({...p,date:new Date(p.date)}))},recommendation:{create:{data:s.recommendation}}}});
  return {runId:prior.id,replacedSeries:prior.series.length,storedSeries:result.series.length};
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:60000});
 const saved=await db.forecastRun.findUniqueOrThrow({where:{id:output.runId},include:{series:{include:{points:{orderBy:{date:'asc'}},recommendation:true}}}});
 assert.equal(saved.sourceHash,result.sourceHash); assert.equal(saved.series.length,79); assert.equal(saved.historyEnd.toISOString().slice(0,10),'2026-10-06');
 for(const s of result.series){const got=saved.series.find(x=>x.materialId===s.materialId);assert(got);assert.deepEqual(got.metadata,s.metadata);assert.deepEqual(got.recommendation.data,s.recommendation);assert.equal(got.points.length,7);s.points.forEach((p,i)=>{assert.equal(got.points[i].date.toISOString().slice(0,10),p.date);for(const k of ['forecast','lower95','upper95'])assert(Math.abs(Number(got.points[i][k])-p[k])<=0.00005001);});}
 const verification={...output,startDate,endDate,dailyPoints:saved.series.reduce((n,s)=>n+s.points.length,0),models:'SARIMA only',databaseVerification:'passed',backup:'replaced-run-backup.json'};
 fs.writeFileSync(path.join(__dirname,'database-replacement-verification.json'),JSON.stringify(verification,null,2)); console.log(JSON.stringify(verification));
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect());
