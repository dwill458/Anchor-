(() => { const qa=globalThis.__anchorStabilizationQA;qa.guard();const state=qa.screenState();let sessionSaved;
qa.visitFocused(node=>{if((typeof node.type==='function'?node.type.name:node.type?.type?.name)==='V2FocusCompleteScreen')sessionSaved=node.memoizedProps.sessionSaved;});
return {profile:10,fault:qa.nativeFailure,sessionSaved,...state};})()