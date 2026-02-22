// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, isToday } from 'date-fns';
import { SvgXml } from 'react-native-svg';
import { MoreRitualsSheet, RitualType } from '@/components/MoreRitualsSheet';
import { useAuthStore } from '@/stores/authStore';
import { ANCHOR_DETAILS_COPY } from '@/constants/copy';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSessionStore } from '@/stores/sessionStore';
import { del } from '@/services/ApiClient';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { safeHaptics } from '@/utils/haptics';
import * as Haptics from 'expo-haptics';
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
import { ChargedGlowCanvas } from '@/components/common';

const { width: SCREEN_W } = Dimensions.get('window');
const SIGIL_CIRCLE_SIZE = Math.round(SCREEN_W * 0.62);

// ─── TOKENS ──────────────────────────────────────────────
const C = {
  gold: '#c9a84c',
  goldBright: '#f0cb6a',
  goldDim: '#b6934c',
  goldBorder: 'rgba(201,168,76,0.3)',
  purpleDeep: '#0d0818',
  purpleMid: '#1a1030',
  purpleCard: '#130e22',
  purpleBorder: 'rgba(140,100,220,0.18)',
  textPrimary: '#e8dfc8',
  textSec: 'rgba(220,205,176,0.88)',
  textDim: 'rgba(196,181,153,0.72)',
  red: 'rgba(232,140,140,0.9)',
  redBorder: 'rgba(200,80,80,0.3)',
  burn: 'rgba(243,176,112,0.92)',
  burnBorder: 'rgba(200,100,40,0.3)',
};

