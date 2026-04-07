/**
 * Anchor App — VaultScreen (Sanctuary Redesign)
 *
 * Two states:
 *   Empty  — no anchors; invite the first forge
 *   Active — at least one anchor; surface the primary sigil as a hero card
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import {
  InteractionManager,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
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
import { useToast } from '../../components/ToastProvider';
import { AnchorLimitModal } from '../../components/modals/AnchorLimitModal';
import { AnchorGridSkeleton } from '../../components/skeletons/AnchorCardSkeleton';
// DEFERRED: freemium — useSubscription removed; freemium tier gates replaced with trial model
// import { useSubscription } from '../../hooks/useSubscription';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { AnalyticsService, AnalyticsEvents } from '../../services/AnalyticsService';
import { ErrorTrackingService } from '../../services/ErrorTrackingService';
import { PerformanceMonitoring } from '../../services/PerformanceMonitoring';
import { SanctuaryHeader } from './components/SanctuaryHeader';
import { AtmosphericOrbs } from './components/AtmosphericOrbs';
import { HeroAnchorCard } from './components/HeroAnchorCard';
import { AnchorStack } from './components/AnchorStack';
import { ZenBackground } from '@/components/common';
import { getEffectiveStabilizeStreakDays, toDateOrNull } from '@/utils/stabilizeStats';
import type { Anchor, RootStackParamList } from '@/types';
import { colors } from '@/theme';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { useSettingsStore } from '@/stores/settingsStore';

// ─── Constants ────────────────────────────────────────────────────────────────

const H_PAD = 28;
const CREATE_ZONE_BG = '#080C10';

// Ghost sigils used in the empty-state ritual circle (from the HTML prototype)
const GHOST_SIGIL_1 = `<svg viewBox="0 0 55 55" fill="none" stroke="#D4AF37" stroke-width="1" xmlns="http://www.w3.org/2000/svg">
  <line x1="27" y1="4" x2="27" y2="51"/>
  <line x1="4" y1="27" x2="51" y2="27"/>
  <line x1="10" y1="10" x2="44" y2="44"/>
  <circle cx="27" cy="27" r="18" opacity=".5"/>
</svg>`;

const GHOST_SIGIL_2 = `<svg viewBox="0 0 45 45" fill="none" stroke="#D4AF37" stroke-width="1" xmlns="http://www.w3.org/2000/svg">
  <line x1="22" y1="4" x2="22" y2="41"/>
  <line x1="4" y1="22" x2="41" y2="22"/>
  <circle cx="22" cy="22" r="14" opacity=".5"/>
  <circle cx="22" cy="22" r="5" opacity=".7"/>
</svg>`;

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

// ─── Greeting helper ──────────────────────────────────────────────────────────

function buildGreeting(displayName: string | undefined): string {
  const hour = new Date().getHours();
  const salutation =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = displayName?.split(' ')[0];
  return firstName ? `${salutation}, ${firstName}` : salutation;
}

// ─── Animation helpers ────────────────────────────────────────────────────────

type VaultScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Vault'>;

const getFadeUp = (delay: number, disabled: boolean) => {
  if (disabled) return undefined;
  return FadeInUp.duration(600)
    .delay(delay)
    .withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] });
};

// ─── VaultScreen ──────────────────────────────────────────────────────────────

export const VaultScreen: React.FC = () => {
  const navigation = useNavigation<VaultScreenNavigationProp>();
  const { registerTabNav, activeTabIndex } = useTabNavigation();
  const isVaultTabActive = activeTabIndex == null ? true : activeTabIndex === 0;

  const { user } = useAuthStore();
  const developerForceStreakBreakEnabled = useSettingsStore(
    (state) => state.developerForceStreakBreakEnabled
  );
  const shouldRedirectToCreation = useAuthStore((s) => s.shouldRedirectToCreation);
  const setShouldRedirectToCreation = useAuthStore((s) => s.setShouldRedirectToCreation);

  const anchors = useAnchorStore((s) => s.anchors);
  const currentAnchorId = useAnchorStore((s) => s.currentAnchorId);
  const setCurrentAnchor = useAnchorStore((s) => s.setCurrentAnchor);
  const isLoading = useAnchorStore((s) => s.isLoading);
  const setLoading = useAnchorStore((s) => s.setLoading);
  const setError = useAnchorStore((s) => s.setError);

  // DEFERRED: freemium — isFree / features.maxAnchors gate removed; all trial/active users have unlimited anchors
  // const { isFree, features } = useSubscription();
  const [showAnchorLimitModal, setShowAnchorLimitModal] = React.useState(false);

  const reduceMotionEnabled = useReduceMotionEnabled();
  const shouldReduceMotion = reduceMotionEnabled || !isVaultTabActive;
  const toast = useToast();

  // ── Derived state ────────────────────────────────────────────────────────────
  const autoPrimary = useMemo(() => selectPrimaryAnchor(anchors), [anchors]);

  // Use the shared store's currentAnchorId so Practice tab stays in sync
  const primaryAnchor = useMemo(() => {
    if (currentAnchorId) {
      const found = anchors.find((a) => a.id === currentAnchorId);
      if (found) return found;
    }
    return autoPrimary;
  }, [currentAnchorId, anchors, autoPrimary]);

  // Anchors to show in the stack — exclude the current hero
  const stackAnchors = useMemo(
    () => anchors.filter((a) => a.id !== primaryAnchor?.id),
    [anchors, primaryAnchor],
  );

  const greeting = useMemo(() => buildGreeting(user?.displayName), [user?.displayName]);

  const streakDays = useMemo(() => {
    if (__DEV__ && developerForceStreakBreakEnabled) {
      return 0;
    }
    const lastStabilizeAt = toDateOrNull(user?.lastStabilizeAt);
    return getEffectiveStabilizeStreakDays(
      user?.stabilizeStreakDays ?? 0,
      lastStabilizeAt,
      new Date(),
    );
  }, [developerForceStreakBreakEnabled, user?.lastStabilizeAt, user?.stabilizeStreakDays]);

  // ── Empty-state orbit animation ───────────────────────────────────────────────
  const orbitRotation = useSharedValue(0);
  const pulseDotOpacity = useSharedValue(1);

  useEffect(() => {
    registerTabNav(0, navigation as any);
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

  // ── Redirect to creation ─────────────────────────────────────────────────────
  useEffect(() => {
    if (shouldRedirectToCreation) {
      setShouldRedirectToCreation(false);
      // DEFERRED: freemium — anchor limit check removed; trial/active users have unlimited anchors
      // if (isFree && anchors.length >= features.maxAnchors) {
      //   setShowAnchorLimitModal(true);
      //   return;
      // }

      const task = InteractionManager.runAfterInteractions(() => {
        navigation.replace('FirstAnchorCreation');
      });

      return () => {
        task.cancel();
      };
    }
  }, [
    shouldRedirectToCreation,
    setShouldRedirectToCreation,
    navigation,
  ]);

  // ── Data fetching ─────────────────────────────────────────────────────────────
  const fetchAnchors = useCallback(async (): Promise<void> => {
    if (!user) return;
    const trace = PerformanceMonitoring.startTrace('fetch_anchors');
    setLoading(true);
    setError(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      trace.putAttribute('anchor_count', anchors.length);
      AnalyticsService.track(AnalyticsEvents.VAULT_VIEWED, { anchor_count: anchors.length });
    } catch (error) {
      const msg = (error as Error).message;
      setError(msg);
      toast.error(`Failed to load anchors: ${msg}`);
      ErrorTrackingService.captureException(error as Error, {
        screen: 'VaultScreen',
        action: 'fetch_anchors',
        user_id: user.id,
      });
    } finally {
      setLoading(false);
      trace.stop();
    }
  }, [user, setLoading, setError, toast, anchors.length]);

  useEffect(() => { fetchAnchors(); }, [fetchAnchors]);

  // ── Navigation handlers ───────────────────────────────────────────────────────
  const handleCreateAnchor = useCallback((): void => {
    // DEFERRED: freemium — anchor limit gate removed; trial/active users have unlimited anchors
    // if (isFree && anchors.length >= features.maxAnchors) {
    //   AnalyticsService.track(AnalyticsEvents.ANCHOR_LIMIT_REACHED, {
    //     current_count: anchors.length,
    //     max_count: features.maxAnchors,
    //     tier: 'free',
    //   });
    //   setShowAnchorLimitModal(true);
    //   return;
    // }
    AnalyticsService.track(AnalyticsEvents.ANCHOR_CREATION_STARTED, {
      source: 'vault',
      has_existing_anchors: anchors.length > 0,
    });
    navigation.navigate(anchors.length === 0 ? 'FirstAnchorCreation' : 'CreateAnchor');
  }, [anchors.length, navigation]);

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
    if (primaryAnchor.isCharged) {
      navigation.navigate('ActivationRitual', {
        anchorId: primaryAnchor.id,
        activationType: 'visual',
      });
    } else {
      navigation.navigate('ChargeSetup', { anchorId: primaryAnchor.id });
    }
  }, [primaryAnchor, navigation]);

  const handleUpgradeFromLimit = useCallback((): void => {
    setShowAnchorLimitModal(false);
    AnalyticsService.track(AnalyticsEvents.UPGRADE_INITIATED, {
      source: 'anchor_limit_modal',
      trigger: 'max_anchors_reached',
    });
    navigation.navigate('Settings');
  }, [navigation]);

  const handleBurnFromLimit = useCallback((): void => {
    setShowAnchorLimitModal(false);
    toast.info('Select an anchor to release and make room for a new one');
  }, [toast]);

  // ── Render ────────────────────────────────────────────────────────────────────

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
      <AtmosphericOrbs reduceMotionEnabled={shouldReduceMotion} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scrollArea}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ── Header ── */}
          <Animated2.View entering={getFadeUp(100, shouldReduceMotion)}>
            <SanctuaryHeader
              reduceMotionEnabled={shouldReduceMotion}
              greeting={greeting}
            />
          </Animated2.View>

          {anchors.length === 0
            ? renderEmptyState({
                handleCreateAnchor,
                shouldReduceMotion,
                orbitRingStyle,
              })
            : renderActiveState({
                anchors: stackAnchors,
                primaryAnchor: primaryAnchor!,
                streakDays,
                shouldReduceMotion,
                pulseDotStyle,
                handleHeroPress,
                handleActivate,
                handleAnchorPress,
                handleCreateAnchor,
              })}
        </ScrollView>

        {anchors.length > 0 && (
          <View style={styles.createZone}>
            <LinearGradient
              colors={['transparent', CREATE_ZONE_BG]}
              style={styles.createFade}
              pointerEvents="none"
            />
            <TouchableOpacity
              style={styles.createBtn}
              onPress={handleCreateAnchor}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Create new anchor"
            >
              <View style={styles.plusRing}>
                <Text style={styles.plusIcon}>+</Text>
              </View>
              <Text style={styles.createLabel}>CREATE NEW ANCHOR</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>

      <AnchorLimitModal
        visible={showAnchorLimitModal}
        currentCount={anchors.length}
        maxCount={features.maxAnchors}
        onClose={() => setShowAnchorLimitModal(false)}
        onUpgrade={handleUpgradeFromLimit}
        onBurnAnchor={handleBurnFromLimit}
      />
    </View>
  );
};

