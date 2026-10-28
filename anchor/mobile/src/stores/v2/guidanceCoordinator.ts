import type { GuidanceDefinition, GuidanceId } from '@/constants/v2/guidanceRegistry';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';

export const DISPLAY_DWELL_MS = 1000;
export const PRESENT_WINDOW_MS = 1500;
export const SESSION_BACKGROUND_MS = 30 * 60 * 1000;
export type GuidanceOutcome = 'dismissed' | 'acknowledged' | 'action_performed' | 'obsolete';
export type GuidanceRecord = {
  version: number; displayCount: number; presentAttempts: number; interruptCount: number;
  firstDisplayedAt?: string; lastDisplayedAt?: string; outcome?: GuidanceOutcome;
  outcomeAt?: string; outcomeDetail?: string; variant?: string;
};
export type GuidanceData = { records: Record<string, GuidanceRecord>; discovery: Record<string, string>; replayedIds?: GuidanceId[] };
export type GuidancePresentation = { token: string; id: GuidanceId; hostKey: string; account: string };
export type GuidanceHost = {
  key: string; variant?: string; visitKey?: string; targetRevision?: number | string; account: string; ready: boolean; candidates: readonly string[];
  present: (presentation: GuidancePresentation) => void; hide: (token: string) => void;
};
export const emptyGuidanceRecord = (): GuidanceRecord => ({ version: 1, displayCount: 0, presentAttempts: 0, interruptCount: 0 });
export function settled(record: GuidanceRecord | undefined, def: GuidanceDefinition): boolean {
  return Boolean(record && (record.outcome || ((def.surface === 'whisper' || def.surface === 'scene_line') && record.displayCount > 0) || record.presentAttempts >= def.maxAttempts || (def.maxDisplays && record.displayCount >= def.maxDisplays)));
}