const CARD_GRADIENT = ['rgba(42,32,84,0.9)', 'rgba(26,18,58,0.93)'];

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
    (lastActivatedDate && isToday(lastActivatedDate) ? 'Activated' : null);

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
const BreathingGlow = () => {
  const scale = useRef(new Animated.Value(0.97)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
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
  }, []);

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
const ShineButton = ({ onPress, children, style }) => {
  const shineX = useRef(new Animated.Value(-SCREEN_W)).current;

  useEffect(() => {
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
  }, []);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={style}>
      <View style={{ overflow: 'hidden', borderRadius: 14 }}>
        <LinearGradient
          colors={['#b8920a', '#d4a820', '#c49a15']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={s.activateInner}
        >
          {children}
          <Animated.View
            style={[
              s.shineSweep,
              { transform: [{ translateX: shineX }] },
            ]}
            pointerEvents="none"
          />
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

const PrimerModal = ({ visible, onActivate, onSkip, onCancel }) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={rs.modalOverlay}>
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
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

const AnchorDetailsScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const getAnchorById = useAnchorStore((state) => state.getAnchorById);
  const removeAnchor = useAnchorStore((state) => state.removeAnchor);
  const currentAnchorId = useAnchorStore((state) => state.currentAnchorId);
  const setCurrentAnchor = useAnchorStore((state) => state.setCurrentAnchor);
  const { defaultActivation, setDefaultActivation } = useSettingsStore();
  const { navigateToPractice } = useTabNavigation();
  const sessionLog = useSessionStore((s) => s.sessionLog);
  const [activeDuration, setActiveDuration] = useState('30s');
  const [primerVisible, setPrimerVisible] = useState(false);
  const [moreRitualsVisible, setMoreRitualsVisible] = useState(false);

  const routeAnchor = route?.params?.anchor;
  const anchorId = route?.params?.anchorId ?? routeAnchor?.id;
  const storeAnchor = anchorId ? getAnchorById(anchorId) : null;
  const sourceAnchor = routeAnchor ?? storeAnchor;
  const anchor = toDisplayAnchor(sourceAnchor) ?? {
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
  };
  // Compute today's session count for THIS anchor from local session log.
  const todayStr = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
  const todaySessionsForAnchor = anchorId
    ? sessionLog.filter(
        (e) => e.anchorId === anchorId && e.completedAt.startsWith(todayStr)
      ).length
    : 0;
  const todayDisplayValue =
    todaySessionsForAnchor > 0
      ? `${todaySessionsForAnchor} session${todaySessionsForAnchor > 1 ? 's' : ''}`
      : anchor.today ?? 'Not yet';

  const divineBreath = useSharedValue(0);
  const divineGlowActive = Boolean(anchor.charged || anchor.today === 'Activated');

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
        elevation: 4,
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
      elevation: Math.round(interpolate(divineBreath.value, [0, 1], [4, 12])),
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
        elevation: 4,
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
      elevation: Math.round(interpolate(divineBreath.value, [0, 1], [4, 14])),
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

    navigation.navigate('ConfirmBurn', {
      anchorId,
      intention: sourceAnchor?.intentionText ?? sourceAnchor?.intention ?? anchor.intention,
      sigilSvg: sourceAnchor?.baseSigilSvg ?? '',
      enhancedImageUrl: sourceAnchor?.enhancedImageUrl,
    });
  };

  const handlePracticePress = () => {
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);
    if (anchorId) setCurrentAnchor(anchorId);
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

  // Removed renderHeroAction and renderRitualCards in favor of the new Primary CTA architecture.


  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      {/* Background atmosphere */}
      <LinearGradient
        colors={['#0F1419', '#3E2C5B', '#1A1A1D']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* ── HEADER ── */}
      <BlurView intensity={30} tint="dark" style={s.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>ANCHOR DETAILS</Text>
      </BlurView>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── TITLE CARD ── */}
        <FadeUp delay={50}>
          <Reanimated.View style={[s.animatedCardShell, topCardPulseStyle]}>
            <LinearGradient
              colors={CARD_GRADIENT}
              style={[s.card, s.cardGold]}
            >
              <Text style={s.anchorName}>"{anchor.name}"</Text>
              <Text style={s.intentionText}>{anchor.intention}</Text>
              <View style={s.badgeRow}>
                {currentAnchorId === anchor.id && (
                  <View style={s.badgeThread}>
                    <Text style={s.badgeIcon}>🧵</Text>
                    <Text style={[s.badgeText, { color: C.goldBright }]}>CURRENT THREAD</Text>
                  </View>
                )}
                <View style={s.badgeDesire}>
                  <View style={[s.badgeDot, { backgroundColor: C.red }]} />
                  <Text style={[s.badgeText, { color: C.red }]}>{anchor.category}</Text>
                </View>
                <View style={[s.badgeCharged, !anchor.charged && s.badgeDormant]}>
                  <Text style={s.badgeIcon}>{anchor.charged ? '⚡' : '💤'}</Text>
                  <Text style={[s.badgeText, { color: anchor.charged ? C.goldBright : C.textDim }]}>
                    {anchor.charged ? 'Charged' : 'Dormant'}
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
            {/* DivineSigilAura only for uncharged — sits behind the card */}
            {!anchor.charged && (
              <View pointerEvents="none" style={s.sigilAuraCanvas}>
                <DivineSigilAura
                  size={SCREEN_W * 1.25}
                  enabled={divineGlowActive}
                  breath={divineBreath}
                />
              </View>
            )}
            <View style={s.sigilCard}>
              <LinearGradient
                colors={['#1a0f35', '#0d0820', '#080510']}
                style={s.sigilWrapper}
              >
                {!divineGlowActive && <BreathingGlow />}

                {/* ChargedGlowCanvas fills inside the card for charged anchors */}
                {anchor.charged && (
                  <ChargedGlowCanvas
                    size={SCREEN_W * 0.65}
                    reduceMotionEnabled={false}
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
            <LinearGradient
              colors={CARD_GRADIENT}
              style={[s.card, s.cardGold]}
            >
              <Text style={[s.statsHeader, !anchor.charged && { color: C.textDim }]}>
                ⟡  {anchor.charged ? 'Charged' : 'Dormant'}  ⟡
              </Text>
              <View style={s.statsGrid}>
                <View style={s.statItem}>
                  <Text style={s.statLabel}>LAST ACTIVATED</Text>
                  <Text style={s.statValue}>{anchor.lastActivated ?? 'Not yet'}</Text>
                </View>
                <View style={s.statItem}>
                  <Text style={s.statLabel}>STREAK</Text>
                  <Text style={[s.statValue, { color: C.goldBright }]}>
                    {anchor.streak} days
                  </Text>
                </View>
                <View style={[s.statItem, s.statItemFull]}>
                  <Text style={s.statLabel}>TODAY</Text>
                  <Text style={s.statValue}>{todayDisplayValue}</Text>
                </View>
              </View>

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
                <Text style={{ color: C.textDim, fontSize: 12, marginLeft: 4 }}>ⓘ</Text>
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
            <LinearGradient
              colors={['#1a1523', '#241a35']}
              style={s.primaryCtaGradient}
            >
              <View style={s.primaryCtaContent}>
                <View style={s.primaryCtaLeft}>
                  <Text style={s.primaryCtaTitle}>{ANCHOR_DETAILS_COPY.primaryCTA}</Text>
                  <Text style={s.primaryCtaSubtitle}>{ANCHOR_DETAILS_COPY.primarySubtitle}</Text>
                </View>
                <View style={s.primaryCtaButtonWrap}>
                  <Text style={s.primaryCtaButtonText}>{ANCHOR_DETAILS_COPY.practiceCta}</Text>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </FadeUp>

        {/* ── SECONDARY ACTION ── */}
        <FadeUp delay={250}>
          <TouchableOpacity
            style={s.moreRitualsGhostBtn}
            activeOpacity={0.8}
            onPress={handleMoreRitualsPress}
          >
            <Text style={s.moreRitualsGhostText}>{ANCHOR_DETAILS_COPY.moreRituals}</Text>
          </TouchableOpacity>
        </FadeUp>

        {/* ── YOUR PRACTICE ── */}
        <FadeUp delay={360}>
          <LinearGradient
            colors={CARD_GRADIENT}
            style={s.card}
          >
            <View style={s.practiceHeader}>
              <Text style={s.practiceTitle}>Your Practice</Text>
              <Text style={{ color: C.goldDim, fontSize: 11 }}>▼</Text>
            </View>
            <View style={{ gap: 12 }}>
              {[
                { label: 'Create', done: anchor.practiceCreate, tag: '✓', progress: null },
                { label: 'Charge', done: anchor.practiceCharge, tag: '✓', progress: null },
                { label: 'Activate daily', done: false, tag: null, progress: `${anchor.practiceActivateDays}/7` },
              ].map((item) => (
                <View key={item.label} style={s.practiceItem}>
                  <View style={[
                    s.practiceCheck,
                    item.done ? s.checkComplete : s.checkProgress,
                  ]}>
                    <Text style={[
                      s.practiceCheckText,
                      { color: item.done ? C.gold : 'rgba(160,130,220,0.7)' },
                    ]}>
                      {item.tag ?? item.progress}
                    </Text>
                  </View>
                  <Text style={[s.practiceLabel, !item.done && { color: C.textSec }]}>
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>
          </LinearGradient>
        </FadeUp>

        {/* ── PHYSICAL ANCHOR ── */}
        <FadeUp delay={400}>
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
              style={{ marginBottom: 10 }}
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
        <FadeUp delay={420}>
          <TouchableOpacity style={s.deleteBtn} onPress={handleDelete}>
            <Text style={s.deleteBtnText}>Delete Anchor</Text>
          </TouchableOpacity>
        </FadeUp>

        {/* ── FOOTER ── */}
        <FadeUp delay={440}>
          <Text style={s.footerDate}>Created {anchor.createdAt}</Text>
        </FadeUp>

      </ScrollView>

      {/* Sheet overlay — rendered last so it sits above all screen content */}
      <MoreRitualsSheet
        visible={moreRitualsVisible}
        onClose={() => setMoreRitualsVisible(false)}
        onSelectRitual={handleRitualSelect}
        isCharged={anchor.charged}
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
    backgroundColor: C.purpleDeep,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(140,100,220,0.1)',
  },
  backBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
  backArrow: {
    color: C.gold, fontSize: 22, opacity: 0.85,
  },
  headerTitle: {
    fontFamily: 'Cinzel_500Medium', // or use a loaded font
    fontSize: 13,
    letterSpacing: 3,
    color: C.gold,
    opacity: 0.9,
  },
  scroll: {
    padding: 16,
    gap: 14,
  },

  // ── CARD ──
  card: {
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: C.purpleBorder,
    overflow: 'hidden',
  },
  animatedCardShell: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: 'rgba(201,168,76,0.24)',
    overflow: 'hidden',
  },
  cardAuraOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    zIndex: 2,
  },
  cardGold: {
    borderColor: C.goldBorder,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },

  // ── TITLE CARD ──
  anchorName: {
    fontFamily: 'serif',
    fontSize: 20,
    fontWeight: '700',
    color: '#f0e8d0',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 6,
    textShadowColor: 'rgba(201,168,76,0.2)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  intentionText: {
    fontFamily: 'serif',
    fontSize: 12,
    fontStyle: 'italic',
    color: C.textSec,
    textAlign: 'center',
    letterSpacing: 0.3,
    marginBottom: 16,
    lineHeight: 18,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
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
    backgroundColor: 'rgba(120,40,40,0.4)',
    borderWidth: 1, borderColor: 'rgba(200,80,80,0.3)',
  },
  badgeCharged: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6, paddingHorizontal: 14,
    borderRadius: 30,
    backgroundColor: 'rgba(60,45,10,0.5)',
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.4)',
    shadowColor: C.gold,
    shadowOpacity: 0.2, shadowRadius: 8,
  },
  badgeDormant: {
    backgroundColor: 'rgba(40,40,60,0.4)',
    borderColor: 'rgba(140,100,220,0.2)',
    shadowOpacity: 0,
  },
  badgeDot: {
    width: 5, height: 5, borderRadius: 3,
  },
  badgeIcon: { fontSize: 11 },
  badgeText: {
    fontFamily: 'serif',
    fontSize: 10,
    fontWeight: '700',
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
    gap: 8,
    paddingTop: 14,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(140,100,220,0.1)',
  },
  distilledLabel: {
    fontFamily: 'serif',
    fontSize: 8,
    letterSpacing: 2.5,
    color: C.textDim,
    textTransform: 'uppercase',
  },
  distilledTags: { flexDirection: 'row', gap: 6 },
  distilledTag: {
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.15)',
    borderRadius: 4, paddingVertical: 2, paddingHorizontal: 7,
  },
  distilledTagText: {
    fontFamily: 'serif',
    fontSize: 8, letterSpacing: 1, color: 'rgba(201,168,76,0.5)',
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
    marginBottom: 16,
  },
  practiceTitle: {
    fontFamily: 'serif',
    fontSize: 13, fontWeight: '600', color: C.gold, letterSpacing: 1,
  },
  practiceItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
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
    fontFamily: 'serif',
    fontSize: 10, fontWeight: '700',
  },
  practiceLabel: {
    fontFamily: 'serif',
    fontSize: 15, color: C.textPrimary, letterSpacing: 0.3,
  },

  // ── PHYSICAL ──
  physicalEyebrow: {
    fontFamily: 'serif',
    fontSize: 9, letterSpacing: 3, color: C.gold,
    textTransform: 'uppercase', marginBottom: 4, opacity: 0.8,
  },
  physicalSub: {
    fontFamily: 'serif',
    fontSize: 13, fontStyle: 'italic', color: C.textSec, marginBottom: 16,
  },
  physicalRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16,
  },
  physicalThumb: {
    width: 64, height: 64, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.25)',
    backgroundColor: 'rgba(26,20,58,0.85)',
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
    fontFamily: 'serif',
    fontSize: 13, fontWeight: '700', color: C.textPrimary, marginBottom: 4,
  },
  physicalCopyBody: {
    fontFamily: 'serif',
    fontSize: 12, fontStyle: 'italic', color: C.textSec,
  },
  createPhysicalBtn: {
    borderRadius: 12, padding: 15, alignItems: 'center',
    shadowColor: C.gold, shadowOpacity: 0.25, shadowRadius: 10,
  },
  createPhysicalText: {
    fontFamily: 'serif',
    fontSize: 12, fontWeight: '800', letterSpacing: 2, color: '#1a0e00',
  },
  physicalTags: {
    fontFamily: 'serif',
    fontSize: 11, color: C.textDim,
    textAlign: 'center', letterSpacing: 1,
  },
  // ── NEW RITUAL ACTIONS ──
  primaryCtaCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.4)',
    overflow: 'hidden',
  },
  primaryCtaGradient: {
    padding: 20,
  },
  primaryCtaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  primaryCtaLeft: {
    flex: 1,
  },
  primaryCtaTitle: {
    fontFamily: 'serif',
    fontSize: 18,
    fontWeight: '700',
    color: C.gold,
    letterSpacing: 0.5,
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

  // ── FOOTER ──
  footerDate: {
    fontFamily: 'serif',
    fontSize: 11, fontStyle: 'italic',
    color: C.textDim, textAlign: 'center',
    paddingVertical: 8, letterSpacing: 0.5,
  },
});
