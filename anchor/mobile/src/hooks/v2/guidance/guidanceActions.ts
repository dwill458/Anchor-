import type { GuidanceId } from '@/constants/v2/guidanceRegistry';
import { guidanceCoordinator } from './guidanceRuntime';

/** Capture before dispatching navigation or starting an asynchronous product action. */
export function beginGuidanceAction(account: string, id: GuidanceId, detail: string) {
  const active = guidanceCoordinator.snapshot();
  return active?.account === account && active.id === id
    ? guidanceCoordinator.startAction(active.token, detail) : (_success: boolean) => undefined;
}
