import type { FirstRunStep } from '@/stores/v2/firstRunStore';
import type { AnchorCategory } from '@/types';
import { AnalyticsService } from '@/services/AnalyticsService';

export type OnboardingStepName = 'welcome' | 'bridge' | 'motivation' | 'creation' | 'save' | 'complete';
export type AuthMethod = 'email' | 'google' | 'apple';
export type AuthMode = 'create' | 'signin';
export type AuthContext = 'onboarding_save' | 'v2_auth' | 'save_progress';
export type AuthErrorCode =
  | 'email_in_use' | 'bad_credentials' | 'user_not_found' | 'invalid_email'
  | 'weak_password' | 'network' | 'cancelled' | 'unknown';
export type ValidationCode =
  | 'email_missing' | 'email_invalid' | 'password_missing' | 'password_short';

const ORDER: OnboardingStepName[] = ['welcome', 'bridge', 'motivation', 'creation', 'save', 'complete'];
const STEP_MAP: Record<string, OnboardingStepName> = {
  welcome: 'welcome', bridge: 'bridge', motivation: 'motivation',
  outcome: 'motivation', meaning: 'motivation', friction: 'motivation', system: 'motivation',
  handoff: 'motivation', life: 'motivation', need: 'motivation', summary: 'motivation',
  creation: 'creation', intention: 'creation', formation: 'creation', anchor: 'creation', expression: 'creation',
  auth: 'save', vision: 'save', focus: 'save', complete: 'complete',
};

let flowSessionId: string | null = null;
let sessionStartedAt = 0;
let currentStep: string | undefined;
let currentStepViewedAt = 0;
let startedEmitted = false;
let backgroundedThisVisit = false;
let bypassedThisSession = false;

const safeTrack = (event: string, properties: Record<string, unknown>) => {
  try { AnalyticsService.track(event, properties); } catch { /* Analytics must not affect product flows. */ }
};

