/**
 * Anchor App - Anchor Detail Screen (PREMIUM REFACTOR)
 *
 * Premium ritual-centric detailed view with:
 * - Animated breathing sigil with glow effects
 * - State-based visual intensity (dormant/charged/active/stale)
 * - Meaning-driven stats and copy
 * - Practice path tracker with activation history
 * - Reduce motion support
 */

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  AccessibilityInfo,
  Alert,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Haptics from 'expo-haptics';
import { useAnchorStore } from '../../stores/anchorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { RootStackParamList, ActivationType } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { format } from 'date-fns';
import { AnalyticsService, AnalyticsEvents } from '../../services/AnalyticsService';
import { ErrorSeverity, ErrorTrackingService } from '../../services/ErrorTrackingService';
import { safeHaptics } from '@/utils/haptics';
import { del } from '@/services/ApiClient';
import { ChevronDown, ChevronUp, Zap } from 'lucide-react-native';

// New components
import { SigilHeroCard } from './components/SigilHeroCard';
import { PracticePathCard } from './components/PracticePathCard';
import { PhysicalAnchorCard } from './components/PhysicalAnchorCard';
import { DistilledLettersModal } from './components/DistilledLettersModal';
import { CustomDurationSheet, ZenBackground, PresetChips } from '@/components/common';
import type { PresetChip } from '@/components/common/PresetChips';

// Helper utilities
import {
  getAnchorState,
  getMeaningCopy,
  getDeepChargeMicrocopy,
  getActivationsThisWeek,
  getDashboardHeadline,
  hasIgnited as getHasIgnited,
  isAnchorReleased,
  isToday,
} from './utils/anchorStateHelpers';

type AnchorDetailRouteProp = RouteProp<RootStackParamList, 'AnchorDetail'>;
type AnchorDetailNavigationProp = StackNavigationProp<
  RootStackParamList,
  'AnchorDetail'
>;

function getStatusChip(state: ReturnType<typeof getAnchorState>): {
  icon: string;
  label: string;
  color: string;
} {
  switch (state) {
    case 'active':
      return { icon: '✦', label: 'Live', color: colors.gold };
    case 'charged':
      return { icon: '⚡', label: 'Charged', color: `${colors.gold}CC` };
    case 'stale':
      return { icon: '◌', label: 'Fading', color: colors.silver };
    default:
      return { icon: '◈', label: 'Ready', color: colors.text.tertiary };
  }
}

const CATEGORY_CONFIG: Record<
  string,
  { label: string; color: string; emoji: string }
> = {
  career: { label: 'Career', color: colors.gold, emoji: '💼' },
  health: { label: 'Health', color: colors.success, emoji: '💪' },
  wealth: { label: 'Wealth', color: colors.bronze, emoji: '💰' },
  relationships: { label: 'Love', color: colors.deepPurple, emoji: '💜' },
  personal_growth: { label: 'Growth', color: colors.silver, emoji: '🌱' },
  custom: { label: 'Custom', color: colors.text.secondary, emoji: '✨' },
};

type DeepChargePreset = '2m' | '5m' | '10m' | '20m' | 'custom';

const DEEP_CHARGE_PRESETS: ReadonlyArray<{ key: DeepChargePreset; label: string }> = [
  { key: '2m', label: '2m' },
  { key: '5m', label: '5m' },
  { key: '10m', label: '10m' },
  { key: '20m', label: '20m' },
  { key: 'custom', label: 'Custom' },
];
const clampDeepChargeMinutes = (value: number): number => Math.min(20, Math.max(2, Math.round(value)));

const ACTIVATION_PRESETS: ReadonlyArray<PresetChip> = [
  { key: '10s', label: '10s' },
  { key: '30s', label: '30s' },
  { key: '60s', label: '60s' },
];