// ─── Empty state ──────────────────────────────────────────────────────────────

interface EmptyStateProps {
  handleCreateAnchor: () => void;
  shouldReduceMotion: boolean;
  orbitRingStyle: ReturnType<typeof useAnimatedStyle>;
}

export function VaultEmptyStateContent({
  handleCreateAnchor,
  shouldReduceMotion,
  orbitRingStyle,
}: EmptyStateProps) {
  return (
    <View style={styles.emptyStateFill} testID="vault-empty-state-fill">
      {/* Kicker */}
      <Animated2.View entering={getFadeUp(150, shouldReduceMotion)}>
        <Text style={styles.emptyKicker}>YOUR RITUAL SPACE AWAITS</Text>
      </Animated2.View>

      {/* Ritual circle */}
      <Animated2.View entering={getFadeUp(200, shouldReduceMotion)} style={styles.ritualWrap}>
        {/* Ghost sigils */}
        <View style={styles.ghostSigil1} pointerEvents="none">
          <SvgXml xml={GHOST_SIGIL_1} width={55} height={55} />
        </View>
        <View style={styles.ghostSigil2} pointerEvents="none">
          <SvgXml xml={GHOST_SIGIL_2} width={45} height={45} />
        </View>

        {/* Static outer ring */}
        <View style={[styles.rcRing, styles.rcR1]} />
        {/* Static middle ring */}
        <View style={[styles.rcRing, styles.rcR2]} />
        {/* Animated inner ring */}
        <Animated2.View style={[styles.rcRing, styles.rcR3, orbitRingStyle]}>
          <View style={styles.rcOrbitDot} />
        </Animated2.View>

        {/* Center forge button */}
        <TouchableOpacity
          style={styles.rcCenter}
          onPress={handleCreateAnchor}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Forge your first anchor"
        >
          <Text style={styles.rcPlus}>+</Text>
          <Text style={styles.rcLabel}>FORGE</Text>
        </TouchableOpacity>
      </Animated2.View>

      {/* Copy */}
      <Animated2.View entering={getFadeUp(300, shouldReduceMotion)} style={styles.emptyCopyWrap}>
        <Text style={styles.emptyHeadline}>
          {'Begin with one '}
          <Text style={styles.emptyHeadlineGold}>intention.</Text>
        </Text>
        <Text style={styles.emptyBody}>
          Forge your first anchor — a personal symbol that primes your mind before the moments that matter.
        </Text>
        <TouchableOpacity
          style={styles.forgeCta}
          onPress={handleCreateAnchor}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <View style={styles.forgeCtaShimmer} pointerEvents="none" />
          <Text style={styles.forgeCtaText}>⚡  FORGE YOUR FIRST ANCHOR</Text>
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
  streakDays: number;
  shouldReduceMotion: boolean;
  pulseDotStyle: ReturnType<typeof useAnimatedStyle>;
  handleHeroPress: () => void;
  handleActivate: () => void;
  handleAnchorPress: (id: string) => void;
  handleCreateAnchor: () => void;
}

function renderActiveState({
  anchors,
  primaryAnchor,
  streakDays,
  shouldReduceMotion,
  pulseDotStyle,
  handleHeroPress,
  handleActivate,
  handleAnchorPress,
  handleCreateAnchor,
}: ActiveStateProps) {
  const isCharged = primaryAnchor.isCharged;

  return (
    <>
      {/* ── Context bar ── */}
      <Animated2.View
        entering={getFadeUp(250, shouldReduceMotion)}
        style={styles.contextBar}
      >
        <View>
          <Text style={styles.ctxSubLabel}>ACTIVE ANCHOR</Text>
          {/* DEFERRED: removed duplicate intention - intention shown below medallion */}
        </View>
        {streakDays > 0 && (
          <View style={styles.streakChip}>
            <Text style={styles.streakFire}>🔥</Text>
            <Text style={styles.streakCount}>{streakDays}</Text>
            <Text style={styles.streakLabel}>day streak</Text>
          </View>
        )}
      </Animated2.View>

      {/* ── Hero card ── */}
      <Animated2.View
        entering={getFadeUp(350, shouldReduceMotion)}
        style={styles.heroWrap}
      >
        <HeroAnchorCard
          anchor={primaryAnchor}
          onPress={handleHeroPress}
          reduceMotionEnabled={shouldReduceMotion}
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
          accessibilityLabel={isCharged ? 'Activate Anchor' : 'Charge Anchor'}
        >
          <Animated2.View style={[styles.activatePulseDot, pulseDotStyle]} />
          <Text style={styles.activateBtnText}>
            {isCharged ? 'ACTIVATE ANCHOR' : 'CHARGE ANCHOR'}
          </Text>
        </TouchableOpacity>
      </Animated2.View>

      {/* ── Anchor stack — shows ALL anchors so users always see their collection ── */}
      <Animated2.View
        entering={getFadeUp(600, shouldReduceMotion)}
        style={styles.stackWrap}
      >
        <AnchorStack
          anchors={anchors}
          onAnchorPress={handleAnchorPress}
          onAddPress={handleCreateAnchor}
          onViewAll={() => {
            // Phase 3: full vault list
          }}
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
    backgroundColor: colors.sanctuary.purpleBg,
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
    paddingBottom: 0,
  },

  // ── Empty state ───────────────────────────────────────────────────────────────
  emptyKicker: {
    marginTop: 14,
    marginHorizontal: H_PAD,
    fontFamily: 'Cinzel-Regular',
    fontSize: 9,
    letterSpacing: 2.5,
    color: 'rgba(212,175,55,0.4)',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  emptyStateFill: {
    flex: 1,
    justifyContent: 'space-between',
  },
  ritualWrap: {
    marginTop: 16,
    alignSelf: 'center',
    width: CIRCLE,
    height: CIRCLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostSigil1: {
    position: 'absolute',
    top: 8,
    left: 10,
    opacity: 0.04,
  },
  ghostSigil2: {
    position: 'absolute',
    bottom: 8,
    right: 10,
    opacity: 0.04,
    transform: [{ rotate: '55deg' }],
  },
  rcRing: {
    position: 'absolute',
    borderRadius: CIRCLE / 2,
    borderWidth: 1,
    borderColor: RING_BORDER,
    alignItems: 'center',
  },
  rcR1: { width: CIRCLE, height: CIRCLE },
  rcR2: {
    width: CIRCLE - 44,
    height: CIRCLE - 44,
    borderColor: 'rgba(212,175,55,0.07)',
  },
  rcR3: {
    width: CIRCLE - 88,
    height: CIRCLE - 88,
    borderColor: 'rgba(212,175,55,0.10)',
  },
  rcOrbitDot: {
    position: 'absolute',
    top: -2.5,
    left: (CIRCLE - 88) / 2 - 2.5,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 5,
    elevation: 4,
  },
  rcCenter: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(62,44,91,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  rcPlus: {
    fontSize: 22,
    lineHeight: 26,
    color: colors.gold,
    opacity: 0.75,
    fontWeight: '300',
  },
  rcLabel: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 8,
    letterSpacing: 2,
    color: colors.gold,
    opacity: 0.65,
    textTransform: 'uppercase',
  },
  emptyCopyWrap: {
    marginTop: 20,
    marginHorizontal: H_PAD,
  },
  emptyHeadline: {
    fontFamily: 'Cinzel-Medium',
    fontSize: 19,
    color: colors.bone,
    letterSpacing: 0.3,
    lineHeight: 26,
    marginBottom: 10,
  },
  emptyHeadlineGold: {
    color: colors.gold,
  },
  emptyBody: {
    fontFamily: 'CormorantGaramond-Regular',
    fontSize: 15,
    fontWeight: '300',
    color: 'rgba(192,192,192,0.5)',
    lineHeight: 24,
    marginBottom: 20,
  },
  forgeCta: {
    width: '100%',
    height: 54,
    backgroundColor: colors.gold,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  forgeCtaShimmer: {
    position: 'absolute',
    inset: 0,
    // Simulates the 135deg linear-gradient shimmer from the prototype
    backgroundColor: 'rgba(255,255,255,0.1)',
    top: 0,
    left: 0,
    right: '50%',
    bottom: 0,
    transform: [{ skewX: '-20deg' }],
  },
  forgeCtaText: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 12,
    letterSpacing: 2.2,
    color: colors.navy,
    textTransform: 'uppercase',
  },

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
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(212,175,55,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.14)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  streakFire: {
    fontSize: 12,
  },
  streakCount: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 14,
    color: colors.gold,
  },
  streakLabel: {
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 11,
    color: 'rgba(192,192,192,0.45)',
  },
  heroWrap: {
    marginTop: 10,
    marginHorizontal: H_PAD,
  },
  activateBtnWrap: {
    marginTop: 10,
    marginHorizontal: H_PAD,
  },
  activateBtn: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  activatePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 5,
    elevation: 4,
  },
  activateBtnText: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 12,
    letterSpacing: 2,
    color: colors.gold,
    textTransform: 'uppercase',
  },
  stackWrap: {
    marginTop: 10,
    marginHorizontal: H_PAD,
    marginBottom: 4,
  },
  createZone: {
    backgroundColor: CREATE_ZONE_BG,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 14,
    position: 'relative',
  },
  createFade: {
    position: 'absolute',
    top: -28,
    left: 0,
    right: 0,
    height: 28,
  },
  createBtn: {
    width: '100%',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    backgroundColor: 'rgba(212,175,55,0.04)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  plusRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusIcon: {
    color: '#D4AF37',
    fontSize: 14,
    lineHeight: 16,
    marginTop: -1,
  },
  createLabel: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 11.5,
    letterSpacing: 2.5,
    color: 'rgba(212,175,55,0.82)',
  },
});

export default VaultScreen;
