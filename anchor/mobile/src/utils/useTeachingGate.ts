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

import { TEACHINGS, type TeachingContent } from '@/constants/teaching';
import { useTeachingStore } from '@/stores/teachingStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { AnalyticsService } from '@/services/AnalyticsService';

const VEIL_CARD_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

interface TeachingGateContext {
  screenId: string;
  /** Suppress glass_card overlays while keyboard is visible. */
  isKeyboardOpen?: boolean;
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

export function useTeachingGate(context: TeachingGateContext): TeachingContent | null {
  const guideMode = useSettingsStore((s) => s.guideMode);
  const store = useTeachingStore();

  // Pattern-level cooldowns — computed once per render
  const veilCardBlocked = store.lastVeilCardAt
    ? Date.now() - new Date(store.lastVeilCardAt).getTime() < VEIL_CARD_COOLDOWN_MS
    : false;
  const groundNoteBlocked = store.sessionSeenPatterns.includes('bottom_hint');

  for (const id of context.candidateIds) {
    const content = TEACHINGS[id];
    if (!content) continue;

    // Gate 1: Guide Mode
    if (content.guideOnly && !guideMode) {
      trackSuppressed(id, 'guide_off', guideMode);
      continue;
    }

    // Gate 2: Lifetime exhaustion (O(1))
    if (store.isExhausted(id)) {
      trackSuppressed(id, 'exhausted', guideMode);
      continue;
    }

    // Gate 3: Per-teaching cooldown
    if (content.cooldownMs > 0 && store.isOnCooldown(id, content.cooldownMs)) {
      trackSuppressed(id, 'cooldown', guideMode);
      continue;
    }

    // Gate 4: Ground Note session-level suppression
    if (content.pattern === 'bottom_hint' && (store.isSessionSeen(id) || groundNoteBlocked)) {
      trackSuppressed(id, 'session_seen', guideMode);
      continue;
    }

    // Gate 5: Veil Card keyboard + 24h pattern cooldown
    if (content.pattern === 'glass_card' && (context.isKeyboardOpen || veilCardBlocked)) {
      trackSuppressed(id, 'global_gate_blocked', guideMode);
      continue;
    }

    // First candidate to clear all gates wins
    return content;
  }

  return null;
}
