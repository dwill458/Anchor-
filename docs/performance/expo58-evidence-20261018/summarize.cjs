const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const out = __dirname;
const source = 'C:/Users/dwill/.codex/worktrees/expo58-upgrade/Anchor';
const mobile = path.join(source, 'anchor/mobile');
const git = (...args) => cp.execFileSync('git', ['-C', source, ...args], {encoding:'utf8'});
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const percentile = (values, p) => [...values].sort((a,b)=>a-b)[Math.ceil(values.length*p)-1];
const stats = values => ({n:values.length,min:Math.min(...values),median:(percentile(values,.5)+[...values].sort((a,b)=>a-b)[Math.floor(values.length*.5)])/2,p95NearestRank:percentile(values,.95),max:Math.max(...values)});
const cycles = JSON.parse(fs.readFileSync(path.join(out,'lifecycle-samples.json')));
const versions = Object.fromEntries(['expo','react','react-native','react-native-reanimated','react-native-worklets','react-native-gesture-handler','react-native-svg','@shopify/react-native-skia','expo-sqlite','jest','typescript'].map(name=>[name,JSON.parse(fs.readFileSync(path.join(mobile,'node_modules',name,'package.json'))).version]));
const events = fs.readFileSync(path.join(out,'phone-restart-perf-sanitized.jsonl'),'utf8').trim().split(/\r?\n/).map(JSON.parse);
const failures = [...fs.readFileSync(path.join(out,'jest.txt'),'utf8').matchAll(/^FAIL (.+?)(?: \([\d.]+ s\))?\r?$/gm)].map(x=>x[1]);
const result = {
  capturedUtc: new Date().toISOString(), source, commit:git('rev-parse','HEAD').trim(),branch:git('branch','--show-current').trim(),
  trackedDiffSha256:digest(git('diff','--binary','HEAD')),statusSha256:digest(git('status','--porcelain=v1')),versions,
  lifecycle:{scenario:'DEBUG Focus resolving surface, 20 HOME/background to existing Activity resumes; not screen navigation',activityTotalMs:stats(cycles.map(c=>Number(c.activityTotalMs.split(':')[1]))),beforePssKb:stats(cycles.map(c=>c.beforePssKb)),backgroundPssKb:stats(cycles.map(c=>c.backgroundPssKb)),afterPssKb:stats(cycles.map(c=>c.afterPssKb)),firstBeforeKb:cycles[0].beforePssKb,lastAfterKb:cycles.at(-1).afterPssKb},
  debugJsStalls:stats(events.filter(e=>e.event==='js-stall').map(e=>e.gapMs)),
  fullSuiteInterrupted:{failedSuiteCount:failures.length,failedSuites:failures,complete:false},
};
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
