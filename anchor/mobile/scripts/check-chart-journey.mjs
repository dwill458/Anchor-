import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const { transformSync }=require('@babel/core');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=await readFile(path.join(root,'src/components/v2/chart/chartJourneyGeometry.ts'),'utf8');
const code=transformSync(source,{filename:'chartJourneyGeometry.ts',configFile:false,babelrc:false,presets:['@babel/preset-typescript'],plugins:['@babel/plugin-transform-modules-commonjs']}).code;
const context={exports:{}};
vm.runInNewContext(code,context);
const g=context.exports;
const states=[];
for (const size of [{name:'iphone-14-pro',width:393,height:500},{name:'galaxy-s24',width:360,height:460}]) {
  for (const count of [3,5,8,12]) for (const progress of [.08,.5,.9,.96,1]) {
    const camera=g.getCameraTransform(progress,size),offset=g.getRoadParallax(progress);
    states.push({size,count,progress,camera,layers:g.WORLD_LAYERS.map(layer=>({...layer,offset:g.getLayerParallax(progress,layer.parallax)})),nodes:g.getWaypointRoutePositions(count).map((p,i)=>({index:i,progress:p,point:g.getPointAtNormalizedDistance(p),screen:g.worldToViewport(g.getPointAtNormalizedDistance(p),camera,offset)}))});
  }
}
const output=process.argv[2] ?? path.join(root,'docs/qa/chart-journey/geometry-captures.json');
await mkdir(path.dirname(output),{recursive:true});
await writeFile(output,JSON.stringify({decodedBytes:g.decodedWorldBytes(),decodedBudget:g.WORLD_TEXTURE_BUDGET,gpuBudget:g.WORLD_GPU_BUDGET,states},null,2)+'\n');
console.log(`${states.length} viewport/count/progress captures. Decoded texture estimate: ${(g.decodedWorldBytes()/1024/1024).toFixed(2)} MiB. These are geometry fixtures, not native QA.`);
