import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  Easing,
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { type StackNavigationProp } from '@react-navigation/stack';
import { SvgXml } from 'react-native-svg';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Polygon, Stop } from 'react-native-svg';
import { OptimizedImage } from '@/components/common';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { safeHaptics } from '@/utils/haptics';
import type { RootStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { RitualScaffold } from './components/RitualScaffold';
import { RitualTopBar } from './components/RitualTopBar';

type ChargeSetupRouteProp = RouteProp<RootStackParamList, 'ChargeSetup'>;
type ChargeSetupNavigationProp = StackNavigationProp<RootStackParamList, 'ChargeSetup'>;
type DurationChoice = 'quick' | 'deep';

const HERO_SIZE = 248;
const HERO_CORONA_SIZE = 268;
const HERO_HEIGHT = 400;
const SIGIL_DISK_SIZE = 208;
const CTA_AREA_HEIGHT = 164;

const withOpacity = (hexColor: string, opacity: number): string => {
  const raw = hexColor.replace('#', '').trim();
  if (raw.length !== 6) return hexColor;
  const normalized = Math.min(1, Math.max(0, opacity));
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${normalized})`;
};

const ritualColors = {
  transparent: withOpacity(colors.background.primary, 0),
  atmosphereTop: withOpacity(colors.deepPurple, 0.86),
  atmosphereMid: withOpacity(colors.background.primary, 0.96),
  heroBloomCenter: withOpacity(colors.sanctuary.gold, 0.18),
  heroBloomMid: withOpacity(colors.sanctuary.gold, 0.08),
  heroBloomEdge: withOpacity(colors.sanctuary.gold, 0),
  heroSweepArc: withOpacity(colors.sanctuary.goldBright, 0.24),
  heroSweepTail: withOpacity(colors.sanctuary.gold, 0.04),
  coronaBorder: withOpacity(colors.sanctuary.gold, 0.22),
  coronaShadow: withOpacity(colors.sanctuary.gold, 0.34),
  poolCenter: withOpacity(colors.sanctuary.gold, 0.22),
  poolEdge: withOpacity(colors.sanctuary.gold, 0),
  heroSurface: withOpacity(colors.deepPurple, 0.33),
  heroSurfaceBorder: withOpacity(colors.sanctuary.gold, 0.2),
  sigilSurface: withOpacity(colors.background.secondary, 0.92),
  badgeLine: withOpacity(colors.sanctuary.gold, 0.3),
  badgeText: colors.bronze,
  headingText: colors.bone,
  subHeadingText: withOpacity(colors.text.secondary, 0.74),
  durationLabel: colors.bronze,
  pillSurface: withOpacity(colors.background.secondary, 0.92),
  pillBorder: withOpacity(colors.sanctuary.gold, 0.18),
  pillSelectedSurface: withOpacity(colors.sanctuary.gold, 0.11),
  pillSelectedBorder: withOpacity(colors.sanctuary.gold, 0.56),
  pillCheckSurface: colors.gold,
  pillCheckText: colors.background.primary,
  pillTime: withOpacity(colors.text.secondary, 0.9),
  pillDesc: withOpacity(colors.text.tertiary, 0.74),
  ctaFadeTop: withOpacity(colors.background.primary, 0),
  ctaFadeBottom: withOpacity(colors.background.primary, 0.96),
  ctaText: colors.background.primary,
  stopText: withOpacity(colors.text.secondary, 0.8),
  fallbackSymbol: withOpacity(colors.sanctuary.gold, 0.85),
  goldGradientStart: withOpacity(colors.sanctuary.gold, 0.3),
  goldGradientBright: withOpacity(colors.sanctuary.goldBright, 0.95),
  goldGradientMid: withOpacity(colors.sanctuary.gold, 0.54),
  dashedStroke: withOpacity(colors.sanctuary.gold, 0.14),
};

const chargeConfigByChoice = {
  quick: {
    mode: 'focus' as const,
    preset: '30s' as const,
    ritualType: 'focus' as const,
    durationSeconds: 30,
    ctaLabel: 'BEGIN CHARGING',
    icon: '⚡',
    name: 'Quick',
    time: '30 seconds',
    desc: 'Fast focused session',
  },
  deep: {
    mode: 'ritual' as const,
    preset: '5m' as const,
    ritualType: 'ritual' as const,
    durationSeconds: 300,
    ctaLabel: 'BEGIN DEEP CHARGE',
    icon: '🔥',
    name: 'Deep',
    time: '~5 minutes',
    desc: 'Guided 5-phase ritual',
  },
};

export const ChargeSetupScreen: React.FC = () => {
  const navigation = useNavigation<ChargeSetupNavigationProp>();
  const route = useRoute<ChargeSetupRouteProp>();
  const { anchorId, returnTo } = route.params || {};

  const getAnchorById = useAnchorStore((state) => state.getAnchorById);
  const { setDefaultCharge } = useSettingsStore();
  const anchor = getAnchorById(anchorId);

  const [selectedDuration, setSelectedDuration] = useState<DurationChoice>('quick');
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const isNavigatingRef = useRef(false);
  const anchorLayoutRef = useRef<{ y: number }>({ y: 0 });

  const bloomAnim = useRef(new Animated.Value(0)).current;
  const sweepAnim = useRef(new Animated.Value(0)).current;
  const coronaAnim = useRef(new Animated.Value(0.8)).current;
  const poolAnim = useRef(new Animated.Value(0)).current;
  const sigilAnim = useRef(new Animated.Value(0)).current;
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const ctaPressAnim = useRef(new Animated.Value(0)).current;

  const selectedConfig = chargeConfigByChoice[selectedDuration];

  const bloomScale = bloomAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.08],
  });
  const bloomOpacity = bloomAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });
  const sweepRotate = sweepAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const poolOpacity = poolAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });
  const poolScale = poolAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.82, 1.09],
  });
  const sigilScale = sigilAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.02],
  });
  const ctaScale = ctaPressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.98],
  });
  const ctaOpacity = ctaPressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.92],
  });

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotionEnabled);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotionEnabled);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (reduceMotionEnabled) {
      heroOpacity.setValue(1);
      contentOpacity.setValue(1);
      bloomAnim.setValue(1);
      sweepAnim.setValue(0);
      coronaAnim.setValue(0.85);
      poolAnim.setValue(0.8);
      sigilAnim.setValue(0.5);
      return;
    }

    const entryAnimation = Animated.parallel([
      Animated.timing(heroOpacity, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    const bloomLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bloomAnim, {
          toValue: 1,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bloomAnim, {
          toValue: 0,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const sweepLoop = Animated.loop(
      Animated.timing(sweepAnim, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const coronaLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(coronaAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(coronaAnim, {
          toValue: 0.7,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(coronaAnim, {
          toValue: 0.85,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const poolLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(1000),
        Animated.timing(poolAnim, {
          toValue: 1,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(poolAnim, {
          toValue: 0,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const sigilLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sigilAnim, {
          toValue: 1,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(sigilAnim, {
          toValue: 0,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    entryAnimation.start();
    bloomLoop.start();
    sweepLoop.start();
    coronaLoop.start();
    poolLoop.start();
    sigilLoop.start();

    return () => {
      bloomLoop.stop();
      sweepLoop.stop();
      coronaLoop.stop();
      poolLoop.stop();
      sigilLoop.stop();
    };
  }, [
    bloomAnim,
    contentOpacity,
    coronaAnim,
    heroOpacity,
    poolAnim,
    reduceMotionEnabled,
    sigilAnim,
    sweepAnim,
  ]);

  const navigateToRitual = useCallback(() => {
    navigation.navigate('Ritual', {
      anchorId,
      ritualType: selectedConfig.ritualType,
      durationSeconds: selectedConfig.durationSeconds,
      returnTo,
    });
  }, [anchorId, navigation, returnTo, selectedConfig.durationSeconds, selectedConfig.ritualType]);

  const handleBeginRitual = useCallback(() => {
    if (isNavigatingRef.current || isTransitioning) return;
    isNavigatingRef.current = true;
    setIsTransitioning(true);

    setDefaultCharge({
      mode: selectedConfig.mode,
      preset: selectedConfig.preset,
      customMinutes: undefined,
    });

    void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);

    if (reduceMotionEnabled) {
      navigateToRitual();
      return;
    }

    Animated.sequence([
      Animated.timing(ctaPressAnim, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(ctaPressAnim, {
        toValue: 0,
        duration: 210,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      navigateToRitual();
    });
  }, [
    ctaPressAnim,
    isTransitioning,
    navigateToRitual,
    reduceMotionEnabled,
    selectedConfig.mode,
    selectedConfig.preset,
    setDefaultCharge,
  ]);

  const handleSelectDuration = (choice: DurationChoice) => {
    setSelectedDuration(choice);
    void safeHaptics.selection();
  };

  const handleBack = () => {
    if (isTransitioning) return;
    navigation.goBack();
  };

  const handleAnchorLayout = (event: LayoutChangeEvent) => {
    anchorLayoutRef.current = { y: event.nativeEvent.layout.y };
  };

  useFocusEffect(
    useCallback(() => {
      isNavigatingRef.current = false;
      setIsTransitioning(false);
      ctaPressAnim.setValue(0);
      const onBackPress = () => isTransitioning;
      BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [ctaPressAnim, isTransitioning])
  );

  const pills = useMemo(
    () => (['quick', 'deep'] as const).map((choice) => ({ choice, ...chargeConfigByChoice[choice] })),
    []
  );

  if (!anchorId || !anchor) {
    return (
      <RitualScaffold>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Anchor Not Found</Text>
          <Text style={styles.errorText}>We could not load your anchor. Please try again.</Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={handleBack}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Go Back"
          >
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </RitualScaffold>
    );
  }

  return (
    <RitualScaffold>
      <View style={styles.container}>
        <Animated.View style={{ opacity: contentOpacity }}>
          <RitualTopBar
            onBack={handleBack}
            title="Charge Your Anchor"
            disableBack={isTransitioning}
          />
        </Animated.View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!isTransitioning}
        >
          <Animated.View style={[styles.heroContainer, { opacity: heroOpacity }]} onLayout={handleAnchorLayout}>
            <LinearGradient
              colors={[ritualColors.atmosphereTop, ritualColors.atmosphereMid, ritualColors.transparent]}
              style={StyleSheet.absoluteFillObject}
            />

            <Animated.View
              pointerEvents="none"
              style={[
                styles.glowBloom,
                {
                  transform: [{ scale: bloomScale }],
                  opacity: bloomOpacity,
                },
              ]}
            />

            <Animated.View
              pointerEvents="none"
              style={[
                styles.glowSweep,
                {
                  transform: [{ rotate: sweepRotate }],
                },
              ]}
            >
              <LinearGradient
                colors={[ritualColors.transparent, ritualColors.heroSweepArc, ritualColors.heroSweepTail, ritualColors.transparent]}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={styles.glowSweepArc}
              />
            </Animated.View>

            <Animated.View pointerEvents="none" style={[styles.glowCorona, { opacity: coronaAnim }]} />

            <Animated.View style={[styles.octagonWrap, { transform: [{ scale: sigilScale }] }]}>
              <View style={styles.octagonClip}>
                <View style={styles.sigilDisk}>{renderAnchorSymbol(anchor)}</View>
              </View>
              <OctagonBorderSVG />
            </Animated.View>

            <Animated.View
              pointerEvents="none"
              style={[
                styles.glowPool,
                {
                  opacity: poolOpacity,
                  transform: [{ scaleX: poolScale }],
                },
              ]}
            />
          </Animated.View>

          <Animated.View style={[styles.contentPanel, { opacity: contentOpacity }]}>
            <View style={styles.firstChargeBadge}>
              <LinearGradient
                colors={[ritualColors.transparent, ritualColors.badgeLine]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.badgeLine}
              />
              <Text style={styles.badgeText}>FIRST CHARGE</Text>
              <LinearGradient
                colors={[ritualColors.badgeLine, ritualColors.transparent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.badgeLine}
              />
            </View>

            <Text style={styles.mainHeading}>Seal your intention{'\n'}into the symbol</Text>
            <Text style={styles.subHeading}>Choose how long to hold focus.</Text>

            <Text style={styles.durationLabel}>SELECT DURATION</Text>

            <View style={styles.pillsRow}>
              {pills.map((pill) => {
                const isSelected = selectedDuration === pill.choice;
                return (
                  <TouchableOpacity
                    key={pill.choice}
                    style={[styles.pill, isSelected ? styles.pillSelected : null]}
                    onPress={() => handleSelectDuration(pill.choice)}
                    activeOpacity={0.82}
                    accessibilityRole="radio"
                    accessibilityLabel={`${pill.name} duration`}
                    accessibilityState={{ selected: isSelected }}
                    disabled={isTransitioning}
                  >
                    {isSelected ? (
                      <View style={styles.pillCheck}>
                        <Text style={styles.pillCheckMark}>✓</Text>
                      </View>
                    ) : null}
                    <Text style={styles.pillIcon}>{pill.icon}</Text>
                    <Text style={[styles.pillName, isSelected ? styles.pillNameSelected : null]}>{pill.name}</Text>
                    <Text style={styles.pillTime}>{pill.time}</Text>
                    <Text style={styles.pillDesc}>{pill.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        </ScrollView>

        <View style={styles.ctaWrapper} pointerEvents="box-none">
          <LinearGradient
            pointerEvents="none"
            colors={[ritualColors.ctaFadeTop, ritualColors.ctaFadeBottom]}
            style={StyleSheet.absoluteFillObject}
          />
          <TouchableOpacity
            onPress={handleBeginRitual}
            activeOpacity={0.88}
            disabled={isTransitioning}
            accessibilityRole="button"
            accessibilityLabel={selectedConfig.ctaLabel}
            style={styles.ctaTouchable}
          >
            <Animated.View style={[styles.ctaButton, { transform: [{ scale: ctaScale }], opacity: ctaOpacity }]}>
              <LinearGradient
                colors={[
                  colors.practice.ctaGradientStart,
                  colors.practice.ctaGradientMid,
                  colors.practice.ctaGradientEnd,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaGradient}
              >
                <Text style={styles.ctaBtnText}>{selectedConfig.ctaLabel}</Text>
              </LinearGradient>
            </Animated.View>
          </TouchableOpacity>
          <Text style={styles.stopText}>You can stop anytime.</Text>
        </View>
      </View>
    </RitualScaffold>
  );

  function renderAnchorSymbol(currentAnchor: NonNullable<typeof anchor>) {
    if (currentAnchor.enhancedImageUrl) {
      return (
        <OptimizedImage
          uri={currentAnchor.enhancedImageUrl}
          style={styles.sigilImage}
          resizeMode="cover"
        />
      );
    }

    if (currentAnchor.baseSigilSvg) {
      return (
        <View style={styles.sigilSvgWrap}>
          <SvgXml xml={currentAnchor.baseSigilSvg} width={SIGIL_DISK_SIZE * 0.74} height={SIGIL_DISK_SIZE * 0.74} />
        </View>
      );
    }

    return <Text style={styles.fallbackSymbol}>◈</Text>;
  }
};

const OctagonBorderSVG: React.FC = () => (
  <Svg
    width={HERO_SIZE}
    height={HERO_SIZE}
    viewBox="0 0 248 248"
    style={StyleSheet.absoluteFillObject}
  >
    <Defs>
      <SvgLinearGradient
        id="goldGrad"
        x1="0"
        y1="0"
        x2="248"
        y2="248"
        gradientUnits="userSpaceOnUse"
      >
        <Stop offset="0%" stopColor={ritualColors.goldGradientStart} />
        <Stop offset="25%" stopColor={ritualColors.goldGradientBright} />
        <Stop offset="50%" stopColor={ritualColors.goldGradientMid} />
        <Stop offset="75%" stopColor={ritualColors.goldGradientBright} />
        <Stop offset="100%" stopColor={ritualColors.goldGradientStart} />
      </SvgLinearGradient>
    </Defs>

    <Polygon
      points="72,2 176,2 246,72 246,176 176,246 72,246 2,176 2,72"
      stroke="url(#goldGrad)"
      strokeWidth={1.5}
      fill="none"
    />
    <Polygon
      points="77,10 171,10 238,77 238,171 171,238 77,238 10,171 10,77"
      stroke={ritualColors.dashedStroke}
      strokeWidth={0.7}
      fill="none"
      strokeDasharray="4 6"
    />
    {([
      [72, 2], [176, 2], [246, 72], [246, 176],
      [176, 246], [72, 246], [2, 176], [2, 72],
    ] as [number, number][]).map(([cx, cy], index) => (
      <Circle key={`vertex-${index}`} cx={cx} cy={cy} r={2.2} fill={colors.sanctuary.gold} opacity={0.85} />
    ))}
  </Svg>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: CTA_AREA_HEIGHT + spacing.xl,
  },
  heroContainer: {
    height: HERO_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: spacing.sm,
    position: 'relative',
  },
  glowBloom: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: ritualColors.heroBloomCenter,
    shadowColor: colors.sanctuary.gold,
    shadowOpacity: 0.26,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
  },
  glowSweep: {
    position: 'absolute',
    width: 310,
    height: 310,
    borderRadius: 155,
    overflow: 'hidden',
  },
  glowSweepArc: {
    flex: 1,
    borderRadius: 155,
  },
  glowCorona: {
    position: 'absolute',
    width: HERO_CORONA_SIZE,
    height: HERO_CORONA_SIZE,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ritualColors.coronaBorder,
    shadowColor: ritualColors.coronaShadow,
    shadowOpacity: 0.38,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
    zIndex: 3,
  },
  octagonWrap: {
    width: HERO_SIZE,
    height: HERO_SIZE,
    zIndex: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  octagonClip: {
    width: HERO_SIZE,
    height: HERO_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: ritualColors.heroSurface,
    borderWidth: 1,
    borderColor: ritualColors.heroSurfaceBorder,
  },
  sigilDisk: {
    width: SIGIL_DISK_SIZE,
    height: SIGIL_DISK_SIZE,
    borderRadius: SIGIL_DISK_SIZE / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: ritualColors.sigilSurface,
  },
  sigilImage: {
    width: SIGIL_DISK_SIZE,
    height: SIGIL_DISK_SIZE,
    borderRadius: SIGIL_DISK_SIZE / 2,
  },
  sigilSvgWrap: {
    width: SIGIL_DISK_SIZE,
    height: SIGIL_DISK_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackSymbol: {
    fontSize: 88,
    color: ritualColors.fallbackSymbol,
    fontFamily: typography.fonts.heading,
  },
  glowPool: {
    position: 'absolute',
    bottom: 5,
    width: 220,
    height: 50,
    borderRadius: 999,
    backgroundColor: ritualColors.poolCenter,
    shadowColor: colors.sanctuary.gold,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  contentPanel: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  firstChargeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  badgeLine: {
    flex: 1,
    height: 1,
  },
  badgeText: {
    fontFamily: typography.fonts.heading,
    fontSize: 10,
    letterSpacing: 4,
    color: ritualColors.badgeText,
  },
  mainHeading: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h3,
    fontWeight: '600',
    color: ritualColors.headingText,
    textAlign: 'center',
    lineHeight: typography.lineHeights.h3,
    letterSpacing: 0.4,
    marginBottom: spacing.xs + 1,
  },
  subHeading: {
    fontSize: typography.sizes.body2 + 1,
    fontFamily: typography.fonts.body,
    color: ritualColors.subHeadingText,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: spacing.sm + 4,
  },
  durationLabel: {
    fontFamily: typography.fonts.heading,
    fontSize: 10,
    letterSpacing: 3.5,
    color: ritualColors.durationLabel,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
  },
  pill: {
    flex: 1,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ritualColors.pillBorder,
    backgroundColor: ritualColors.pillSurface,
    alignItems: 'center',
    position: 'relative',
  },
  pillSelected: {
    borderColor: ritualColors.pillSelectedBorder,
    backgroundColor: ritualColors.pillSelectedSurface,
    shadowColor: colors.sanctuary.gold,
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  pillCheck: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: ritualColors.pillCheckSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillCheckMark: {
    fontSize: 9,
    color: ritualColors.pillCheckText,
    fontWeight: '700',
  },
  pillIcon: {
    fontSize: 18,
    marginBottom: spacing.xs,
  },
  pillName: {
    fontFamily: typography.fonts.heading,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: colors.bone,
    marginBottom: spacing.xs - 1,
  },
  pillNameSelected: {
    color: colors.gold,
  },
  pillTime: {
    fontSize: 12,
    fontFamily: typography.fonts.body,
    color: ritualColors.pillTime,
    marginBottom: spacing.xs - 1,
  },
  pillDesc: {
    fontSize: 11,
    fontFamily: typography.fonts.body,
    color: ritualColors.pillDesc,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  ctaWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg - 4,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    minHeight: CTA_AREA_HEIGHT,
    justifyContent: 'flex-end',
  },
  ctaTouchable: {
    width: '100%',
  },
  ctaButton: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: colors.sanctuary.gold,
    shadowOpacity: 0.32,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 9,
  },
  ctaGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md + 4,
    borderRadius: 18,
  },
  ctaBtnText: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h4 - 1,
    letterSpacing: 1.2,
    color: ritualColors.ctaText,
  },
  stopText: {
    textAlign: 'center',
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: ritualColors.stopText,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  errorTitle: {
    fontSize: typography.sizes.h2,
    fontFamily: typography.fonts.heading,
    color: colors.error,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  errorButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.gold,
    borderRadius: 12,
  },
  errorButtonText: {
    fontSize: typography.sizes.button,
    fontFamily: typography.fonts.bodyBold,
    color: colors.navy,
  },
});
