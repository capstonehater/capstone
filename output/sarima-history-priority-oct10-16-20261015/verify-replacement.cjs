const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const backend=path.resolve(__dirname,'../../ims-backend');
require(path.join(backend,'node_modules/dotenv')).config({path:path.join(backend,'.env'),quiet:true});
const {PrismaClient}=require(path.join(backend,'node_modules/@prisma/client'));const db=new PrismaClient();
function equivalent(a,b){if(typeof a==='number'&&typeof b==='number'){assert(Math.abs(a-b)<=1e-12*Math.max(1,Math.abs(b)));return;}if(a===null||b===null||typeof a!=='object'||typeof b!=='object'){assert.equal(a,b);return;}assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort());for(const k of Object.keys(a))equivalent(a[k],b[k]);}
(async()=>{
 const expected=JSON.parse(fs.readFileSync(path.join(__dirname,'worker-result.json'),'utf8'));const id='bdacf49e-cfa3-4429-9400-646f5a4c553a';
 const saved=await db.forecastRun.findUniqueOrThrow({where:{id},include:{series:{include:{points:{orderBy:{date:'asc'}},recommendation:true}}}});
 assert.equal(saved.status,'COMPLETED');assert.equal(saved.startDate.toISOString().slice(0,10),'2026-10-10');assert.equal(saved.endDate.toISOString().slice(0,10),'2026-10-16');assert.equal(saved.historyEnd.toISOString().slice(0,10),expected.historyEnd);assert.equal(saved.sourceHash,expected.sourceHash);assert.equal(saved.series.length,79);
 for(const s of expected.series){const got=saved.series.find(x=>x.materialId===s.materialId);assert(got);assert.equal(got.metadata.model,'SARIMA');equivalent(got.metadata,s.metadata);equivalent(got.recommendation.data,s.recommendation);assert.equal(got.points.length,7);s.points.forEach((p,i)=>{assert.equal(got.points[i].date.toISOString().slice(0,10),p.date);for(const k of ['forecast','lower95','upper95'])assert(Math.abs(Number(got.points[i][k])-p[k])<=0.00005001);});}
 const verification={runId:id,startDate:'2026-10-10',endDate:'2026-10-16',forecastSeries:79,dailyPoints:553,models:'SARIMA only',databaseVerification:'passed',decimalPrecision:4,backup:'replaced-run-backup.json'};
 fs.writeFileSync(path.join(__dirname,'database-replacement-verification.json'),JSON.stringify(verification,null,2));console.log(JSON.stringify(verification));
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect());