const sessionId = () => {
  if (!flowSessionId) flowSessionId = `onboarding_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return flowSessionId;
};

export const stepFor = (raw: FirstRunStep | string): OnboardingStepName | string => STEP_MAP[raw] ?? raw;

const onboardingTrack = (event: string, properties: Record<string, unknown>) =>
  safeTrack(event, { flow_session_id: sessionId(), ...properties });

export const OnboardingAnalytics = {
  started(raw: FirstRunStep | string): void {
    try {
      if (startedEmitted) return;
      startedEmitted = true;
      sessionStartedAt = Date.now();
      const restoredStep = stepFor(raw);
      currentStep = raw;
      currentStepViewedAt = Date.now();
      onboardingTrack('onboarding_started', {
        resumed: restoredStep !== 'welcome', restored_step: restoredStep,
      });
    } catch { /* Analytics must not affect product flows. */ }
  },

  stepChanged(fromRaw: FirstRunStep | string | undefined, toRaw: FirstRunStep | string): void {
    try {
      const fromStep = fromRaw === undefined ? undefined : stepFor(fromRaw);
      const toStep = stepFor(toRaw);
      if (fromStep === toStep) return;
      if (fromRaw !== undefined) {
        const fromIndex = ORDER.indexOf(fromStep as OnboardingStepName);
        const toIndex = ORDER.indexOf(toStep as OnboardingStepName);
        onboardingTrack('onboarding_step_completed', {
          step: fromStep,
          exit: toIndex > fromIndex ? 'continue' : 'back',
          duration_ms: Math.max(0, Date.now() - currentStepViewedAt),
        });
      }
      const stepIndex = ORDER.indexOf(toStep as OnboardingStepName);
      onboardingTrack('onboarding_step_viewed', {
        step: toStep,
        from_step: fromStep ?? null,
        step_index: stepIndex >= 0 ? stepIndex + 1 : null,
      });
      currentStep = toRaw;
      currentStepViewedAt = Date.now();
      backgroundedThisVisit = false;
    } catch { /* Analytics must not affect product flows. */ }
  },

  cta(step: OnboardingStepName, cta: 'start' | 'sign_in' | 'create'): void {
    try { onboardingTrack('onboarding_cta_tapped', { step, cta }); } catch { /* no-op */ }
  },
  bridgeSkipped(msIntoAnimation: number): void {
    try { onboardingTrack('onboarding_bridge_skipped', { ms_into_animation: Math.max(0, msIntoAnimation) }); } catch { /* no-op */ }
  },
  categorySelected(category: AnchorCategory): void {
    try { onboardingTrack('onboarding_category_selected', { category }); } catch { /* no-op */ }
  },
  backgrounded(raw: FirstRunStep | string): void {
    try {
      if (backgroundedThisVisit) return;
      backgroundedThisVisit = true;
      onboardingTrack('onboarding_backgrounded', { step: stepFor(raw) });
    } catch { /* no-op */ }
  },
  bypassed(reason: 'returning_user' | 'already_complete'): void {
    try {
      if (bypassedThisSession) return;
      bypassedThisSession = true;
      onboardingTrack('onboarding_bypassed', { reason });
    } catch { /* no-op */ }
  },
  completed(path: 'account' | 'guest'): void {
    try { onboardingTrack('onboarding_completed', { path, session_ms: Math.max(0, Date.now() - sessionStartedAt) }); } catch { /* no-op */ }
  },
  classifyAuthError(error: unknown): AuthErrorCode {
    try {
      const message = error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
            ? error.message
            : '';
      const normalized = message.toLowerCase();
      if (normalized.includes('already') && normalized.includes('email')) return 'email_in_use';
      if (normalized.includes('wrong-password') || normalized.includes('incorrect') || normalized.includes('credential')) return 'bad_credentials';
      if (normalized.includes('user-not-found') || normalized.includes('no user')) return 'user_not_found';
      if (normalized.includes('invalid-email')) return 'invalid_email';
      if (normalized.includes('weak') || normalized.includes('at least 8')) return 'weak_password';
      if (normalized.includes('network')) return 'network';
      if (normalized.includes('cancel')) return 'cancelled';
      return 'unknown';
    } catch { return 'unknown'; }
  },
  auth: {
    emailFormOpened(context: AuthContext, mode: AuthMode): void { safeTrack('auth_email_form_opened', { context, mode }); },
    started(context: AuthContext, method: AuthMethod, mode: AuthMode): void { safeTrack('auth_started', { context, method, mode }); },
    succeeded(context: AuthContext, method: AuthMethod, mode: AuthMode, hasCompletedOnboarding: boolean): void {
      safeTrack('auth_succeeded', { context, method, mode, has_completed_onboarding: hasCompletedOnboarding });
    },
    failed(context: AuthContext, method: AuthMethod, mode: AuthMode, stage: 'validation' | 'provider', errorCode: AuthErrorCode | ValidationCode): void {
      safeTrack('auth_failed', { context, method, mode, stage, error_code: errorCode });
    },
    cancelled(context: AuthContext, method: AuthMethod, mode: AuthMode): void { safeTrack('auth_cancelled', { context, method, mode }); },
    guestChosen(): void { safeTrack('auth_guest_chosen', { context: 'onboarding_save' }); },
    passwordResetRequested(context: AuthContext, outcome: 'sent' | 'failed'): void { safeTrack('auth_password_reset_requested', { context, outcome }); },
    saveRetry(attempt: number): void { safeTrack('anchor_save_retry', { context: 'onboarding_save', attempt }); },
    saveFailed(errorCode: AuthErrorCode): void { safeTrack('anchor_save_failed', { context: 'onboarding_save', error_code: errorCode }); },
  },
  reset(): void {
    flowSessionId = null;
    sessionStartedAt = 0;
    currentStep = undefined;
    currentStepViewedAt = 0;
    startedEmitted = false;
    backgroundedThisVisit = false;
    bypassedThisSession = false;
  },
};
