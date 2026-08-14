// @ts-nocheck
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  InteractionManager,
  StatusBar,
  Image,
  Alert,
  Modal,
  Pressable,
  Share,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, isToday } from 'date-fns';
import { SvgXml } from 'react-native-svg';
import { ChevronLeft, ChevronRight, Info, MoreHorizontal, Share2, X, Zap } from 'lucide-react-native';
import { MoreRitualsSheet, RitualType } from '@/components/MoreRitualsSheet';
import { useToast } from '@/components/ToastProvider';
import { usePracticeEntry } from '@/hooks/usePracticeEntry';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { ENABLE_MERCH } from '@/config';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSessionStore } from '@/stores/sessionStore';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { del, post } from '@/services/ApiClient';
import {
  requestPhotoLibrarySavePermission,
  savePngToPhotoLibrary,
} from '@/services/AnchorArtworkExportService';
import { captureRef } from 'react-native-view-shot';
import { safeHaptics } from '@/utils/haptics';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography } from '@/theme';
import { MicroTeachHintRow, MicroTeachInfoChip } from '@/components/teaching';
import { useTeachingGate } from '@/utils/useTeachingGate';
import { calculateStreak } from '@/utils/streakHelpers';
import { selectCanonicalPracticeEvents } from '@/utils/practiceMetrics';
import { eventMatchesAnchor, formatWeaveDuration } from '@/screens/weave/weaveData';
import Reanimated, {
  Easing as ReanimatedEasing,
  cancelAnimation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { DivineSigilAura } from './components/DivineSigilAura';
import {
  ChargedGlowCanvas,
  SigilSvg,
  ZenBackground,
} from '@/components/common';
import { useAppPerformanceTier } from '@/hooks/useAppPerformanceTier';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { resolveBurnArtworkUri } from '@/screens/rituals/utils/resolveBurnArtworkUri';
import { ExportAnchorSheet } from '@/components/ExportAnchorSheet';
import {
  ThreadStrengthSheet,
  resolveAnchorStrengthPct,
} from '@/components/ThreadStrengthSheet';
import { ConfirmUnchargedBurnSheet } from '@/components/modals/ConfirmUnchargedBurnSheet';
import { ConfirmDeleteAnchorSheet } from '@/components/modals/ConfirmDeleteAnchorSheet';
import ShareCardRenderer from '@/components/ShareCardRenderer';
import { useShareCard } from '@/hooks/useShareCard';
import { logger } from '@/utils/logger';

const { width: SCREEN_W } = Dimensions.get('window');
const SIGIL_CIRCLE_SIZE = Math.round(SCREEN_W * 0.62);

// ─── TOKENS ──────────────────────────────────────────────
const C = {
  gold: colors.gold,
  goldBright: '#f0cb6a',
  goldDim: colors.bronze,
  goldBorder: colors.practice.cardFeaturedBorder,
  purpleDeep: colors.background.primary,
  purpleMid: colors.background.primary,
  purpleCard: colors.practice.cardSecondarySurface,
  purpleBorder: colors.practice.cardSecondaryBorder,
  textPrimary: colors.text.primary,
  textSec: colors.text.secondary,
  textDim: colors.text.tertiary,
  silverDim: 'rgba(184,184,184,0.45)',
  red: 'rgba(232,140,140,0.9)',
  redBorder: 'rgba(200,80,80,0.3)',
  burn: 'rgba(243,176,112,0.92)',
  burnBorder: 'rgba(200,100,40,0.3)',
};

const CARD_GRADIENT = [
  colors.practice.cardSecondarySurface,
  colors.practice.cardSecondarySurface,
];
const MINI_WEEK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const CATEGORY_LABELS = {
  career: 'Career',
  health: 'Health',
  wealth: 'Wealth',
  relationships: 'Love',
  personal_growth: 'Growth',
  desire: 'Desire',
  experience: 'Experience',
  custom: 'Custom',
};

const getDateValue = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const formatDate = (value, pattern = 'MMMM d, yyyy') => {
  const date = getDateValue(value);
  if (!date) return null;
  return format(date, pattern);
};

const localDateString = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const isoWeekKey = (d) => {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayOfWeek = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

const toDisplayAnchor = (rawAnchor) => {
  if (!rawAnchor) return null;

  const lastActivatedDate = getDateValue(rawAnchor.lastActivatedAt);

  const intention =
    rawAnchor.intention ?? rawAnchor.intentionText ?? 'No intention set';

  const categoryKey = rawAnchor.category ?? 'custom';
  const categoryLabel =
    CATEGORY_LABELS[categoryKey] ?? String(categoryKey).replace(/_/g, ' ');

  const distilled = rawAnchor.distilled ?? rawAnchor.distilledLetters ?? [];

  const charged = Boolean(rawAnchor.charged ?? rawAnchor.isCharged);
  const released = Boolean(rawAnchor.isReleased);
  const todayActivated =
    rawAnchor.today ??
    (lastActivatedDate && isToday(lastActivatedDate) ? 'Primed' : null);

  return {
    id: rawAnchor.id,
    name:
      rawAnchor.name ??
      rawAnchor.title ??
      (intention.length > 36 ? `${intention.slice(0, 36)}…` : intention),
    intention,
    category: categoryLabel,
    charged,
    isReleased: released,
    releasedAt:
      formatDate(rawAnchor.releasedAt, 'MMMM d, yyyy') ??
      (rawAnchor.releasedAt ? String(rawAnchor.releasedAt) : null),
    lastActivated:
      rawAnchor.lastActivated ??
      formatDate(rawAnchor.lastActivatedAt, 'MMM d, yyyy'),
    streak: rawAnchor.streak ?? (todayActivated ? 1 : 0),
    today: todayActivated,
    distilled,
    sigilUri: rawAnchor.sigilUri ?? rawAnchor.enhancedImageUrl ?? null,
    createdAt:
      formatDate(rawAnchor.createdAt, 'MMMM d, yyyy') ??
      String(rawAnchor.createdAt ?? 'Unknown'),
    practiceCreate: rawAnchor.practiceCreate ?? true,
    practiceCharge: rawAnchor.practiceCharge ?? charged,
    practiceActivateDays:
      rawAnchor.practiceActivateDays ??
      Math.min(rawAnchor.activationCount ?? 0, 7),
    reinforcedSigilSvg: rawAnchor.reinforcedSigilSvg ?? null,
    baseSigilSvg: rawAnchor.baseSigilSvg ?? '',
    enhancedImageUrl: rawAnchor.enhancedImageUrl,
  };
};

// ─── FADE-UP WRAPPER ─────────────────────────────────────
const FadeUp = ({ children, delay = 0, animate = true }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    if (!animate) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 500,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [animate, delay, opacity, translateY]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
};

// ─── BREATHING GLOW (sigil bg) ───────────────────────────
const BreathingGlow = ({ animate = true }: { animate?: boolean }) => {
  const scale = useSharedValue(animate ? 0.97 : 1.0);
  const opacity = useSharedValue(animate ? 0.6 : 0.8);

  useEffect(() => {
    if (!animate) {
      cancelAnimation(scale);
      cancelAnimation(opacity);
      return;
    }

    scale.value = withRepeat(
      withTiming(1.03, {
        duration: 2200,
        easing: ReanimatedEasing.inOut(ReanimatedEasing.ease),
      }),
      -1,
      true,
    );

    opacity.value = withRepeat(
      withTiming(1.0, {
        duration: 2200,
        easing: ReanimatedEasing.inOut(ReanimatedEasing.ease),
      }),
      -1,
      true,
    );

    return () => {
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  }, [animate, opacity, scale]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Reanimated.View
      style={[StyleSheet.absoluteFillObject, style]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={[
          'rgba(140,90,220,0.18)',
          'rgba(201,168,76,0.07)',
          'transparent',
        ]}
        style={StyleSheet.absoluteFillObject}
      />
    </Reanimated.View>
  );
};

// ─── SHINE ANIMATION (activate button) ───────────────────
const ShineButton = ({ onPress, children, style, animate = true }) => {
  const shinePhase = useSharedValue(0);

  useEffect(() => {
    if (!animate) {
      cancelAnimation(shinePhase);
      return;
    }

    shinePhase.value = withRepeat(
      withTiming(1, { duration: 3400, easing: ReanimatedEasing.linear }),
      -1,
      false,
    );

    return () => cancelAnimation(shinePhase);
  }, [animate, shinePhase]);

  const shineStyle = useAnimatedStyle(() => {
    // 0 to 900ms = shine moves, 900ms to 3400ms = wait
    // So ratio is 900/3400 = 0.2647
    const progress = Math.min(1, shinePhase.value / 0.2647);
    return {
      transform: [
        {
          translateX: interpolate(
            progress,
            [0, 1],
            [-SCREEN_W, SCREEN_W * 1.5],
          ),
        },
      ],
    };
  });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={style}>
      <View style={{ overflow: 'hidden', borderRadius: 14 }}>
        <LinearGradient
          colors={['#b8920a', '#d4a820', '#c49a15']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.activateInner}
        >
          {children}
          {animate && (
            <Reanimated.View
              style={[s.shineSweep, shineStyle]}
              pointerEvents="none"
            />
          )}
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );
};

// ─── RITUAL COMPONENTS ──────────────────────────────────
const rs = StyleSheet.create({
  ritualCardShell: {
    marginHorizontal: 20,
    marginBottom: 12,
  },
  card: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.purpleBorder,
  },
  cardMuted: {
    borderColor: C.burnBorder,
  },
  cardDanger: {
    borderColor: C.redBorder,
  },
  ritualCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ritualCardIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  col: { flex: 1, paddingLeft: 14 },
  title: {
    color: '#e8dfc8',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  subtitle: {
    color: 'rgba(196,181,153,0.72)',
    fontSize: 13,
    marginTop: 2,
    fontFamily: 'Inter-Regular',
  },
  helper: {
    color: 'rgba(220,205,176,0.6)',
    fontSize: 12,
    marginTop: 2,
    fontStyle: 'italic',
    fontFamily: 'Inter-Regular',
  },
  heroContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    position: 'relative',
  },
  heroHalo: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 22,
    opacity: 0.6,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  modalTitle: {
    color: C.goldBright,
    fontSize: 22,
    fontFamily: 'Cinzel-Bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalBody: {
    color: C.textSec,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'Inter-Regular',
  },
  modalActions: { gap: 12 },
  modalBtnPrimary: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  modalBtnGrad: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalBtnTextPrimary: {
    color: '#000',
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    letterSpacing: 1,
  },
  modalBtnSecondary: {
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
  },
  modalBtnTextSecondary: {
    color: C.textPrimary,
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
  modalBtnCancel: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalBtnTextCancel: {
    color: C.textDim,
    fontFamily: 'Inter-Medium',
    fontSize: 14,
  },
});

const RitualCard = ({
  icon,
  title,
  subtitle,
  helper,
  onPress,
  isMuted = false,
  isDanger = false,
  children,
}) => {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowOpacity: glowOpacity.value,
    shadowColor: isDanger ? C.red : isMuted ? C.burn : C.gold,
    shadowRadius: interpolate(glowOpacity.value, [0, 1], [4, 12]),
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.97, { duration: 150 });
    glowOpacity.value = withTiming(0.6, { duration: 150 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 250 });
    glowOpacity.value = withTiming(0, { duration: 250 });
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Reanimated.View style={[rs.ritualCardShell, animatedStyle]}>
        <LinearGradient
          colors={
            isDanger
              ? ['rgba(116,28,28,0.3)', 'rgba(78,16,16,0.24)']
              : isMuted
                ? ['rgba(150,62,24,0.32)', 'rgba(102,36,12,0.28)']
                : CARD_GRADIENT
          }
          style={[rs.card, isDanger && rs.cardDanger, isMuted && rs.cardMuted]}
        >
          <View style={rs.ritualCardHeader}>
            <View style={rs.ritualCardIconWrapper}>
              <Text style={{ fontSize: 20 }}>{icon}</Text>
            </View>
            <View style={rs.col}>
              <Text
                style={[
                  rs.title,
                  isDanger && { color: C.red },
                  isMuted && { color: C.burn },
                ]}
              >
                {title}
              </Text>
              {subtitle && <Text style={rs.subtitle}>{subtitle}</Text>}
              {helper && (
                <Text
                  style={[
                    rs.helper,
                    isDanger && { color: 'rgba(232,140,140,0.7)' },
                  ]}
                >
                  {helper}
                </Text>
              )}
            </View>
          </View>
          {children}
        </LinearGradient>
      </Reanimated.View>
    </TouchableOpacity>
  );
};

const PrimerModal = ({
  visible,
  onActivate,
  onSkip,
  onCancel,
  blurIntensity = 30,
}) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={rs.modalOverlay}>
      <BlurView
        intensity={blurIntensity}
        tint="dark"
        style={StyleSheet.absoluteFillObject}
      />
      <View style={rs.modalContent}>
        <LinearGradient
          colors={CARD_GRADIENT}
          style={[rs.card, { padding: 24, paddingVertical: 32 }]}
        >
          <Text style={rs.modalTitle}>Primer Session</Text>
          <Text style={rs.modalBody}>
            Primer: 10 seconds to bring it online.
          </Text>

          <View style={rs.modalActions}>
            <TouchableOpacity style={rs.modalBtnPrimary} onPress={onActivate}>
              <LinearGradient
                colors={['#b8920a', '#d4a820', '#c49a15']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={rs.modalBtnGrad}
              >
                <Text style={rs.modalBtnTextPrimary}>ACTIVATE (10s)</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={rs.modalBtnSecondary} onPress={onSkip}>
              <Text style={rs.modalBtnTextSecondary}>
                Skip straight to Reinforce
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={rs.modalBtnCancel} onPress={onCancel}>
              <Text style={rs.modalBtnTextCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    </View>
  </Modal>
);

const MiniWeekTrack = ({ weekHistory, lastPrimedAt }) => {
  const todayIdx = (new Date().getDay() + 6) % 7;
  const primedToday = lastPrimedAt === localDateString(new Date());

  return (
    <View style={s.miniDayRow}>
      {MINI_WEEK_DAYS.map((day, index) => {
        const primed = weekHistory[index] ?? false;
        const isToday = index === todayIdx;
        const isFuture = index > todayIdx;

        return (
          <View key={`${day}-${index}`} style={s.miniDayCol}>
            <Text style={s.miniDayLetter}>{day}</Text>
            <View
              style={[
                s.miniDayDot,
                primed && s.miniDayDotDone,
                isToday && !primed && s.miniDayDotToday,
                isFuture && s.miniDayDotFuture,
                isToday && primedToday && s.miniDayDotTodayDone,
              ]}
            />
          </View>
        );
      })}
    </View>
  );
};

const AnchorDetailsScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const perfTier = useAppPerformanceTier();
  const reduceMotionEnabled = useReduceMotionEnabled();
  const isLowPerfDevice = perfTier === 'low';
  const isReducedEffectsDevice = perfTier !== 'high';
  const shouldAnimateIntro = perfTier === 'high' && !reduceMotionEnabled;
  const { startPractice } = usePracticeEntry();
  const { navigateToPractice } = useTabNavigation();
  const toast = useToast();
  const anchorReuseTeaching = useTeachingGate({
    screenId: 'anchor_detail',
    candidateIds: ['anchor_reuse_v1'],
  });
  const getAnchorById = useAnchorStore((state) => state.getAnchorById);
  const removeAnchor = useAnchorStore((state) => state.removeAnchor);
  const isAnchorStoreLoading = useAnchorStore((state) => state.isLoading);
  const anchorStoreError = useAnchorStore((state) => state.error);
  const defaultActivation = useSettingsStore((s) => s.defaultActivation);
  const setDefaultActivation = useSettingsStore((s) => s.setDefaultActivation);
  const practiceHistory = useSessionStore((s) => s.practiceHistory);
  const accountId = useAuthStore((s) => s.user?.id ?? null);
  const [isReady, setIsReady] = useState(false);
  const [activeDuration, setActiveDuration] = useState('30s');
  const [primerVisible, setPrimerVisible] = useState(false);
  const [moreRitualsVisible, setMoreRitualsVisible] = useState(false);
  const isScrollActiveRef = useRef(false);
  const [pendingExportAction, setPendingExportAction] = useState<
    'download' | 'wallpaper' | null
  >(null);
  const anchorCardRef = useRef<View>(null);
  const [isExporting, setIsExporting] = useState(false);
  const mediaLibraryPermissionGrantedRef = useRef(false);
  const [showExportSheet, setShowExportSheet] = useState(false);
  const [confirmUnchargedBurnVisible, setConfirmUnchargedBurnVisible] =
    useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [threadStrengthSheetVisible, setThreadStrengthSheetVisible] =
    useState(false);
  const [detailOptionsVisible, setDetailOptionsVisible] = useState(false);
  const [distilledFormSheetVisible, setDistilledFormSheetVisible] = useState(false);
  const [weaveInfoSheetVisible, setWeaveInfoSheetVisible] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const [shareFormat, setShareFormat] = useState<'square' | 'stories'>(
    'square',
  );
  const shareCardRef = useRef(null);
  const shareCardRenderedRef = useRef(false);
  const shareCardTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const {
    captureAndShare,
    isLoading: isShareCardLoading,
    setIsRendered: setShareCardRendered,
  } = useShareCard(shareCardRef, shareCardRenderedRef);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setIsReady(true);
    });
    return () => task.cancel();
  }, []);

  useEffect(
    () => () => {
      if (shareCardTimeoutRef.current) {
        clearTimeout(shareCardTimeoutRef.current);
      }
    },
    [],
  );

  // Permissions are requested lazily on export to avoid native-module errors
  // or unhandled rejections surfacing as a LogBox popup during navigation.

  const routeAnchor = route?.params?.anchor;
  const anchorId = route?.params?.anchorId ?? routeAnchor?.id;
  const storeAnchor = anchorId ? getAnchorById(anchorId) : null;
  const sourceAnchor = routeAnchor ?? storeAnchor;
  const anchor = useMemo(
    () =>
      toDisplayAnchor(sourceAnchor) ?? {
        id: anchorId,
        name: 'Untitled Anchor',
        intention: 'No intention found for this anchor.',
        category: 'Custom',
        charged: false,
        lastActivated: null,
        streak: 0,
        today: null,
        distilled: [],
        sigilUri: null,
        createdAt: 'Unknown',
        practiceCreate: true,
        practiceCharge: false,
        practiceActivateDays: 0,
        reinforcedSigilSvg: null,
        baseSigilSvg: '',
        enhancedImageUrl: null,
      },
    [sourceAnchor], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => {
    if (!anchorId) return;
    AnalyticsService.track(AnalyticsEvents.ANCHOR_DETAIL_VIEWED, {
      anchor_id: anchorId,
      source: routeAnchor ? 'navigation_params' : 'store',
      charged: Boolean(anchor.charged),
      released: Boolean(anchor.isReleased),
    });
  }, [anchorId]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolvedSigilSvg =
    anchor.reinforcedSigilSvg ?? anchor.baseSigilSvg ?? '';
  const anchorPractice = useMemo(() => {
    if (!anchorId) {
      return {
        currentStreak: 0,
        totalPrimingSessions: 0,
        lastPrimedAt: null,
        weekHistory: [false, false, false, false, false, false, false],
        practiceDays: 0,
        activeWeeks: 0,
        practicedSeconds: 0,
        modeCounts: { focus: 0, visualize: 0, deep_prime: 0, release: 0 },
        recentSessions: [],
      };
    }

    const currentWeekKey = isoWeekKey(new Date());
    const anchorAliases = [anchorId, sourceAnchor?.id, sourceAnchor?.localId];
    const primingSessions = selectCanonicalPracticeEvents(practiceHistory, accountId)
      .filter((entry) => eventMatchesAnchor(entry, anchorAliases))
      .sort(
        (a, b) =>
          new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
      );

    const weekHistoryForAnchor = [
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ];
    primingSessions.forEach((entry) => {
      const date = new Date(entry.completedAt);
      if (Number.isNaN(date.getTime()) || isoWeekKey(date) !== currentWeekKey)
        return;
      const dayIndex = (date.getDay() + 6) % 7;
      weekHistoryForAnchor[dayIndex] = true;
    });

    const currentStreak = calculateStreak(
      primingSessions.map((entry) => ({ createdAt: entry.completedAt })),
    ).currentStreak;

    return {
      currentStreak,
      totalPrimingSessions: primingSessions.length,
      lastPrimedAt: primingSessions[0]
        ? localDateString(new Date(primingSessions[0].completedAt))
        : null,
      weekHistory: weekHistoryForAnchor,
      practiceDays: new Set(primingSessions.map((entry) => entry.localDateKey)).size,
      activeWeeks: new Set(primingSessions.map((entry) => isoWeekKey(new Date(entry.completedAt)))).size,
      practicedSeconds: primingSessions.reduce((total, entry) => total + Math.max(0, entry.completedDurationSeconds || 0), 0),
      modeCounts: primingSessions.reduce((counts, entry) => ({ ...counts, [entry.practiceMode]: counts[entry.practiceMode] + 1 }), { focus: 0, visualize: 0, deep_prime: 0, release: 0 }),
      recentSessions: primingSessions.slice(0, 3),
    };
  }, [accountId, anchorId, practiceHistory, sourceAnchor?.id, sourceAnchor?.localId]);
  const threadStrengthValue = resolveAnchorStrengthPct({
    storedStrength: sourceAnchor?.threadStrength ?? null,
    totalSessions: anchorPractice.totalPrimingSessions,
    currentStreak: anchorPractice.currentStreak,
    thisWeekDays: MINI_WEEK_DAYS.map((day, index) => ({
      day,
      type: anchorPractice.weekHistory[index] ? 'focus' : 'empty',
      isToday: false,
    })),
  });
  const currentStreakUnit = anchorPractice.currentStreak === 1 ? 'Day' : 'Days';

  const divineBreath = useSharedValue(0);
  const divineGlowActive = Boolean(anchor.charged || anchor.today === 'Primed');
  const freezeDetailChrome =
    Platform.OS === 'android' && isScrollActiveRef.current;
  const pauseExpensiveEffects =
    freezeDetailChrome || isReducedEffectsDevice || reduceMotionEnabled;
  const enableDetailChromeGlow =
    Platform.OS !== 'android' && perfTier === 'high';
  const glowAnimationsActive = divineGlowActive && !pauseExpensiveEffects;
  const headerBlurIntensity =
    Platform.OS === 'ios'
      ? perfTier === 'high'
        ? 30
        : perfTier === 'medium'
          ? 12
          : 0
      : 0;

  useEffect(() => {
    if (!divineGlowActive) {
      cancelAnimation(divineBreath);
      divineBreath.value = 0;
      return;
    }

    if (pauseExpensiveEffects) {
      cancelAnimation(divineBreath);
      return;
    }

    divineBreath.value = withRepeat(
      withTiming(1, {
        duration: 1600,
        easing: ReanimatedEasing.inOut(ReanimatedEasing.sin),
      }),
      -1,
      true,
    );

    return () => {
      cancelAnimation(divineBreath);
    };
  }, [divineBreath, divineGlowActive, pauseExpensiveEffects]);

  const topCardPulseStyle = useAnimatedStyle(() => {
    if (!enableDetailChromeGlow) {
      return {
        borderColor: colors.practice.cardFeaturedBorder,
        shadowOpacity: 0,
        shadowRadius: 0,
      };
    }

    if (!glowAnimationsActive) {
      return {
        borderColor: C.purpleBorder,
        shadowOpacity: 0.08,
        shadowRadius: 12,
      };
    }

    return {
      borderColor: interpolateColor(
        divineBreath.value,
        [0, 1],
        ['rgba(201,168,76,0.28)', 'rgba(245,216,137,0.92)'],
      ),
      shadowColor: C.gold,
      shadowOpacity: interpolate(divineBreath.value, [0, 1], [0.12, 0.34]),
      shadowRadius: interpolate(divineBreath.value, [0, 1], [10, 20]),
    };
  }, [divineBreath, enableDetailChromeGlow, glowAnimationsActive]);

  const topCardAuraStyle = useAnimatedStyle(
    () => ({
      opacity:
        enableDetailChromeGlow && glowAnimationsActive
          ? interpolate(divineBreath.value, [0, 1], [0.12, 0.34])
          : 0,
    }),
    [divineBreath, enableDetailChromeGlow, glowAnimationsActive],
  );

  const statsCardPulseStyle = useAnimatedStyle(() => {
    if (!enableDetailChromeGlow) {
      return {
        borderColor: colors.practice.threadBorder,
        shadowOpacity: 0,
        shadowRadius: 0,
      };
    }

    if (!glowAnimationsActive) {
      return {
        borderColor: C.purpleBorder,
        shadowOpacity: 0.08,
        shadowRadius: 12,
      };
    }

    return {
      borderColor: interpolateColor(
        divineBreath.value,
        [0, 1],
        ['rgba(201,168,76,0.30)', 'rgba(255,228,148,0.96)'],
      ),
      shadowColor: C.gold,
      shadowOpacity: interpolate(divineBreath.value, [0, 1], [0.14, 0.4]),
      shadowRadius: interpolate(divineBreath.value, [0, 1], [12, 26]),
    };
  }, [divineBreath, enableDetailChromeGlow, glowAnimationsActive]);

  const statsCardAuraStyle = useAnimatedStyle(
    () => ({
      opacity:
        enableDetailChromeGlow && glowAnimationsActive
          ? interpolate(divineBreath.value, [0, 1], [0.14, 0.36])
          : 0,
    }),
    [divineBreath, enableDetailChromeGlow, glowAnimationsActive],
  );

  useEffect(() => {
    if (defaultActivation?.unit !== 'seconds') return;
    const value = defaultActivation.value;
    if (value <= 10) {
      setActiveDuration('10s');
      return;
    }
    if (value <= 30) {
      setActiveDuration('30s');
      return;
    }
    setActiveDuration('60s');
  }, [defaultActivation]);

  const getDurationSeconds = () => {
    if (activeDuration === '10s') return 10;
    if (activeDuration === '60s') return 60;
    return 30;
  };

  const handleActivatePress = () => {
    if (!anchorId) {
      Alert.alert(
        'Anchor unavailable',
        'This anchor could not be opened. Go back to your vault and try again.',
      );
      return;
    }

    startPractice({
      mode: 'focus',
      anchorId,
      source: 'anchor_detail',
      durationSeconds: getDurationSeconds(),
    });
  };

  const handleSaveDefault = () => {
    setDefaultActivation({
      ...defaultActivation,
      type: 'visual',
      unit: 'seconds',
      value: getDurationSeconds(),
    });
  };

  const handleReinforce = () => {
    if (!anchorId) return;
    if (!anchor.charged) {
      setPrimerVisible(true);
    } else {
      executeReinforce();
    }
  };

  const executeReinforce = () => {
    setPrimerVisible(false);
    startPractice({
      mode: 'deepPrime',
      anchorId,
      source: 'anchor_detail',
      durationSeconds: 300,
    });
  };

  const handlePrimerActivate = () => {
    setPrimerVisible(false);
    startPractice({
      mode: 'focus',
      anchorId,
      source: 'anchor_detail',
      durationSeconds: 10,
    });
  };

  const handleBurn = () => {
    if (!anchorId) return;

    if (!anchor.charged) {
      setConfirmUnchargedBurnVisible(true);
      return;
    }

    executeBurn();
  };

  const executeBurn = () => {
    if (!anchorId) return;
    setConfirmUnchargedBurnVisible(false);

    const burnAnchor = storeAnchor ?? sourceAnchor;

    startPractice({
      mode: 'release',
      anchorId,
      source: 'anchor_detail',
      intention:
        burnAnchor?.intentionText ?? burnAnchor?.intention ?? anchor.intention,
      sigilSvg:
        burnAnchor?.reinforcedSigilSvg ?? burnAnchor?.baseSigilSvg ?? '',
      enhancedImageUrl:
        anchor.sigilUri ||
        anchor.enhancedImageUrl ||
        burnAnchor?.enhancedImageUrl ||
        undefined,
    });
  };

  const handlePracticePress = () => {
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);
    if (anchorId) {
      startPractice({ mode: 'deepPrime', anchorId, source: 'anchor_detail' });
    }
  };

  const handleOpenWeave = () => {
    if (!anchorId) return;
    navigateToPractice('TheWeave', {
      origin: 'anchorDetail',
      originAnchorId: anchorId,
      initialScope: { kind: 'anchor', anchorId },
    });
  };

  const handleMoreRitualsPress = () => {
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    setMoreRitualsVisible(true);
  };

  const handleRitualSelect = (type: RitualType, durationSeconds?: number) => {
    setMoreRitualsVisible(false);
    if (!anchorId) return;

    if (type === 'burn') {
      handleBurn();
    } else if (type === 'quickActivate' || type === 'charge') {
      startPractice({
        mode: 'focus',
        anchorId,
        source: 'anchor_detail',
        durationSeconds: durationSeconds ?? (type === 'quickActivate' ? 30 : 180),
      });
    } else if (type === 'stabilize') {
      startPractice({
        mode: 'deepPrime',
        anchorId,
        source: 'anchor_detail',
        durationSeconds: durationSeconds ?? 180,
      });
    }
  };

  const handleDelete = () => {
    if (!anchorId) return;
    setConfirmDeleteVisible(true);
  };

  const confirmDeleteAnchor = async () => {
    if (!anchorId) return;

    setConfirmDeleteVisible(false);

    try {
      await del(`/api/anchors/${anchorId}`);
    } catch {
      // Keep local delete behavior even if backend is unreachable.
    }

    removeAnchor(anchorId);
    AnalyticsService.track(AnalyticsEvents.ANCHOR_DELETED, {
      anchor_id: anchorId,
      source: 'anchor_detail',
    });
    navigation.popToTop();
  };

  const ensureMediaLibraryPermission = async () => {
    if (mediaLibraryPermissionGrantedRef.current) return true;
    try {
      const granted = await requestPhotoLibrarySavePermission();
      mediaLibraryPermissionGrantedRef.current = granted;
      return granted;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (!pendingExportAction) return;

    let cancelled = false;

    const task = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(async () => {
          if (cancelled || !anchorCardRef.current) {
            if (!cancelled) {
              setPendingExportAction(null);
              setIsExporting(false);
            }
            return;
          }

          try {
            const granted = await ensureMediaLibraryPermission();
            if (!granted) {
              toast.warning('Allow photo library access to save your anchor');
              return;
            }

            const uri = await captureRef(anchorCardRef, {
              format: 'png',
              quality: 1,
            });
            const savedUri = await savePngToPhotoLibrary(
              uri,
              'anchor-wallpaper.png',
            );

            if (pendingExportAction === 'wallpaper') {
              await Share.share({ url: savedUri });
              toast.info(
                'Save the image, then set it as your wallpaper in Settings',
              );
            } else {
              toast.success('Anchor saved to your photo library');
            }
          } catch {
            toast.error(
              pendingExportAction === 'wallpaper'
                ? 'Could not open share sheet'
                : 'Could not save image. Check your permissions.',
            );
          } finally {
            if (!cancelled) {
              setPendingExportAction(null);
              setIsExporting(false);
            }
          }
        });
      });
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [pendingExportAction]);

  const handleDownloadPNG = async () => {
    if (isExporting) return;
    const granted = await ensureMediaLibraryPermission();
    if (!granted) {
      toast.warning('Allow photo library access to save your anchor');
      return;
    }
    setIsExporting(true);
    setPendingExportAction('download');
  };

  const handleSetWallpaper = async () => {
    if (isExporting) return;
    const granted = await ensureMediaLibraryPermission();
    if (!granted) {
      toast.warning('Allow photo library access to share your anchor');
      return;
    }
    setIsExporting(true);
    setPendingExportAction('wallpaper');
  };

  const handleShareAnchor = useCallback(() => {
    if (isShareCardLoading) {
      return;
    }

    if (shareCardTimeoutRef.current) {
      clearTimeout(shareCardTimeoutRef.current);
    }

    shareCardRenderedRef.current = false;
    setShareCardRendered(false);
    setShowShareCard(true);
    shareCardTimeoutRef.current = setTimeout(async () => {
      try {
        await captureAndShare(
          anchor.intention,
          anchorPractice.currentStreak,
          shareFormat,
        );
      } finally {
        setShowShareCard(false);
        shareCardRenderedRef.current = false;
        setShareCardRendered(false);
        shareCardTimeoutRef.current = null;
      }
    }, 250);
  }, [
    anchor.intention,
    anchorPractice.currentStreak,
    captureAndShare,
    isShareCardLoading,
    setShareCardRendered,
    shareFormat,
  ]);

  const handleHeroScrollStart = useCallback(() => {
    isScrollActiveRef.current = true;
  }, []);

  const handleHeroScrollStop = useCallback(() => {
    isScrollActiveRef.current = false;
  }, []);

  // Removed renderHeroAction and renderRitualCards in favor of the new Primary CTA architecture.

  const handleReportContent = () => {
    const imageUrl = anchor.sigilUri ?? anchor.enhancedImageUrl ?? '';
    if (!imageUrl || !anchor.id) return;

    Alert.alert('Report AI Content', 'Why are you reporting this anchor?', [
      {
        text: 'Inappropriate',
        onPress: () =>
          submitContentReport(anchor.id, imageUrl, 'inappropriate'),
      },
      {
        text: 'Harmful',
        onPress: () => submitContentReport(anchor.id, imageUrl, 'harmful'),
      },
      {
        text: 'Other',
        onPress: () => submitContentReport(anchor.id, imageUrl, 'other'),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const submitContentReport = async (
    anchorId: string,
    imageUrl: string,
    reason: string,
  ) => {
    try {
      await post('/content/flag', { anchorId, imageUrl, reason });
      Alert.alert('Reported', 'Thank you. Our team will review this content.');
    } catch {
      Alert.alert(
        'Report not sent',
        'Your report could not be submitted. Please try again.',
      );
    }
  };

  return (
    <AnchorDetailEditorialPage
      anchor={anchor}
      hasAnchor={Boolean(sourceAnchor)}
      isLoading={Boolean(isAnchorStoreLoading)}
      loadError={anchorStoreError}
      insets={insets}
      perfTier={perfTier}
      reduceMotionEnabled={reduceMotionEnabled}
      resolvedSigilSvg={resolvedSigilSvg}
      anchorPractice={anchorPractice}
      threadStrengthValue={threadStrengthValue}
      isExporting={isExporting}
      isShareCardLoading={isShareCardLoading}
      pendingExportAction={pendingExportAction}
      anchorCardRef={anchorCardRef}
      showOptions={detailOptionsVisible}
      showDistilledForm={distilledFormSheetVisible}
      showWeaveInfo={weaveInfoSheetVisible}
      showThreadStrength={threadStrengthSheetVisible}
      showExportSheet={showExportSheet}
      showConfirmDelete={confirmDeleteVisible}
      showConfirmRelease={confirmUnchargedBurnVisible}
      showShareCard={showShareCard}
      shareCardRef={shareCardRef}
      shareFormat={shareFormat}
      onBack={() => navigation?.goBack()}
      onOpenOptions={() => setDetailOptionsVisible(true)}
      onCloseOptions={() => setDetailOptionsVisible(false)}
      onOpenDistilledForm={() => setDistilledFormSheetVisible(true)}
      onCloseDistilledForm={() => setDistilledFormSheetVisible(false)}
      onOpenWeaveInfo={() => setWeaveInfoSheetVisible(true)}
      onCloseWeaveInfo={() => setWeaveInfoSheetVisible(false)}
      onOpenThreadStrength={() => setThreadStrengthSheetVisible(true)}
      onCloseThreadStrength={() => setThreadStrengthSheetVisible(false)}
      onOpenWeave={handleOpenWeave}
      onPractice={handlePracticePress}
      onShare={handleShareAnchor}
      onSetWallpaper={handleSetWallpaper}
      onSavePng={() => setShowExportSheet(true)}
      onCloseExport={() => setShowExportSheet(false)}
      onRelease={() => {
        setDetailOptionsVisible(false);
        handleBurn();
      }}
      onDelete={() => {
        setDetailOptionsVisible(false);
        handleDelete();
      }}
      onCloseDelete={() => setConfirmDeleteVisible(false)}
      onConfirmDelete={confirmDeleteAnchor}
      onCloseRelease={() => setConfirmUnchargedBurnVisible(false)}
      onConfirmRelease={executeBurn}
      onShareCardRendered={() => {
        shareCardRenderedRef.current = true;
        setShareCardRendered(true);
      }}
    />
  );

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      {isReady && (
        <ZenBackground
          variant="practice"
          showOrbs={perfTier === 'high'}
          showGrain
          showVignette
          performanceTier={perfTier}
        />
      )}

      {/* ── HEADER ── */}
      {headerBlurIntensity > 0 ? (
        <BlurView intensity={headerBlurIntensity} tint="dark" style={s.header}>
          <TouchableOpacity
            onPress={() => navigation?.goBack()}
            style={s.backBtn}
          >
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>ANCHOR DETAILS</Text>
        </BlurView>
      ) : (
        <View style={[s.header, s.headerFallback]}>
          <TouchableOpacity
            onPress={() => navigation?.goBack()}
            style={s.backBtn}
          >
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>ANCHOR DETAILS</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingBottom: insets.bottom + spacing.xl + spacing.sm },
        ]}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={handleHeroScrollStart}
        onMomentumScrollBegin={handleHeroScrollStart}
        onScrollEndDrag={handleHeroScrollStop}
        onMomentumScrollEnd={handleHeroScrollStop}
        scrollEventThrottle={16}
      >
        <View style={s.heroStack}>
          {/* ── TITLE CARD ── */}
          <FadeUp delay={50} animate={shouldAnimateIntro}>
            <Reanimated.View
              style={[
                s.animatedCardShell,
                Platform.OS === 'android' && s.animatedCardShellAndroid,
                isLowPerfDevice && s.lowPerfFlatCardShell,
                topCardPulseStyle,
              ]}
            >
              <LinearGradient
                colors={CARD_GRADIENT}
                style={[
                  s.card,
                  s.cardGold,
                  Platform.OS === 'android' && s.cardGoldAndroid,
                  isLowPerfDevice && s.lowPerfNoCardShadow,
                ]}
              >
                <Text style={s.anchorEyebrow}>CURRENT ANCHOR</Text>
                <Text style={s.intentionText}>{anchor.intention}</Text>
                <View style={s.badgeRow}>
                  <View style={s.badgeDesire}>
                    <View
                      style={[s.badgeDot, { backgroundColor: colors.gold }]}
                    />
                    <Text style={[s.badgeText, { color: colors.gold }]}>
                      {anchor.category}
                    </Text>
                  </View>
                  <View
                    style={[
                      s.badgeCharged,
                      Platform.OS === 'android' && s.badgeChargedAndroid,
                      anchor.isReleased
                        ? s.badgeReleased
                        : !anchor.charged && s.badgeDormant,
                    ]}
                  >
                    <Text style={s.badgeIcon}>
                      {anchor.isReleased ? '🔥' : anchor.charged ? '⚡' : '💤'}
                    </Text>
                    <Text
                      style={[
                        s.badgeText,
                        {
                          color: anchor.isReleased
                            ? colors.silver
                            : anchor.charged
                              ? C.goldBright
                              : C.textDim,
                        },
                      ]}
                    >
                      {anchor.isReleased
                        ? 'Released'
                        : anchor.charged
                          ? 'Primed'
                          : 'Dormant'}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
              {!isLowPerfDevice && (
                <Reanimated.View
                  pointerEvents="none"
                  style={[s.cardAuraOverlay, topCardAuraStyle]}
                >
                  <LinearGradient
                    colors={[
                      'rgba(255, 223, 133, 0.14)',
                      'rgba(245, 198, 82, 0.05)',
                      'rgba(255, 223, 133, 0.14)',
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                </Reanimated.View>
              )}
            </Reanimated.View>
          </FadeUp>

          {/* ── SIGIL CARD ── */}
          <FadeUp delay={120} animate={shouldAnimateIntro}>
            <View
              style={s.sigilAuraContainer}
              renderToHardwareTextureAndroid={freezeDetailChrome}
              needsOffscreenAlphaCompositing={freezeDetailChrome}
            >
              {/* DivineSigilAura only for uncharged — sits behind the card.
                  Low-tier devices skip the aura entirely to avoid extra
                  offscreen compositing and the visible halo artifact. */}
              {!anchor.charged && isReady && !isLowPerfDevice && (
                <View pointerEvents="none" style={s.sigilAuraCanvas}>
                  <DivineSigilAura
                    size={SCREEN_W * 1.25}
                    enabled
                    breath={divineBreath}
                    tier={pauseExpensiveEffects ? 'medium' : perfTier}
                  />
                </View>
              )}
              <View
                style={[
                  s.sigilCard,
                  Platform.OS === 'android' && s.sigilCardAndroid,
                  isLowPerfDevice && s.lowPerfNoSigilShadow,
                ]}
              >
                <LinearGradient
                  colors={['#1a0f35', '#0d0820', '#080510']}
                  style={s.sigilWrapper}
                >
                  {!divineGlowActive && !isLowPerfDevice && (
                    <BreathingGlow
                      animate={perfTier === 'high' && !pauseExpensiveEffects}
                    />
                  )}

                  {/* ChargedGlowCanvas fills inside the card for charged
                      anchors. Low-tier devices skip the glow entirely;
                      medium-tier keeps the Skia look but freezes per-frame updates. */}
                  {anchor.charged && perfTier !== 'low' && isReady && (
                    <ChargedGlowCanvas
                      size={SCREEN_W * 0.65}
                      reduceMotionEnabled={pauseExpensiveEffects}
                      tier={pauseExpensiveEffects ? 'medium' : perfTier}
                    />
                  )}

                  {/* Purple backdrop for charged anchors */}
                  {anchor.charged && <View style={s.chargedSigilBackdrop} />}

                  {anchor.sigilUri ? (
                    <Image
                      source={{ uri: anchor.sigilUri }}
                      style={[
                        s.sigilImage,
                        anchor.charged && s.chargedSigilImage,
                        anchor.isReleased && s.releasedSigilImage,
                      ]}
                      resizeMode="cover"
                    />
                  ) : resolvedSigilSvg ? (
                    <View
                      style={[
                        s.sigilPlaceholder,
                        Platform.OS === 'android' && s.sigilPlaceholderAndroid,
                        isLowPerfDevice && s.lowPerfNoSigilShadow,
                        anchor.charged && s.chargedSigilPlaceholder,
                      ]}
                    >
                      <SigilSvg
                        xml={resolvedSigilSvg}
                        width={SIGIL_CIRCLE_SIZE * (anchor.charged ? 0.72 : 1)}
                        height={SIGIL_CIRCLE_SIZE * (anchor.charged ? 0.72 : 1)}
                      />
                    </View>
                  ) : (
                    <LinearGradient
                      colors={['#2a1a60', '#0f0830', '#050015']}
                      style={[
                        s.sigilPlaceholder,
                        anchor.charged && s.chargedSigilPlaceholder,
                      ]}
                    >
                      <Text style={{ fontSize: 72 }}>🎵</Text>
                    </LinearGradient>
                  )}
                </LinearGradient>
              </View>
            </View>
          </FadeUp>

          {/* ── STATS CARD ── */}
          <FadeUp delay={180} animate={shouldAnimateIntro}>
            <TouchableOpacity
              activeOpacity={0.92}
              accessibilityRole="button"
              accessibilityLabel="Open this anchor thread strength"
              testID="anchor-thread-strength-row"
              onPress={() => setThreadStrengthSheetVisible(true)}
            >
              <Reanimated.View
                style={[
                  s.animatedCardShell,
                  Platform.OS === 'android' && s.animatedCardShellAndroid,
                  isLowPerfDevice && s.lowPerfFlatCardShell,
                  statsCardPulseStyle,
                ]}
              >
                <LinearGradient
                  colors={[
                    colors.practice.threadSurface,
                    colors.practice.threadSurface,
                  ]}
                  style={[
                    s.card,
                    s.statsCard,
                    isLowPerfDevice && s.lowPerfNoCardShadow,
                  ]}
                >
                  <View style={s.miniStreakCard}>
                    <View style={s.miniStreakLeft}>
                      <View style={s.miniStreakIcon}>
                        <Zap size={16} color={colors.gold} />
                      </View>
                      <View>
                        <Text
                          testID="anchor-detail-streak-value"
                          style={s.miniStreakNum}
                        >
                          {anchorPractice.currentStreak}
                          <Text style={s.miniStreakUnit}>
                            {' '}
                            {currentStreakUnit}
                          </Text>
                        </Text>
                        <Text style={s.miniStreakSub}>Thread Strength</Text>
                      </View>
                    </View>

                    <View style={s.miniDays}>
                      <View style={s.miniThreadBarWrap}>
                        <View
                          style={[
                            s.miniThreadBar,
                            { width: `${threadStrengthValue}%` },
                          ]}
                        />
                      </View>
                      <MiniWeekTrack
                        weekHistory={anchorPractice.weekHistory}
                        lastPrimedAt={anchorPractice.lastPrimedAt}
                      />
                    </View>
                  </View>

                  <Text style={s.miniAffirmation}>
                    Each return strengthens the signal.
                  </Text>

                  <View style={{ marginTop: spacing.sm }}>
                    <MicroTeachInfoChip
                      teachingIds="anchor_history_v1"
                      screenId="anchor_detail"
                      label="Why this matters"
                      sheetTitle="Why this matters"
                    />
                  </View>

                  <MicroTeachHintRow
                    teaching={anchorReuseTeaching}
                    screenId="anchor_detail"
                    showPin={false}
                  />

                  {/* Distilled row */}
                  <View style={s.distilledSection}>
                    <View style={s.distilledHeader}>
                      <Text style={s.distilledLabel}>DISTILLED</Text>
                      <Text style={{ color: C.textDim, fontSize: 12 }}>ⓘ</Text>
                    </View>
                    <View style={s.distilledTags}>
                      {anchor.distilled.map((t) => (
                        <View key={t} style={s.distilledTag}>
                          <Text style={s.distilledTagText}>{t}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </LinearGradient>
                {!isLowPerfDevice && (
                  <Reanimated.View
                    pointerEvents="none"
                    style={[s.cardAuraOverlay, statsCardAuraStyle]}
                  >
                    <LinearGradient
                      colors={[
                        'rgba(255, 223, 133, 0.18)',
                        'rgba(245, 198, 82, 0.08)',
                        'rgba(255, 223, 133, 0.18)',
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFillObject}
                    />
                  </Reanimated.View>
                )}
              </Reanimated.View>
            </TouchableOpacity>
          </FadeUp>
        </View>

        <FadeUp delay={205} animate={shouldAnimateIntro}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Open this anchor's Weave"
            accessibilityHint="View completed practice history for this anchor"
            testID="anchor-detail-open-weave"
            activeOpacity={0.82}
            onPress={handleOpenWeave}
            style={s.weavePreview}
          >
            <View style={s.weavePreviewCopy}>
              <Text style={s.weavePreviewEyebrow}>PRACTICE HISTORY</Text>
              <Text style={s.weavePreviewTitle}>The Weave</Text>
              <Text style={s.weavePreviewText}>
                {anchorPractice.totalPrimingSessions > 0
                  ? `${anchorPractice.totalPrimingSessions} completed returns, held in one thread.`
                  : 'Your completed returns will gather here.'}
              </Text>
              <View style={s.weavePreviewMetrics}>
                <Text style={s.weavePreviewMetric}>{anchorPractice.practiceDays} days</Text>
                <Text style={s.weavePreviewMetric}>{anchorPractice.activeWeeks} weeks</Text>
                <Text style={s.weavePreviewMetric}>{formatWeaveDuration(anchorPractice.practicedSeconds)}</Text>
              </View>
              <Text style={s.weavePreviewMix}>Practice mix · Focus {anchorPractice.modeCounts.focus} · Visualize {anchorPractice.modeCounts.visualize} · Deep Prime {anchorPractice.modeCounts.deep_prime}</Text>
              {anchorPractice.recentSessions[0] ? <Text style={s.weavePreviewRecent}>Recent · {anchorPractice.recentSessions[0].practiceMode.replace('_', ' ')} · {localDateString(new Date(anchorPractice.recentSessions[0].completedAt))}</Text> : null}
            </View>
            <ChevronRight size={20} color={colors.gold} />
          </TouchableOpacity>
        </FadeUp>

        {/* ── PRIMARY CTA ── */}
        <FadeUp delay={220} animate={shouldAnimateIntro}>
          {anchor.isReleased ? (
            <View style={s.releasedStatusCard}>
              <View style={s.releasedStatusGradient}>
                <View style={s.releasedStatusLeft}>
                  <Text style={s.releasedStatusLabel}>Ceremony Complete</Text>
                  <Text style={s.releasedStatusTitle}>
                    This anchor has been released.
                  </Text>
                  <Text style={s.releasedStatusDate}>
                    Success on {anchor.releasedAt}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={s.primaryCtaCard}
              activeOpacity={0.8}
              onPress={handlePracticePress}
            >
              <View style={s.primaryCtaGradient}>
                <View style={s.primaryCtaLeft}>
                  <Text style={s.primaryCtaLabel}>Ready to prime?</Text>
                  <Text style={s.primaryCtaTitle}>Open Practice</Text>
                </View>
                <View style={s.primaryCtaArrow}>
                  <ChevronRight size={18} color={colors.gold} />
                </View>
              </View>
            </TouchableOpacity>
          )}
        </FadeUp>

        {/* DEFERRED: Direct ritual entry points live on Practice — restore the secondary ritual sheet here only if the detail screen regains mode-launch responsibilities. */}

        <FadeUp delay={320} animate={shouldAnimateIntro}>
          <LinearGradient colors={CARD_GRADIENT} style={[s.card, s.exportCard]}>
            <Text style={s.exportEyebrow}>WALLPAPER & EXPORT</Text>
            <Text style={s.exportTitle}>
              Keep your anchor where you will actually see it.
            </Text>
            <Text style={s.exportBody}>
              Share a branded card for messages and social, save the raw PNG, or
              open the wallpaper flow when you want the symbol on your lock
              screen.
            </Text>
            <View style={s.exportActionRow}>
              <View style={s.formatToggleRow}>
                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.85}
                  onPress={() => setShareFormat('square')}
                  style={[
                    s.formatPill,
                    shareFormat === 'square' && s.formatPillActive,
                  ]}
                >
                  <Text
                    style={[
                      s.formatPillText,
                      shareFormat === 'square' && s.formatPillTextActive,
                    ]}
                  >
                    SQUARE
                  </Text>
                  <Text
                    style={[
                      s.formatPillDim,
                      shareFormat === 'square' && s.formatPillDimActive,
                    ]}
                  >
                    1:1
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.85}
                  onPress={() => setShareFormat('stories')}
                  style={[
                    s.formatPill,
                    shareFormat === 'stories' && s.formatPillActive,
                  ]}
                >
                  <Text
                    style={[
                      s.formatPillText,
                      shareFormat === 'stories' && s.formatPillTextActive,
                    ]}
                  >
                    STORIES
                  </Text>
                  <Text
                    style={[
                      s.formatPillDim,
                      shareFormat === 'stories' && s.formatPillDimActive,
                    ]}
                  >
                    9:16
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.85}
                disabled={isShareCardLoading}
                onPress={handleShareAnchor}
                style={[
                  s.exportActionButton,
                  s.exportActionPrimary,
                  isShareCardLoading && s.exportActionDisabled,
                ]}
                testID="anchor-detail-share-button"
              >
                <View style={s.exportActionPrimaryContent}>
                  <Share2 size={16} color={colors.background.primary} />
                  <Text style={s.exportActionPrimaryText}>
                    {isShareCardLoading ? 'Sharing...' : 'SHARE MY ANCHOR'}
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={s.exportSecondaryRow}>
                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.85}
                  disabled={isExporting}
                  onPress={handleSetWallpaper}
                  style={[
                    s.exportActionButton,
                    s.exportActionSecondary,
                    s.exportActionHalf,
                    isExporting && s.exportActionDisabled,
                  ]}
                  testID="anchor-detail-set-wallpaper-button"
                >
                  <Text style={s.exportActionSecondaryText}>
                    {isExporting ? 'OPENING...' : 'SET AS WALLPAPER'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.85}
                  onPress={() => setShowExportSheet(true)}
                  style={[
                    s.exportActionButton,
                    s.exportActionSecondary,
                    s.exportActionHalf,
                  ]}
                  testID="anchor-detail-download-png-button"
                >
                  <Text style={s.exportActionSecondaryText}>SAVE PNG</Text>
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </FadeUp>

        {ENABLE_MERCH && (
          <FadeUp delay={360}>
            <LinearGradient colors={CARD_GRADIENT} style={[s.card, s.cardGold]}>
              <Text style={s.physicalEyebrow}>PHYSICAL ANCHOR</Text>
              <Text style={s.physicalSub}>Make this symbol tangible.</Text>
              <View style={s.physicalRow}>
                <View style={s.physicalThumb}>
                  {anchor.sigilUri ? (
                    <Image
                      source={{ uri: anchor.sigilUri }}
                      style={s.physicalThumbImage}
                      resizeMode="cover"
                    />
                  ) : resolvedSigilSvg ? (
                    <SigilSvg
                      xml={resolvedSigilSvg}
                      width={58}
                      height={58}
                      color={colors.gold}
                    />
                  ) : (
                    <LinearGradient
                      colors={['#2a1a60', '#0f0830']}
                      style={s.physicalThumbFallbackBg}
                    >
                      <Text style={s.physicalThumbFallback}>🎵</Text>
                    </LinearGradient>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.physicalCopyTitle}>Carry your anchor</Text>
                  <Text style={s.physicalCopyBody}>
                    A quiet reminder you can carry.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                activeOpacity={0.85}
                style={{ marginBottom: spacing.sm + spacing.xs }}
                onPress={() =>
                  Alert.alert(
                    'Physical Anchor',
                    'Physical anchor flow coming soon.',
                  )
                }
              >
                <LinearGradient
                  colors={['#b8920a', '#d4a820', '#c49a15']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.createPhysicalBtn}
                >
                  <Text style={s.createPhysicalText}>
                    CREATE PHYSICAL ANCHOR
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
              <Text style={s.physicalTags}>Keychains · Prints · Apparel</Text>
            </LinearGradient>
          </FadeUp>
        )}

        {/* ── DESTRUCTIVE ACTION ── */}
        {!anchor.isReleased && (
          <FadeUp delay={380} animate={shouldAnimateIntro}>
            <TouchableOpacity style={s.deleteBtn} onPress={handleDelete}>
              <Text style={s.deleteBtnText}>Delete Anchor</Text>
            </TouchableOpacity>
          </FadeUp>
        )}

        {/* ── FOOTER ── */}
        <FadeUp delay={400} animate={shouldAnimateIntro}>
          <Text style={s.footerDate}>Created {anchor.createdAt}</Text>
        </FadeUp>
      </ScrollView>

      {/* ── HIDDEN CAPTURE TARGET — mount only while exporting so it doesn't
          consume layout/raster budget during normal scrolling. */}
      {pendingExportAction && (
        <View
          ref={anchorCardRef}
          style={{
            position: 'absolute',
            left: -9999,
            width: 1170,
            height: 2532,
            backgroundColor: '#0F1419',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          collapsable={false}
        >
          <View
            style={{
              width: 1170 * 0.65,
              aspectRatio: 1,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {anchor.sigilUri ? (
              <Image
                source={{ uri: anchor.sigilUri }}
                style={{ width: '100%', height: '100%', borderRadius: 999 }}
                resizeMode="cover"
              />
            ) : resolvedSigilSvg ? (
              <SigilSvg
                xml={resolvedSigilSvg}
                width={1170 * 0.65}
                height={1170 * 0.65}
              />
            ) : null}
          </View>
          <Text
            style={{
              color: '#F5F5DC',
              fontFamily: 'CormorantGaramond-Regular',
              fontSize: 28,
              textAlign: 'center',
              marginTop: 48,
              paddingHorizontal: 80,
            }}
          >
            {anchor.intention}
          </Text>
          <Text
            style={{
              color: '#D4AF37',
              fontFamily: 'Cinzel-Regular',
              fontSize: 18,
              letterSpacing: 8,
              textAlign: 'center',
              marginTop: 24,
              marginBottom: 80,
            }}
          >
            ANCHOR
          </Text>
        </View>
      )}

      {showShareCard && (
        <ShareCardRenderer
          ref={shareCardRef}
          anchorSVG={anchor.baseSigilSvg}
          artworkUri={anchor.sigilUri ?? anchor.enhancedImageUrl}
          intention={anchor.intention}
          daysPrimed={anchorPractice.currentStreak}
          format={shareFormat}
          onRenderReady={() => {
            shareCardRenderedRef.current = true;
            setShareCardRendered(true);
          }}
        />
      )}

      {/* DEFERRED: MoreRitualsSheet stays off-screen while Anchor Details only routes into Practice — restore post-launch if needed. */}
      {/*
      <MoreRitualsSheet
        visible={moreRitualsVisible}
        onClose={() => setMoreRitualsVisible(false)}
        onSelectRitual={handleRitualSelect}
        isCharged={anchor.charged}
      />
      */}

      <ConfirmUnchargedBurnSheet
        visible={confirmUnchargedBurnVisible}
        onConfirm={executeBurn}
        onCancel={() => setConfirmUnchargedBurnVisible(false)}
        intentionText={anchor.intention}
      />

      <ConfirmDeleteAnchorSheet
        visible={confirmDeleteVisible}
        intentionText={anchor.intention}
        onBurnInstead={() => {
          setConfirmDeleteVisible(false);
          handleBurn();
        }}
        onDelete={confirmDeleteAnchor}
        onCancel={() => setConfirmDeleteVisible(false)}
      />

      <ThreadStrengthSheet
        visible={threadStrengthSheetVisible}
        onClose={() => setThreadStrengthSheetVisible(false)}
        anchorId={anchor.id}
      />

      <ExportAnchorSheet
        isVisible={showExportSheet}
        onClose={() => setShowExportSheet(false)}
        sigilSvg={anchor.baseSigilSvg}
        sigilUri={anchor.sigilUri}
        intention={anchor.intention}
        onExportComplete={(uri) => {
          logger.info('[AnchorDetail] Anchor exported', { uri });
        }}
      />
    </View>
  );
};

export const AnchorDetailScreen = AnchorDetailsScreen;
export default AnchorDetailsScreen;

// ─── STYLES ──────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.1)',
    backgroundColor: 'rgba(12,14,18,0.88)',
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  backArrow: {
    color: C.gold,
    fontSize: 22,
    opacity: 0.85,
  },
  headerTitle: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 11,
    letterSpacing: 3,
    color: C.silverDim,
  },
  headerFallback: {
    backgroundColor: 'rgba(8, 10, 16, 0.94)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(201,168,76,0.12)',
  },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  heroStack: {
    gap: spacing.md,
  },

  // ── CARD ──
  card: {
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.practice.cardSecondaryBorder,
    overflow: 'hidden',
  },
  animatedCardShell: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: colors.practice.cardFeaturedBorder,
    overflow: 'hidden',
    elevation: 6,
  },
  animatedCardShellAndroid: {
    elevation: 0,
  },
  lowPerfFlatCardShell: {
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  cardAuraOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    zIndex: 2,
  },
  cardGold: {
    borderColor: colors.practice.cardFeaturedBorder,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  cardGoldAndroid: {
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  lowPerfNoCardShadow: {
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },

  // ── TITLE CARD ──
  anchorEyebrow: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 8,
    letterSpacing: 3,
    color: C.silverDim,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  anchorName: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 24,
    color: colors.bone,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  intentionText: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 20,
    color: colors.bone,
    textAlign: 'center',
    letterSpacing: 0.4,
    marginBottom: spacing.md,
    lineHeight: 28,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badgeThread: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 30,
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.4)',
  },
  badgeDesire: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 30,
    backgroundColor: colors.practice.cardIconSecondarySurface,
    borderWidth: 1,
    borderColor: colors.practice.cardIconSecondaryBorder,
  },
  badgeCharged: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 30,
    backgroundColor: colors.practice.threadIconSurface,
    borderWidth: 1,
    borderColor: colors.practice.threadIconBorder,
    shadowColor: C.gold,
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  badgeChargedAndroid: {
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  badgeReleased: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowOpacity: 0,
  },
  badgeDormant: {
    backgroundColor: colors.practice.heroSwitcherSurface,
    borderColor: colors.practice.heroSwitcherBorder,
    shadowOpacity: 0,
  },
  badgeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  badgeIcon: { fontSize: 11 },
  badgeText: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 9,
    letterSpacing: 1.5,
  },

  // ── SIGIL ──
  sigilAuraContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  sigilAuraCanvas: {
    position: 'absolute',
    width: SCREEN_W * 1.25,
    height: SCREEN_W * 1.25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sigilCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.goldBorder,
    shadowColor: '#8040c8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 8,
  },
  sigilCardAndroid: {
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  lowPerfNoSigilShadow: {
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sigilWrapper: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sigilImage: {
    width: '78%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(201,168,76,0.35)',
  },
  releasedSigilImage: {
    opacity: 0.4,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sigilPlaceholder: {
    width: '78%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(201,168,76,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.gold,
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  sigilPlaceholderAndroid: {
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  chargedSigilBackdrop: {
    position: 'absolute',
    width: '72%',
    height: '72%',
    borderRadius: 999,
    backgroundColor: 'rgba(10, 6, 36, 0.92)',
    borderWidth: 1.5,
    borderColor: 'rgba(200, 160, 40, 0.55)',
    zIndex: 2,
  },
  chargedSigilImage: {
    width: '72%',
    borderColor: 'rgba(255, 210, 80, 0.5)',
    zIndex: 3,
  },
  chargedSigilPlaceholder: {
    width: '72%',
    borderColor: 'rgba(255, 210, 80, 0.5)',
    zIndex: 3,
  },

  // ── STATS ──
  statsHeader: {
    fontFamily: 'serif',
    fontSize: 11,
    letterSpacing: 3,
    color: C.gold,
    textAlign: 'center',
    marginBottom: 20,
    textTransform: 'uppercase',
  },
  statsCard: {
    borderColor: colors.practice.threadBorder,
  },
  miniStreakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
  },
  miniStreakLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  miniStreakIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.practice.threadIconBorder,
    backgroundColor: colors.practice.threadIconSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniStreakNum: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 22,
    lineHeight: 22,
    color: colors.gold,
  },
  miniStreakUnit: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 10,
    color: colors.silver,
    letterSpacing: 1.2,
  },
  miniStreakSub: {
    marginTop: 3,
    fontFamily: typography.fontFamily.serif,
    fontSize: 7.5,
    letterSpacing: 1.2,
    color: C.silverDim,
    textTransform: 'uppercase',
  },
  miniDays: {
    flex: 1,
    gap: spacing.xs,
  },
  miniThreadBarWrap: {
    height: 2.5,
    borderRadius: 2,
    backgroundColor: 'rgba(212,175,55,0.1)',
    overflow: 'hidden',
  },
  miniThreadBar: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.gold,
  },
  miniDayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  miniDayCol: {
    alignItems: 'center',
    gap: 3,
  },
  miniDayLetter: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 7.5,
    color: C.silverDim,
  },
  miniDayDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.practice.threadIconBorder,
    backgroundColor: 'transparent',
  },
  miniDayDotDone: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  miniDayDotToday: {
    borderColor: colors.gold,
  },
  miniDayDotTodayDone: {
    shadowColor: colors.gold,
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 2,
  },
  miniDayDotFuture: {
    opacity: 0.35,
  },
  miniAffirmation: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 12,
    fontStyle: 'italic',
    color: C.textSec,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212,175,55,0.08)',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(34,26,70,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(156,120,224,0.25)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  statItemFull: {
    flexBasis: '100%',
    flexGrow: 1,
  },
  statLabel: {
    fontFamily: 'serif',
    fontSize: 8,
    letterSpacing: 2,
    color: C.textDim,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  // Released Status
  releasedStatusCard: {
    marginHorizontal: 4,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  releasedStatusGradient: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  releasedStatusLeft: {
    flex: 1,
  },
  releasedStatusLabel: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.silver,
    textTransform: 'uppercase',
    marginBottom: 4,
    opacity: 0.8,
  },
  releasedStatusTitle: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 18,
    color: colors.bone,
    marginBottom: 4,
  },
  releasedStatusDate: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 12,
    color: colors.silver,
    opacity: 0.6,
  },
  statValue: {
    fontFamily: 'serif',
    fontSize: 16,
    fontWeight: '700',
    color: C.textPrimary,
    letterSpacing: 0.5,
  },
  distilledSection: {
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212,175,55,0.08)',
    gap: spacing.xs,
  },
  distilledHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  distilledLabel: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 8,
    letterSpacing: 2.5,
    color: C.silverDim,
    textTransform: 'uppercase',
  },
  distilledTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  distilledTag: {
    borderWidth: 1,
    borderColor: colors.practice.cardSecondaryBorder,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 7,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  distilledTagText: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 8,
    letterSpacing: 1,
    color: C.textSec,
  },

  // ── SECTION LABEL ──
  sectionLabel: {
    fontFamily: 'serif',
    fontSize: 9,
    letterSpacing: 3,
    color: C.textSec,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    marginTop: 4,
  },

  // ── ACTIVATE ──
  activateInner: {
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  activateBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activateIcon: { fontSize: 18 },
  activateText: {
    fontFamily: 'serif',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#1a0e00',
  },
  shineSweep: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: 'rgba(255,255,255,0.18)',
    transform: [{ skewX: '-20deg' }],
  },
  activateSub: {
    fontFamily: 'serif',
    fontSize: 11,
    color: C.textDim,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginTop: -6,
  },
  durationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  durationPill: {
    paddingVertical: 7,
    paddingHorizontal: 20,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(140,100,220,0.25)',
  },
  durationPillActive: {
    borderColor: C.goldBorder,
    backgroundColor: 'rgba(201,168,76,0.1)',
    shadowColor: C.gold,
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  durationText: {
    fontFamily: 'serif',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: C.textSec,
  },
  durationTextActive: { color: C.goldBright },
  saveDefault: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveDefaultText: {
    fontFamily: 'serif',
    fontSize: 12,
    fontStyle: 'italic',
    color: C.goldDim,
    opacity: 0.96,
  },
  fastReset: {
    fontFamily: 'serif',
    fontSize: 11,
    fontStyle: 'italic',
    color: C.textDim,
    textAlign: 'center',
    marginTop: -6,
  },

  // ── COLLAPSIBLE ──
  collapsibleCard: { padding: 18 },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  collapsibleTitle: {
    fontFamily: 'serif',
    fontSize: 13,
    fontWeight: '600',
    color: C.gold,
    letterSpacing: 1,
    marginBottom: 3,
  },
  collapsibleMeta: {
    fontFamily: 'serif',
    fontSize: 12,
    color: C.textSec,
    marginBottom: 2,
  },
  collapsibleSub: {
    fontFamily: 'serif',
    fontSize: 11,
    fontStyle: 'italic',
    color: C.textDim,
  },
  chevron: { color: C.goldDim, fontSize: 12 },

  // ── ACTION BTNS ──
  actionBtn: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnText: {
    fontFamily: 'serif',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.6,
  },

  // ── PRACTICE ──
  practiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  practiceTitle: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 13,
    fontWeight: '600',
    color: C.gold,
    letterSpacing: 1,
  },
  practiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
  },
  practiceCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkComplete: {
    borderColor: 'rgba(201,168,76,0.5)',
    backgroundColor: 'rgba(201,168,76,0.12)',
  },
  checkProgress: {
    borderColor: 'rgba(140,100,220,0.35)',
    backgroundColor: 'rgba(100,60,180,0.1)',
  },
  practiceCheckText: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 10,
    fontWeight: '700',
  },
  practiceLabel: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 15,
    color: C.textPrimary,
    letterSpacing: 0.3,
  },

  // ── PHYSICAL ──
  physicalEyebrow: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 8,
    letterSpacing: 3,
    color: C.silverDim,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  physicalSub: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 13,
    fontStyle: 'italic',
    color: C.textSec,
    marginBottom: spacing.md,
  },
  physicalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
    marginBottom: spacing.md,
  },
  physicalThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.practice.cardFeaturedBorder,
    backgroundColor: colors.practice.cardFeaturedSurface,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  physicalThumbImage: {
    width: '100%',
    height: '100%',
  },
  physicalThumbFallbackBg: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  physicalThumbFallback: {
    fontSize: 28,
  },
  physicalCopyTitle: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 13,
    fontWeight: '700',
    color: C.textPrimary,
    marginBottom: spacing.xs,
  },
  physicalCopyBody: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 12,
    fontStyle: 'italic',
    color: C.textSec,
  },
  createPhysicalBtn: {
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    shadowColor: C.gold,
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  createPhysicalText: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#1a0e00',
  },
  physicalTags: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 11,
    color: C.textDim,
    textAlign: 'center',
    letterSpacing: 1,
  },
  // ── NEW RITUAL ACTIONS ──
  primaryCtaCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.practice.cardFeaturedBorder,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  weavePreview: {
    marginTop: spacing.md,
    minHeight: 112,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212,175,55,0.22)',
  },
  weavePreviewCopy: { flex: 1, paddingRight: spacing.sm },
  weavePreviewEyebrow: {
    color: 'rgba(242,223,168,0.56)',
    fontFamily: typography.fontFamily.sans,
    fontSize: 8,
    letterSpacing: 2,
  },
  weavePreviewTitle: {
    color: colors.gold,
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 18,
    marginTop: 3,
  },
  weavePreviewText: {
    color: 'rgba(245,245,241,0.58)',
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  weavePreviewMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  weavePreviewMetric: { color: 'rgba(242,223,168,0.65)', fontFamily: typography.fontFamily.sans, fontSize: 9, letterSpacing: 0.7 },
  weavePreviewMix: { color: 'rgba(245,245,241,0.55)', fontFamily: typography.fontFamily.bodySerifItalic, fontSize: 11, lineHeight: 16, marginTop: spacing.xs },
  weavePreviewRecent: { color: 'rgba(245,245,241,0.48)', fontFamily: typography.fontFamily.bodySerifItalic, fontSize: 11, marginTop: spacing.xs },
  primaryCtaGradient: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  primaryCtaLeft: {
    flex: 1,
  },
  primaryCtaLabel: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 8.5,
    letterSpacing: 2.5,
    color: C.silverDim,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  primaryCtaTitle: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 16,
    color: colors.gold,
    letterSpacing: 0.5,
  },
  primaryCtaArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.practice.cardFeaturedBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCtaSubtitle: {
    marginTop: 4,
    fontFamily: 'sans-serif',
    fontSize: 13,
    color: C.textSec,
  },
  primaryCtaButtonWrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
  },
  primaryCtaButtonText: {
    fontFamily: 'sans-serif-medium',
    fontSize: 13,
    color: C.goldBright,
    fontWeight: '600',
  },
  exportCard: {
    gap: spacing.md,
  },
  exportEyebrow: {
    color: C.goldDim,
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    letterSpacing: 1.2,
  },
  exportTitle: {
    color: C.textPrimary,
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 20,
    lineHeight: 28,
  },
  exportBody: {
    color: C.textSec,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 22,
  },
  exportActionRow: {
    gap: spacing.sm,
  },
  formatToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  formatPill: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatPillActive: {
    borderColor: 'rgba(212,175,55,0.65)',
    backgroundColor: 'rgba(212,175,55,0.06)',
  },
  formatPillText: {
    color: 'rgba(245,245,220,0.5)',
    fontFamily: typography.fontFamily.serif,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  formatPillTextActive: {
    color: colors.gold,
  },
  formatPillDim: {
    marginTop: 2,
    color: 'rgba(245,245,220,0.42)',
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 9,
  },
  formatPillDimActive: {
    color: 'rgba(212,175,55,0.72)',
  },
  exportSecondaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  exportActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportActionHalf: {
    flex: 1,
  },
  exportActionPrimary: {
    backgroundColor: colors.gold,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  exportActionSecondary: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  exportActionPrimaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  exportActionPrimaryText: {
    color: colors.background.primary,
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    letterSpacing: 0.4,
  },
  exportActionSecondaryText: {
    color: 'rgba(245,245,220,0.5)',
    fontFamily: typography.fontFamily.serif,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  exportActionDisabled: {
    opacity: 0.6,
  },
  moreRitualsGhostBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  moreRitualsGhostText: {
    fontFamily: 'sans-serif',
    fontSize: 14,
    color: C.textDim,
    textDecorationLine: 'underline',
  },
  deleteBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(244,67,54,0.5)',
    backgroundColor: 'rgba(244,67,54,0.08)',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  deleteBtnText: {
    color: colors.error,
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 14,
    letterSpacing: 0.4,
  },

  // ── FOOTER ──
  footerDate: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 11,
    fontStyle: 'italic',
    color: C.textDim,
    textAlign: 'center',
    paddingVertical: spacing.sm,
    letterSpacing: 0.5,
  },

  // ── REPORT CONTENT ──
  reportButton: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  reportButtonText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: 0.3,
  },
});