export const AnchorDetailScreen: React.FC = () => {
  const navigation = useNavigation<AnchorDetailNavigationProp>();
  const route = useRoute<AnchorDetailRouteProp>();
  const { anchorId } = route.params;

  const { getAnchorById, removeAnchor } = useAnchorStore();
  const {
    reduceIntentionVisibility,
    developerModeEnabled,
    developerDeleteWithoutBurnEnabled,
    defaultActivation,
    setDefaultActivation,
  } = useSettingsStore();
  const anchor = getAnchorById(anchorId);

  // State
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const [distilledModalVisible, setDistilledModalVisible] = useState(false);
  const [isDeletingAnchor, setIsDeletingAnchor] = useState(false);
  const [isDeepChargeExpanded, setIsDeepChargeExpanded] = useState(false);
  const [deepChargePreset, setDeepChargePreset] = useState<DeepChargePreset>('5m');
  const [customDeepChargeMinutes, setCustomDeepChargeMinutes] = useState(5);
  const [customDurationSheetVisible, setCustomDurationSheetVisible] = useState(false);
  const [mantraAudioEnabled, setMantraAudioEnabled] = useState(false);
  const [activationRippleNonce, setActivationRippleNonce] = useState(0);
  const activationNavigateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Activation preset (derived from settingsStore, kept in sync)
  const activationPresetKey = useMemo(() => {
    if (defaultActivation.unit === 'seconds') {
      const s = defaultActivation.value;
      if (s <= 10) return '10s';
      if (s <= 30) return '30s';
      return '60s';
    }
    return '30s';
  }, [defaultActivation]);
  const primaryButtonPulseOpacity = useMemo(() => new Animated.Value(0.18), []);
  const liveShimmerProgress = useMemo(() => new Animated.Value(-1), []);

  // Detect reduce motion setting
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotionEnabled);

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotionEnabled
    );

    return () => subscription.remove();
  }, []);

  // Analytics tracking
  useEffect(() => {
    if (anchor) {
      AnalyticsService.track(AnalyticsEvents.ANCHOR_DETAIL_VIEWED, {
        anchor_id: anchor.id,
        category: anchor.category,
        is_charged: anchor.isCharged,
        activation_count: anchor.activationCount,
      });

      ErrorTrackingService.addBreadcrumb('Anchor detail viewed', 'navigation', {
        anchor_id: anchor.id,
      });
    } else if (!isDeletingAnchor) {
      ErrorTrackingService.captureException(new Error('Anchor not found'), {
        screen: 'AnchorDetailScreen',
        anchor_id: anchorId,
      });
    }
  }, [anchor, anchorId, isDeletingAnchor]);

  // Derived state (memoized)
  const anchorState = useMemo(() => {
    if (!anchor) return 'dormant';
    return getAnchorState(anchor);
  }, [anchor]);

  const hasIgnited = useMemo(() => {
    if (!anchor) return false;
    return getHasIgnited(anchor);
  }, [anchor]);

  const isReleased = useMemo(() => {
    if (!anchor) return false;
    return isAnchorReleased(anchor);
  }, [anchor]);

  const meaningCopy = useMemo(() => {
    if (!anchor) return {
      activationStatus: '',
      lastActivatedText: '',
      ctaLabel: '',
      ctaMicrocopy: '',
    };
    return getMeaningCopy(anchor, anchorState);
  }, [anchor, anchorState]);

  const activationsThisWeek = useMemo(() => {
    if (!anchor) return 0;
    return getActivationsThisWeek(anchor);
  }, [anchor]);

  const deepChargeMicrocopy = useMemo(() => {
    if (!anchor) return 'Best when your intention feels dim.';
    return getDeepChargeMicrocopy(anchor.lastActivatedAt);
  }, [anchor]);

  const todayActivated = useMemo(() => {
    if (!anchor?.lastActivatedAt) return false;
    return isToday(anchor.lastActivatedAt);
  }, [anchor]);

  const deepChargeDurationSeconds = useMemo(() => {
    if (deepChargePreset === '2m') return 120;
    if (deepChargePreset === '5m') return 300;
    if (deepChargePreset === '10m') return 600;
    if (deepChargePreset === '20m') return 1200;
    return clampDeepChargeMinutes(customDeepChargeMinutes) * 60;
  }, [customDeepChargeMinutes, deepChargePreset]);

  useEffect(() => {
    return () => {
      if (activationNavigateTimeoutRef.current) {
        clearTimeout(activationNavigateTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (reduceMotionEnabled || isReleased) {
      primaryButtonPulseOpacity.setValue(0);
      return;
    }

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(primaryButtonPulseOpacity, {
          toValue: 0.24,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(primaryButtonPulseOpacity, {
          toValue: 0.1,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [isReleased, primaryButtonPulseOpacity, reduceMotionEnabled]);

  useEffect(() => {
    if (reduceMotionEnabled || !hasIgnited || isReleased) {
      liveShimmerProgress.setValue(-1);
      return;
    }

    const shimmerLoop = Animated.loop(
      Animated.timing(liveShimmerProgress, {
        toValue: 1,
        duration: 2800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    shimmerLoop.start();
    return () => shimmerLoop.stop();
  }, [hasIgnited, isReleased, liveShimmerProgress, reduceMotionEnabled]);

  // Handlers (memoized with haptics)
  const handleChargePress = useCallback((): void => {
    if (!anchor) return;

    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);

    AnalyticsService.track(AnalyticsEvents.CHARGE_STARTED, {
      anchor_id: anchor.id,
      charge_type: 'initial_quick',
      source: 'anchor_detail',
    });

    ErrorTrackingService.addBreadcrumb('Charge initiated', 'navigation', {
      anchor_id: anchor.id,
      charge_type: 'initial_quick',
    });

    navigation.navigate('ChargeSetup', {
      anchorId: anchor.id,
      returnTo: 'detail',
    });
  }, [anchor, navigation]);

  const handleDeepChargeExpandPress = useCallback((): void => {
    safeHaptics.selection();
    setIsDeepChargeExpanded((prev) => !prev);
  }, []);

  const handleDeepChargePresetPress = useCallback((preset: DeepChargePreset): void => {
    safeHaptics.selection();
    setDeepChargePreset(preset);
    if (preset === 'custom') {
      setCustomDurationSheetVisible(true);
    }
  }, []);

  const handleCustomDurationConfirm = useCallback((minutes: number): void => {
    setCustomDeepChargeMinutes(clampDeepChargeMinutes(minutes));
    setDeepChargePreset('custom');
    setCustomDurationSheetVisible(false);
  }, []);

  const handleBeginDeepCharge = useCallback((): void => {
    if (!anchor || isReleased) return;

    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);

    AnalyticsService.track(AnalyticsEvents.DEEP_CHARGE_STARTED, {
      anchor_id: anchor.id,
      source: 'anchor_detail',
      duration_seconds: deepChargeDurationSeconds,
      mantra_audio_enabled: mantraAudioEnabled,
    });

    ErrorTrackingService.addBreadcrumb('Deep charge initiated', 'navigation', {
      anchor_id: anchor.id,
      duration_seconds: deepChargeDurationSeconds,
      mantra_audio_enabled: mantraAudioEnabled,
    });

    navigation.navigate('Ritual', {
      anchorId: anchor.id,
      ritualType: 'ritual',
      durationSeconds: deepChargeDurationSeconds,
      mantraAudioEnabled,
      returnTo: 'detail',
    });
  }, [anchor, deepChargeDurationSeconds, isReleased, mantraAudioEnabled, navigation]);

  const handleActivationPresetSelect = useCallback((key: string) => {
    const presetSeconds: Record<string, number> = { '10s': 10, '30s': 30, '60s': 60 };
    const seconds = presetSeconds[key] ?? 30;
    setDefaultActivation({ ...defaultActivation, type: 'visual', value: seconds, unit: 'seconds' });
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
  }, [defaultActivation, setDefaultActivation]);

  const handleActivatePress = useCallback((): void => {
    if (!anchor) return;

    if (!hasIgnited) {
      AnalyticsService.track(AnalyticsEvents.ACTIVATION_ATTEMPTED_UNCHARGED, {
        anchor_id: anchor.id,
      });
      return;
    }

    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    setActivationRippleNonce((prev) => prev + 1);

    AnalyticsService.track(AnalyticsEvents.ACTIVATION_STARTED, {
      anchor_id: anchor.id,
      activation_type: 'visual',
      source: 'anchor_detail',
      activation_count: anchor.activationCount,
    });

    ErrorTrackingService.addBreadcrumb('Activation initiated', 'navigation', {
      anchor_id: anchor.id,
    });

    const navigateToActivation = () => {
      navigation.navigate('ActivationRitual', {
        anchorId: anchor.id,
        activationType: 'visual' as ActivationType,
        returnTo: 'detail',
      });
    };

    if (reduceMotionEnabled) {
      if (activationNavigateTimeoutRef.current) {
        clearTimeout(activationNavigateTimeoutRef.current);
        activationNavigateTimeoutRef.current = null;
      }
      navigateToActivation();
      return;
    }

    if (activationNavigateTimeoutRef.current) {
      clearTimeout(activationNavigateTimeoutRef.current);
    }

    activationNavigateTimeoutRef.current = setTimeout(() => {
      activationNavigateTimeoutRef.current = null;
      navigateToActivation();
    }, 150);
  }, [anchor, hasIgnited, navigation, reduceMotionEnabled]);

  const handleBurnPress = useCallback((): void => {
    if (!anchor || isReleased) return;

    void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);

    AnalyticsService.track(AnalyticsEvents.BURN_INITIATED, {
      anchor_id: anchor.id,
      activation_count: anchor.activationCount,
      days_since_created: Math.floor(
        (Date.now() - new Date(anchor.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      ),
    });

    ErrorTrackingService.addBreadcrumb('Burn ritual initiated', 'navigation', {
      anchor_id: anchor.id,
    });

    (navigation as any).navigate('ConfirmBurn', {
      anchorId: anchor.id,
      intention: anchor.intentionText,
      sigilSvg: anchor.baseSigilSvg,
      enhancedImageUrl: anchor.enhancedImageUrl,
    });
  }, [anchor, isReleased, navigation]);

  const handleDeveloperDeletePress = useCallback((): void => {
    if (!anchor || !developerModeEnabled || !developerDeleteWithoutBurnEnabled) return;

    Alert.alert(
      'Delete Anchor (Developer)',
      'Delete this anchor immediately without burn ritual?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeletingAnchor(true);
            try {
              await del(`/api/anchors/${anchor.id}`);
              removeAnchor(anchor.id);

              AnalyticsService.track(AnalyticsEvents.ANCHOR_DELETED, {
                anchor_id: anchor.id,
                source: 'developer_settings',
                sync: 'server',
              });

              navigation.popToTop();
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';

              ErrorTrackingService.captureMessage(
                `Developer delete fell back to local-only removal: ${errorMessage}`,
                ErrorSeverity.Warning
              );

              // Dev delete should still succeed locally when backend sync is unavailable.
              removeAnchor(anchor.id);
              AnalyticsService.track(AnalyticsEvents.ANCHOR_DELETED, {
                anchor_id: anchor.id,
                source: 'developer_settings',
                sync: 'local_fallback',
              });
              Alert.alert(
                'Deleted Locally',
                'Anchor was deleted on this device but failed to sync to backend.'
              );
              navigation.popToTop();
            }
          },
        },
      ]
    );
  }, [anchor, developerDeleteWithoutBurnEnabled, developerModeEnabled, navigation, removeAnchor]);

  // Error state
  if (!anchor) {
    if (isDeletingAnchor) {
      return <SafeAreaView style={styles.container} />;
    }

    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Anchor not found</Text>
      </SafeAreaView>
    );
  }

  const categoryConfig = CATEGORY_CONFIG[anchor.category] || CATEGORY_CONFIG.custom;
  const statusChip = getStatusChip(anchorState);
  const dashboardHeadline = getDashboardHeadline(anchorState, hasIgnited);
  const streakDisplay = activationsThisWeek > 0 ? '1 day' : '0 days';

  const renderDashboardContent = () => (
    <>
      {/* State headline */}
      <Text
        style={styles.meaningText}
        accessibilityLabel={`Anchor state: ${statusChip.label}`}
      >
        {dashboardHeadline}
      </Text>

      {/* 2-column stat grid */}
      <View style={styles.dashboardGrid}>
        <View
          style={styles.dashboardStatItem}
          accessible
          accessibilityLabel={`Last activated: ${meaningCopy.lastActivatedText}`}
        >
          <Text style={styles.statLabel}>LAST ACTIVATED</Text>
          <Text style={styles.statValue}>{meaningCopy.lastActivatedText}</Text>
        </View>
        <View
          style={styles.dashboardStatItem}
          accessible
          accessibilityLabel={`Streak: ${streakDisplay}`}
        >
          <Text style={styles.statLabel}>STREAK</Text>
          <Text style={styles.statValue}>{streakDisplay}</Text>
        </View>
      </View>

      {/* Today row */}
      <View
        style={styles.todayRow}
        accessible
        accessibilityLabel={todayActivated ? 'Today: Activated' : 'Today: Not yet activated'}
      >
        <Text style={styles.statLabel}>TODAY</Text>
        <Text style={[
          styles.todayValue,
          { color: todayActivated ? colors.gold : colors.text.secondary },
        ]}>
          {todayActivated ? 'Activated' : 'Not yet'}
        </Text>
      </View>

      {/* Distilled letters with info icon */}
      <View style={styles.dashboardDivider} />
      <TouchableOpacity
        style={styles.distilledContainer}
        onPress={() => {
          safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
          setDistilledModalVisible(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Distilled letters: ${anchor.distilledLetters.join(' ')}. Tap for info.`}
      >
        <Text style={styles.distilledLabel}>
          Distilled: {anchor.distilledLetters.join(' ')}{' '}
          <Text style={styles.infoIcon}>ⓘ</Text>
        </Text>
      </TouchableOpacity>
    </>
  );

  const shimmerTranslateX = liveShimmerProgress.interpolate({
    inputRange: [-1, 1],
    outputRange: [-320, 320],
  });

  return (
    <View style={styles.container}>
      <ZenBackground showOrbs={true} orbOpacity={0.1} animationDuration={800} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Header Card */}
          <View style={styles.headerCard}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill}>
                <View style={styles.goldLeftBorder} />
                <View style={styles.headerContent}>
                  <Text style={styles.intentionText}>
                    {reduceIntentionVisibility
                      ? `"${anchor.mantraText || 'Intention Obscured'}"`
                      : `"${anchor.intentionText}"`}
                  </Text>

                  <View style={styles.badgeRow}>
                    <View style={styles.badgeWrapper}>
                      <BlurView intensity={18} tint="dark" style={styles.blurBadge}>
                        <View style={[styles.badgeInner, { backgroundColor: `${categoryConfig.color}15` }]}>
                          <Text style={styles.categoryEmoji}>{categoryConfig.emoji}</Text>
                          <Text style={[styles.categoryText, { color: categoryConfig.color }]}>
                            {categoryConfig.label}
                          </Text>
                        </View>
                      </BlurView>
                    </View>

                    <View style={styles.badgeWrapper}>
                      <BlurView intensity={18} tint="dark" style={styles.blurBadge}>
                        <View style={[styles.badgeInner, { backgroundColor: `${statusChip.color}18` }]}>
                          <Text style={styles.categoryEmoji}>{statusChip.icon}</Text>
                          <Text style={[styles.categoryText, { color: statusChip.color }]}>
                            {statusChip.label}
                          </Text>
                        </View>
                      </BlurView>
                    </View>
                  </View>
                </View>
              </BlurView>
            ) : (
              <View style={[styles.androidHeaderFallback, { backgroundColor: 'rgba(12, 17, 24, 0.92)' }]}>
                <View style={styles.goldLeftBorder} />
                <View style={styles.headerContent}>
                  <Text style={styles.intentionText}>
                    {reduceIntentionVisibility
                      ? `"${anchor.mantraText || 'Intention Obscured'}"`
                      : `"${anchor.intentionText}"`}
                  </Text>

                  <View style={styles.badgeRow}>
                    <View
                      style={[styles.categoryBadgeCompact, { backgroundColor: categoryConfig.color + '20' }]}
                    >
                      <Text style={styles.categoryEmoji}>{categoryConfig.emoji}</Text>
                      <Text style={[styles.categoryText, { color: categoryConfig.color }]}>
                        {categoryConfig.label}
                      </Text>
                    </View>

                    <View style={[styles.categoryBadgeCompact, { backgroundColor: `${statusChip.color}20` }]}>
                      <Text style={styles.categoryEmoji}>{statusChip.icon}</Text>
                      <Text style={[styles.categoryText, { color: statusChip.color }]}>
                        {statusChip.label}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* NEW: Animated Sigil Hero Card */}
          <SigilHeroCard
            anchor={anchor}
            anchorState={anchorState}
            reduceMotionEnabled={reduceMotionEnabled}
            activationRippleNonce={activationRippleNonce}
            deepChargeHaloActive={hasIgnited && !isReleased && (isDeepChargeExpanded || anchorState === 'active')}
          />

          {/* Ritual Dashboard */}
          <View style={styles.statsCard}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill}>
                <View style={styles.goldLeftBorder} />
                <View style={styles.statsContent}>
                  {renderDashboardContent()}
                </View>
              </BlurView>
            ) : (
              <View style={[styles.androidStatsFallback, { backgroundColor: 'rgba(12, 17, 24, 0.92)' }]}>
                <View style={styles.goldLeftBorder} />
                <View style={styles.statsContent}>
                  {renderDashboardContent()}
                </View>
              </View>
            )}
            {hasIgnited && !isReleased && !reduceMotionEnabled && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.liveShimmerOverlay,
                  { transform: [{ translateX: shimmerTranslateX }] },
                ]}
              >
                <LinearGradient
                  colors={['transparent', 'rgba(212, 175, 55, 0.16)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            )}
          </View>

          {/* Ritual Actions */}
          <View style={styles.actionContainer}>
            <Text style={styles.actionsTitle}>Ritual Actions</Text>
            {isReleased ? (
              <>
                <View style={[styles.primaryButtonContainer, styles.disabledButton]}>
                  <Text style={styles.disabledButtonText}>Anchor released</Text>
                </View>
                <Text style={styles.microcopy}>
                  This closes the loop. You can't reactivate this anchor after release.
                </Text>
              </>
            ) : !hasIgnited ? (
              <>
                <View style={styles.primaryButtonContainer}>
                  {!reduceMotionEnabled && (
                    <Animated.View
                      pointerEvents="none"
                      style={[styles.primaryButtonPulse, { opacity: primaryButtonPulseOpacity }]}
                    />
                  )}
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleChargePress}
                    accessibilityRole="button"
                    accessibilityLabel="Ignite Anchor"
                    accessibilityHint="Starts your first 1 to 30 minute charge."
                  >
                    <Text style={styles.primaryButtonText}>Ignite Anchor</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.microcopy}>1–30 minutes · first charge</Text>
              </>
            ) : (
              <>
                <View style={styles.primaryButtonContainer}>
                  {!reduceMotionEnabled && (
                    <Animated.View
                      pointerEvents="none"
                      style={[styles.primaryButtonPulse, { opacity: primaryButtonPulseOpacity }]}
                    />
                  )}
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleActivatePress}
                    accessibilityRole="button"
                    accessibilityLabel="Activate now"
                    accessibilityHint="Starts a focused activation in one tap."
                  >
                    <View style={styles.primaryButtonInner}>
                      <Zap size={18} color={colors.charcoal} />
                      <Text style={styles.primaryButtonText}>Activate now</Text>
                    </View>
                  </TouchableOpacity>
                </View>
                <Text style={styles.actionHelperText}>10–60s • instant activation</Text>
                <PresetChips
                  chips={ACTIVATION_PRESETS}
                  selectedKey={activationPresetKey}
                  onSelect={handleActivationPresetSelect}
                  style={styles.activationPresetsRow}
                />
                <TouchableOpacity
                  onPress={() => navigation.navigate('DefaultActivation')}
                  accessibilityRole="button"
                  accessibilityLabel="Save as default activation preset"
                  style={styles.savePresetLink}
                >
                  <Text style={styles.savePresetText}>★ Save as default</Text>
                </TouchableOpacity>
                <Text style={styles.microcopy}>Fast reset. One clean start.</Text>

                <View style={styles.deepChargeModule}>
                  <TouchableOpacity
                    style={styles.deepChargeHeader}
                    onPress={handleDeepChargeExpandPress}
                    accessibilityRole="button"
                    accessibilityLabel="Reinforce"
                    accessibilityHint="Expands reinforcement options including duration and mantra audio."
                  >
                    <View style={styles.deepChargeHeaderContent}>
                      <Text style={styles.deepChargeTitle}>Reinforce</Text>
                      <Text style={styles.deepChargeHelperText}>2–20m • deepen the imprint</Text>
                    </View>
                    {isDeepChargeExpanded ? (
                      <ChevronUp size={20} color={colors.gold} />
                    ) : (
                      <ChevronDown size={20} color={colors.gold} />
                    )}
                  </TouchableOpacity>
                  <Text style={styles.deepChargeMicrocopy}>{deepChargeMicrocopy}</Text>

                  {isDeepChargeExpanded && (
                    <>
                      <View style={styles.durationChipsRow}>
                        {DEEP_CHARGE_PRESETS.map((preset) => {
                          const isSelected = deepChargePreset === preset.key;
                          return (
                            <TouchableOpacity
                              key={preset.key}
                              style={[styles.durationChip, isSelected && styles.durationChipSelected]}
                              onPress={() => handleDeepChargePresetPress(preset.key)}
                              accessibilityRole="button"
                              accessibilityLabel={`${preset.label} duration`}
                              accessibilityState={{ selected: isSelected }}
                            >
                              <Text style={[styles.durationChipText, isSelected && styles.durationChipTextSelected]}>
                                {preset.key === 'custom' && isSelected
                                  ? `Custom ${clampDeepChargeMinutes(customDeepChargeMinutes)}m`
                                  : preset.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <View style={styles.mantraToggleRow}>
                        <View style={styles.mantraToggleCopy}>
                          <Text style={styles.mantraToggleTitle}>Mantra audio</Text>
                          <Text style={styles.mantraToggleDescription}>Repeat softly during session</Text>
                        </View>
                        <Switch
                          value={mantraAudioEnabled}
                          onValueChange={setMantraAudioEnabled}
                          thumbColor={colors.bone}
                          trackColor={{
                            false: 'rgba(255, 255, 255, 0.2)',
                            true: colors.gold,
                          }}
                          ios_backgroundColor="rgba(255, 255, 255, 0.2)"
                          accessibilityRole="switch"
                          accessibilityState={{ checked: mantraAudioEnabled }}
                          accessibilityLabel="Mantra audio"
                          accessibilityHint="When enabled, your mantra repeats during deep charge."
                        />
                      </View>

                      <TouchableOpacity
                        style={styles.deepChargeStartButton}
                        onPress={handleBeginDeepCharge}
                        accessibilityRole="button"
                        accessibilityLabel="Begin Reinforce"
                        accessibilityHint="Starts a longer reinforce session with selected options."
                      >
                        <Text style={styles.deepChargeStartButtonText}>Begin Reinforce</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>

                <View style={styles.burnDivider} />
                <TouchableOpacity
                  style={styles.burnButton}
                  onPress={handleBurnPress}
                  accessibilityRole="button"
                  accessibilityLabel="Burn and Release"
                  accessibilityHint="Permanently closes this anchor."
                >
                  <Text style={styles.burnButtonText}>🔥 Burn & Release</Text>
                </TouchableOpacity>
              </>
            )}
            {developerModeEnabled && developerDeleteWithoutBurnEnabled && (
              <TouchableOpacity
                style={styles.devDeleteButton}
                onPress={handleDeveloperDeletePress}
                accessibilityRole="button"
                accessibilityLabel="Delete Anchor (Developer)"
              >
                <Text style={styles.devDeleteButtonText}>Delete Anchor (Dev)</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* NEW: Practice Path Card */}
          <PracticePathCard
            anchor={anchor}
            anchorState={anchorState}
            activationsThisWeek={activationsThisWeek}
          />

          {/* Physical Anchor Card */}
          <PhysicalAnchorCard
            anchor={anchor}
            hasActivations={anchor.activationCount >= 1}
          />

          {/* Footer */}
          <Text style={styles.createdText}>
            Created {format(new Date(anchor.createdAt), 'MMMM d, yyyy')}
          </Text>
        </ScrollView>

        {/* NEW: Distilled Letters Modal */}
        <DistilledLettersModal
          visible={distilledModalVisible}
          onClose={() => setDistilledModalVisible(false)}
          distilledLetters={anchor.distilledLetters}
        />
        <CustomDurationSheet
          visible={customDurationSheetVisible}
          mode="charge"
          initialValue={clampDeepChargeMinutes(customDeepChargeMinutes)}
          onCancel={() => setCustomDurationSheetVisible(false)}
          onConfirm={handleCustomDurationConfirm}
          reduceMotion={reduceMotionEnabled}
        />
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 0,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.md,
  },
  headerCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  goldLeftBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.gold,
  },
  androidHeaderFallback: {
    backgroundColor: 'rgba(12, 17, 24, 0.82)',
  },
  headerContent: {
    padding: spacing.md,
    alignItems: 'center',
  },
  intentionText: {
    fontSize: typography.sizes.h3,
    fontFamily: typography.fonts.heading,
    color: colors.bone,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: typography.lineHeights.h3,
    letterSpacing: 0.5,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
    marginHorizontal: spacing.xs,
    marginBottom: spacing.sm,
  },
  blurBadge: {
    overflow: 'hidden',
  },
  badgeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    marginBottom: spacing.md,
  },
  categoryBadgeCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    marginHorizontal: spacing.xs,
    marginBottom: spacing.sm,
  },
  categoryEmoji: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  categoryText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    fontWeight: '600',
  },
  chargedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gold + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
  },
  chargedEmoji: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  chargedText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.gold,
    fontWeight: '600',
    marginRight: spacing.xs,
  },
  chargedDate: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
  },
  statsCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.24)',
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
  },
  liveShimmerOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 120,
    transform: [{ rotate: '-12deg' }],
  },
  androidStatsFallback: {
    backgroundColor: 'rgba(12, 17, 24, 0.82)',
  },
  statsContent: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  meaningText: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  statsRow: {
    marginBottom: spacing.md,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  statValue: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fonts.body,
    color: colors.text.primary,
    fontWeight: '600',
  },
  distilledContainer: {
    paddingVertical: spacing.sm,
  },
  distilledLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  infoIcon: {
    fontSize: 14,
    color: colors.gold,
  },
  actionContainer: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  actionsTitle: {
    width: '100%',
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: spacing.sm,
  },
  primaryButtonContainer: {
    width: '100%',
    position: 'relative',
    marginBottom: spacing.xs,
  },
  primaryButtonPulse: {
    position: 'absolute',
    top: -6,
    right: -6,
    bottom: -6,
    left: -6,
    borderRadius: 16,
    backgroundColor: 'rgba(212, 175, 55, 0.42)',
  },
  primaryButton: {
    backgroundColor: colors.gold,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.xs,
    width: '100%',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  primaryButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  disabledButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  disabledButtonText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  primaryButtonText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.charcoal,
    fontWeight: '700',
  },
  actionHelperText: {
    alignSelf: 'flex-start',
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  microcopy: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
    marginBottom: spacing.md,
    fontStyle: 'italic',
  },
  activationPresetsRow: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  savePresetLink: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  savePresetText: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.gold,
    opacity: 0.75,
  },
  deepChargeModule: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.34)',
    backgroundColor: 'rgba(16, 22, 30, 0.52)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 3,
  },
  deepChargeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  deepChargeHeaderContent: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  deepChargeTitle: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.gold,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  deepChargeHelperText: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
  },
  deepChargeMicrocopy: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
  },
  durationChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  durationChip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  durationChipSelected: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(212, 175, 55, 0.16)',
  },
  durationChipText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  durationChipTextSelected: {
    color: colors.gold,
    fontWeight: '600',
  },
  mantraToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  mantraToggleCopy: {
    flex: 1,
    paddingRight: spacing.md,
  },
  mantraToggleTitle: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  mantraToggleDescription: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
  },
  deepChargeStartButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  deepChargeStartButtonText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.gold,
    fontWeight: '600',
  },
  burnDivider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  burnButton: {
    backgroundColor: 'rgba(122, 83, 71, 0.08)',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(201, 162, 138, 0.28)',
    width: '100%',
  },
  burnButtonText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  devDeleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    marginTop: spacing.md,
    width: '100%',
  },
  devDeleteButtonText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.error,
    fontWeight: '700',
  },
  createdText: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  errorText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
  // Ritual Dashboard
  dashboardGrid: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    gap: spacing.lg,
  },
  dashboardStatItem: {
    flex: 1,
    alignItems: 'flex-start',
  },
  todayRow: {
    marginBottom: spacing.sm,
  },
  todayValue: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fonts.body,
    fontWeight: '600',
  },
  dashboardDivider: {
    height: 1,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    marginVertical: spacing.sm,
  },
});
