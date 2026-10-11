/**
 * Teaching Gate Orchestrator
 *
 * The single API for all teaching surface decisions.
 * Screens call useTeachingGate() once and receive at most ONE resolved
 * TeachingContent per screen visit. Multiple candidates are provided in
 * priority order; the first that clears all gates is returned.
 *
 * Priority order (by candidateIds position):
 *   1. Safety / burn-flow clarity
 *   2. First-time ritual meaning
 *   3. Milestone / streak
 *   4. Encouragement / nice-to-have
 *
 * Pattern-level cooldowns enforced here (not in individual screens):
 *   - glass_card:   suppressed if any Veil Card shown < 24h ago, or keyboard open
 *   - bottom_hint:  suppressed for remainder of session after one fades
 */

import { useEffect, useRef, useState } from 'react';
import { TEACHINGS, type TeachingContent } from '@/constants/teaching';
import { useTeachingStore, type TeachingState } from '@/stores/teachingStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSessionStore } from '@/stores/sessionStore';
import { AnalyticsService } from '@/services/AnalyticsService';

const VEIL_CARD_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface TeachingGateContext {
  screenId: string;
  /** Changes when a reused route starts showing a different anchor. */
  visitKey?: string;
  /** Suppress glass_card overlays while keyboard is visible. */
  isKeyboardOpen?: boolean;
  /** Explicitly override returning user check (defaults to automatic check). */
  isReturning?: boolean;
  /**
   * Ordered list of candidate teachingIds to evaluate.
   * First candidate that passes all gates is returned.
   * Put highest-priority (safety, burn clarity) first.
   */
  candidateIds: string[];
}

function trackSuppressed(id: string, reason: string, guideMode: boolean): void {
  // Sampled 10% to avoid analytics noise
  if (Math.random() > 0.1) return;
  AnalyticsService.track('teaching_suppressed', {
    teaching_id: id,
    reason,
    guide_mode: guideMode,
  });
}

export function checkIsReturningUser(store: TeachingState): boolean {
  if (
    store.userFlags.hasCreatedFirstAnchor ||
    store.userFlags.hasCompletedFirstCharge ||
    store.userFlags.hasCompletedFirstBurn ||
    store.userFlags.hasCompletedFirstStabilize ||
    store.userFlags.hasSeenFirstAnchorArrival ||
    store.userFlags.hasSeenFirstPracticeScene
  ) {
    return true;
  }
  try {
    const anchors = useAnchorStore.getState().anchors;
    if (anchors && anchors.length > 0) {
      if (!store.userFlags.hasCreatedFirstAnchor) {
        store.setUserFlag('hasCreatedFirstAnchor', true);
      }
      return true;
    }
  } catch {
    // Store might not be mounted in isolated tests
  }
  try {
    const sessionLog = useSessionStore.getState().sessionLog;
    if (sessionLog && sessionLog.length > 0) {
      return true;
    }
  } catch {
    // Store might not be mounted in isolated tests
  }
  return false;
}

export function useTeachingGate(context: TeachingGateContext): TeachingContent | null {
  const guideMode = useSettingsStore((s) => s.guideMode);
  const store = useTeachingStore();
  const [teachingStoreHydrated, setTeachingStoreHydrated] = useState(() =>
    useTeachingStore.persist.hasHydrated()
  );
  const retainedTeachingRef = useRef<{
    screenId: string;
    candidateKey: string;
    visitKey: string | null;
    teaching: TeachingContent;
  } | null>(null);
  const candidateKey = context.candidateIds.join('\u0000');
  const visitKey = context.visitKey ?? null;

  useEffect(() => {
    if (useTeachingStore.persist.hasHydrated()) {
      setTeachingStoreHydrated(true);
      return;
    }

    const unsubscribe = useTeachingStore.persist.onFinishHydration(() => {
      setTeachingStoreHydrated(true);
    });
    // Close the gap between the initial check and subscribing to hydration.
    if (useTeachingStore.persist.hasHydrated()) setTeachingStoreHydrated(true);
    return unsubscribe;
  }, []);

  if (!teachingStoreHydrated) {
    retainedTeachingRef.current = null;
    return null;
  }

  const isReturning = context.isReturning ?? checkIsReturningUser(store);

  const retainedTeaching = retainedTeachingRef.current;
  if (
    retainedTeaching &&
    retainedTeaching.screenId === context.screenId &&
    retainedTeaching.candidateKey === candidateKey &&
    retainedTeaching.visitKey === visitKey
  ) {
    const content = retainedTeaching.teaching;
    const isSuppressedReturning = isReturning && (content.trigger === 'first_time' || content.trigger === 'hesitation');
    const isGuideBlocked = content.guideOnly && !guideMode;

    if (!isSuppressedReturning && !isGuideBlocked) {
      return retainedTeaching.teaching;
    }
    retainedTeachingRef.current = null;
  }

  // Pattern-level cooldowns — computed once per render
  const veilCardBlocked = store.lastVeilCardAt
    ? Date.now() - new Date(store.lastVeilCardAt).getTime() < VEIL_CARD_COOLDOWN_MS
    : false;
  const groundNoteBlocked = store.sessionSeenPatterns.includes('bottom_hint');

  for (const id of context.candidateIds) {
    const content = TEACHINGS[id];
    if (!content) continue;

    // Gate 1: Returning user suppression for first-time setup and hesitation tips
    if (isReturning && (content.trigger === 'first_time' || content.trigger === 'hesitation')) {
      trackSuppressed(id, 'returning_user', guideMode);
      continue;
    }

    // Gate 2: Guide Mode
    if (content.guideOnly && !guideMode) {
      trackSuppressed(id, 'guide_off', guideMode);
      continue;
    }

    // Gate 3: Lifetime exhaustion (O(1))
    if (store.isExhausted(id)) {
      trackSuppressed(id, 'exhausted', guideMode);
      continue;
    }

    // Gate 4: Session-level suppression (never show the same teaching twice in one app session)
    if (store.isSessionSeen(id)) {
      trackSuppressed(id, 'session_seen', guideMode);
      continue;
    }

    // Gate 5: Per-teaching cooldown
    if (content.cooldownMs > 0 && store.isOnCooldown(id, content.cooldownMs)) {
      trackSuppressed(id, 'cooldown', guideMode);
      continue;
    }

    // Gate 6: Ground Note pattern-level session suppression
    if (content.pattern === 'bottom_hint' && groundNoteBlocked) {
      trackSuppressed(id, 'session_seen', guideMode);
      continue;
    }

    // Gate 7: Veil Card keyboard + 24h pattern cooldown
    if (content.pattern === 'glass_card' && (context.isKeyboardOpen || veilCardBlocked)) {
      trackSuppressed(id, 'global_gate_blocked', guideMode);
      continue;
    }

    // First candidate to clear all gates wins
    retainedTeachingRef.current = {
      screenId: context.screenId,
      candidateKey,
      visitKey,
      teaching: content,
    };
    return content;
  }

  retainedTeachingRef.current = null;
  return null;
}
