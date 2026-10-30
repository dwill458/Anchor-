import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { useNotificationController } from '@/hooks/useNotificationController';
import { useEntitlements } from '@/hooks/useEntitlements';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { ApiClientError, post, type AccountBoundRequestConfig } from '@/services/ApiClient';
import { isBackendAnchorId } from '@/services/BackendAnchorService';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import { FrictionAnalytics } from '@/services/FrictionAnalytics';
import { useAnchorStore, useTempStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useFirstAnchorFlowStore, flushFirstAnchorFlowDraft } from '@/stores/firstAnchorFlowStore';
import type {
  Anchor,
  AnchorCategory,
  ApiResponse,
  EnhancementMetadata,
  ReinforcementMetadata,
  RootStackParamList,
  SigilVariant,
} from '@/types';
import { getAnchorCreationLimitCopy } from '@/utils/entitlements';
import { logger } from '@/utils/logger';
import { AuthService } from '@/services/AuthService';
import { creationSelection } from '@/services/AnchorCreationSession';
import { captureCreationAuthContext } from '@/services/CreationAuthContext';
import { classifyToTierPreliminary } from '@/utils/tierClassifier';

/**
 * Both guest and registered creation save through verified server ownership before
 * writing the local vault. The stable key survives a retry or interrupted first run.
 * `proceed` leaves the caller in control of the existing seal animation and routing.
 */

type SaveAnchorNavigation = StackNavigationProp<RootStackParamList>;

export interface SaveAnchorInput {
  intentionText: string;
  category: AnchorCategory;
  distilledLetters: string[];
  baseSigilSvg: string;
  reinforcedSigilSvg?: string;
  structureVariant: SigilVariant;
  reinforcementMetadata?: ReinforcementMetadata;
  enhancementMetadata?: EnhancementMetadata;
  /** The chosen image. Heavy inline images arrive through the temp store instead. */
  enhancedImageUrl?: string | null;
}

export type SaveAnchorOutcome =
  | { status: 'blocked' }
  | {
      status: 'saved';
      anchorId: string;
      isGuestFirstAnchor: boolean;
      isFirstAnchor: boolean;
      /** Offer the reminder card, or route onward. Call once the caller is ready to leave. */
      proceed: () => void;
    };

export interface SaveAnchorRouting {
  /**
   * Replace the legacy post-save routing (SaveProgress / PrimeYourAnchor / WallpaperPrompt /
   * ChargeSetup). The V2 navigator has none of those routes, so it hands off to Home instead.
   */
  onSaved?: (result: { anchorId: string; isGuestFirstAnchor: boolean; isFirstAnchor: boolean; input: SaveAnchorInput }) => void;
}

