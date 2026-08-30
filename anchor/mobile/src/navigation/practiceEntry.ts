import type { Anchor, PracticeStackParamList, RootStackParamList } from '@/types';
import {
  PRACTICE_ENTRY_MODES,
  type PracticeEntryMode,
  type PracticeEntrySource,
} from '@/types/practice';
import type { PrimeSessionAccessSnapshot } from '@/hooks/usePrimeSessionAccess';
import type {
  SessionAudioConfiguration,
} from '@/types/sessionAudio';

export interface StartPracticeRequest {
  mode: PracticeEntryMode;
  anchorId: string;
  source: PracticeEntrySource;
  durationSeconds?: number;
  audioConfiguration?: SessionAudioConfiguration;
  intention?: string;
  sigilSvg?: string;
  enhancedImageUrl?: string;
}

export type PracticeEntryTarget =
  | { route: 'ChargeSetup'; params: PracticeStackParamList['ChargeSetup'] }
  | { route: 'Ritual'; params: PracticeStackParamList['Ritual'] }
  | { route: 'ActivationRitual'; params: PracticeStackParamList['ActivationRitual'] }
  | { route: 'VisualizePreparation'; params: PracticeStackParamList['VisualizePreparation'] }
  | { route: 'ConfirmBurn'; params: PracticeStackParamList['ConfirmBurn'] };

export interface StartPracticeDependencies {
  getAnchorById: (anchorId: string) => Anchor | undefined;
  primeSessionAccess: PrimeSessionAccessSnapshot;
  visualizeAvailable: boolean;
  defaultFocusDurationSeconds: number;
  defaultAudioConfiguration: {
    focus: SessionAudioConfiguration;
    deepPrime: SessionAudioConfiguration;
  };
  navigateToPractice: (target: PracticeEntryTarget) => void;
  navigateToPaywall: (params?: RootStackParamList['Paywall']) => void;
  onEntitlementDenied?: (params: {
    mode: PracticeEntryMode;
    anchorId: string;
    remaining: number;
    tier: PrimeSessionAccessSnapshot['tier'];
  }) => void;
}

const isPracticeEntryMode = (value: unknown): value is PracticeEntryMode =>
  typeof value === 'string' &&
  (PRACTICE_ENTRY_MODES as readonly string[]).includes(value);

const isValidDuration = (value: number | undefined): value is number =>
  value == null || (Number.isFinite(value) && value > 0);

const getAnchorIntention = (anchor: Anchor, request: StartPracticeRequest): string =>
  request.intention ??
  anchor.intentionText ??
  (anchor as Anchor & { intention?: string }).intention ??
  '';

/**
 * The only route-construction boundary for practice sessions.
 *
 * This function deliberately accepts a target navigator instead of a generic
 * React Navigation object. That keeps tab switching and session entry in one
 * place and makes it impossible for a Practice entry to accidentally push a
 * route into the Sanctuary stack.
 */
export function startPractice(
  request: StartPracticeRequest,
  dependencies: StartPracticeDependencies,
): boolean {
  const anchorId = request.anchorId.trim();
  if (!anchorId || !isPracticeEntryMode(request.mode) || !isValidDuration(request.durationSeconds)) {
    return false;
  }

  const anchor = dependencies.getAnchorById(anchorId);
  if (!anchor || anchor.isReleased || anchor.archivedAt) {
    return false;
  }

  if (request.mode === 'deepPrime' && !dependencies.primeSessionAccess.deep.isAllowed) {
    dependencies.onEntitlementDenied?.({
      mode: request.mode,
      anchorId,
      remaining: dependencies.primeSessionAccess.deep.remaining,
      tier: dependencies.primeSessionAccess.tier,
    });
    dependencies.navigateToPaywall({
      source: 'free_weekly_sessions_used',
      preferredPlanId: 'annual',
    });
    return false;
  }

  if (request.mode === 'focus' && !dependencies.primeSessionAccess.focus.isAllowed) {
    dependencies.onEntitlementDenied?.({
      mode: request.mode,
      anchorId,
      remaining: dependencies.primeSessionAccess.focus.remaining,
      tier: dependencies.primeSessionAccess.tier,
    });
    dependencies.navigateToPaywall({
      source: 'free_weekly_sessions_used',
      preferredPlanId: 'annual',
    });
    return false;
  }

  if (request.mode === 'visualize' && !dependencies.visualizeAvailable) {
    dependencies.navigateToPaywall({
      source: 'premium_practice_locked',
      preferredPlanId: 'annual',
      resumeTarget: { kind: 'visualize_prepare', anchorId },
    });
    return false;
  }

  const audioConfiguration = request.audioConfiguration ??
    (request.mode === 'focus'
      ? dependencies.defaultAudioConfiguration.focus
      : dependencies.defaultAudioConfiguration.deepPrime);

  let target: PracticeEntryTarget;
  switch (request.mode) {
    case 'deepPrime':
      target = request.durationSeconds != null
        ? {
          route: 'Ritual',
          params: {
            anchorId,
            ritualType: 'ritual',
            durationSeconds: request.durationSeconds,
            audioConfiguration,
            returnTo: 'practice',
            source: request.source,
          },
        }
        : {
          route: 'ChargeSetup',
          params: {
            anchorId,
            returnTo: 'practice',
            initialDuration: 'deep',
            source: request.source,
          },
        };
      break;
    case 'focus':
      target = {
        route: 'ActivationRitual',
        params: {
          anchorId,
          activationType: 'visual',
          durationOverride: request.durationSeconds ?? dependencies.defaultFocusDurationSeconds,
          audioConfiguration,
          returnTo: 'practice',
          source: request.source,
        },
      };
      break;
    case 'visualize':
      target = {
        route: 'VisualizePreparation',
        params: { anchorId, source: request.source },
      };
      break;
    case 'release':
      target = {
        route: 'ConfirmBurn',
        params: {
          anchorId,
          intention: getAnchorIntention(anchor, request),
          sigilSvg: request.sigilSvg ?? anchor.reinforcedSigilSvg ?? anchor.baseSigilSvg ?? '',
          enhancedImageUrl: request.enhancedImageUrl ?? anchor.enhancedImageUrl,
          returnTo: 'practice',
          source: request.source,
        },
      };
      break;
  }

  dependencies.navigateToPractice(target);
  return true;
}
