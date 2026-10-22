(() => {const qa=globalThis.__anchorStabilizationQA;qa.guard();qa.retry={status:'pending'};
(async()=>{if(!qa.failedFocusInput||qa.nativeFailure.phase!=='rejected-and-unlocked')throw Error('No rejected native input');
const service=qa.load('src/services/PracticeCompletionService.ts').PracticeCompletionService;
const result=await service.completePracticeSession(qa.failedFocusInput,{mirrorLegacySession:true,flushImmediately:false});
if(result.duplicate)throw Error('Failed transaction falsely acknowledged');
qa.verifyCycle();qa.retry={status:'written',newRecord:true};})().catch(error=>{qa.retry={status:'failed',message:String(error.message)};});return {scheduled:true};})()