export function useSaveAnchor(input: SaveAnchorInput, routing: SaveAnchorRouting = {}) {
  const navigation = useNavigation<SaveAnchorNavigation>();
  const addAnchor = useAnchorStore((state) => state.addAnchor);
  const setCurrentAnchor = useAnchorStore((state) => state.setCurrentAnchor);
  const incrementAnchorCount = useAuthStore((state) => state.incrementAnchorCount);
  const wallpaperPromptSeen = useAuthStore((state) => state.wallpaperPromptSeen);
  const authUser = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const existingAnchorCount = useAuthStore((state) => state.anchorCount);
  const setPendingFirstAnchorDraft = useAuthStore((state) => state.setPendingFirstAnchorDraft);
  const clearPendingFirstAnchorState = useAuthStore((state) => state.clearPendingFirstAnchorState);
  const { handleAnchorSaved, canOfferFirstAnchorReminder } = useNotificationController();
  const entitlements = useEntitlements();
  const tempEnhancedImage = useTempStore((state) => state.tempEnhancedImage);
  const setTempEnhancedImage = useTempStore((state) => state.setTempEnhancedImage);

  const [isSaving, setIsSaving] = useState(false);
  const [reminderCardVisible, setReminderCardVisible] = useState(false);
  const pendingNavRef = useRef<{ anchorId: string; isGuestFirstAnchor: boolean; resolved: SaveAnchorInput } | null>(null);
  // State updates do not take effect until React re-renders. Keep a synchronous
  // guard across the whole create-and-reminder flow so a second tap cannot start
  // another request while an async continuation is still pending.
  const creationInFlightRef = useRef(false);
  const saveKeyRef = useRef<string | null>(null);

  // The latest render's input, so `saveAnchor(override)` always sees current values.
  const inputRef = useRef(input);
  inputRef.current = input;

  const navigateAfterSave = (
    anchorId: string,
    isGuestFirstAnchor: boolean,
    isFirstAnchor: boolean,
    resolved: SaveAnchorInput = inputRef.current
  ) => {
    if (routing.onSaved) {
      routing.onSaved({ anchorId, isGuestFirstAnchor, isFirstAnchor, input: { ...resolved, enhancedImageUrl: resolved.enhancedImageUrl || tempEnhancedImage } });
      return;
    }

    const {
      intentionText,
      category,
      distilledLetters,
      baseSigilSvg,
      reinforcedSigilSvg,
      structureVariant,
      reinforcementMetadata,
      enhancementMetadata,
    } = resolved;
    const enhancedImageUrl = resolved.enhancedImageUrl || tempEnhancedImage;


    if (isGuestFirstAnchor) {
      // The creation record already exists locally. Passing it through is
      // more reliable than rereading a persisted store during the same
      // render turn, particularly immediately after a cold-start restore.
      const savedAnchor: Anchor = {
        id: anchorId,
        userId: authUser?.id || 'user-local',
        intentionText,
        category,
        distilledLetters,
        baseSigilSvg,
        reinforcedSigilSvg,
        structureVariant,
        reinforcementMetadata,
        enhancementMetadata,
        enhancedImageUrl: enhancedImageUrl || undefined,
        isCharged: false,
        activationCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      navigation.replace('SaveProgress', { anchor: savedAnchor });
      return;
    }

    if (isFirstAnchor) {
      navigation.replace('PrimeYourAnchor', { anchorId });
      return;
    }

    if (!wallpaperPromptSeen) {
      navigation.replace('WallpaperPrompt', {
        anchorId,
        intentionText,
        enhancedImageUrl: enhancedImageUrl || undefined,
        sigilSvg: reinforcedSigilSvg || baseSigilSvg,
        fromOnboarding: isGuestFirstAnchor,
      });
    } else {
      navigation.replace('ChargeSetup', {
        anchorId,
        autoStartOnSelection: true,
        returnTo: 'vault',
        fromOnboarding: isGuestFirstAnchor,
      });
    }
  };

  const handleReminderDismiss = () => {
    setReminderCardVisible(false);
    const pending = pendingNavRef.current;
    pendingNavRef.current = null;
    if (pending) {
      navigateAfterSave(pending.anchorId, pending.isGuestFirstAnchor, false, pending.resolved);
    }
  };

  const saveAnchor = async (override?: Partial<SaveAnchorInput>): Promise<SaveAnchorOutcome> => {
    if (isSaving || creationInFlightRef.current) return { status: 'blocked' };
    const authContext = captureCreationAuthContext();

    const resolved: SaveAnchorInput = { ...inputRef.current, ...override };
    const {
      intentionText,
      category,
      distilledLetters,
      baseSigilSvg,
      reinforcedSigilSvg,
      structureVariant,
      reinforcementMetadata,
      enhancementMetadata,
    } = resolved;
    // Retrieve from the temp store if not passed (handles large base64).
    const enhancedImageUrl = resolved.enhancedImageUrl || tempEnhancedImage;
    resolved.enhancedImageUrl = enhancedImageUrl;

    const isGuestFirstAnchor = !isAuthenticated && existingAnchorCount === 0;
    const isFirstAnchor = existingAnchorCount === 0;
    if (!isGuestFirstAnchor && !entitlements.canCreateAnchor) {
      const reason = entitlements.anchorCreationLimitReason;
      if (!reason) return { status: 'blocked' };

      AnalyticsService.track(reason, {
        source: 'anchor_reveal',
        anchors_created_today: entitlements.anchorsCreatedToday,
        anchors_created_during_trial: entitlements.anchorsCreatedDuringTrial,
        tier: entitlements.tier,
      });

      if (reason === 'pro_daily_anchor_cap_reached') {
        const copy = getAnchorCreationLimitCopy(reason);
        Alert.alert(copy?.title ?? 'Daily creation limit reached', copy?.body, [
          { text: copy?.cta ?? 'Return to Sanctuary', onPress: () => navigation.goBack() },
        ]);
        return { status: 'blocked' };
      }

      navigation.navigate('Paywall', {
        source: reason,
        preferredPlanId: 'annual',
      });
      return { status: 'blocked' };
    }

    creationInFlightRef.current = true;
    setIsSaving(true);

    ErrorTrackingService.addBreadcrumb('Anchor reveal continued', 'create.anchor_reveal', {
      has_image: Boolean(enhancedImageUrl),
    });

    const firstFlow = useFirstAnchorFlowStore.getState();
    const idempotencyKey = saveKeyRef.current ?? firstFlow.draft?.saveRequestKey ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    saveKeyRef.current = idempotencyKey;
    firstFlow.updateDraft({ saveRequestKey: idempotencyKey });
    let anchorId = isGuestFirstAnchor
      ? `pending-first-anchor-${idempotencyKey}`
      : `anchor-${idempotencyKey}`;
    let confirmedAnchor: Anchor | undefined;

    // Precedence rule: the deterministic category -> tier map (CATEGORY_TO_TIER) is
    // authoritative whenever the resolved category is one of the 9 specific categories.
    // Fallback tier classification (and the Gemini /api/anchors/classify-tier endpoint)
    // runs ONLY when the resolved category is a fallback ('desire' or 'custom'), i.e.
    // the exact cases where the keyword system or onboarding choice declared uncertainty.
    const { tier, confidenceScore, isCustomFallback } = classifyToTierPreliminary(intentionText, category);

    try {
      {
        await flushFirstAnchorFlowDraft();
        authContext.assertCurrent();
        const identity = await AuthService.ensureGuestSession();
        authContext.assertIdentity(identity.user.id, identity.isAnonymous);
        const requestConfig: AccountBoundRequestConfig = {
          anchorAuthToken: identity.token,
          anchorAuthGuard: () => authContext.isCurrent() && useAuthStore.getState().user?.id === authUser?.id
            && useAuthStore.getState().isAuthenticated === isAuthenticated,
        };
        // Persist anchor to backend — this is the source of truth.
        // idempotencyKey lets a retried request return the anchor that was
        // already created rather than creating a duplicate, so a single
        // network-only retry (no response received either way) is safe here.
        const anchorPayload = {
          intentionText,
          category,
          distilledLetters,
          baseSigilSvg,
          structureVariant: structureVariant || 'balanced',
          reinforcedSigilSvg: reinforcedSigilSvg || undefined,
          reinforcementMetadata: reinforcementMetadata || undefined,
          enhancedImageUrl: enhancedImageUrl || undefined,
          enhancementMetadata: enhancementMetadata || undefined,
          ...creationSelection(enhancementMetadata, !enhancedImageUrl),
          planetaryTier: tier,
          classifierVersion: 2,
          classifierMeta: { confidenceScore, isCustomFallback },
          idempotencyKey,
        };

        let response: ApiResponse<Anchor> | undefined;
        try {
          response = await post<ApiResponse<Anchor>>('/api/anchors', anchorPayload, requestConfig);
          authContext.assertCurrent();
        } catch (firstAttemptErr) {
          const isNetworkError =
            !(firstAttemptErr instanceof ApiClientError) &&
            firstAttemptErr instanceof Error &&
            firstAttemptErr.message === 'Network error. Please check your connection.';
          if (!isNetworkError) {
            throw firstAttemptErr;
          }
          await new Promise((resolve) => setTimeout(resolve, 500));
          authContext.assertCurrent();
          response = await post<ApiResponse<Anchor>>('/api/anchors', anchorPayload, requestConfig);
          authContext.assertCurrent();
        }

        if (response?.success && response?.data?.id) {
          confirmedAnchor = response.data;
          anchorId = response.data.id;
          resolved.enhancedImageUrl = response.data.enhancedImageUrl ?? resolved.enhancedImageUrl;
          resolved.enhancementMetadata = response.data.enhancementMetadata ?? resolved.enhancementMetadata;
          logger.info('[AnchorReveal] Anchor saved to backend', { anchorId });
        } else {
          throw new Error('The server did not confirm your saved Anchor. Please retry.');
        }
        if (isGuestFirstAnchor) {
          clearPendingFirstAnchorState();
          setPendingFirstAnchorDraft({
            tempAnchorId: anchorId, backendAnchorId: anchorId,
            source: 'onboarding_first_anchor', requiresAccountGate: false, createdAt: new Date(),
          });
        }
      }
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'ANCHOR_CREATION_QUOTA_EXCEEDED') {
        Alert.alert('Creation limit reached', 'You have reached your current creation allowance. Your Anchor is still here.');
        creationInFlightRef.current = false;
        setIsSaving(false);
        return { status: 'blocked' };
      }
      const serverLimitReason =
        err instanceof ApiClientError && err.code === 'PRO_DAILY_ANCHOR_CAP_REACHED'
          ? 'pro_daily_anchor_cap_reached'
          : err instanceof ApiClientError && err.code === 'CREATE_ANCHOR_FREE_LOCKED'
            ? 'create_anchor_free_locked'
            : null;

      if (serverLimitReason) {
        AnalyticsService.track(serverLimitReason, {
          source: 'anchor_reveal_server',
          tier: entitlements.tier,
        });

        if (serverLimitReason === 'pro_daily_anchor_cap_reached') {
          const copy = getAnchorCreationLimitCopy(serverLimitReason);
          Alert.alert(copy?.title ?? 'Daily creation limit reached', copy?.body, [
            { text: copy?.cta ?? 'Return to Sanctuary', onPress: () => navigation.goBack() },
          ]);
        } else {
          navigation.navigate('Paywall', {
            source: serverLimitReason,
            preferredPlanId: 'annual',
          });
        }
        creationInFlightRef.current = false;
        setIsSaving(false);
        return { status: 'blocked' };
      }

      logger.warn('[AnchorReveal] Failed to save anchor to backend', err);
      FrictionAnalytics.flowError('anchor_creation', 'anchor_reveal', 'backend_save_failed', {
        is_first_anchor: isGuestFirstAnchor,
        category,
        has_enhanced_image: Boolean(enhancedImageUrl),
        error_code: err instanceof ApiClientError ? err.code : undefined,
        error_status: err instanceof ApiClientError ? err.status : undefined,
        error_message: err instanceof Error ? err.message : undefined,
        idempotency_key: idempotencyKey,
      });
      ErrorTrackingService.captureException(err, {
        screen: 'AnchorRevealScreen',
        action: 'save_anchor_to_backend',
      });
      Alert.alert('Your Anchor has not finished saving', 'Your creation is still here. Check your connection and try again.');
      creationInFlightRef.current = false;
      setIsSaving(false);
      return { status: 'blocked' };
    }

    if (!authContext.isCurrent()) {
      creationInFlightRef.current = false;
      setIsSaving(false);
      return { status: 'blocked' };
    }
    const createdAnchor: Anchor = {
      id: anchorId,
      intentionText,
      category,
      distilledLetters,
      baseSigilSvg,
      reinforcedSigilSvg,
      structureVariant,
      reinforcementMetadata,
      enhancementMetadata,
      enhancedImageUrl: enhancedImageUrl || undefined,
      planetaryTier: tier,
      classifierVersion: 2,
      classifierMeta: { confidenceScore, isCustomFallback },
      isCharged: false,
      activationCount: 0,
      ...(confirmedAnchor as Partial<Anchor> | undefined),
      // The backend owns verified guest attribution. The device's signed-out
      // vault deliberately uses its existing guest partition until account linking.
      userId: isAuthenticated ? confirmedAnchor?.userId ?? authUser?.id ?? 'guest' : 'guest',
      createdAt: confirmedAnchor?.createdAt ? new Date(confirmedAnchor.createdAt) : new Date(),
      updatedAt: confirmedAnchor?.updatedAt ? new Date(confirmedAnchor.updatedAt) : new Date(),
    };
    addAnchor(createdAnchor);
    setCurrentAnchor?.(anchorId);
    incrementAnchorCount();
    AnalyticsService.track(AnalyticsEvents.ANCHOR_CREATION_COMPLETED, {
      anchor_id: anchorId,
      source: isGuestFirstAnchor ? 'onboarding_first_anchor' : 'anchor_reveal',
      category,
      is_first_anchor: isGuestFirstAnchor,
      has_enhanced_image: Boolean(enhancedImageUrl),
      structure_variant: structureVariant || 'balanced',
      backend_synced: isBackendAnchorId(anchorId),
    });
    if (isFirstAnchor) {
      AnalyticsService.trackFirstAnchorCreatedOnce?.({
        anchor_id: anchorId,
        category,
        is_guest: isGuestFirstAnchor,
        backend_synced: isBackendAnchorId(anchorId),
        has_enhanced_image: Boolean(enhancedImageUrl),
        structure_variant: structureVariant || 'balanced',
      });
    }
    FrictionAnalytics.stepCompleted('anchor_creation', 'anchor_reveal', {
      is_first_anchor: isGuestFirstAnchor,
      category,
      has_enhanced_image: Boolean(enhancedImageUrl),
    });
    FrictionAnalytics.completeFlow('anchor_creation', {
      is_first_anchor: isGuestFirstAnchor,
      category,
      next_step: isGuestFirstAnchor ? 'save_progress' : isFirstAnchor ? 'prime_your_anchor' : 'creation_complete',
    });
    void handleAnchorSaved();

    // Clear heavy temporary data once the anchor record is created.
    setTempEnhancedImage(null);

    // First-anchor moment: offer a calm daily-reminder card before moving on.
    // We surface it once unless this device has already denied permission.
    // First creation now moves directly to the Save Progress / Prime
    // continuation. The optional reminder remains a returning-user affordance.
    const shouldShowReminder =
      !isFirstAnchor && await canOfferFirstAnchorReminder();

    const proceed = () => {
      if (shouldShowReminder) {
        pendingNavRef.current = { anchorId, isGuestFirstAnchor, resolved };
        setReminderCardVisible(true);
        return;
      }

      useFirstAnchorFlowStore.getState().clearDraft();
      // `resolved` still carries the chosen image: the temp store was cleared above.
      navigateAfterSave(anchorId, isGuestFirstAnchor, isFirstAnchor, resolved);
    };

    return { status: 'saved', anchorId, isGuestFirstAnchor, isFirstAnchor, proceed };
  };

  return {
    isSaving,
    reminderCardVisible,
    saveAnchor,
    handleReminderDismiss,
  };
}
