import { AnalyticsService } from '@/services/AnalyticsService';
import type { ResolvedSessionAudioPlan } from '@/services/SessionAudioManifest';

const planProperties = (plan: ResolvedSessionAudioPlan) => ({
  session_type: plan.sessionType,
  duration_seconds: plan.durationSeconds,
  guidance_voice: plan.configuration.guidanceVoice,
  requested_guidance_voice: plan.requestedConfiguration.guidanceVoice,
  background_audio: plan.configuration.backgroundAudio,
  source: plan.configuration.source,
  locale: plan.locale,
  voice_available:
    plan.requestedConfiguration.guidanceVoice === 'none' || plan.shouldPlayVoice,
  fallback_used: plan.fallbackUsed,
});

export const trackSessionAudioFallback = (plan: ResolvedSessionAudioPlan): void => {
  if (!plan.fallbackUsed) return;
  AnalyticsService.track('session_audio_fallback_used', {
    ...planProperties(plan),
    fallback_reasons: plan.fallbackReasons,
  });
};

export const trackSessionStartedWithAudio = (plan: ResolvedSessionAudioPlan): void => {
  AnalyticsService.track('session_started', planProperties(plan));
  trackSessionAudioFallback(plan);
};

export const trackGuidedAudioLoadFailed = (
  plan: ResolvedSessionAudioPlan,
  phaseId: string
): void => {
  AnalyticsService.track('guided_audio_load_failed', {
    ...planProperties(plan),
    phase_id: phaseId,
  });
};

export const trackAmbientAudioLoadFailed = (plan: ResolvedSessionAudioPlan): void => {
  AnalyticsService.track('ambient_audio_load_failed', planProperties(plan));
};
