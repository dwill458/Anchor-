(() => {
 const qa=globalThis.__anchorStabilizationQA;qa.guard();
 const service=qa.load('src/services/PracticeCompletionService.ts').PracticeCompletionService;
 const db=qa.load('src/storage/sqlcipher/runtime.ts').recordDatabase();
 const prior=db.transaction;
 qa.interruption={status:'scheduled',baseCount:qa.load('src/stores/sessionStore.ts').useSessionStore.getState().practiceHistory.length};
 const sessionId='stabilization-native-uncommitted';
 db.transaction=function(connection,task){
   return prior.call(this,connection,async transaction=>{
     let touched=false;
     const proxy=new Proxy(transaction,{get(target,property){const value=target[property];if(typeof value!=='function')return value;
       return (...args)=>{if(property==='runAsync'&&args.some(arg=>typeof arg==='string'&&arg.includes(sessionId)))touched=true;return value.apply(target,args);};}});
     await task(proxy);
     if(touched){qa.interruption.status='held-before-commit';await new Promise(()=>{});}
   });
 };
 const now=new Date().toISOString();
 service.completePracticeSession({sessionId,accountId:qa.owner,anchorId:null,anchorLocalId:qa.anchorId,mode:'focus',
   startedAt:now,completedAt:now,plannedDurationSeconds:30,actualDurationSeconds:30,source:'practice_screen',guidanceVoice:'none',backgroundAudio:'off'},
   {mirrorLegacySession:true,flushImmediately:false}).then(()=>{qa.interruption.status='unexpected-commit';},error=>{qa.interruption.status='rejected';qa.interruption.message=String(error.message);});
 return {scheduled:true,profile:10,baseCount:qa.interruption.baseCount};
})()