/** No backlog: every arbitration reads the currently registered, ready contexts. */
export function createGuidanceCoordinator(registry: readonly GuidanceDefinition[], save: (account: string, data: GuidanceData) => void) {
  let account = '';
  let data: GuidanceData = { records: {}, discovery: {} };
  let loaded = false;
  let active: GuidancePresentation | null = null;
  let visible = false;
  let displayed = false;
  let started = false;
  let serial = 0;
  let bubbles = 0;
  let chartAllowance = false;
  let backgroundAt: number | null = null;
  let foreground = true;
  const hosts = new Map<string, GuidanceHost>();
  const visits = new Set<string>();
  // Only pre-visible measurement failures may recover, on a changed target signal.
  const measurements = new Map<string, { hostKey: string; id: GuidanceId; revision: number | string | undefined; selections: number; failed: boolean }>();
  const cancelMeasurement = (key: string) => {
    if (measurements.has(key)) visits.add(key);
    measurements.delete(key);
  };
  const cancelMeasurements = () => { measurements.forEach((_, key) => visits.add(key)); measurements.clear(); };
  const recover = (host: GuidanceHost) => {
    const key = visitKey(host);
    const pending = measurements.get(key);
    if (pending?.failed && pending.selections < 3 && pending.hostKey === host.key && host.ready
      && host.account === account && host.candidates.includes(pending.id)
      && host.targetRevision !== pending.revision && !quiet.has(key) && !locks.size && foreground) {
      pending.failed = false;
      visits.delete(key);
      schedule();
    }
  };
  const quiet = new Set<string>();
  const locks = new Set<string>();
  const listeners = new Set<() => void>();
  let evaluation: ReturnType<typeof setTimeout> | undefined;
  let dwell: ReturnType<typeof setTimeout> | undefined;
  let window: ReturnType<typeof setTimeout> | undefined;
  const emit = () => listeners.forEach(listener => listener());
  const persist = () => save(account, data);
  const rec = (id: string) => data.records[id] ?? (data.records[id] = emptyGuidanceRecord());
  const visitKey = (host: GuidanceHost) => host.visitKey ?? host.key;
  const clearTimers = () => { clearTimeout(dwell); clearTimeout(window); dwell = undefined; window = undefined; };
  const hide = (interrupted: boolean) => {
    if (!active) return;
    const previous = active;
    clearTimers();
    if (interrupted && displayed) { rec(previous.id).interruptCount++; persist(); }
    active = null; visible = false; displayed = false; started = false;
    hosts.get(previous.hostKey)?.hide(previous.token);
    emit();
  };
  const measurementFailed = (token: string) => {
    if (active?.token !== token) return;
    const host = hosts.get(active.hostKey);
    const pending = host && measurements.get(visitKey(host));
    if (!started && pending) pending.failed = true;
    hide(true);
    if (host) recover(host);
  };
  const evaluate = () => {
    evaluation = undefined;
    if (!loaded || active || locks.size || !foreground) return;
    registry.forEach(def => {
      const record = data.records[def.id];
      const expired = record?.firstDisplayedAt && def.repeatWithinMs && Date.now() - Date.parse(record.firstDisplayedAt) > def.repeatWithinMs;
      if (record && !record.outcome && (record.presentAttempts >= def.maxAttempts || (def.maxDisplays && record.displayCount >= def.maxDisplays) || expired)) {
        Object.assign(record, { outcome: 'obsolete', outcomeAt: new Date().toISOString(), outcomeDetail: 'not_applicable' });
        persist();
      }
    });
    const candidates = [...hosts.values()].filter(host => host.account === account && host.ready && !visits.has(visitKey(host)))
      .flatMap(host => registry.filter(def => host.candidates.includes(def.id) && !settled(data.records[def.id], def)
        && (def.surface === 'scene_line' || !quiet.has(visitKey(host)))
        && (def.surface === 'scene_line' || def.surface === 'whisper' || (def.priority === 0 ? !chartAllowance : bubbles < 1))).map(def => ({ host, def })))
      .sort((a, b) => a.def.priority - b.def.priority || registry.indexOf(a.def) - registry.indexOf(b.def) || a.host.key.localeCompare(b.host.key));
    const next = candidates[0];
    if (!next) return;
    active = { token: `${++serial}`, id: next.def.id, hostKey: next.host.key, account };
    const token = active.token;
    // Reserve the visit. A failed measurement can recover only after a target event.
    const key = visitKey(next.host);
    const previous = measurements.get(key);
    measurements.set(key, { hostKey: next.host.key, id: next.def.id, revision: next.host.targetRevision, selections: (previous?.selections ?? 0) + 1, failed: false });
    visits.add(key);
    window = setTimeout(() => { if (active?.token === token && !visible) measurementFailed(token); }, PRESENT_WINDOW_MS);
    emit();
    next.host.present(active);
  };
  const schedule = () => { if (!evaluation) evaluation = setTimeout(evaluate, 0); };
  const update = (host: GuidanceHost) => {
    hosts.set(host.key, host);
    const pending = measurements.get(visitKey(host));
    if (!host.ready || host.account !== account || (pending && !host.candidates.includes(pending.id))) cancelMeasurement(visitKey(host));
    recover(host);
    if (locks.has('celebration')) quiet.add(visitKey(host));
    if (active?.hostKey === host.key && (!host.ready || host.account !== account || !host.candidates.includes(active.id))) hide(true);
    schedule();
  };
  return {
    snapshot: () => active,
    diagnostics: () => ({ loaded, foreground, locks: [...locks], hosts: [...hosts.values()].map(({ key, ready, candidates }) => ({ key, ready, candidates })), visits: [...visits], quiet: [...quiet], bubbles, chartAllowance }),
    data: () => data,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    bind: (key: string, value: GuidanceData | null) => {
      if (account !== key) { hide(true); visits.clear(); measurements.clear(); quiet.clear(); bubbles = 0; chartAllowance = false; }
      account = key; loaded = value !== null;
      data = value ?? { records: {}, discovery: {} }; schedule();
    },
    register: (host: GuidanceHost) => {
      update(host);
      return () => { if (active?.hostKey === host.key) hide(true); cancelMeasurement(visitKey(host)); hosts.delete(host.key); schedule(); };
    },
    update,
    visible: (token: string) => {
      if (active?.token !== token || visible || locks.size || !foreground) return;
      visible = true;
      const host = hosts.get(active.hostKey);
      if (host) measurements.delete(visitKey(host));
      clearTimeout(window);
      const presentation = active;
      const def = registry.find(item => item.id === presentation.id)!;
      if (!started) {
        started = true;
        rec(presentation.id).presentAttempts++;
        if (host?.variant) rec(presentation.id).variant = host.variant;
        if (def.surface === 'bubble') {
          if (def.priority === 0) chartAllowance = true;
          else bubbles++;
        }
        persist();
      }
      if (displayed) return;
      dwell = setTimeout(() => {
        if (active?.token !== token || locks.size || !foreground) return;
        displayed = true;
        const record = rec(presentation.id);
        record.displayCount++;
        record.firstDisplayedAt ??= new Date().toISOString();
        record.lastDisplayedAt = new Date().toISOString();
        AnalyticsService.track(AnalyticsEvents.TEACHING_SHOWN, { teaching_id: presentation.id, surface: def.surface, host_key: presentation.hostKey, display_count: record.displayCount });
        persist();
      }, DISPLAY_DWELL_MS);
    },
    covered: (token: string) => {
      if (active?.token !== token) return;
      visible = false; clearTimeout(dwell); dwell = undefined;
    },
    finish: (token: string, outcome: GuidanceOutcome, detail?: string) => {
      if (active?.token !== token || !visible || locks.size || !foreground) return;
      const finishedId = active.id;
      const finishedHost = active.hostKey;
      Object.assign(rec(active.id), { outcome, outcomeAt: new Date().toISOString(), outcomeDetail: detail });
      if (outcome === 'dismissed' || outcome === 'acknowledged') {
        AnalyticsService.track(AnalyticsEvents.TEACHING_DISMISSED, { teaching_id: finishedId, host_key: finishedHost, outcome, detail });
      } else if (outcome === 'action_performed') {
        AnalyticsService.track(AnalyticsEvents.TEACHING_ACTION_TAKEN, { teaching_id: finishedId, host_key: finishedHost, detail });
      }
      persist(); hide(false); schedule();
    },
    startAction: (token: string, detail: string) => {
      const origin = active?.token === token && visible ? active : null;
      const record = origin ? rec(origin.id) : null;
      return (success: boolean) => {
        if (!origin || !record || account !== origin.account || data.records[origin.id] !== record) return;
        if (!success) { if (active?.token === token) hide(true); return; }
        // A real operation can finish after navigation/celebration hides its tip.
        // The captured record identity prevents account/replay races.
        Object.assign(record, { outcome: 'action_performed', outcomeAt: new Date().toISOString(), outcomeDetail: detail });
        data.discovery[origin.id] = new Date().toISOString();
        AnalyticsService.track(AnalyticsEvents.TEACHING_ACTION_TAKEN, { teaching_id: origin.id, host_key: origin.hostKey, detail });
        persist(); if (active?.token === token) hide(false); schedule();
      };
    },
    migrate: (id: GuidanceId) => {
      if (loaded && !data.records[id]) { data.records[id] = { ...emptyGuidanceRecord(), outcome: 'acknowledged', outcomeDetail: 'migrated' }; persist(); }
    },
    interrupt: (token: string, reason?: 'unmeasurable' | 'timeout') => {
      if (reason) { measurementFailed(token); return; }
      if (active?.token === token) {
        const host = hosts.get(active.hostKey);
        if (host) cancelMeasurement(visitKey(host));
        hide(true);
      }
    },
    lock: (key: string, on: boolean, celebration = false) => {
      if (on) {
        locks.add(key);
        cancelMeasurements();
        if (celebration) hosts.forEach(host => quiet.add(visitKey(host)));
        hide(true);
      } else { locks.delete(key); schedule(); }
    },
    foreground: (on: boolean) => {
      if (on === foreground) return;
      foreground = on;
      if (!on) { backgroundAt = Date.now(); cancelMeasurements(); hide(true); }
      else {
        if (backgroundAt !== null && Date.now() - backgroundAt >= SESSION_BACKGROUND_MS) { bubbles = 0; chartAllowance = false; }
        backgroundAt = null; schedule();
      }
    },
    discover: (id: GuidanceId) => {
      if (!loaded || data.discovery[id]) return;
      data.discovery[id] = new Date().toISOString();
      // A confirmed active action retains its more precise outcome.
      if (!rec(id).outcome) Object.assign(rec(id), { outcome: 'obsolete', outcomeAt: new Date().toISOString(), outcomeDetail: 'learned_by_use' });
      if (active?.id === id) hide(false);
      persist(); schedule();
    },
    replay: (onlyId?: GuidanceId) => {
      data.replayedIds = [...new Set([...(data.replayedIds ?? []), ...(onlyId ? [onlyId] : registry.map(def => def.id))])];
      if (!onlyId || active?.id === onlyId) hide(true);
      if (onlyId) {
        delete data.records[onlyId];
        measurements.forEach((pending, key) => { if (pending.id === onlyId) measurements.delete(key); });
        hosts.forEach(host => { if (host.candidates.includes(onlyId)) visits.delete(visitKey(host)); });
        if (registry.find(def => def.id === onlyId)?.priority === 0) chartAllowance = false;
      } else {
        data.records = {}; visits.clear(); measurements.clear(); quiet.clear(); bubbles = 0; chartAllowance = false;
        if (locks.has('celebration')) hosts.forEach(host => quiet.add(visitKey(host)));
      }
      Object.entries(data.discovery).forEach(([id, at]) => {
        if (!onlyId || id === onlyId) data.records[id] = { ...emptyGuidanceRecord(), outcome: 'obsolete', outcomeAt: at, outcomeDetail: 'learned_by_use' };
      });
      persist(); schedule();
    },
    dispose: () => { hide(true); clearTimeout(evaluation); evaluation = undefined; hosts.clear(); listeners.clear(); },
  };
}
