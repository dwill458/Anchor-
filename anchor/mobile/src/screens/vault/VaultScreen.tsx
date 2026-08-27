/**
 * Anchor App — VaultScreen (Sanctuary Redesign)
 *
 * Two states:
 *   Empty  — no anchors; invite the first forge
 *   Active — at least one anchor; surface the primary sigil as a hero card
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  InteractionManager,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  Line,
  Path,
  RadialGradient,
  Stop,
  SvgXml,
} from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Animated2, { FadeInUp } from 'react-native-reanimated';
import {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useAnchorStore } from '../../stores/anchorStore';
import { useAuthStore } from '../../stores/authStore';
import { useProfileStore } from '@/stores/profileStore';
import { useToast } from '../../components/ToastProvider';
import { AnchorGridSkeleton } from '../../components/skeletons/AnchorCardSkeleton';
// DEFERRED: freemium — useSubscription removed; freemium tier gates replaced with trial model
// import { useSubscription } from '../../hooks/useSubscription';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { AnalyticsService, AnalyticsEvents } from '../../services/AnalyticsService';
import { FrictionAnalytics } from '@/services/FrictionAnalytics';
import { ErrorTrackingService } from '../../services/ErrorTrackingService';
import { PerformanceMonitoring } from '../../services/PerformanceMonitoring';
import { apiClient } from '@/services/ApiClient';
import { normalizeAnchor } from '@/services/AuthHydrationService';
import { isBackendAnchorId } from '@/services/BackendAnchorService';
import { SanctuaryHeader } from './components/SanctuaryHeader';
import { AtmosphericOrbs } from './components/AtmosphericOrbs';
import { HeroAnchorCard } from './components/HeroAnchorCard';
import { AnchorStack } from './components/AnchorStack';
import { ZenBackground } from '@/components/common';
import { buildProfileGreeting } from '@/utils/profileGreeting';
import type { Anchor, ApiResponse, RootStackParamList } from '@/types';
import { colors, typography } from '@/theme';
import { MicroTeachCard, MicroTeachInfoChip } from '@/components/teaching';
import { useTeachingGate } from '@/utils/useTeachingGate';
import type { TeachingContent } from '@/constants/teaching';
import { withAlpha } from '@/utils/color';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { useAppPerformanceTier, type PerformanceTier } from '@/hooks/useAppPerformanceTier';
import { useSettingsStore } from '@/stores/settingsStore';
import { useWeeklySummaryTrigger } from '@/hooks/useWeeklySummaryTrigger';
import { VaultGridModal } from './components/VaultGridModal';
import { hasIgnited, isAnchorReleased } from './utils/anchorStateHelpers';
import { useEntitlements } from '@/hooks/useEntitlements';
import { getAnchorCreationLimitCopy } from '@/utils/entitlements';
import { usePracticeEntry } from '@/hooks/usePracticeEntry';

// ─── Constants ────────────────────────────────────────────────────────────────

const H_PAD = 28;

// DEFERRED: Ghost sigils used in legacy concentric ritual circle removed in empty-state redesign
// const GHOST_SIGIL_1 = `<svg viewBox="0 0 55 55" fill="none" stroke="#D4AF37" stroke-width="1" xmlns="http://www.w3.org/2000/svg">
//   <line x1="27" y1="4" x2="27" y2="51"/>
//   <line x1="4" y1="27" x2="51" y2="27"/>
//   <line x1="10" y1="10" x2="44" y2="44"/>
//   <circle cx="27" cy="27" r="18" opacity=".5"/>
// </svg>`;
//
// const GHOST_SIGIL_2 = `<svg viewBox="0 0 45 45" fill="none" stroke="#D4AF37" stroke-width="1" xmlns="http://www.w3.org/2000/svg">
//   <line x1="22" y1="4" x2="22" y2="41"/>
//   <line x1="4" y1="22" x2="41" y2="22"/>
//   <circle cx="22" cy="22" r="14" opacity=".5"/>
//   <circle cx="22" cy="22" r="5" opacity=".7"/>
// </svg>`;

// ─── GuestReturnBanner ───────────────────────────────────────────────────────

interface GuestReturnBannerProps {
  onPractice: () => void;
  onDismiss: () => void;
}

function GuestReturnBanner({ onPractice, onDismiss }: GuestReturnBannerProps) {
  return (
    <View style={bannerStyles.container}>
      <View style={bannerStyles.textWrap}>
        <Text style={bannerStyles.title}>Your anchor is here.</Text>
        <Text style={bannerStyles.sub}>Ready to practice?</Text>
      </View>
      <TouchableOpacity onPress={onPractice} style={bannerStyles.cta} activeOpacity={0.8}>
        <Text style={bannerStyles.ctaText}>Begin</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDismiss} style={bannerStyles.dismiss} activeOpacity={0.6} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={bannerStyles.dismissText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: H_PAD,
    marginBottom: 16,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 10,
    backgroundColor: withAlpha(colors.gold, 0.08),
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.25),
    borderRadius: 10,
    gap: 10,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: 14,
    color: colors.bone,
    letterSpacing: 0.2,
  },
  sub: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 13,
    fontWeight: '300',
    color: withAlpha(colors.bone, 0.6),
  },
  cta: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.5),
  },
  ctaText: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.gold,
  },
  dismiss: {
    padding: 4,
  },
  dismissText: {
    fontSize: 12,
    color: withAlpha(colors.bone, 0.35),
  },
});

// ─── selectPrimaryAnchor ──────────────────────────────────────────────────────

/**
 * Priority:
 *  1. Most recently activated today
 *  2. Most recently charged (not yet activated today)
 *  3. Most recently created
 */
