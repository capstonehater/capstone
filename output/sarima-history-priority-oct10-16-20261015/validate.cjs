const path=require('path'); const fs=require('fs');
const backend=path.resolve(__dirname,'../../ims-backend');
require(path.join(backend,'node_modules/ts-node/register'));
const {validateWorkerResult}=require(path.join(backend,'src/forecasting/forecasting.types'));
const result=validateWorkerResult(JSON.parse(fs.readFileSync(path.join(__dirname,'worker-result.json'),'utf8')),'2026-10-10',7);
console.log(JSON.stringify({backendValidation:'passed',series:result.series.length,points:result.series.reduce((n,s)=>n+s.points.length,0)}));
