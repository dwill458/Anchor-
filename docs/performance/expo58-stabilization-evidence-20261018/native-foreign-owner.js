(() => {const qa=globalThis.__anchorStabilizationQA;qa.guard();qa.foreignOwner={status:'pending'};
(async()=>{const store=qa.load('src/stores/sessionStore.ts').useSessionStore;const before=store.getState().practiceHistory.length;const strength=store.getState().threadStrength;let rejected=false;
try{await qa.load('src/services/PracticeCompletionService.ts').PracticeCompletionService.completePracticeSession({sessionId:'stabilization-foreign-owner',accountId:'stabilization-other-owner',anchorId:null,anchorLocalId:qa.anchorId,mode:'focus',startedAt:new Date().toISOString(),plannedDurationSeconds:30,actualDurationSeconds:30,source:'practice_screen',guidanceVoice:'none',backgroundAudio:'off'},{mirrorLegacySession:true,flushImmediately:false});}catch{rejected=true;}
const db=qa.load('src/storage/sqlcipher/runtime.ts').recordDatabase();const history=await db.read(`anchor:practice-history:${qa.owner}`);
if(!rejected||store.getState().practiceHistory.length!==before||history.length!==before||store.getState().threadStrength!==strength)throw Error('Ownership rejection failed');
qa.foreignOwner={status:'complete',rejected:true,recordCountUnchanged:true,strengthUnchanged:true,profile:10};
})().catch(error=>qa.foreignOwner={status:'failed',message:String(error.message)});return {scheduled:true};})()
