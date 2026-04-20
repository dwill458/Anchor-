// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
  Image,
  Alert,
  Modal,
  Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, isToday } from 'date-fns';
import { SvgXml } from 'react-native-svg';
import { ChevronRight, Zap } from 'lucide-react-native';
import { MoreRitualsSheet, RitualType } from '@/components/MoreRitualsSheet';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSessionStore } from '@/stores/sessionStore';
import { del } from '@/services/ApiClient';
import { exportAnchorArtwork } from '@/services/AnchorArtworkExportService';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import { safeHaptics } from '@/utils/haptics';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography } from '@/theme';
import { calculateStreak } from '@/utils/streakHelpers';
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
  AnchorArtworkExportCanvas,
  BakedGlow,
  ChargedGlowCanvas,
  ZenBackground,
} from '@/components/common';
import { useAppPerformanceTier } from '@/hooks/useAppPerformanceTier';
import { resolveBurnArtworkUri } from '@/screens/rituals/utils/resolveBurnArtworkUri';

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

const CARD_GRADIENT = [colors.practice.cardSecondarySurface, colors.practice.cardSecondarySurface];
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
  const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

const toDisplayAnchor = (rawAnchor) => {
  if (!rawAnchor) return null;

  const lastActivatedDate = getDateValue(rawAnchor.lastActivatedAt);

  const intention =
    rawAnchor.intention ??
    rawAnchor.intentionText ??
    'No intention set';

  const categoryKey = rawAnchor.category ?? 'custom';
  const categoryLabel =
    CATEGORY_LABELS[categoryKey] ??
    String(categoryKey).replace(/_/g, ' ');

  const distilled =
    rawAnchor.distilled ??
    rawAnchor.distilledLetters ??
    [];

  const charged = Boolean(rawAnchor.charged ?? rawAnchor.isCharged);
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
    baseSigilSvg: rawAnchor.baseSigilSvg ?? '',
    enhancedImageUrl: rawAnchor.enhancedImageUrl,
  };
};

// ─── FADE-UP WRAPPER ─────────────────────────────────────
const FadeUp = ({ children, delay = 0 }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration: 500, delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0, duration: 500, delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
};

// ─── BREATHING GLOW (sigil bg) ───────────────────────────
const BreathingGlow = ({ animate = true }: { animate?: boolean }) => {
  const scale = useRef(new Animated.Value(animate ? 0.97 : 1.0)).current;
  const opacity = useRef(new Animated.Value(animate ? 0.6 : 0.8)).current;

  useEffect(() => {
    if (!animate) {
      scale.setValue(1.0);
      opacity.setValue(0.8);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.03, duration: 2200, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1.0, duration: 2200, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 0.97, duration: 2200, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 2200, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animate, opacity, scale]);

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFillObject,
        { opacity, transform: [{ scale }] },
      ]}
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
    </Animated.View>
  );
};

