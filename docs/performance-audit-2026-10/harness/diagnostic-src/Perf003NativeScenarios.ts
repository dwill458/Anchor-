import { Linking } from 'react-native';
import * as Application from 'expo-application';
import { API_URL } from '@/config';
import { encryptedPersistStorage, readSecureValue, setLabSingleFlight, getNativeValidationStorageCounts } from '@/stores/encryptedPersistStorage';
import { labEvent, labNow, flushNativeSamples } from './perf003Probe';
let running = Promise.resolve();
let revision = 0;
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
async function scenario(mode: string) {
  const baseline = mode.startsWith('baseline'), large = mode.endsWith('large');
  setLabSingleFlight(!baseline);
  flushNativeSamples();
  const key = 'anchor-vault-storage-perf003-synthetic';
  // Same bytes and retained generations in both modes, no canonical vault change.
  const payload = JSON.stringify({ synthetic: true, padding: 'S'.repeat(large ? 706000 : 800), revision: ++revision });
  const before = getNativeValidationStorageCounts(), start = labNow();
  const requests = [encryptedPersistStorage.setItem(key, payload)];
  await wait(450);
  for (let i=0; i<4; i++) { requests.push(encryptedPersistStorage.setItem(key, payload)); await wait(450); }
  await Promise.all(requests);
  const after = getNativeValidationStorageCounts();
  labEvent(20, { baseline: Number(baseline), large: Number(large), durationMs: labNow()-start,
    requests: requests.length, writes: after.writes-before.writes, reads: after.reads-before.reads,
    deletes: after.deletes-before.deletes, verified: Number(await readSecureValue(key) === payload) });
  flushNativeSamples();
}
export function startPerf003NativeScenarios() {
  if (Application.applicationId !== 'com.anchorintentions.perflab20261012' || API_URL !== 'http://127.0.0.1:39999') return;
  const consume = (url: string | null) => {
    const match = /^anchor-perflab20261012:\/\/perf003\/(baseline-small|fixed-small|baseline-large|fixed-large)$/.exec(url ?? '');
    if (match) running = running.then(() => scenario(match[1])).catch(() => labEvent(99));
  };
  Linking.addEventListener('url', event => consume(event.url));
  void Linking.getInitialURL().then(consume);
}
