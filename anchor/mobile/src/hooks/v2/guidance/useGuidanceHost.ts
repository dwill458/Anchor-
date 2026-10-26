import { useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { NavigationRouteContext } from '@react-navigation/native';
import type { GuidanceId } from '@/constants/v2/guidanceRegistry';
import type { GuidancePresentation } from '@/stores/v2/guidanceCoordinator';
import { bindGuidanceAccount, guidanceCoordinator, mountGuidanceRuntime, prepareChartGuidance } from './guidanceRuntime';
import { scheduleAfterInteractions } from '@/utils/scheduleAfterInteractions';

export type GuidanceHostOptions = { screenId: string; accountId: string | null; eligible: readonly GuidanceId[]; blocked: boolean; isFocused: boolean; contextKey?: string; targetKey?: string };
export function useGuidanceHost(options: GuidanceHostOptions) {
  // Module-constant guard matches the existing screen-focus adapter's isolated hosts.
  const route = NavigationRouteContext ? useContext(NavigationRouteContext) : undefined;
  const instance = useId();
  const account = options.accountId ?? 'guest';
  const visitKey = `${options.screenId}:${route?.key ?? instance}:${account}`;
  const key = `${visitKey}:${options.contextKey ?? ''}:${options.targetKey ?? ''}`;
  const [presentation, setPresentation] = useState<GuidancePresentation | null>(null);
  const live = useRef(options);
  live.current = options;
  const settled = useRef(false);
  useEffect(mountGuidanceRuntime, []);
  const ids = options.eligible.join('|');
  useEffect(() => {
    let cancelled = false;
    settled.current = false;
    let interaction: ReturnType<typeof scheduleAfterInteractions> | undefined;
    const host = { key, visitKey, account, ready: false, candidates: options.eligible,
      present: setPresentation, hide: () => setPresentation(null) };
    const unregister = guidanceCoordinator.register(host);
    const hydration = options.screenId === 'chart' && options.contextKey ? prepareChartGuidance(account, options.contextKey) : bindGuidanceAccount(account);
    void hydration.then(() => {
      if (cancelled) return;
      interaction = scheduleAfterInteractions(() => {
        if (!cancelled) { settled.current = true; guidanceCoordinator.update({ ...host, candidates: live.current.eligible, ready: live.current.isFocused && !live.current.blocked }); }
      });
    }).catch(() => { /* An unreadable migration input also fails closed. */ });
    return () => { cancelled = true; interaction?.cancel(); unregister(); };
  }, [key, account]);
  useEffect(() => {
    guidanceCoordinator.update({ key, visitKey, account, ready: settled.current && options.isFocused && !options.blocked, candidates: options.eligible,
      present: setPresentation, hide: () => setPresentation(null) });
  }, [key, account, ids, options.isFocused, options.blocked]);
  const token = presentation?.token;
  const markShown = useCallback(() => { if (token) guidanceCoordinator.visible(token); }, [token]);
  const markHidden = useCallback(() => { if (token) guidanceCoordinator.covered(token); }, [token]);
  const dismiss = useCallback((reason = 'scrim') => {
    if (!token) return;
    if (reason === 'unmeasurable' || reason === 'timeout') guidanceCoordinator.interrupt(token);
    else guidanceCoordinator.finish(token, reason === 'complete' ? 'acknowledged' : 'dismissed', reason);
  }, [token]);
  const current = presentation?.hostKey === key && presentation.account === account && options.isFocused && !options.blocked
    && guidanceCoordinator.snapshot()?.token === token ? presentation : null;
  return { presentation: current, markShown, markHidden, dismiss };
}