const EDITORIAL_MODE_META = {
  focus: { label: 'Focus', color: '#D9B36C' },
  deep_prime: { label: 'Deep Prime', color: '#A7B9B1' },
  visualize: { label: 'Visualize', color: '#8AB9D5' },
  release: { label: 'Release', color: '#C8875A' },
};

const threadStateFor = (value: number) => {
  if (value >= 80) return 'Well held';
  if (value >= 55) return 'In practice';
  if (value >= 30) return 'Taking shape';
  return 'Just beginning';
};

const modeLabel = (mode: string) =>
  EDITORIAL_MODE_META[mode]?.label ?? String(mode).replace(/_/g, ' ');

const modeColor = (mode: string) =>
  EDITORIAL_MODE_META[mode]?.color ?? colors.anchor15.ash;

const strengthExplanation = (sessions: number) => {
  if (sessions === 0) {
    return 'Your Thread Strength will begin to take shape with your first completed Practice.';
  }
  if (sessions === 1) {
    return 'One completed Practice has begun a thread you can return to.';
  }
  return `${sessions} completed sessions are held in this Anchor’s thread.`;
};

const EditorialRule = ({ style }: { style?: object }) => (
  <View pointerEvents="none" style={[editorial.rule, style]} />
);

const EditorialInfoButton = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityHint="Opens a short explanation"
    hitSlop={8}
    onPress={onPress}
    style={({ pressed }) => [editorial.infoButton, pressed && editorial.pressed]}
  >
    <Info size={13} color={colors.anchor15.gilt} strokeWidth={1.5} />
  </Pressable>
);