// ─── SHINE ANIMATION (activate button) ───────────────────
const ShineButton = ({ onPress, children, style, animate = true }) => {
  const shineX = useRef(new Animated.Value(-SCREEN_W)).current;

  useEffect(() => {
    if (!animate) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shineX, {
          toValue: SCREEN_W * 1.5, duration: 900,
          useNativeDriver: true, delay: 0,
        }),
        Animated.delay(2500),
        Animated.timing(shineX, {
          toValue: -SCREEN_W, duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animate, shineX]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={style}>
      <View style={{ overflow: 'hidden', borderRadius: 14 }}>
        <LinearGradient
          colors={['#b8920a', '#d4a820', '#c49a15']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={s.activateInner}
        >
          {children}
          {animate && (
            <Animated.View
              style={[
                s.shineSweep,
                { transform: [{ translateX: shineX }] },
              ]}
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
    top: -2, left: -2, right: -2, bottom: -2,
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
  }
});

const RitualCard = ({ icon, title, subtitle, helper, onPress, isMuted = false, isDanger = false, children }) => {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowOpacity: glowOpacity.value,
    shadowColor: isDanger ? C.red : (isMuted ? C.burn : C.gold),
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
            isDanger ? ['rgba(116,28,28,0.3)', 'rgba(78,16,16,0.24)'] :
              isMuted ? ['rgba(150,62,24,0.32)', 'rgba(102,36,12,0.28)'] :
                CARD_GRADIENT
          }
          style={[rs.card, isDanger && rs.cardDanger, isMuted && rs.cardMuted]}
        >
          <View style={rs.ritualCardHeader}>
            <View style={rs.ritualCardIconWrapper}>
              <Text style={{ fontSize: 20 }}>{icon}</Text>
            </View>
            <View style={rs.col}>
              <Text style={[rs.title, isDanger && { color: C.red }, isMuted && { color: C.burn }]}>{title}</Text>
              {subtitle && <Text style={rs.subtitle}>{subtitle}</Text>}
              {helper && <Text style={[rs.helper, isDanger && { color: 'rgba(232,140,140,0.7)' }]}>{helper}</Text>}
            </View>
          </View>
          {children}
        </LinearGradient>
      </Reanimated.View>
    </TouchableOpacity>
  );
};

const PrimerModal = ({ visible, onActivate, onSkip, onCancel, blurIntensity = 30 }) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={rs.modalOverlay}>
      <BlurView intensity={blurIntensity} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={rs.modalContent}>
        <LinearGradient colors={CARD_GRADIENT} style={[rs.card, { padding: 24, paddingVertical: 32 }]}>
          <Text style={rs.modalTitle}>Primer Activation</Text>
          <Text style={rs.modalBody}>Primer: 10 seconds to bring it online.</Text>

          <View style={rs.modalActions}>
            <TouchableOpacity style={rs.modalBtnPrimary} onPress={onActivate}>
              <LinearGradient colors={['#b8920a', '#d4a820', '#c49a15']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={rs.modalBtnGrad}>
                <Text style={rs.modalBtnTextPrimary}>ACTIVATE (10s)</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={rs.modalBtnSecondary} onPress={onSkip}>
              <Text style={rs.modalBtnTextSecondary}>Skip straight to Reinforce</Text>
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
  const { navigateToPractice } = useTabNavigation();
  const getAnchorById = useAnchorStore((state) => state.getAnchorById);
  const removeAnchor = useAnchorStore((state) => state.removeAnchor);
  const { defaultActivation, setDefaultActivation } = useSettingsStore();
  const sessionLog = useSessionStore((s) => s.sessionLog);
  const [activeDuration, setActiveDuration] = useState('30s');
  const [primerVisible, setPrimerVisible] = useState(false);
  const [moreRitualsVisible, setMoreRitualsVisible] = useState(false);
  const [exportBusyMode, setExportBusyMode] = useState(null);
  const exportCanvasRef = useRef(null);
  const anchorCardRef = useRef<View>(null);
  const [isExporting, setIsExporting] = useState(false);
  const mediaLibraryPermissionRef = useRef<MediaLibrary.PermissionResponse | null>(null);

  useEffect(() => {
    MediaLibrary.requestPermissionsAsync().then((result) => {
      mediaLibraryPermissionRef.current = result;
    });
  }, []);

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
        baseSigilSvg: '',
        enhancedImageUrl: null,
      },
    [sourceAnchor] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const anchorPractice = useMemo(() => {
    if (!anchorId) {
      return {
        currentStreak: 0,
        totalPrimingSessions: 0,
        lastPrimedAt: null,
        weekHistory: [false, false, false, false, false, false, false],
      };
    }

    const currentWeekKey = isoWeekKey(new Date());
    const primingSessions = sessionLog
      .filter(
        (entry) =>
          entry.anchorId === anchorId &&
          (entry.type === 'activate' || entry.type === 'reinforce')
      )
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

    const weekHistoryForAnchor = [false, false, false, false, false, false, false];
    primingSessions.forEach((entry) => {
      const date = new Date(entry.completedAt);
      if (Number.isNaN(date.getTime()) || isoWeekKey(date) !== currentWeekKey) return;
      const dayIndex = (date.getDay() + 6) % 7;
      weekHistoryForAnchor[dayIndex] = true;
    });

    const currentStreak = calculateStreak(
      primingSessions.map((entry) => ({ createdAt: entry.completedAt }))
    ).currentStreak;

    return {
      currentStreak,
      totalPrimingSessions: primingSessions.length,
      lastPrimedAt: primingSessions[0] ? localDateString(new Date(primingSessions[0].completedAt)) : null,
      weekHistory: weekHistoryForAnchor,
    };
  }, [anchorId, sessionLog]);
  const threadStrengthValue = Math.max(
    0,
    Math.min(
      100,
      Math.max(
        Math.round((anchorPractice.weekHistory.filter(Boolean).length / 7) * 100),
        anchorPractice.totalPrimingSessions > 0 ? Math.round((anchorPractice.currentStreak / 7) * 100) : 0
      )
    )
  );
  const currentStreakUnit = anchorPractice.currentStreak === 1 ? 'Day' : 'Days';

  const divineBreath = useSharedValue(0);
  const divineGlowActive = Boolean(anchor.charged || anchor.today === 'Primed');

  useEffect(() => {
    if (!divineGlowActive) {
      cancelAnimation(divineBreath);
      divineBreath.value = 0;
      return;
    }

    divineBreath.value = withRepeat(
      withTiming(1, {
        duration: 1600,
        easing: ReanimatedEasing.inOut(ReanimatedEasing.sin),
      }),
      -1,
      true
    );

    return () => {
      cancelAnimation(divineBreath);
      divineBreath.value = 0;
    };
  }, [divineBreath, divineGlowActive]);

  const topCardPulseStyle = useAnimatedStyle(() => {
    if (!divineGlowActive) {
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
        ['rgba(201,168,76,0.28)', 'rgba(245,216,137,0.92)']
      ),
      shadowColor: C.gold,
      shadowOpacity: interpolate(divineBreath.value, [0, 1], [0.12, 0.34]),
      shadowRadius: interpolate(divineBreath.value, [0, 1], [10, 20]),
    };
  }, [divineBreath, divineGlowActive]);

  const topCardAuraStyle = useAnimatedStyle(() => ({
    opacity: divineGlowActive ? interpolate(divineBreath.value, [0, 1], [0.12, 0.34]) : 0,
  }), [divineBreath, divineGlowActive]);

  const statsCardPulseStyle = useAnimatedStyle(() => {
    if (!divineGlowActive) {
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
        ['rgba(201,168,76,0.30)', 'rgba(255,228,148,0.96)']
      ),
      shadowColor: C.gold,
      shadowOpacity: interpolate(divineBreath.value, [0, 1], [0.14, 0.4]),
      shadowRadius: interpolate(divineBreath.value, [0, 1], [12, 26]),
    };
  }, [divineBreath, divineGlowActive]);

  const statsCardAuraStyle = useAnimatedStyle(() => ({
    opacity: divineGlowActive ? interpolate(divineBreath.value, [0, 1], [0.14, 0.36]) : 0,
  }), [divineBreath, divineGlowActive]);

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
      Alert.alert('Anchor unavailable', 'Unable to activate because no anchor ID was provided.');
      return;
    }

    navigation.navigate('ActivationRitual', {
      anchorId,
      activationType: 'visual',
      durationOverride: getDurationSeconds(),
      returnTo: 'detail',
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
    navigation.navigate('Ritual', {
      anchorId,
      ritualType: 'ritual',
      durationSeconds: 300,
      returnTo: 'detail',
    });
  };

  const handlePrimerActivate = () => {
    setPrimerVisible(false);
    navigation.navigate('ActivationRitual', {
      anchorId,
      activationType: 'visual',
      durationOverride: 10,
      returnTo: 'reinforce',
    });
  };

  const handleBurn = () => {
    if (!anchorId) return;

    const burnAnchor = storeAnchor ?? sourceAnchor;

    navigation.navigate('ConfirmBurn', {
      anchorId,
      intention: burnAnchor?.intentionText ?? burnAnchor?.intention ?? anchor.intention,
      sigilSvg: burnAnchor?.reinforcedSigilSvg ?? burnAnchor?.baseSigilSvg ?? '',
      enhancedImageUrl: resolveBurnArtworkUri(burnAnchor),
    });
  };

  const handlePracticePress = () => {
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);
    navigateToPractice();
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
      navigation.navigate('ActivationRitual', {
        anchorId,
        activationType: 'visual',
        durationOverride: durationSeconds ?? (type === 'quickActivate' ? 30 : 180),
        returnTo: 'detail',
      });
    } else if (type === 'stabilize') {
      navigation.navigate('Ritual', {
        anchorId,
        ritualType: 'ritual',
        durationSeconds: durationSeconds ?? 180,
        returnTo: 'detail',
      });
    }
  };

  const handleDelete = () => {
    if (!anchorId) return;

    Alert.alert('Delete Anchor', 'Delete this anchor permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await del(`/api/anchors/${anchorId}`);
          } catch {
            // Keep local delete behavior even if backend is unreachable.
          }
          removeAnchor(anchorId);
          navigation.popToTop();
        },
      },
    ]);
  };

  const captureAnchorArtwork = async () => {
    const uri = await exportCanvasRef.current?.capture?.();
    if (!uri) {
      throw new Error('Unable to generate your anchor artwork right now.');
    }
    return uri;
  };

  const handleArtworkExport = async (mode) => {
    if (!anchorId) {
      Alert.alert('Anchor unavailable', 'Unable to export because no anchor ID was provided.');
      return;
    }

    setExportBusyMode(mode);

    try {
      await exportAnchorArtwork({
        anchor: {
          anchorName: sourceAnchor?.name ?? sourceAnchor?.title ?? anchor.name ?? 'Anchor',
          intentionText: sourceAnchor?.intentionText ?? sourceAnchor?.intention ?? anchor.intention,
        },
        mode,
        captureArtwork: captureAnchorArtwork,
      });

      if (mode === 'download') {
        Alert.alert('PNG saved', 'Saved to your photo library.');
      }
    } catch (error) {
      Alert.alert(
        mode === 'download' ? 'PNG export failed' : 'Wallpaper export failed',
        error?.message ?? 'Unable to export this anchor right now.'
      );
    } finally {
      setExportBusyMode(null);
    }
  };

  const handleDownloadPNG = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const uri = await captureRef(anchorCardRef, { format: 'png', quality: 1 });
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved', 'Your anchor has been saved to your photo library.');
    } catch {
      Alert.alert('Error', 'Could not save image. Please check your permissions.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSetWallpaper = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const uri = await captureRef(anchorCardRef, { format: 'png', quality: 1 });
      await MediaLibrary.saveToLibraryAsync(uri);
      await Share.share({ url: uri });
    } catch {
      Alert.alert('Error', 'Could not open share sheet.');
    } finally {
      setIsExporting(false);
    }
  };

  // Removed renderHeroAction and renderRitualCards in favor of the new Primary CTA architecture.


  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      <ZenBackground variant="practice" showOrbs showGrain showVignette />

      {/* ── HEADER ── */}
      <BlurView
        intensity={perfTier === 'high' ? 30 : perfTier === 'medium' ? 12 : 0}
        tint="dark"
        style={s.header}
      >
        <TouchableOpacity onPress={() => navigation?.goBack()} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>ANCHOR DETAILS</Text>
      </BlurView>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + spacing.xl + spacing.sm }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── TITLE CARD ── */}
        <FadeUp delay={50}>
          <Reanimated.View style={[s.animatedCardShell, topCardPulseStyle]}>
            <LinearGradient
              colors={CARD_GRADIENT}
              style={[s.card, s.cardGold]}
            >
              <Text style={s.anchorEyebrow}>CURRENT ANCHOR</Text>
              <Text style={s.intentionText}>{anchor.intention}</Text>
              <View style={s.badgeRow}>
                <View style={s.badgeDesire}>
                  <View style={[s.badgeDot, { backgroundColor: colors.gold }]} />
                  <Text style={[s.badgeText, { color: colors.gold }]}>{anchor.category}</Text>
                </View>
                <View style={[s.badgeCharged, !anchor.charged && s.badgeDormant]}>
                  <Text style={s.badgeIcon}>{anchor.charged ? '⚡' : '💤'}</Text>
                  <Text style={[s.badgeText, { color: anchor.charged ? C.goldBright : C.textDim }]}>
                    {anchor.charged ? 'Primed' : 'Dormant'}
                  </Text>
                </View>
              </View>
            </LinearGradient>
            <Reanimated.View pointerEvents="none" style={[s.cardAuraOverlay, topCardAuraStyle]}>
              <LinearGradient
                colors={['rgba(255, 223, 133, 0.14)', 'rgba(245, 198, 82, 0.05)', 'rgba(255, 223, 133, 0.14)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
            </Reanimated.View>
          </Reanimated.View>
        </FadeUp>

        {/* ── SIGIL CARD ── */}
        <FadeUp delay={120}>
          <View style={s.sigilAuraContainer}>
            {/* DivineSigilAura only for uncharged — sits behind the card.
                On low-tier devices we swap in BakedGlow, which composites a
                single hardware-cached radial gradient instead of the full
                Skia particle canvas. */}
            {!anchor.charged && (
              <View pointerEvents="none" style={s.sigilAuraCanvas}>
                {perfTier === 'low' ? (
                  <BakedGlow size={SCREEN_W * 1.25} />
                ) : (
                  <DivineSigilAura
                    size={SCREEN_W * 1.25}
                    enabled={divineGlowActive}
                    breath={divineBreath}
                    tier={perfTier}
                  />
                )}
              </View>
            )}
            <View style={s.sigilCard}>
              <LinearGradient
                colors={['#1a0f35', '#0d0820', '#080510']}
                style={s.sigilWrapper}
              >
                {!divineGlowActive && <BreathingGlow animate={perfTier === 'high'} />}

                {/* ChargedGlowCanvas fills inside the card for charged
                    anchors. Low-tier substitutes BakedGlow; medium-tier
                    keeps the Skia look but freezes the per-frame update. */}
                {anchor.charged && perfTier === 'low' && (
                  <BakedGlow size={SCREEN_W * 0.65} />
                )}
                {anchor.charged && perfTier !== 'low' && (
                  <ChargedGlowCanvas
                    size={SCREEN_W * 0.65}
                    reduceMotionEnabled={false}
                    tier={perfTier}
                  />
                )}

                {/* Purple backdrop for charged anchors */}
                {anchor.charged && (
                  <View style={s.chargedSigilBackdrop} />
                )}

                {anchor.sigilUri ? (
                  <Image
                    source={{ uri: anchor.sigilUri }}
                    style={[s.sigilImage, anchor.charged && s.chargedSigilImage]}
                    resizeMode="cover"
                  />
                ) : anchor.baseSigilSvg ? (
                  <View style={[s.sigilPlaceholder, anchor.charged && s.chargedSigilPlaceholder]}>
                    <SvgXml
                      xml={anchor.baseSigilSvg}
                      width={SIGIL_CIRCLE_SIZE * (anchor.charged ? 0.72 : 1)}
                      height={SIGIL_CIRCLE_SIZE * (anchor.charged ? 0.72 : 1)}
                    />
                  </View>
                ) : (
                  <LinearGradient
                    colors={['#2a1a60', '#0f0830', '#050015']}
                    style={[s.sigilPlaceholder, anchor.charged && s.chargedSigilPlaceholder]}
                  >
                    <Text style={{ fontSize: 72 }}>🎵</Text>
                  </LinearGradient>
                )}
              </LinearGradient>
            </View>
          </View>
        </FadeUp>

        {/* ── STATS CARD ── */}
        <FadeUp delay={180}>
          <Reanimated.View style={[s.animatedCardShell, statsCardPulseStyle]}>
            <LinearGradient colors={[colors.practice.threadSurface, colors.practice.threadSurface]} style={[s.card, s.statsCard]}>
              <View style={s.miniStreakCard}>
                <View style={s.miniStreakLeft}>
                  <View style={s.miniStreakIcon}>
                    <Zap size={16} color={colors.gold} />
                  </View>
                  <View>
                    <Text testID="anchor-detail-streak-value" style={s.miniStreakNum}>
                      {anchorPractice.currentStreak}
                      <Text style={s.miniStreakUnit}> {currentStreakUnit}</Text>
                    </Text>
                    <Text style={s.miniStreakSub}>Thread Strength</Text>
                  </View>
                </View>

                <View style={s.miniDays}>
                  <View style={s.miniThreadBarWrap}>
                    <View style={[s.miniThreadBar, { width: `${threadStrengthValue}%` }]} />
                  </View>
                  <MiniWeekTrack weekHistory={anchorPractice.weekHistory} lastPrimedAt={anchorPractice.lastPrimedAt} />
                </View>
              </View>

              <Text style={s.miniAffirmation}>The symbol is becoming part of you.</Text>

              {/* Distilled row */}
              <View style={s.distilledRow}>
                <Text style={s.distilledLabel}>DISTILLED</Text>
                <View style={s.distilledTags}>
                  {anchor.distilled.map((t) => (
                    <View key={t} style={s.distilledTag}>
                      <Text style={s.distilledTagText}>{t}</Text>
                    </View>
                  ))}
                </View>
                <Text style={{ color: C.textDim, fontSize: 12, marginLeft: spacing.xs }}>ⓘ</Text>
              </View>
            </LinearGradient>
            <Reanimated.View pointerEvents="none" style={[s.cardAuraOverlay, statsCardAuraStyle]}>
              <LinearGradient
                colors={['rgba(255, 223, 133, 0.18)', 'rgba(245, 198, 82, 0.08)', 'rgba(255, 223, 133, 0.18)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
            </Reanimated.View>
          </Reanimated.View>
        </FadeUp>

        {/* ── PRIMARY CTA ── */}
        <FadeUp delay={220}>
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
        </FadeUp>

        {/* DEFERRED: Direct ritual entry points live on Practice. Restore the secondary ritual sheet here only if the detail screen regains mode-launch responsibilities. */}

        <FadeUp delay={320}>
          <LinearGradient
            colors={CARD_GRADIENT}
            style={[s.card, s.exportCard]}
          >
            <Text style={s.exportEyebrow}>WALLPAPER & EXPORT</Text>
            <Text style={s.exportTitle}>Keep your anchor where you will actually see it.</Text>
            <Text style={s.exportBody}>
              Generate a branded PNG from this anchor, save it to your device, or open the share sheet so you can set it as wallpaper manually.
            </Text>
            <View style={s.exportActionRow}>
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.85}
                disabled={isExporting}
                onPress={handleSetWallpaper}
                style={[s.exportActionButton, s.exportActionPrimary, isExporting && s.exportActionDisabled]}
                testID="anchor-detail-set-wallpaper-button"
              >
                <Text style={s.exportActionPrimaryText}>
                  {isExporting ? 'Opening...' : 'Set as Wallpaper'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.85}
                disabled={isExporting}
                onPress={handleDownloadPNG}
                style={[s.exportActionButton, s.exportActionSecondary, isExporting && s.exportActionDisabled]}
                testID="anchor-detail-download-png-button"
              >
                <Text style={s.exportActionSecondaryText}>
                  {isExporting ? 'Saving...' : 'Download PNG'}
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </FadeUp>

        {/* ── PHYSICAL ANCHOR ── */}
        <FadeUp delay={360}>
          <LinearGradient
            colors={CARD_GRADIENT}
            style={[s.card, s.cardGold]}
          >
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
                ) : anchor.baseSigilSvg ? (
                  <SvgXml
                    xml={anchor.baseSigilSvg}
                    width={58}
                    height={58}
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
                <Text style={s.physicalCopyBody}>A quiet reminder you can carry.</Text>
              </View>
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              style={{ marginBottom: spacing.sm + spacing.xs }}
              onPress={() => Alert.alert('Physical Anchor', 'Physical anchor flow coming soon.')}
            >
              <LinearGradient
                colors={['#b8920a', '#d4a820', '#c49a15']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.createPhysicalBtn}
              >
                <Text style={s.createPhysicalText}>CREATE PHYSICAL ANCHOR</Text>
              </LinearGradient>
            </TouchableOpacity>
            <Text style={s.physicalTags}>Keychains · Prints · Apparel</Text>
          </LinearGradient>
        </FadeUp>

        {/* ── DESTRUCTIVE ACTION ── */}
        <FadeUp delay={380}>
          <TouchableOpacity style={s.deleteBtn} onPress={handleDelete}>
            <Text style={s.deleteBtnText}>Delete Anchor</Text>
          </TouchableOpacity>
        </FadeUp>

        {/* ── FOOTER ── */}
        <FadeUp delay={400}>
          <Text style={s.footerDate}>Created {anchor.createdAt}</Text>
        </FadeUp>

      </ScrollView>

      {/* ── HIDDEN CAPTURE TARGET ── */}
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
        <View style={{ width: 1170 * 0.65, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}>
          {anchor.sigilUri ? (
            <Image source={{ uri: anchor.sigilUri }} style={{ width: '100%', height: '100%', borderRadius: 999 }} resizeMode="cover" />
          ) : anchor.baseSigilSvg ? (
            <SvgXml xml={anchor.baseSigilSvg} width={1170 * 0.65} height={1170 * 0.65} />
          ) : null}
        </View>
        <Text style={{ color: '#F5F5DC', fontFamily: 'CormorantGaramond-Regular', fontSize: 28, textAlign: 'center', marginTop: 48, paddingHorizontal: 80 }}>
          {anchor.intention}
        </Text>
        <Text style={{ color: '#D4AF37', fontFamily: 'Cinzel-Regular', fontSize: 18, letterSpacing: 8, textAlign: 'center', marginTop: 24, marginBottom: 80 }}>
          ANCHOR
        </Text>
      </View>

      <AnchorArtworkExportCanvas
        ref={exportCanvasRef}
        anchorName={sourceAnchor?.name ?? sourceAnchor?.title ?? anchor.name ?? 'Anchor'}
        intentionText={sourceAnchor?.intentionText ?? sourceAnchor?.intention ?? anchor.intention}
        enhancedImageUrl={sourceAnchor?.enhancedImageUrl ?? anchor.enhancedImageUrl}
        sigilSvg={sourceAnchor?.reinforcedSigilSvg ?? sourceAnchor?.baseSigilSvg ?? anchor.baseSigilSvg}
      />

      {/* DEFERRED: MoreRitualsSheet stays off-screen while Anchor Details only routes into Practice. */}
      {/*
      <MoreRitualsSheet
        visible={moreRitualsVisible}
        onClose={() => setMoreRitualsVisible(false)}
        onSelectRitual={handleRitualSelect}
        isCharged={anchor.charged}
      />
      */}
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
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.sm,
  },
  backArrow: {
    color: C.gold, fontSize: 22, opacity: 0.85,
  },
  headerTitle: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 11,
    letterSpacing: 3,
    color: C.silverDim,
  },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
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
    paddingVertical: 6, paddingHorizontal: 14,
    borderRadius: 30,
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.4)',
  },
  badgeDesire: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6, paddingHorizontal: 14,
    borderRadius: 30,
    backgroundColor: colors.practice.cardIconSecondarySurface,
    borderWidth: 1, borderColor: colors.practice.cardIconSecondaryBorder,
  },
  badgeCharged: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6, paddingHorizontal: 14,
    borderRadius: 30,
    backgroundColor: colors.practice.threadIconSurface,
    borderWidth: 1, borderColor: colors.practice.threadIconBorder,
    shadowColor: C.gold,
    shadowOpacity: 0.2, shadowRadius: 8,
  },
  badgeDormant: {
    backgroundColor: colors.practice.heroSwitcherSurface,
    borderColor: colors.practice.heroSwitcherBorder,
    shadowOpacity: 0,
  },
  badgeDot: {
    width: 5, height: 5, borderRadius: 3,
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
  sigilPlaceholder: {
    width: '78%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(201,168,76,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.gold,
    shadowOpacity: 0.2, shadowRadius: 20,
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
    borderWidth: 1, borderColor: 'rgba(156,120,224,0.25)',
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
  statValue: {
    fontFamily: 'serif',
    fontSize: 16,
    fontWeight: '700',
    color: C.textPrimary,
    letterSpacing: 0.5,
  },
  distilledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212,175,55,0.08)',
  },
  distilledLabel: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 8,
    letterSpacing: 2.5,
    color: C.silverDim,
    textTransform: 'uppercase',
  },
  distilledTags: { flexDirection: 'row', gap: spacing.xs + 2 },
  distilledTag: {
    borderWidth: 1, borderColor: colors.practice.cardSecondaryBorder,
    borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  distilledTagText: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 8, letterSpacing: 1, color: C.textSec,
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
    top: 0, bottom: 0,
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
    paddingVertical: 7, paddingHorizontal: 20,
    borderRadius: 30,
    borderWidth: 1, borderColor: 'rgba(140,100,220,0.25)',
  },
  durationPillActive: {
    borderColor: C.goldBorder,
    backgroundColor: 'rgba(201,168,76,0.1)',
    shadowColor: C.gold, shadowOpacity: 0.2, shadowRadius: 8,
  },
  durationText: {
    fontFamily: 'serif',
    fontSize: 10, fontWeight: '700', letterSpacing: 1,
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
    fontSize: 12, fontStyle: 'italic', color: C.goldDim, opacity: 0.96,
  },
  fastReset: {
    fontFamily: 'serif',
    fontSize: 11, fontStyle: 'italic',
    color: C.textDim, textAlign: 'center',
    marginTop: -6,
  },

  // ── COLLAPSIBLE ──
  collapsibleCard: { padding: 18 },
  collapsibleHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  collapsibleTitle: {
    fontFamily: 'serif',
    fontSize: 13, fontWeight: '600', color: C.gold, letterSpacing: 1,
    marginBottom: 3,
  },
  collapsibleMeta: {
    fontFamily: 'serif',
    fontSize: 12, color: C.textSec, marginBottom: 2,
  },
  collapsibleSub: {
    fontFamily: 'serif',
    fontSize: 11, fontStyle: 'italic', color: C.textDim,
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
    fontSize: 13, fontWeight: '700', letterSpacing: 1.6,
  },

  // ── PRACTICE ──
  practiceHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.md,
  },
  practiceTitle: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 13, fontWeight: '600', color: C.gold, letterSpacing: 1,
  },
  practiceItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm + spacing.xs,
  },
  practiceCheck: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
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
    fontSize: 10, fontWeight: '700',
  },
  practiceLabel: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 15, color: C.textPrimary, letterSpacing: 0.3,
  },

  // ── PHYSICAL ──
  physicalEyebrow: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 8, letterSpacing: 3, color: C.silverDim,
    textTransform: 'uppercase', marginBottom: spacing.xs,
  },
  physicalSub: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 13, fontStyle: 'italic', color: C.textSec, marginBottom: spacing.md,
  },
  physicalRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm + spacing.xs, marginBottom: spacing.md,
  },
  physicalThumb: {
    width: 64, height: 64, borderRadius: 12,
    borderWidth: 1, borderColor: colors.practice.cardFeaturedBorder,
    backgroundColor: colors.practice.cardFeaturedSurface,
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
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
    fontSize: 13, fontWeight: '700', color: C.textPrimary, marginBottom: spacing.xs,
  },
  physicalCopyBody: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 12, fontStyle: 'italic', color: C.textSec,
  },
  createPhysicalBtn: {
    borderRadius: 12, padding: 15, alignItems: 'center',
    shadowColor: C.gold, shadowOpacity: 0.25, shadowRadius: 10,
  },
  createPhysicalText: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 12, fontWeight: '800', letterSpacing: 2, color: '#1a0e00',
  },
  physicalTags: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 11, color: C.textDim,
    textAlign: 'center', letterSpacing: 1,
  },
  // ── NEW RITUAL ACTIONS ──
  primaryCtaCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.practice.cardFeaturedBorder,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
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
  exportActionButton: {
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  exportActionPrimary: {
    backgroundColor: colors.gold,
  },
  exportActionSecondary: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  exportActionPrimaryText: {
    color: colors.background.primary,
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    letterSpacing: 0.4,
  },
  exportActionSecondaryText: {
    color: C.textPrimary,
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    letterSpacing: 0.3,
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
    fontSize: 11, fontStyle: 'italic',
    color: C.textDim, textAlign: 'center',
    paddingVertical: spacing.sm, letterSpacing: 0.5,
  },
});