export function selectPrimaryAnchor(anchors: Anchor[]): Anchor | null {
  if (anchors.length === 0) return null;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const toMs = (d: Date | string | undefined): number =>
    d ? new Date(d).getTime() : 0;

  // 1 — activated today
  const activatedToday = anchors
    .filter((a) => a.lastActivatedAt && new Date(a.lastActivatedAt) >= todayStart)
    .sort((a, b) => toMs(b.lastActivatedAt) - toMs(a.lastActivatedAt));
  if (activatedToday.length > 0) return activatedToday[0];

  // 2 — charged
  const charged = anchors
    .filter((a) => a.isCharged)
    .sort((a, b) => toMs(b.chargedAt ?? b.updatedAt) - toMs(a.chargedAt ?? a.updatedAt));
  if (charged.length > 0) return charged[0];

  // 3 — most recently created
  return [...anchors].sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))[0];
}

// ─── Animation helpers ────────────────────────────────────────────────────────

type VaultScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Vault'>;

const getFadeUp = (delay: number, disabled: boolean) => {
  // Android can leave Reanimated entering views at their initial opacity
  // after the tab container remounts the Home screen. Render the content
  // immediately there; iOS keeps the intended entrance animation.
  if (disabled || Platform.OS === 'android') return undefined;
  return FadeInUp.duration(600)
    .delay(delay)
    .withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] });
};

// ─── VaultScreen ──────────────────────────────────────────────────────────────