const EditorialSheet = ({
  visible,
  title,
  children,
  onClose,
  reduceMotionEnabled,
}: {
  visible: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  reduceMotionEnabled: boolean;
}) => (
  <Modal
    transparent
    visible={visible}
    animationType={reduceMotionEnabled ? 'none' : 'slide'}
    onRequestClose={onClose}
    accessibilityViewIsModal
  >
    <Pressable
      accessibilityLabel={`Close ${title}`}
      onPress={onClose}
      style={editorial.sheetScrim}
    >
      <Pressable onPress={(event) => event.stopPropagation()} style={editorial.sheet}>
        <View style={editorial.sheetHandle} />
        <View style={editorial.sheetHeader}>
          <Text style={editorial.sheetTitle}>{title}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            style={editorial.sheetClose}
          >
            <X size={18} color={colors.anchor15.ash} strokeWidth={1.5} />
          </Pressable>
        </View>
        {children}
      </Pressable>
    </Pressable>
  </Modal>
);

const EditorialWeavePreview = ({ anchorPractice, onPress }: any) => {
  const modes = Object.keys(EDITORIAL_MODE_META);
  const total = Math.max(1, anchorPractice.totalPrimingSessions);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open The Weave. ${anchorPractice.totalPrimingSessions} completed sessions for this Anchor.`}
      accessibilityHint="Shows this Anchor’s completed Practice history"
      onPress={onPress}
      style={({ pressed }) => [editorial.weaveEntry, pressed && editorial.pressed]}
      testID="anchor-detail-open-weave"
    >
      <View style={editorial.weaveHeadingRow}>
        <Text style={editorial.sectionEyebrow}>THE WEAVE</Text>
        <ChevronRight size={17} color={colors.anchor15.gilt} strokeWidth={1.4} />
      </View>
      <View style={editorial.weaveCanvas} accessible={false}>
        {modes.map((mode, index) => {
          const count = anchorPractice.modeCounts[mode] ?? 0;
          const length = count ? Math.max(18, Math.round((count / total) * 100)) : 12;
          return (
            <View key={mode} style={[editorial.weaveLane, { top: 18 + index * 20 }]}>
              <View style={editorial.weaveLaneTrack} />
              <View
                style={[
                  editorial.weaveLaneFill,
                  { width: `${length}%`, backgroundColor: modeColor(mode) },
                ]}
              />
              {Array.from({ length: Math.min(count, 6) }).map((_, dotIndex) => (
                <View
                  key={`${mode}-${dotIndex}`}
                  style={[
                    editorial.weaveNode,
                    {
                      left: `${Math.min(90, 12 + ((dotIndex + 1) * 72) / (Math.min(count, 6) + 1))}%`,
                      backgroundColor: modeColor(mode),
                    },
                  ]}
                />
              ))}
            </View>
          );
        })}
        {anchorPractice.totalPrimingSessions === 0 ? (
          <Text style={editorial.weaveEmpty}>Your first completed Practice will appear here.</Text>
        ) : null}
      </View>
      <View style={editorial.weaveFooter}>
        <Text style={editorial.weaveMeta}>
          {anchorPractice.totalPrimingSessions} {anchorPractice.totalPrimingSessions === 1 ? 'session' : 'sessions'} · Thread Strength {anchorPractice.threadStrengthValue}
        </Text>
        <Text style={editorial.weaveLink}>VIEW THE WEAVE →</Text>
      </View>
    </Pressable>
  );
};

const AnchorDetailEditorialPage = (props: any) => {
  const {
    anchor,
    hasAnchor,
    isLoading,
    loadError,
    insets,
    perfTier,
    reduceMotionEnabled,
    resolvedSigilSvg,
    anchorPractice,
    threadStrengthValue,
    isExporting,
    isShareCardLoading,
    pendingExportAction,
    anchorCardRef,
    showOptions,
    showDistilledForm,
    showWeaveInfo,
    showThreadStrength,
    showExportSheet,
    showConfirmDelete,
    showConfirmRelease,
    showShareCard,
    shareCardRef,
    shareFormat,
    onBack,
    onOpenOptions,
    onCloseOptions,
    onOpenDistilledForm,
    onCloseDistilledForm,
    onOpenWeaveInfo,
    onCloseWeaveInfo,
    onOpenThreadStrength,
    onCloseThreadStrength,
    onOpenWeave,
    onPractice,
    onShare,
    onSetWallpaper,
    onSavePng,
    onCloseExport,
    onRelease,
    onDelete,
    onCloseDelete,
    onConfirmDelete,
    onCloseRelease,
    onConfirmRelease,
    onShareCardRendered,
  } = props;
  const threadState = threadStateFor(threadStrengthValue);
  const hasHistory = anchorPractice.totalPrimingSessions > 0;
  const isCachedOffline = Boolean(loadError && hasAnchor);

  const statusTitle = isLoading
    ? 'Gathering your Anchor'
    : loadError
      ? 'This Anchor is unavailable right now'
      : 'Anchor not found';
  const statusBody = isLoading
    ? 'Your saved intention and Practice history are being prepared.'
    : loadError
      ? 'Reconnect, then return to Sanctuary and try again.'
      : 'This Anchor may have been released or removed.';

  return (
    <View style={editorial.root}>
      <StatusBar barStyle="light-content" />
      <ZenBackground
        variant="sanctuary"
        showOrbs={perfTier === 'high' && !reduceMotionEnabled}
        showGrain
        showVignette
        performanceTier={perfTier}
      />
      <View style={[editorial.header, { paddingTop: insets.top + 2 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Sanctuary"
          onPress={onBack}
          style={({ pressed }) => [editorial.headerControl, editorial.backControl, pressed && editorial.pressed]}
        >
          <ChevronLeft size={19} color={colors.anchor15.giltBright} strokeWidth={1.45} />
          <Text style={editorial.backLabel}>Sanctuary</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Anchor options"
          onPress={onOpenOptions}
          style={({ pressed }) => [editorial.headerControl, editorial.optionsControl, pressed && editorial.pressed]}
        >
          <MoreHorizontal size={21} color={colors.anchor15.ash} strokeWidth={1.45} />
        </Pressable>
      </View>

      {!hasAnchor ? (
        <View style={editorial.statusWrap} accessibilityRole={loadError ? 'alert' : undefined}>
          <View style={editorial.statusRule} />
          <Text style={editorial.statusTitle}>{statusTitle}</Text>
          <Text style={editorial.statusBody}>{statusBody}</Text>
          <Pressable accessibilityRole="button" onPress={onBack} style={editorial.statusAction}>
            <Text style={editorial.statusActionText}>BACK TO SANCTUARY</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={[editorial.scroll, { paddingBottom: insets.bottom + 128 }]}
            showsVerticalScrollIndicator={false}
          >
            {isCachedOffline ? (
              <Text accessibilityRole="alert" style={editorial.cachedLabel}>
                Showing saved Anchor details while offline.
              </Text>
            ) : null}

            <FadeUp animate={!reduceMotionEnabled}>
              <View style={editorial.heroArtworkWrap} accessible accessibilityLabel={`${anchor.name} Anchor artwork`}>
                <View pointerEvents="none" style={editorial.heroHalo} />
                <View pointerEvents="none" style={editorial.heroRing} />
                <View style={editorial.heroArtwork}>
                  {anchor.sigilUri ? (
                    <Image source={{ uri: anchor.sigilUri }} style={editorial.heroImage} resizeMode="cover" />
                  ) : resolvedSigilSvg ? (
                    <SigilSvg xml={resolvedSigilSvg} width={122} height={122} color={colors.anchor15.giltBright} />
                  ) : (
                    <Text style={editorial.heroFallbackMark}>{anchor.name?.slice(0, 1)?.toUpperCase() ?? 'A'}</Text>
                  )}
                </View>
              </View>

              <View style={editorial.identity}>
                <Text numberOfLines={3} style={editorial.anchorName}>{anchor.name}</Text>
                <Text style={editorial.category}>{anchor.category}</Text>
                <Text style={editorial.intention}>“{anchor.intention}”</Text>
              </View>
            </FadeUp>

            <FadeUp delay={80} animate={!reduceMotionEnabled}>
              <View style={editorial.formSection}>
                <View style={editorial.centeredLabelRow}>
                  <Text style={editorial.sectionEyebrow}>DISTILLED FORM</Text>
                  <EditorialInfoButton label="About Distilled Form" onPress={onOpenDistilledForm} />
                </View>
                <View style={editorial.lettersRow}>
                  {anchor.distilled.length ? anchor.distilled.map((letter: string, index: number) => (
                    <React.Fragment key={`${letter}-${index}`}>
                      {index > 0 ? <View style={editorial.letterDot} /> : null}
                      <Text style={editorial.letter}>{letter}</Text>
                    </React.Fragment>
                  )) : <Text style={editorial.emptyForm}>No distilled form was saved for this Anchor.</Text>}
                </View>
              </View>

              <View style={editorial.strengthSection}>
                <View style={editorial.centeredLabelRow}>
                  <Text style={editorial.sectionEyebrow}>THREAD STRENGTH</Text>
                  <EditorialInfoButton label="About Thread Strength" onPress={onOpenThreadStrength} />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Thread Strength ${threadStrengthValue} out of 100. ${threadState}.`}
                  accessibilityHint="Opens an explanation of this Anchor’s Thread Strength"
                  onPress={onOpenThreadStrength}
                  style={({ pressed }) => [editorial.strengthContent, pressed && editorial.pressed]}
                  testID="anchor-thread-strength-row"
                >
                  <View style={editorial.strengthNumberRow}>
                    <Text testID="anchor-detail-streak-value" style={editorial.strengthNumber}>{threadStrengthValue}</Text>
                    <Text style={editorial.strengthOutOf}>/ 100</Text>
                  </View>
                  <View style={editorial.threadStateRow}>
                    <View style={editorial.stateRule} />
                    <Text style={editorial.threadState}>{threadState}</Text>
                    <View style={editorial.stateRule} />
                  </View>
                  <Text style={editorial.strengthExplanation}>{strengthExplanation(anchorPractice.totalPrimingSessions)}</Text>
                </Pressable>
              </View>
            </FadeUp>

            <EditorialRule style={editorial.firstRule} />

            <View style={editorial.weaveSection}>
              <View style={editorial.weaveTopLine}>
                <Text style={editorial.weaveIntro}>A living record of the Practice you return to.</Text>
                <EditorialInfoButton label="About The Weave" onPress={onOpenWeaveInfo} />
              </View>
              <EditorialWeavePreview
                anchorPractice={{ ...anchorPractice, threadStrengthValue }}
                onPress={onOpenWeave}
              />
            </View>

            <EditorialRule />

            <View style={editorial.metricsSection}>
              <Text style={editorial.sectionEyebrow}>PRACTICE HISTORY</Text>
              <View style={editorial.metricsRow}>
                <View style={editorial.metric}>
                  <Text style={editorial.metricValue}>{anchorPractice.practiceDays}</Text>
                  <Text style={editorial.metricLabel}>PRACTICE DAYS</Text>
                </View>
                <View style={editorial.metric}>
                  <Text style={editorial.metricValue}>{anchorPractice.activeWeeks}</Text>
                  <Text style={editorial.metricLabel}>ACTIVE WEEKS</Text>
                </View>
                <View style={editorial.metric}>
                  <Text style={editorial.metricValue}>{formatWeaveDuration(anchorPractice.practicedSeconds)}</Text>
                  <Text style={editorial.metricLabel}>PRACTICED</Text>
                </View>
              </View>
              <View style={editorial.mixSection}>
                <Text style={editorial.sectionEyebrow}>PRACTICE MIX</Text>
                {hasHistory ? Object.keys(EDITORIAL_MODE_META).map((mode) => {
                  const count = anchorPractice.modeCounts[mode] ?? 0;
                  const percent = Math.round((count / anchorPractice.totalPrimingSessions) * 100);
                  return (
                    <View key={mode} style={editorial.mixRow}>
                      <Text style={[editorial.mixName, { color: modeColor(mode) }]}>{modeLabel(mode)}</Text>
                      <View style={editorial.mixTrack}><View style={[editorial.mixFill, { width: `${percent}%`, backgroundColor: modeColor(mode) }]} /></View>
                      <Text style={editorial.mixValue}>{count}</Text>
                    </View>
                  );
                }) : <Text style={editorial.lowHistoryCopy}>A mix appears after a few completed Practice sessions.</Text>}
              </View>
            </View>

            <EditorialRule />

            <View style={editorial.activitySection}>
              <Text style={editorial.sectionEyebrow}>RECENT ACTIVITY</Text>
              {hasHistory ? anchorPractice.recentSessions.map((session: any, index: number) => (
                <View key={session.id ?? `${session.completedAt}-${index}`} style={[editorial.activityRow, index > 0 && editorial.activityRowRule]}>
                  <View style={[editorial.activityDot, { backgroundColor: modeColor(session.practiceMode) }]} />
                  <View style={editorial.activityCopy}>
                    <Text style={editorial.activityTitle}>{modeLabel(session.practiceMode)}</Text>
                    <Text style={editorial.activityMeta}>{formatDate(session.completedAt, 'MMM d')} · {formatWeaveDuration(session.completedDurationSeconds ?? 0)}</Text>
                  </View>
                </View>
              )) : <Text style={editorial.lowHistoryCopy}>Your completed returns will appear here.</Text>}
            </View>

            <EditorialRule />

            <View style={editorial.utilitySection}>
              <Pressable accessibilityRole="button" accessibilityLabel="Share Anchor" onPress={onShare} disabled={isShareCardLoading} style={({ pressed }) => [editorial.utilityRow, (pressed || isShareCardLoading) && editorial.pressed]} testID="anchor-detail-share-button">
                <Text style={editorial.utilityText}>{isShareCardLoading ? 'SHARING ANCHOR…' : 'SHARE ANCHOR'}</Text>
                <ChevronRight size={17} color={colors.anchor15.ash} strokeWidth={1.4} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Set Anchor as wallpaper" onPress={onSetWallpaper} disabled={isExporting} style={({ pressed }) => [editorial.utilityRow, (pressed || isExporting) && editorial.pressed]} testID="anchor-detail-set-wallpaper-button">
                <Text style={editorial.utilityText}>{isExporting ? 'OPENING WALLPAPER…' : 'SET AS WALLPAPER'}</Text>
                <ChevronRight size={17} color={colors.anchor15.ash} strokeWidth={1.4} />
              </Pressable>
            </View>

            <View style={editorial.releaseSection}>
              <EditorialRule style={editorial.releaseRule} />
              {anchor.isReleased ? (
                <Text style={editorial.releasedText}>Released {anchor.releasedAt ?? 'previously'}</Text>
              ) : (
                <Pressable accessibilityRole="button" accessibilityLabel="Release Anchor" onPress={onRelease} style={({ pressed }) => [editorial.releaseRow, pressed && editorial.pressed]}>
                  <Text style={editorial.releaseText}>RELEASE ANCHOR</Text>
                  <ChevronRight size={17} color="rgba(200,135,96,0.8)" strokeWidth={1.4} />
                </Pressable>
              )}
              <Text style={editorial.createdDate}>Created {anchor.createdAt}</Text>
            </View>
          </ScrollView>

          <View pointerEvents="box-none" style={[editorial.floatingCtaWrap, { paddingBottom: insets.bottom + 16 }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={anchor.isReleased ? 'Anchor released' : 'Practice this Anchor'}
              accessibilityState={{ disabled: Boolean(anchor.isReleased) }}
              disabled={anchor.isReleased}
              onPress={onPractice}
              style={({ pressed }) => [editorial.floatingCta, (pressed || anchor.isReleased) && editorial.pressed]}
            >
              <Text style={editorial.floatingCtaText}>{anchor.isReleased ? 'ANCHOR RELEASED' : 'PRACTICE THIS ANCHOR →'}</Text>
            </Pressable>
          </View>
        </>
      )}

      <EditorialSheet visible={showOptions} title="Anchor options" onClose={onCloseOptions} reduceMotionEnabled={reduceMotionEnabled}>
        <Pressable accessibilityRole="button" onPress={() => { onCloseOptions(); onShare(); }} style={editorial.optionRow}><Text style={editorial.optionText}>Share Anchor</Text><ChevronRight size={17} color={colors.anchor15.ash} /></Pressable>
        <Pressable accessibilityRole="button" onPress={() => { onCloseOptions(); onSetWallpaper(); }} style={editorial.optionRow}><Text style={editorial.optionText}>Set as Wallpaper</Text><ChevronRight size={17} color={colors.anchor15.ash} /></Pressable>
        <Pressable accessibilityRole="button" onPress={() => { onCloseOptions(); onSavePng(); }} style={editorial.optionRow}><Text style={editorial.optionText}>Save PNG</Text><ChevronRight size={17} color={colors.anchor15.ash} /></Pressable>
        {!anchor.isReleased ? <Pressable accessibilityRole="button" onPress={onRelease} style={editorial.optionRow}><Text style={editorial.optionRelease}>Release Anchor</Text><ChevronRight size={17} color="rgba(200,135,96,0.8)" /></Pressable> : null}
        {!anchor.isReleased ? <Pressable accessibilityRole="button" onPress={onDelete} style={[editorial.optionRow, editorial.optionDelete]}><Text style={editorial.optionDeleteText}>Delete Anchor</Text></Pressable> : null}
      </EditorialSheet>

      <EditorialSheet visible={showDistilledForm} title="Distilled Form" onClose={onCloseDistilledForm} reduceMotionEnabled={reduceMotionEnabled}>
        <Text style={editorial.sheetBody}>Your intention was distilled into its essential letters before this Anchor took form.</Text>
        <Text style={editorial.sheetBody}>Those letters remain a quiet part of the Anchor you return to.</Text>
      </EditorialSheet>

      <EditorialSheet visible={showWeaveInfo} title="The Weave" onClose={onCloseWeaveInfo} reduceMotionEnabled={reduceMotionEnabled}>
        <Text style={editorial.sheetBody}>Each completed Practice becomes a point in this Anchor’s history. The Weave shows the rhythm of those returns over time.</Text>
      </EditorialSheet>

      {pendingExportAction ? (
        <View
          ref={anchorCardRef}
          collapsable={false}
          style={editorial.captureTarget}
        >
          <View style={editorial.captureArtwork}>
            {anchor.sigilUri ? <Image source={{ uri: anchor.sigilUri }} style={editorial.captureImage} resizeMode="cover" /> : resolvedSigilSvg ? <SigilSvg xml={resolvedSigilSvg} width={720} height={720} color={colors.anchor15.giltBright} /> : <Text style={editorial.captureMark}>{anchor.name?.slice(0, 1)?.toUpperCase() ?? 'A'}</Text>}
          </View>
          <Text style={editorial.captureIntention}>{anchor.intention}</Text>
          <Text style={editorial.captureWordmark}>ANCHOR</Text>
        </View>
      ) : null}

      <ThreadStrengthSheet visible={showThreadStrength} onClose={onCloseThreadStrength} anchorId={anchor.id} />
      <ConfirmUnchargedBurnSheet visible={showConfirmRelease} onConfirm={onConfirmRelease} onCancel={onCloseRelease} intentionText={anchor.intention} />
      <ConfirmDeleteAnchorSheet visible={showConfirmDelete} intentionText={anchor.intention} onBurnInstead={onRelease} onDelete={onConfirmDelete} onCancel={onCloseDelete} />
      <ExportAnchorSheet isVisible={showExportSheet} onClose={onCloseExport} sigilSvg={anchor.baseSigilSvg} sigilUri={anchor.sigilUri} intention={anchor.intention} onExportComplete={(uri) => logger.info('[AnchorDetail] Anchor exported', { uri })} />
      {showShareCard ? <ShareCardRenderer ref={shareCardRef} anchorSVG={anchor.baseSigilSvg} artworkUri={anchor.sigilUri ?? anchor.enhancedImageUrl} intention={anchor.intention} daysPrimed={anchorPractice.currentStreak} format={shareFormat} onRenderReady={onShareCardRendered} /> : null}
    </View>
  );
};

