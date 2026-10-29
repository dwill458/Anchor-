import { AppState, Keyboard } from 'react-native';
import { GUIDANCE_REGISTRY, type GuidanceId } from '@/constants/v2/guidanceRegistry';
import { createGuidanceCoordinator, type DiscoverySignal, type GuidancePending } from '@/stores/v2/guidanceCoordinator';
import { guidanceRecords } from '@/stores/v2/guidanceRecords';
import { useMilestoneCelebrationStore } from '@/stores/v2/milestoneCelebrationStore';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { V2DialogManager } from '@/components/v2/feedback/V2DialogManager';
import { useGuidanceSurfaceLocks } from '@/stores/v2/guidanceSurfaceLocks';
import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';

export const guidanceCoordinator = createGuidanceCoordinator(GUIDANCE_REGISTRY, guidanceRecords.save);
let accountKey: string | undefined;
let revision = 0;
let binding: Promise<void> = Promise.resolve();
export function bindGuidanceAccount(account: string): Promise<void> {
  if (accountKey === account) return binding;
  accountKey = account;
  const generation = ++revision;
  guidanceCoordinator.bind(account, null);
  binding = guidanceRecords.load(account).then(data => {
    if (generation === revision) guidanceCoordinator.bind(account, data);
  }).catch(() => { /* Fail closed for this binding. */ });
  return binding;
}
export function discoverGuidance(account: string, signal: DiscoverySignal) {
  const generation = revision;
  void binding.then(() => { if (accountKey === account && revision === generation) guidanceCoordinator.discover(signal); });
}
export function requestGuidance(account: string, id: GuidanceId, options?: { pending?: GuidancePending }) {
  const generation = revision;
  void binding.then(() => { if (accountKey === account && revision === generation) guidanceCoordinator.request(id, options); });
}
export function dismissGettingStartedGuidance(account: string) {
  const generation = revision;
  void binding.then(() => { if (accountKey === account && revision === generation) guidanceCoordinator.dismissGettingStarted(); });
}
export async function replayGuidance(account: string, onlyId?: GuidanceId) {
  if (accountKey !== undefined && accountKey !== account) return;
  if (accountKey === undefined) await bindGuidanceAccount(account);
  else await binding;
  if (accountKey === account) guidanceCoordinator.replay(onlyId);
}
export async function prepareChartGuidance(account: string, courseId: string) {
  await bindGuidanceAccount(account);
  const generation = revision;
  if (account === 'guest' || guidanceCoordinator.data().records['chart.next_move'] || guidanceCoordinator.data().replayedIds?.includes('chart.next_move')) return;
  const key = `anchor:v2:chart2:taught:${encodeURIComponent(account)}:${encodeURIComponent(courseId)}`;
  const value = await encryptedPersistStorage.getItem(key);
  if (value === '1' && accountKey === account && revision === generation) guidanceCoordinator.migrate('chart.next_move');
}
let users = 0;
let stop: (() => void) | undefined;
/** Read-only external locks. Celebration infrastructure remains authoritative. */
export function mountGuidanceRuntime() {
  if (++users === 1) {
    const celebration = () => guidanceCoordinator.lock('celebration',
      useMilestoneCelebrationStore.getState().queue.length > 0 || useCelebrationStore.getState().active !== null || useCelebrationStore.getState().queueLength > 0, true);
    const settings = () => guidanceCoordinator.lock('tips', useSettingsStore.getState().showTips === false);
    const modals = () => guidanceCoordinator.lock('modal', useGuidanceSurfaceLocks.getState().keys.length > 0);
    celebration(); settings(); modals();
    guidanceCoordinator.foreground(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
    const off = [useMilestoneCelebrationStore.subscribe(celebration), useCelebrationStore.subscribe(celebration), useSettingsStore.subscribe(settings), useGuidanceSurfaceLocks.subscribe(modals),
      V2DialogManager.subscribe(state => guidanceCoordinator.lock('dialog', state !== null))];
    const subscriptions = [
      AppState.addEventListener('change', state => { guidanceCoordinator.foreground(state === 'active'); if (state !== 'active') void guidanceRecords.flush(); }),
      Keyboard.addListener('keyboardDidShow', () => guidanceCoordinator.lock('keyboard', true)),
      Keyboard.addListener('keyboardDidHide', () => guidanceCoordinator.lock('keyboard', false)),
    ];
    stop = () => { off.forEach(unsubscribe => unsubscribe()); subscriptions.forEach(subscription => subscription.remove()); };
  }
  return () => { if (--users === 0) { stop?.(); stop = undefined; } };
}
