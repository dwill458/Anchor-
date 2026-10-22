const fs=require('fs'),path=require('path'),Module=require('module');
const root=path.resolve(__dirname,'../../..');const ts=require(path.join(root,'node_modules/typescript'));
const resolve=Module._resolveFilename,load=Module._load;
Module._load=function(n,...r){if(n==='@/utils/logger')return{logger:new Proxy({},{get:()=>()=>{}})};return load.call(this,n,...r);};
Module._resolveFilename=function(n,p,...r){return resolve.call(this,n.startsWith('@/')?path.join(root,'src',n.slice(2)):n,p,...r);};
require.extensions['.txt']=require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);
const flow=path.join(root,'src/screens/create/flow');
const {RecordingPainter,fakeMeasure}=require(path.join(flow,'__tests__/recordingPainter.ts'));
const {buildSceneContext}=require(path.join(flow,'sceneContext.ts'));
const {INK_PALETTE}=require(path.join(flow,'scenes/sceneTypes.ts'));
const newF=require(path.join(flow,'scenes/FormScene.ts')).drawForm;
const oldF=require(path.join(__dirname,'FormScene.old.abs.ts.txt')).drawForm;
const ctx=buildSceneContext({intentionText:'I am calm and focused',category:'desire',source:'typed',entry:'glide',mode:'first',reduceMotion:false,measure:fakeMeasure}).context;
const pts=(p)=>p.ops.reduce((a,o)=>a+(o.points?o.points.length:0),0);
for(const id of ['prism-flow','alloy','porcelain','joybrush','woven']){
 for(const tf of [2,6]){
  const row=[];for(const [nm,f] of [['old',oldF],['new',newF]]){const p=new RecordingPainter();const t0=process.hrtime.bigint();for(let i=0;i<200;i++){const q=new RecordingPainter();f(q,INK_PALETTE,ctx,{tf,progress:.5,slow:false,fade:1,styleId:id,styleName:id,longerWait:true});}
   const dt=Number(process.hrtime.bigint()-t0)/200/1e6;f(p,INK_PALETTE,ctx,{tf,progress:.5,slow:false,fade:1,styleId:id,styleName:id,longerWait:true});
   const c={};p.ops.forEach(o=>c[o.op]=(c[o.op]||0)+1);row.push(`${nm}: ops=${p.ops.length} polylines=${c.polyline||0} circles=${c.circle||0} pts=${pts(p)} build=${dt.toFixed(3)}ms`);}
  console.log(id.padEnd(12),'tf='+tf,row.join(' | '));}}
