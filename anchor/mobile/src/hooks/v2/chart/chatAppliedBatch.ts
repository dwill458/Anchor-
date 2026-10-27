import { useSyncExternalStore } from 'react';

type AppliedBatch = { accountId: string | null; courseId: string; batchId: string; firstMoveId: string };
let current: AppliedBatch | null = null;
const listeners = new Set<() => void>();

// DEFERRED: persist the updated-from-chat tag across sessions.
// DEFERRED: editing proposed moves in chat.
export function setChatAppliedBatch(batch: AppliedBatch | null) {
  current = batch;
  listeners.forEach(listener => listener());
}
export function useChatAppliedBatch() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => current, () => null);
}
