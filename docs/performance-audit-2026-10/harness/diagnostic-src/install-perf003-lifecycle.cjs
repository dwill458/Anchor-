const fs = require('node:fs'), path = require('node:path');
const root = 'E:/apd/src';
// Fixed names are mapped to numeric codes; supplied account fields are discarded.
fs.writeFileSync(path.join(root,'src/utils/homeStartupProfiler.ts'), `import { labEvent, labSpan } from './perf003Probe';
const codes = new Map<string, number>();
function code(stage: string) { if (!codes.has(stage)) codes.set(stage, codes.size+1); return codes.get(stage)!; }
export const HomeStartupProfiler = {
 mark(stage: string, _fields: Record<string, unknown> = {}) { labEvent(50, {stage:code(stage)}); },
 start(stage: string, _fields: Record<string, unknown> = {}) { const end=labSpan(51); labEvent(52,{stage:code(stage)}); return (_result: Record<string, unknown> = {})=>end(); }
};
`);
function edit(relative, replacements) {
 const file=path.join(root,relative); let source=fs.readFileSync(file,'utf8');
 if(source.includes('// PERF003 lifecycle')) return;
 source="// PERF003 lifecycle\nimport { labEvent, labSpan, labNow } from '@/utils/perf003Probe';\n"+source;
 for(const [before,after] of replacements) { if(!source.includes(before)) throw Error(relative+' missing anchor'); source=source.replace(before,after); }
 fs.writeFileSync(file,source);
}
edit('src/services/AppAuthBootstrap.ts',[
 ['const session = await AuthService.syncCurrentUser();','const endSync = labSpan(60);\n      const session = await AuthService.syncCurrentUser();\n      endSync();'],
 ['initialAuthCallbackReceived = true;','labEvent(61);\n    initialAuthCallbackReceived = true;'],
 ['onInitialAuthRestoreSettled();','labEvent(62);\n    onInitialAuthRestoreSettled();'],
]);
edit('src/services/PracticeCompletionService.ts',[
 ['const queue = await readQueue(record.accountId);','const endRead = labSpan(70);\n    const queue = await readQueue(record.accountId);\n    endRead();'],
 ['await writeQueue(record.accountId, [...queue, record]);','const endCommit = labSpan(71);\n      await writeQueue(record.accountId, [...queue, record]);\n      endCommit();'],
 ['async flush(accountId: string): Promise<void> {','async flush(accountId: string): Promise<void> {\n    labEvent(72);'],
]);
edit('src/screens/v2/practice/V2PracticeSessionScreen.tsx',[
 ['void startFocusPersistence(sessionData);','labEvent(73);\n      void startFocusPersistence(sessionData);'],
 ["setFocusPhase('complete');","labEvent(74);\n      setFocusPhase('complete');"],
]);
edit('src/stores/anchorStore.ts',[
 ['latestPersistenceWrite = Promise.resolve', 'labEvent(80, {payloadChars:value.length});\n          latestPersistenceWrite = Promise.resolve'],
]);
edit('App.tsx',[
 ['ErrorTrackingService.registerNavigationContainer(navRef);','labEvent(81);\n                      ErrorTrackingService.registerNavigationContainer(navRef);'],
]);
// Preserve all Home presentation; mark mount only (interaction acceptance is separate).
const home=path.join(root,'src/screens/v2/home/V2DevelopmentHome.tsx');
let homeSource=fs.readFileSync(home,'utf8');
if(!homeSource.includes('labEvent(82)')) {
 const declaration=/export function V2DevelopmentHome\([^]*?\) \{/;
 const match=homeSource.match(declaration);
 if(match) { homeSource="import { labEvent } from '@/utils/perf003Probe';\n"+homeSource.replace(match[0],match[0]+'\n  React.useEffect(() => { labEvent(82); }, []);'); fs.writeFileSync(home,homeSource); }
}
console.log('Installed isolated lifecycle probes');