const editorial = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.anchor15.ink },
  pressed: { opacity: 0.7 },
  header: { minHeight: 60, paddingHorizontal: 14, paddingBottom: 7, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerControl: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  backControl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingRight: 12 },
  backLabel: { color: colors.anchor15.bone, fontFamily: typography.fontFamily.instrument, fontSize: 13, marginLeft: 1 },
  optionsControl: { alignItems: 'flex-end', paddingRight: 4 },
  statusWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 34 },
  statusRule: { width: 44, height: StyleSheet.hairlineWidth, backgroundColor: colors.anchor15.gilt, marginBottom: 22 },
  statusTitle: { color: colors.anchor15.bone, fontFamily: typography.fontFamily.voice, fontSize: 26, lineHeight: 31, textAlign: 'center' },
  statusBody: { maxWidth: 270, color: colors.anchor15.ash, fontFamily: typography.fontFamily.voiceItalic, fontSize: 16, lineHeight: 22, textAlign: 'center', marginTop: 10 },
  statusAction: { minHeight: 44, marginTop: 25, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.anchor15.gilt },
  statusActionText: { color: colors.anchor15.giltBright, fontFamily: typography.fontFamily.ritual, fontSize: 10, letterSpacing: 1.8 },
  scroll: { paddingHorizontal: 22, paddingTop: 2 },
  cachedLabel: { color: colors.anchor15.ash, fontFamily: typography.fontFamily.instrument, fontSize: 11, lineHeight: 16, textAlign: 'center', marginBottom: 14 },
  heroArtworkWrap: { width: 150, height: 150, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  heroHalo: { position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(217,179,108,0.10)' },
  heroRing: { position: 'absolute', width: 150, height: 150, borderRadius: 75, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(217,179,108,0.30)' },
  heroArtwork: { width: 132, height: 132, borderRadius: 66, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.anchor15.veil, borderWidth: 1, borderColor: 'rgba(217,179,108,0.20)' },
  heroImage: { width: '100%', height: '100%' },
  heroFallbackMark: { color: colors.anchor15.giltBright, fontFamily: typography.fontFamily.ritual, fontSize: 44, lineHeight: 50 },
  identity: { alignItems: 'center', marginTop: 25 },
  anchorName: { maxWidth: '100%', color: colors.anchor15.bone, fontFamily: typography.fontFamily.ritualSemiBold, fontSize: 27, lineHeight: 33, letterSpacing: 2.1, textAlign: 'center', textTransform: 'uppercase' },
  category: { color: colors.anchor15.gilt, fontFamily: typography.fontFamily.ritual, fontSize: 10, letterSpacing: 2.3, textAlign: 'center', textTransform: 'uppercase', marginTop: 8 },
  intention: { maxWidth: 324, color: 'rgba(244,239,230,0.67)', fontFamily: typography.fontFamily.voiceItalic, fontSize: 18, lineHeight: 26, textAlign: 'center', marginTop: 15 },
  centeredLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  sectionEyebrow: { color: 'rgba(242,223,168,0.75)', fontFamily: typography.fontFamily.ritual, fontSize: 10, letterSpacing: 2.1, textTransform: 'uppercase' },
  infoButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginHorizontal: -10 },
  formSection: { marginTop: 31, paddingBottom: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.anchor15.hairline },
  lettersRow: { minHeight: 34, marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 11 },
  letter: { color: colors.anchor15.giltBright, fontFamily: typography.fontFamily.ritualSemiBold, fontSize: 17, letterSpacing: 1 },
  letterDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(217,179,108,0.48)' },
  emptyForm: { color: colors.anchor15.ash, fontFamily: typography.fontFamily.voiceItalic, fontSize: 14, textAlign: 'center' },
  strengthSection: { marginTop: 29 },
  strengthContent: { alignItems: 'center', paddingTop: 5 },
  strengthNumberRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
  strengthNumber: { color: colors.anchor15.bone, fontFamily: typography.fontFamily.instrument, fontSize: 60, fontWeight: '200', letterSpacing: -3, lineHeight: 67, fontVariant: ['tabular-nums'] },
  strengthOutOf: { color: 'rgba(135,147,157,0.66)', fontFamily: typography.fontFamily.instrument, fontSize: 11, letterSpacing: 1, marginLeft: 10 },
  threadStateRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 7 },
  stateRule: { width: 14, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(217,179,108,0.54)' },
  threadState: { color: colors.anchor15.giltBright, fontFamily: typography.fontFamily.ritualSemiBold, fontSize: 11, letterSpacing: 2.3, textTransform: 'uppercase' },
  strengthExplanation: { maxWidth: 285, color: 'rgba(244,239,230,0.58)', fontFamily: typography.fontFamily.voiceItalic, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 10 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.anchor15.hairline, marginTop: 27 },
  firstRule: { marginTop: 28 },
  weaveSection: { marginTop: 21 },
  weaveTopLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  weaveIntro: { flex: 1, color: 'rgba(244,239,230,0.52)', fontFamily: typography.fontFamily.voiceItalic, fontSize: 14, lineHeight: 19, paddingRight: 4 },
  weaveEntry: { paddingTop: 4 },
  weaveHeadingRow: { minHeight: 32, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weaveCanvas: { height: 100, overflow: 'hidden', backgroundColor: 'rgba(30,42,51,0.34)', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(217,179,108,0.12)', marginTop: 7 },
  weaveLane: { position: 'absolute', left: 14, right: 14, height: 12, justifyContent: 'center' },
  weaveLaneTrack: { height: StyleSheet.hairlineWidth, width: '100%', backgroundColor: 'rgba(244,239,230,0.09)' },
  weaveLaneFill: { position: 'absolute', height: 1.5, opacity: 0.88 },
  weaveNode: { position: 'absolute', width: 5, height: 5, borderRadius: 3, marginLeft: -2.5 },
  weaveEmpty: { position: 'absolute', left: 18, right: 18, top: 40, color: 'rgba(244,239,230,0.48)', fontFamily: typography.fontFamily.voiceItalic, fontSize: 14, textAlign: 'center' },
  weaveFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 9 },
  weaveMeta: { flex: 1, color: 'rgba(244,239,230,0.66)', fontFamily: typography.fontFamily.instrument, fontSize: 11 },
  weaveLink: { color: colors.anchor15.giltBright, fontFamily: typography.fontFamily.ritualSemiBold, fontSize: 9, letterSpacing: 1.25, marginLeft: 10 },
  metricsSection: { marginTop: 18 },
  metricsRow: { flexDirection: 'row', paddingTop: 17 },
  metric: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  metricValue: { color: colors.anchor15.bone, fontFamily: typography.fontFamily.instrument, fontSize: 18, lineHeight: 22, textAlign: 'center' },
  metricLabel: { color: 'rgba(135,147,157,0.82)', fontFamily: typography.fontFamily.ritual, fontSize: 7.5, letterSpacing: 1.2, textAlign: 'center', marginTop: 4 },
  mixSection: { marginTop: 28 },
  mixRow: { flexDirection: 'row', alignItems: 'center', minHeight: 29, gap: 9 },
  mixName: { width: 83, fontFamily: typography.fontFamily.instrument, fontSize: 12 },
  mixTrack: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(244,239,230,0.12)' },
  mixFill: { height: 2, marginTop: -0.5 },
  mixValue: { width: 18, color: colors.anchor15.ash, fontFamily: typography.fontFamily.instrument, fontSize: 11, textAlign: 'right' },
  lowHistoryCopy: { color: 'rgba(244,239,230,0.52)', fontFamily: typography.fontFamily.voiceItalic, fontSize: 15, lineHeight: 21, marginTop: 10 },
  activitySection: { marginTop: 18 },
  activityRow: { minHeight: 47, flexDirection: 'row', alignItems: 'center' },
  activityRowRule: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(244,239,230,0.08)' },
  activityDot: { width: 5, height: 5, borderRadius: 3, marginRight: 11 },
  activityCopy: { flex: 1 },
  activityTitle: { color: 'rgba(244,239,230,0.88)', fontFamily: typography.fontFamily.instrument, fontSize: 13 },
  activityMeta: { color: colors.anchor15.ash, fontFamily: typography.fontFamily.voiceItalic, fontSize: 13, marginTop: 2 },
  utilitySection: { marginTop: 5 },
  utilityRow: { minHeight: 47, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  utilityText: { color: colors.anchor15.giltBright, fontFamily: typography.fontFamily.ritualSemiBold, fontSize: 11, letterSpacing: 1.65, textTransform: 'uppercase' },
  releaseSection: { marginTop: 23 },
  releaseRule: { marginTop: 0, backgroundColor: 'rgba(217,179,108,0.14)' },
  releaseRow: { minHeight: 51, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  releaseText: { color: 'rgba(200,135,96,0.86)', fontFamily: typography.fontFamily.ritualSemiBold, fontSize: 11, letterSpacing: 1.65, textTransform: 'uppercase' },
  releasedText: { minHeight: 51, color: 'rgba(200,135,96,0.74)', fontFamily: typography.fontFamily.voiceItalic, fontSize: 15, paddingTop: 15 },
  createdDate: { color: 'rgba(135,147,157,0.68)', fontFamily: typography.fontFamily.instrument, fontSize: 11, marginTop: 1 },
  floatingCtaWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 22, paddingTop: 38, backgroundColor: 'rgba(15,20,25,0.91)' },
  floatingCta: { minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 27, borderWidth: 1, borderColor: 'rgba(217,179,108,0.38)', backgroundColor: 'rgba(217,179,108,0.09)' },
  floatingCtaText: { color: colors.anchor15.giltBright, fontFamily: typography.fontFamily.ritualSemiBold, fontSize: 12, letterSpacing: 1.65 },
  sheetScrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.62)' },
  sheet: { backgroundColor: colors.anchor15.veil, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.anchor15.goldHairline, paddingHorizontal: 22, paddingBottom: 30 },
  sheetHandle: { width: 34, height: 3, borderRadius: 3, alignSelf: 'center', backgroundColor: 'rgba(244,239,230,0.28)', marginTop: 11 },
  sheetHeader: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.anchor15.hairline },
  sheetTitle: { color: colors.anchor15.bone, fontFamily: typography.fontFamily.voice, fontSize: 22, lineHeight: 27 },
  sheetClose: { width: 44, height: 44, alignItems: 'flex-end', justifyContent: 'center' },
  sheetBody: { color: 'rgba(244,239,230,0.7)', fontFamily: typography.fontFamily.voiceItalic, fontSize: 17, lineHeight: 24, marginTop: 17 },
  optionRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(244,239,230,0.08)' },
  optionText: { color: colors.anchor15.bone, fontFamily: typography.fontFamily.instrument, fontSize: 15 },
  optionRelease: { color: 'rgba(200,135,96,0.9)', fontFamily: typography.fontFamily.instrument, fontSize: 15 },
  optionDelete: { borderBottomWidth: 0 },
  optionDeleteText: { color: '#E8B7A4', fontFamily: typography.fontFamily.instrument, fontSize: 15 },
  captureTarget: { position: 'absolute', left: -9999, width: 1170, height: 2532, backgroundColor: colors.anchor15.navy, alignItems: 'center', justifyContent: 'center' },
  captureArtwork: { width: 720, height: 720, borderRadius: 360, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.anchor15.veil },
  captureImage: { width: '100%', height: '100%' },
  captureMark: { color: colors.anchor15.giltBright, fontFamily: typography.fontFamily.ritual, fontSize: 240 },
  captureIntention: { width: 920, color: colors.anchor15.bone, fontFamily: typography.fontFamily.voiceItalic, fontSize: 42, lineHeight: 56, textAlign: 'center', marginTop: 48 },
  captureWordmark: { color: colors.anchor15.gilt, fontFamily: typography.fontFamily.ritual, fontSize: 26, letterSpacing: 9, textAlign: 'center', marginTop: 24, marginBottom: 80 },
});