export const VaultScreen: React.FC = () => {
  const navigation = useNavigation<VaultScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  // Matches CustomTabBar's own layout math (MainTabNavigator.tsx): a 64pt-tall
  // floating capsule positioned at Math.max(46, insets.bottom + 12) from the
  // bottom. Scroll content needs at least that much clearance plus a margin so
  // the anchor row isn't hidden behind it on devices with tall gesture insets.
  const tabBarClearance = 64 + Math.max(46, insets.bottom + 12) + 32;
  const { registerTabNav, activeTabIndex, navigateToPractice, navigateToVault } = useTabNavigation();
  const { startPractice } = usePracticeEntry();
  const isVaultTabActive = activeTabIndex == null ? true : activeTabIndex === 0;

  const { user, isAuthenticated } = useAuthStore();
  const vaultTeaching = useTeachingGate({
    screenId: 'vault',
    candidateIds: ['vault_intro_first_time_v1'],
  });
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const profileName = useProfileStore((state) => state.name);
  const profileTimezone = useProfileStore((state) => state.timezone);
  const developerForceStreakBreakEnabled = useSettingsStore(
    (state) => state.developerForceStreakBreakEnabled
  );
  const focusSessionMode = useSettingsStore((state) => state.focusSessionMode ?? 'quick');
  const primeSessionDuration = useSettingsStore((state) => state.primeSessionDuration ?? 120);
  const shouldRedirectToCreation = useAuthStore((s) => s.shouldRedirectToCreation);
  const setShouldRedirectToCreation = useAuthStore((s) => s.setShouldRedirectToCreation);
  const pendingFirstAnchorDraft = useAuthStore((s) => s.pendingFirstAnchorDraft);

  // Account-gate backstop: a guest who forged their first anchor can never land
  // on the Vault without an account, regardless of which screen routed here.
  const mustGateFirstAnchor = !isAuthenticated && Boolean(pendingFirstAnchorDraft);

  const anchors = useAnchorStore((s) => s.anchors);
  const entitlements = useEntitlements();
  const currentAnchorId = useAnchorStore((s) => s.currentAnchorId);
  const setCurrentAnchor = useAnchorStore((s) => s.setCurrentAnchor);
  const isLoading = useAnchorStore((s) => s.isLoading);
  const setLoading = useAnchorStore((s) => s.setLoading);
  const setError = useAnchorStore((s) => s.setError);
  const setAnchors = useAnchorStore((s) => s.setAnchors);

  const reduceMotionEnabled = useReduceMotionEnabled();
  // Use the same device classification as the rest of the visual system. This
  // explicitly recognizes recent Galaxy flagships (including the S24 Ultra),
  // instead of relying solely on display resolution.
  const performanceTier = useAppPerformanceTier();
  const shouldReduceMotion = reduceMotionEnabled || !isVaultTabActive;
  const toast = useToast();
  const { shouldShow, dismiss } = useWeeklySummaryTrigger();

  useEffect(() => {
    if (shouldShow) {
      dismiss();
      navigation.navigate('WeeklyReview');
    }
  }, [shouldShow, dismiss, navigation]);

  const developerSaveProgressPreviewToken = useSettingsStore(
    (state) => state.developerSaveProgressPreviewToken
  );
  const clearDeveloperSaveProgressPreview = useSettingsStore(
    (state) => state.clearDeveloperSaveProgressPreview
  );

  const [now, setNow] = useState(() => new Date());
  const [gridVisible, setGridVisible] = useState(false);
  const [nextAnchorCursor, setNextAnchorCursor] = useState<string | null>(null);
  const [isLoadingMoreAnchors, setIsLoadingMoreAnchors] = useState(false);
  const isLoadingMoreAnchorsRef = React.useRef(false);

  // ── Derived state ────────────────────────────────────────────────────────────
  const sanctuaryAnchors = useMemo(
    () => anchors.filter((anchor) => !isAnchorReleased(anchor)),
    [anchors]
  );

  const autoPrimary = useMemo(() => selectPrimaryAnchor(sanctuaryAnchors), [sanctuaryAnchors]);

  // Use the shared store's currentAnchorId so Practice tab stays in sync
  const primaryAnchor = useMemo(() => {
    if (currentAnchorId) {
      const found = sanctuaryAnchors.find((a) => a.id === currentAnchorId);
      if (found) return found;
    }
    return autoPrimary;
  }, [currentAnchorId, sanctuaryAnchors, autoPrimary]);

  useEffect(() => {
    if (!developerSaveProgressPreviewToken) return;
    clearDeveloperSaveProgressPreview();
    const previewAnchor = primaryAnchor ?? anchors[0];
    if (!previewAnchor) {
      Alert.alert('No Anchor Available', 'Create an anchor first, then preview Save Progress here.');
      return;
    }
    navigateToVault('SaveProgress', { anchor: previewAnchor, previewMode: true });
  }, [
    developerSaveProgressPreviewToken,
    clearDeveloperSaveProgressPreview,
    primaryAnchor,
    anchors,
    navigateToVault,
  ]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => clearInterval(timer);
  }, []);

  const greeting = useMemo(
    () =>
      buildProfileGreeting(
        profileName || user?.displayName,
        profileTimezone,
        now
      ),
    [now, profileName, profileTimezone, user?.displayName]
  );


  // ── Empty-state orbit animation ───────────────────────────────────────────────
  const orbitRotation = useSharedValue(0);
  const pulseDotOpacity = useSharedValue(1);

  useEffect(() => {
    registerTabNav(0, navigation);
    return () => registerTabNav(0, null);
  }, [navigation, registerTabNav]);

  useEffect(() => {
    if (shouldReduceMotion) {
      cancelAnimation(orbitRotation);
      cancelAnimation(pulseDotOpacity);
      return;
    }
    orbitRotation.value = withRepeat(
      withTiming(360, { duration: 30000, easing: Easing.linear }),
      -1,
      false,
    );
    pulseDotOpacity.value = withRepeat(
      withTiming(0.4, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(orbitRotation);
      cancelAnimation(pulseDotOpacity);
    };
  }, [shouldReduceMotion, orbitRotation, pulseDotOpacity]);

  const orbitRingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${orbitRotation.value}deg` }],
  }));

  const pulseDotStyle = useAnimatedStyle(() => ({
    opacity: pulseDotOpacity.value,
  }));

  // ── Account gate backstop ────────────────────────────────────────────────────
  useEffect(() => {
    if (mustGateFirstAnchor && pendingFirstAnchorDraft) {
      const anchor = anchors.find((item) => item.id === pendingFirstAnchorDraft.tempAnchorId);
      if (anchor) {
        navigation.replace('SaveProgress', { anchor });
      }
    }
  }, [anchors, mustGateFirstAnchor, pendingFirstAnchorDraft, navigation]);

  // ── Redirect to creation ─────────────────────────────────────────────────────
  useEffect(() => {
    if (shouldRedirectToCreation) {
      setShouldRedirectToCreation(false);
      navigation.replace('FirstAnchorCreation');
    }
  }, [
    shouldRedirectToCreation,
    setShouldRedirectToCreation,
    navigation,
  ]);

  // ── Analytics tracking — fires once per user session, not on every anchor update ──
  const anchorsLengthRef = React.useRef(anchors.length);
  anchorsLengthRef.current = anchors.length;
  useEffect(() => {
    if (!user) return;
    AnalyticsService.track(AnalyticsEvents.VAULT_VIEWED, { anchor_count: anchorsLengthRef.current });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Data fetching ─────────────────────────────────────────────────────────────
  const fetchAnchors = useCallback(async (): Promise<void> => {
    if (!user) return;
    const trace = PerformanceMonitoring.startTrace('fetch_anchors');
    setLoading(true);
    setError(null);
    try {
      // Self-healing load: the Vault fetches the full anchor collection directly
      // so it never depends solely on launch-time hydration. Without this, a
      // failed/empty hydration leaves the Vault permanently empty with no recovery.
      const response = await apiClient.get<ApiResponse<Anchor[]>>('/api/anchors', {
        params: {
          limit: 500,
          orderBy: 'updatedAt',
          order: 'desc',
        },
      });
      const fetched = Array.isArray(response.data?.data)
        ? response.data.data.map(normalizeAnchor)
        : [];
      // Preserve unsynced local-only anchors (temp ids) created before sync.
      const preservedLocal = useAnchorStore
        .getState()
        .anchors.filter((a) => !isBackendAnchorId(a.id));
      setAnchors([...fetched, ...preservedLocal]);
      setNextAnchorCursor(response.data?.meta?.nextCursor ?? null);
      trace.putAttribute('anchor_count', String(fetched.length));
    } catch (error) {
      const msg = (error as Error).message;
      setError(msg);
      toast.error("Could not load your anchors. Check your connection and try again.");
      ErrorTrackingService.captureException(error as Error, {
        screen: 'VaultScreen',
        action: 'fetch_anchors',
        user_id: user.id,
      });
    } finally {
      setLoading(false);
      trace.stop();
    }
  }, [user, setLoading, setError, setAnchors, toast]);

  const loadMoreAnchors = useCallback(async (): Promise<void> => {
    if (!user || !nextAnchorCursor || isLoadingMoreAnchorsRef.current) return;

    isLoadingMoreAnchorsRef.current = true;
    setIsLoadingMoreAnchors(true);
    try {
      const response = await apiClient.get<ApiResponse<Anchor[]>>('/api/anchors', {
        params: {
          limit: 100,
          cursor: nextAnchorCursor,
          orderBy: 'updatedAt',
          order: 'desc',
        },
      });
      const fetched = Array.isArray(response.data?.data)
        ? response.data.data.map(normalizeAnchor)
        : [];

      // Fetch only the page the user reaches, then merge it into the existing store.
      setAnchors([...useAnchorStore.getState().anchors, ...fetched]);
      setNextAnchorCursor(response.data?.meta?.nextCursor ?? null);
    } catch (error) {
      ErrorTrackingService.captureException(error as Error, {
        screen: 'VaultScreen',
        action: 'load_more_anchors',
        user_id: user.id,
      });
    } finally {
      isLoadingMoreAnchorsRef.current = false;
      setIsLoadingMoreAnchors(false);
    }
  }, [nextAnchorCursor, setAnchors, user]);

  // Fire once on mount and whenever the authenticated user changes.
  // Do NOT depend on `fetchAnchors` directly — its reference changes every
  // render when `toast` (from useToast) is unstable, which would cause an
  // infinite fetch loop and trigger rate-limiting.
  useEffect(() => {
    if (user?.id) void fetchAnchors();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigation handlers ───────────────────────────────────────────────────────
  const handleCreateAnchor = useCallback((): void => {
    // Guests may forge their first anchor before any entitlement exists,
    // mirroring the bypass in IntentionInputScreen.
    const isGuestFirstAnchor = !isAuthenticated && anchors.length === 0;
    if (!isGuestFirstAnchor && !entitlements.canCreateAnchor) {
      const reason = entitlements.anchorCreationLimitReason;
      if (!reason) return;

      AnalyticsService.track(reason, {
        source: 'vault',
        anchor_count: anchors.length,
        anchors_created_today: entitlements.anchorsCreatedToday,
        anchors_created_during_trial: entitlements.anchorsCreatedDuringTrial,
        tier: entitlements.tier,
      });

      if (reason === 'pro_daily_anchor_cap_reached') {
        const copy = getAnchorCreationLimitCopy(reason);
        Alert.alert(copy?.title ?? 'Daily creation limit reached', copy?.body, [
          { text: copy?.cta ?? 'Return to Sanctuary' },
        ]);
        return;
      }

      navigation.navigate('Paywall', {
        source: reason,
        preferredPlanId: 'annual',
      });
      return;
    }

    AnalyticsService.track(AnalyticsEvents.ANCHOR_CREATION_STARTED, {
      source: 'vault',
      has_existing_anchors: anchors.length > 0,
    });
    FrictionAnalytics.startFlow('anchor_creation', {
      source: 'vault',
      anchor_count: anchors.length,
      is_first_anchor: anchors.length === 0,
    });
    FrictionAnalytics.stepCompleted('anchor_creation', 'create_cta', {
      source: 'vault',
      anchor_count: anchors.length,
      is_first_anchor: anchors.length === 0,
    });
    // The Sanctuary create CTA should always open the redesigned intention
    // screen. Keep the legacy returning-user route available to other flows
    // that still depend on it.
    navigation.push('FirstAnchorCreation');
  }, [anchors.length, entitlements, isAuthenticated, navigation]);

  const handleAnchorPress = useCallback(
    (anchorId: string): void => {
      // Swap the tapped anchor into the hero position (syncs with Practice tab)
      setCurrentAnchor(anchorId);
    },
    [setCurrentAnchor],
  );

  const handleHeroPress = useCallback((): void => {
    if (!primaryAnchor) return;
    navigation.navigate('AnchorDetail', { anchorId: primaryAnchor.id });
  }, [primaryAnchor, navigation]);

  const handleActivate = useCallback((): void => {
    if (!primaryAnchor) return;
    setCurrentAnchor(primaryAnchor.id);
    // The selected anchor is already in the shared store. Let PracticeStack
    // keep its existing PracticeHome root instead of updating route params
    // during the tab mount, which causes a second PracticeHome load.
    navigateToPractice();
  }, [navigateToPractice, primaryAnchor, setCurrentAnchor]);

  // ── Render ────────────────────────────────────────────────────────────────────

  // Hold a bare background while the account-gate redirect fires — never expose
  // the Vault contents to an un-accounted guest.
  if (mustGateFirstAnchor) {
    return (
      <View style={styles.container}>
        <ZenBackground variant="sanctuary" showGrain showVignette />
      </View>
    );
  }

  if (isLoading && anchors.length === 0) {
    return (
      <View style={styles.container}>
        <ZenBackground variant="sanctuary" showOrbs={isVaultTabActive} showGrain showVignette />
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <AnchorGridSkeleton count={6} />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ZenBackground variant="sanctuary" showOrbs={isVaultTabActive} showGrain showVignette />
      {performanceTier === 'high' && (
        <AtmosphericOrbs reduceMotionEnabled={shouldReduceMotion} />
      )}

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scrollArea}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarClearance }]}
        >
          {/* ── Header ── */}
          <Animated2.View entering={getFadeUp(100, shouldReduceMotion)}>
            <SanctuaryHeader
              reduceMotionEnabled={shouldReduceMotion}
              greeting={greeting}
              onCreateAnchor={handleCreateAnchor}
            />
          </Animated2.View>

          {!isAuthenticated && sanctuaryAnchors.length > 0 && !bannerDismissed && (
            <GuestReturnBanner
              onPractice={handleActivate}
              onDismiss={() => setBannerDismissed(true)}
            />
          )}

          {sanctuaryAnchors.length === 0
            ? renderEmptyState({
                handleCreateAnchor,
                shouldReduceMotion,
                pulseDotStyle,
                orbitRingStyle,
              })
            : renderActiveState({
                anchors: sanctuaryAnchors,
                primaryAnchor: primaryAnchor!,
                shouldReduceMotion,
                performanceTier,
                pulseDotStyle,
                handleHeroPress,
                handleActivate,
                handleAnchorPress,
                handleCreateAnchor,
                onViewAll: () => setGridVisible(true),
                isDeepPrimeMode: focusSessionMode === 'deep',
                vaultTeaching,
              })}
        </ScrollView>
      </SafeAreaView>
      <VaultGridModal
        visible={gridVisible}
        onDismiss={() => setGridVisible(false)}
        anchors={sanctuaryAnchors}
        onAnchorPress={handleAnchorPress}
        onLoadMore={loadMoreAnchors}
        hasMore={nextAnchorCursor != null}
        isLoadingMore={isLoadingMoreAnchors}
      />
    </View>
  );
};

// ─── Empty state ──────────────────────────────────────────────────────────────

interface EmptyStateProps {
  handleCreateAnchor: () => void;
  shouldReduceMotion: boolean;
  pulseDotStyle: ReturnType<typeof useAnimatedStyle>;
  orbitRingStyle?: ReturnType<typeof useAnimatedStyle>;
}

export function VaultEmptyStateContent({
  handleCreateAnchor,
  shouldReduceMotion,
  pulseDotStyle,
}: EmptyStateProps) {
  return (
    <View style={styles.emptyStateFill} testID="vault-empty-state-fill">
      {/* ── Single-ring blueprint glyph frame ── */}
      <Animated2.View
        entering={getFadeUp(150, shouldReduceMotion)}
        style={styles.blueprintWrap}
      >
        <Svg width={CIRCLE} height={CIRCLE} viewBox="0 0 200 200">
          <Defs>
            <RadialGradient id="blueprint-bg" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#1E2A33" stopOpacity={0.4} />
              <Stop offset="80%" stopColor="#0F1419" stopOpacity={0.7} />
              <Stop offset="100%" stopColor="#080B0F" stopOpacity={0.9} />
            </RadialGradient>
          </Defs>

          {/* Single circular frame matching medallion ring */}
          <Circle
            cx="100"
            cy="100"
            r="98"
            fill="url(#blueprint-bg)"
            stroke={withAlpha(colors.anchor15.gilt, 0.35)}
            strokeWidth="1"
          />

          {/* Low-opacity straight grid lines (silver at ~15%) */}
          <Line x1="40" y1="20" x2="40" y2="180" stroke={withAlpha(colors.silver, 0.15)} strokeWidth="1" />
          <Line x1="70" y1="10" x2="70" y2="190" stroke={withAlpha(colors.silver, 0.15)} strokeWidth="1" />
          <Line x1="100" y1="5" x2="100" y2="195" stroke={withAlpha(colors.silver, 0.15)} strokeWidth="1" />
          <Line x1="130" y1="10" x2="130" y2="190" stroke={withAlpha(colors.silver, 0.15)} strokeWidth="1" />
          <Line x1="160" y1="20" x2="160" y2="180" stroke={withAlpha(colors.silver, 0.15)} strokeWidth="1" />

          <Line x1="20" y1="40" x2="180" y2="40" stroke={withAlpha(colors.silver, 0.15)} strokeWidth="1" />
          <Line x1="10" y1="70" x2="190" y2="70" stroke={withAlpha(colors.silver, 0.15)} strokeWidth="1" />
          <Line x1="5" y1="100" x2="195" y2="100" stroke={withAlpha(colors.silver, 0.15)} strokeWidth="1" />
          <Line x1="10" y1="130" x2="190" y2="130" stroke={withAlpha(colors.silver, 0.15)} strokeWidth="1" />
          <Line x1="20" y1="160" x2="180" y2="160" stroke={withAlpha(colors.silver, 0.15)} strokeWidth="1" />

          {/* Dashed unfinished glyph linework in gold at ~55% */}
          <Line
            x1="100"
            y1="35"
            x2="100"
            y2="165"
            stroke={withAlpha(colors.anchor15.gilt, 0.55)}
            strokeWidth="1.6"
            strokeDasharray="5 4"
            strokeLinecap="round"
          />
          <Path
            d="M100 45 L145 100 L100 155 L55 100 Z"
            stroke={withAlpha(colors.anchor15.gilt, 0.55)}
            strokeWidth="1.5"
            strokeDasharray="6 5"
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="M70 70 L100 100 L130 70"
            stroke={withAlpha(colors.anchor15.gilt, 0.45)}
            strokeWidth="1.2"
            strokeDasharray="4 4"
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="M70 130 L100 100 L130 130"
            stroke={withAlpha(colors.anchor15.gilt, 0.45)}
            strokeWidth="1.2"
            strokeDasharray="4 4"
            fill="none"
            strokeLinecap="round"
          />
          <Circle
            cx="100"
            cy="100"
            r="45"
            stroke={withAlpha(colors.anchor15.gilt, 0.35)}
            strokeWidth="1"
            strokeDasharray="4 6"
            fill="none"
          />
        </Svg>

        {/* Small pulsing gold dot */}
        <Animated2.View style={[styles.blueprintPulseDot, pulseDotStyle]} pointerEvents="none" />

        {/*
        // DEFERRED: ring tap-to-forge removed — single CTA below now owns this action
        // <TouchableOpacity
        //   style={styles.rcCenter}
        //   onPress={handleCreateAnchor}
        //   activeOpacity={0.75}
        //   accessibilityRole="button"
        //   accessibilityLabel="Forge your first anchor"
        // >
        //   <Text style={styles.rcPlus}>+</Text>
        //   <Text style={styles.rcLabel}>FORGE</Text>
        // </TouchableOpacity>
        */}
      </Animated2.View>

      {/* ── Copy and ghost CTA ── */}
      <Animated2.View entering={getFadeUp(250, shouldReduceMotion)} style={styles.emptyCopyWrap}>
        <Text style={styles.emptyEyebrow}>AWAITING FORGE</Text>
        <Text style={styles.emptyHeadline}>One intention. Forged.</Text>
        <Text style={styles.emptySubhead}>
          Write it once. Anchor compresses it into a symbol you will return to daily.
        </Text>

        <TouchableOpacity
          style={styles.activateBtn}
          onPress={handleCreateAnchor}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Forge your first anchor"
        >
          <Text style={styles.activateBtnText}>FORGE YOUR FIRST ANCHOR →</Text>
        </TouchableOpacity>
      </Animated2.View>
    </View>
  );
}

function renderEmptyState(props: EmptyStateProps) {
  return <VaultEmptyStateContent {...props} />;
}

// ─── Active state ─────────────────────────────────────────────────────────────

interface ActiveStateProps {
  anchors: Anchor[];
  primaryAnchor: Anchor;
  shouldReduceMotion: boolean;
  performanceTier: PerformanceTier;
  pulseDotStyle: ReturnType<typeof useAnimatedStyle>;
  handleHeroPress: () => void;
  handleActivate: () => void;
  handleAnchorPress: (id: string) => void;
  handleCreateAnchor: () => void;
  onViewAll: () => void;
  isDeepPrimeMode: boolean;
  vaultTeaching: TeachingContent | null;
}

function renderActiveState({
  anchors,
  primaryAnchor,
  shouldReduceMotion,
  performanceTier,
  pulseDotStyle,
  handleHeroPress,
  handleActivate,
  handleAnchorPress,
  handleCreateAnchor,
  onViewAll,
  isDeepPrimeMode,
  vaultTeaching,
}: ActiveStateProps) {
  const isCharged = primaryAnchor.isCharged;

  return (
    <>
      {/* ── Hero card ── */}
      <Animated2.View
        entering={getFadeUp(250, shouldReduceMotion)}
        style={styles.heroWrap}
      >
        <HeroAnchorCard
          anchor={primaryAnchor}
          onPress={handleHeroPress}
          reduceMotionEnabled={shouldReduceMotion}
          performanceTier={performanceTier}
        />
      </Animated2.View>

      {/* ── Activate / Charge button ── */}
      <Animated2.View
        entering={getFadeUp(500, shouldReduceMotion)}
        style={styles.activateBtnWrap}
      >
        <TouchableOpacity
          style={styles.activateBtn}
          onPress={handleActivate}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Practice this anchor"
        >
          <Text style={styles.activateBtnText}>
            PRACTICE THIS ANCHOR →
          </Text>
        </TouchableOpacity>
      </Animated2.View>

      <View style={styles.sectionDivider} />

      {/* ── Anchor stack — shows ALL anchors, current one highlighted ── */}
      <Animated2.View
        entering={getFadeUp(600, shouldReduceMotion)}
        style={styles.stackWrap}
      >
        <AnchorStack
          anchors={anchors}
          primaryAnchorId={primaryAnchor.id}
          onAnchorPress={handleAnchorPress}
          onAddPress={handleCreateAnchor}
          onViewAll={onViewAll}
        />
      </Animated2.View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CIRCLE = 220;
const RING_BORDER = 'rgba(212,175,55,0.10)';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.anchor15.navy,
  },
  safeArea: {
    flex: 1,
  },
  scrollArea: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingTop: 4,
    flexGrow: 1,
    paddingBottom: 32,
  },

  // ── Empty state ───────────────────────────────────────────────────────────────
  emptyStateFill: {
    flex: 1,
  },
  blueprintWrap: {
    marginTop: 12,
    alignSelf: 'center',
    width: CIRCLE,
    height: CIRCLE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  blueprintPulseDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.anchor15.giltBright,
    shadowColor: colors.anchor15.giltBright,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 6,
    elevation: 4,
  },
  emptyCopyWrap: {
    marginTop: 20,
    marginHorizontal: H_PAD,
    alignItems: 'center',
  },
  emptyEyebrow: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 2.34,
    color: colors.anchor15.giltBright,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyHeadline: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: colors.anchor15.bone,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  emptySubhead: {
    fontFamily: 'CormorantGaramond-Regular',
    fontSize: 15,
    fontWeight: '300',
    color: colors.anchor15.ash,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 26,
  },
  // DEFERRED: concentric multi-ring and ritual circle styles removed in empty-state redesign — single blueprint frame renders in its place
  // emptyKicker: {
  //   marginTop: 14,
  //   marginHorizontal: H_PAD,
  //   fontFamily: 'Cinzel-Regular',
  //   fontSize: 9,
  //   letterSpacing: 2.5,
  //   color: 'rgba(212,175,55,0.4)',
  //   textTransform: 'uppercase',
  //   textAlign: 'center',
  // },
  // ritualWrap: {
  //   marginTop: 16,
  //   alignSelf: 'center',
  //   width: CIRCLE,
  //   height: CIRCLE,
  //   alignItems: 'center',
  //   justifyContent: 'center',
  // },
  // ghostSigil1: {
  //   position: 'absolute',
  //   top: 8,
  //   left: 10,
  //   opacity: 0.04,
  // },
  // ghostSigil2: {
  //   position: 'absolute',
  //   bottom: 8,
  //   right: 10,
  //   opacity: 0.04,
  //   transform: [{ rotate: '55deg' }],
  // },
  // rcRing: {
  //   position: 'absolute',
  //   borderRadius: CIRCLE / 2,
  //   borderWidth: 1,
  //   borderColor: RING_BORDER,
  //   alignItems: 'center',
  // },
  // rcR1: { width: CIRCLE, height: CIRCLE },
  // rcR2: {
  //   width: CIRCLE - 44,
  //   height: CIRCLE - 44,
  //   borderColor: 'rgba(212,175,55,0.07)',
  // },
  // rcR3: {
  //   width: CIRCLE - 88,
  //   height: CIRCLE - 88,
  //   borderColor: 'rgba(212,175,55,0.10)',
  // },
  // rcOrbitDot: {
  //   position: 'absolute',
  //   top: -2.5,
  //   left: (CIRCLE - 88) / 2 - 2.5,
  //   width: 5,
  //   height: 5,
  //   borderRadius: 3,
  //   backgroundColor: colors.gold,
  //   shadowColor: colors.gold,
  //   shadowOffset: { width: 0, height: 0 },
  //   shadowOpacity: 0.65,
  //   shadowRadius: 5,
  //   elevation: 4,
  // },
  // rcCenter: {
  //   width: 110,
  //   height: 110,
  //   borderRadius: 55,
  //   backgroundColor: 'rgba(30,42,51,0.5)',
  //   borderWidth: 1,
  //   borderColor: 'rgba(212,175,55,0.18)',
  //   alignItems: 'center',
  //   justifyContent: 'center',
  //   gap: 5,
  // },
  // rcPlus: {
  //   fontSize: 22,
  //   lineHeight: 26,
  //   color: colors.gold,
  //   opacity: 0.75,
  //   fontWeight: '300',
  // },
  // rcLabel: {
  //   fontFamily: 'Cinzel-Regular',
  //   fontSize: 8,
  //   letterSpacing: 2,
  //   color: colors.gold,
  //   opacity: 0.65,
  //   textTransform: 'uppercase',
  // },
  // emptyHeadlineGold: {
  //   color: colors.gold,
  // },
  // emptyBody: {
  //   fontFamily: 'CormorantGaramond-Regular',
  //   fontSize: 15,
  //   fontWeight: '300',
  //   color: 'rgba(192,192,192,0.5)',
  //   lineHeight: 24,
  //   marginBottom: 20,
  // },
  // DEFERRED: solid gold filled forgeCta removed to comply with brand rules — replaced with ghost button sharing styles.activateBtn
  // forgeCta: {
  //   width: '100%',
  //   height: 54,
  //   backgroundColor: colors.gold,
  //   borderRadius: 10,
  //   alignItems: 'center',
  //   justifyContent: 'center',
  //   overflow: 'hidden',
  //   shadowColor: colors.gold,
  //   shadowOffset: { width: 0, height: 8 },
  //   shadowOpacity: 0.25,
  //   shadowRadius: 14,
  //   elevation: 6,
  // },
  // forgeCtaShimmer: {
  //   position: 'absolute',
  //   inset: 0,
  //   backgroundColor: 'rgba(255,255,255,0.1)',
  //   top: 0,
  //   left: 0,
  //   right: '50%',
  //   bottom: 0,
  //   transform: [{ skewX: '-20deg' }],
  // },
  // forgeCtaText: {
  //   fontFamily: 'Cinzel-SemiBold',
  //   fontSize: 12,
  //   letterSpacing: 2.2,
  //   color: colors.navy,
  //   textTransform: 'uppercase',
  // },

  // ── Active state ──────────────────────────────────────────────────────────────
  contextBar: {
    marginTop: 8,
    marginHorizontal: H_PAD,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ctxSubLabel: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 9,
    letterSpacing: 2.2,
    color: 'rgba(212,175,55,0.4)',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  vaultTeachingCard: {
    marginTop: 10,
    marginHorizontal: H_PAD,
  },
  heroWrap: {
    marginTop: 6,
    marginHorizontal: H_PAD,
  },
  activateBtnWrap: {
    marginTop: 26,
    marginHorizontal: H_PAD,
  },
  activateBtn: {
    height: 56,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: withAlpha(colors.anchor15.gilt, 0.34),
    backgroundColor: withAlpha(colors.anchor15.gilt, 0.1),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  activateBtnText: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 13,
    letterSpacing: 0.78,
    color: colors.anchor15.giltBright,
  },
  sectionDivider: {
    marginTop: 18,
    marginHorizontal: H_PAD,
    height: 1,
    backgroundColor: withAlpha(colors.anchor15.gilt, 0.12),
  },
  stackWrap: {
    marginTop: 14,
    marginHorizontal: H_PAD,
    marginBottom: 18,
  },
});

export default VaultScreen;
