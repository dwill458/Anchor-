// Explicit lab overlay: never invoke against the product checkout.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(process.argv[2] || 'E:/apd/src');
if (root !== path.resolve('E:/apd/src')) throw Error('Only the retained isolated lab is accepted');
const product = path.resolve(__dirname, '../../../../anchor/mobile');
const adapterPath = path.join(root, 'src/stores/encryptedPersistStorage.ts');
const old = fs.readFileSync(adapterPath, 'utf8');
if (old.includes('setLabSingleFlight')) throw Error('Overlay already installed; do not nest wrappers');
const wrapper = old.slice(old.indexOf('let validationFault:'), old.indexOf("import type { StateStorage }"));
let source = fs.readFileSync(path.join(product, 'src/stores/encryptedPersistStorage.ts'), 'utf8');
source = source.replace("import * as SecureStore from 'expo-secure-store';", "import * as RawSecureStore from 'expo-secure-store';\n" + wrapper);
source = source.replace("import { perfLog }", "import { labEvent, labNow, labSpan } from '@/utils/perf003Probe';\nimport { perfLog }");
source = source.replace('const SECURE_META_SUFFIX', 'let singleFlightEnabled = true;\nexport function setLabSingleFlight(enabled: boolean) { singleFlightEnabled = enabled; }\nconst SECURE_META_SUFFIX');
source = source.replace('if (!pendingWrites.has(name) && active?.size === 1)', 'if (singleFlightEnabled && !pendingWrites.has(name) && active?.size === 1)');
source = source.replace('const chunks = splitIntoChunks(value);', "const splitStart = labNow();\n  const chunks = splitIntoChunks(value);\n  labEvent(1, { splitMs: labNow()-splitStart, payloadChars: value.length, chunks: chunks.length });\n  const endNative = labSpan(2);");
source = source.replace('// Verify all bytes', 'endNative();\n  const endVerify = labSpan(3);\n  // Verify all bytes');
source = source.replace('const commit = (manifestWrites', 'endVerify();\n  const endPublication = labSpan(4);\n  const commit = (manifestWrites');
source = source.replace('await commit;\n  perfLog', 'await commit;\n  endPublication();\n  perfLog');
source = source.replace('await scheduleWrite(name, value);', 'const endReceipt = labSpan(5);\n    await scheduleWrite(name, value);\n    endReceipt();');
source = source.replace('pendingWrites.delete(name);\n  inFlightWrites', 'pendingWrites.delete(name);\n  labEvent(6, { active: (inFlightWrites.get(name) ?? 0)+1, receipts: entry.resolvers.length });\n  inFlightWrites');
// Numeric only; JS native-call elapsed includes dispatch/queue and execution.
source = source.replace('return RawSecureStore.setItemAsync(...args);', 'return labNative(1, () => RawSecureStore.setItemAsync(...args));');
source = source.replace('return RawSecureStore.getItemAsync(...args);', 'return labNative(2, () => RawSecureStore.getItemAsync(...args));');
source = source.replace('return RawSecureStore.deleteItemAsync(...args);', 'return labNative(3, () => RawSecureStore.deleteItemAsync(...args));');
source = source.replace('const SecureStore = {', `let nativeDepth = 0;
async function labNative<T>(kind: number, run: () => Promise<T>): Promise<T> {
  const depth = ++nativeDepth, start = labNow();
  try { return await run(); } finally {
    labEvent(7, { kind, depth, nativeElapsedMs: labNow()-start }); nativeDepth--;
  }
}
const SecureStore = {`);
fs.writeFileSync(adapterPath, source);
fs.copyFileSync(path.join(__dirname, 'perf003Probe.ts'), path.join(root, 'src/utils/perf003Probe.ts'));
fs.copyFileSync(path.join(__dirname, 'Perf003NativeScenarios.ts'), path.join(root, 'src/utils/Perf003NativeScenarios.ts'));
let app = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8');
if (!app.includes('startPerf003NativeScenarios')) app = app.replace('startNativePersistenceValidation();', "startNativePersistenceValidation();\nimport { startPerf003NativeScenarios } from './src/utils/Perf003NativeScenarios';\nstartPerf003NativeScenarios();");
fs.writeFileSync(path.join(root, 'App.tsx'), app);
console.log('Installed numeric probes in isolated lab only');
