import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { Check } from 'lucide-react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  RadialGradient,
  Stop,
  SvgXml,
} from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { AuthService } from '@/services/AuthService';
import { useAuthStore } from '@/stores/authStore';
import type { Anchor, RootStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { withAlpha } from '@/utils/color';
import { logger } from '@/utils/logger';
import { useFirstAnchorFlowStore } from '@/stores/firstAnchorFlowStore';
import { AnalyticsService } from '@/services/AnalyticsService';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';

type NavigationProp = StackNavigationProp<RootStackParamList, 'SaveProgress'>;
type SaveProgressRouteProp = RouteProp<RootStackParamList, 'SaveProgress'>;

const GOLD_BRIGHT = colors.anchor15.giltBright;
const GOLD_MID = colors.anchor15.gilt;
const GOLD_DEEP = '#A7793A';
const BONE = colors.anchor15.bone;
const DISC_SIGIL_SIZE = 184;
const FALLBACK_SIGIL_SIZE = 148;
const DISC_ARTWORK_RADIUS = DISC_SIGIL_SIZE / 2;
const ORBIT_SIZE = 278;
const ORBIT_OFFSET = 17.5;
const SUN_GLOW_SIZE = 340;
const SUN_RAY_CENTER = SUN_GLOW_SIZE / 2;
const SUN_RAY_COUNT = 16;
const SUN_RAY_ANGLE_STEP = 360 / SUN_RAY_COUNT;
const SUN_RAY_INNER_RADIUS = 58;

const buildSunRayPath = (outerRadius: number, outerWidth: number) => {
  const apexY = SUN_RAY_CENTER - SUN_RAY_INNER_RADIUS;
  const outerY = SUN_RAY_CENTER - outerRadius;
  const halfWidth = outerWidth / 2;
  return `M ${SUN_RAY_CENTER} ${apexY} L ${SUN_RAY_CENTER - halfWidth} ${outerY} L ${
    SUN_RAY_CENTER + halfWidth
  } ${outerY} Z`;
};

const SunburstGlow = () => (
  <Svg width="100%" height="100%" viewBox={`0 0 ${SUN_GLOW_SIZE} ${SUN_GLOW_SIZE}`}>
    <Defs>
      <RadialGradient id="sunBloom" cx="50%" cy="50%" r="50%">
        <Stop offset="0%" stopColor={GOLD_BRIGHT} stopOpacity={0.42} />
        <Stop offset="45%" stopColor={GOLD_MID} stopOpacity={0.16} />
        <Stop offset="100%" stopColor={GOLD_MID} stopOpacity={0} />
      </RadialGradient>
      <SvgLinearGradient id="sunRayFade" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={GOLD_BRIGHT} stopOpacity={0} />
        <Stop offset="1" stopColor={GOLD_BRIGHT} stopOpacity={0.85} />
      </SvgLinearGradient>
    </Defs>
    <Circle cx={SUN_RAY_CENTER} cy={SUN_RAY_CENTER} r={SUN_RAY_CENTER} fill="url(#sunBloom)" />
    {Array.from({ length: SUN_RAY_COUNT }).map((_, index) => {
      const angle = index * SUN_RAY_ANGLE_STEP;
      const isLong = index % 2 === 0;
      const outerRadius = isLong ? SUN_RAY_CENTER - 6 : SUN_RAY_CENTER - 30;
      const outerWidth = isLong ? 26 : 14;
      return (
        <React.Fragment key={angle}>
          <Path
            d={buildSunRayPath(outerRadius, outerWidth * 1.8)}
            fill="url(#sunRayFade)"
            opacity={0.22}
            rotation={angle}
            originX={SUN_RAY_CENTER}
            originY={SUN_RAY_CENTER}
          />
          <Path
            d={buildSunRayPath(outerRadius, outerWidth)}
            fill="url(#sunRayFade)"
            opacity={0.85}
            rotation={angle}
            originX={SUN_RAY_CENTER}
            originY={SUN_RAY_CENTER}
          />
        </React.Fragment>
      );
    })}
  </Svg>
);

const useEntranceStyle = (value: SharedValue<number>) =>
  useAnimatedStyle(() => ({
    opacity: value.value,
    transform: [{ translateY: (1 - value.value) * 14 }],
  }));

const FallbackAnchorMark = ({ size }: { size: number }) => (
  <Svg width={size} height={size} viewBox="0 0 200 200">
    <Path
      d="M58 62 L142 62 L72 148"
      stroke={colors.anchor15.gilt}
      strokeWidth="6.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Path
      d="M58 62 Q62 74 66 84"
      stroke={colors.anchor15.gilt}
      strokeWidth="2.8"
      strokeLinecap="round"
      opacity={0.72}
      fill="none"
    />
    <Circle
      cx="100"
      cy="100"
      r="13"
      stroke={GOLD_BRIGHT}
      strokeWidth="1.6"
      opacity={0.55}
      fill="none"
    />
  </Svg>
);

const LoggedFallbackAnchorMark = ({ size, anchorId }: { size: number; anchorId: string }) => {
  useEffect(() => {
    logger.warn('[SaveProgress] Missing forged sigil artwork; rendering fallback mark', {
      anchorId,
    });
  }, [anchorId]);

  return <FallbackAnchorMark size={size} />;
};

const AnchorDisc = ({ anchor }: { anchor: Anchor }) => {
  const sigilXml = anchor.reinforcedSigilSvg || anchor.baseSigilSvg;

  return (
    <View style={styles.disc}>
      <View style={styles.discRingOuter} />
      <View style={styles.discRingA} />
      <View style={styles.discRingB} />
      <View style={styles.discRingC} />
      <View style={styles.discSigilWrap}>
        {anchor.enhancedImageUrl ? (
          <View style={styles.discSigilImageClip}>
            <Image
              source={{ uri: anchor.enhancedImageUrl }}
              style={styles.discSigilImage}
              resizeMode="cover"
            />
          </View>
        ) : sigilXml ? (
          <SvgXml xml={sigilXml} width={DISC_SIGIL_SIZE} height={DISC_SIGIL_SIZE} />
        ) : (
          <LoggedFallbackAnchorMark size={FALLBACK_SIGIL_SIZE} anchorId={anchor.id} />
        )}
      </View>
    </View>
  );
};

const TrustItem = ({ label }: { label: string }) => (
  <View style={styles.trustItem}>
    <Check size={13} color={colors.anchor15.gilt} strokeWidth={1.8} />
    <Text style={styles.trustLabel} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

export const SaveProgressScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<SaveProgressRouteProp>();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotionEnabled = useReduceMotionEnabled();
  const anchor = route.params.anchor;
  const previewMode = route.params.previewMode ?? false;

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const pendingFirstAnchorDraft = useAuthStore((state) => state.pendingFirstAnchorDraft);
  const isFinalizingPendingFirstAnchor = useAuthStore(
    (state) => state.isFinalizingPendingFirstAnchor
  );
  const pendingFirstAnchorError = useAuthStore((state) => state.pendingFirstAnchorError);
  const finalizePendingFirstAnchorDraft = useAuthStore(
    (state) => state.finalizePendingFirstAnchorDraft
  );
  const clearPendingFirstAnchorError = useAuthStore((state) => state.clearPendingFirstAnchorError);
  const signOut = useAuthStore((state) => state.signOut);

  const floatY = useSharedValue(0);
  const haloOpacity = useSharedValue(0.6);
  const haloScale = useSharedValue(1);
  const pulseScale = useSharedValue(reduceMotionEnabled ? 1 : 0);
  const spinProgress = useSharedValue(0);
  const ctaShineX = useSharedValue(-1.3);
  const wave1 = useSharedValue(reduceMotionEnabled ? 1 : 0);
  const wave2 = useSharedValue(reduceMotionEnabled ? 1 : 0);
  const wave3 = useSharedValue(reduceMotionEnabled ? 1 : 0);
  const wave4 = useSharedValue(reduceMotionEnabled ? 1 : 0);

  const isShortLayout = height < 760;
  const hasPng = Boolean(anchor.enhancedImageUrl);
  const hasSvg = Boolean(anchor.reinforcedSigilSvg || anchor.baseSigilSvg);

  useEffect(() => {
    AnalyticsService.track('save_progress_viewed', {
      anchor_id: anchor.id,
      has_png: hasPng,
      has_svg: hasSvg,
    });
  }, [anchor.id, hasPng, hasSvg]);

  useFocusEffect(
    React.useCallback(() => {
      if (reduceMotionEnabled) {
        floatY.value = 0;
        haloOpacity.value = 0.72;
        haloScale.value = 1;
        pulseScale.value = 1;
        spinProgress.value = 0;
        ctaShineX.value = 2.4;
        wave1.value = 1;
        wave2.value = 1;
        wave3.value = 1;
        wave4.value = 1;
        return;
      }

      // reduceMotionEnabled above is the single reduce-motion gate for this
      // screen, so opt out of Reanimated's implicit ReduceMotion.System —
      // otherwise Android devices with "Remove animations" (or animator scale 0)
      // silently cancel the infinite repeats and the medallion freezes.
      const ambient = { reduceMotion: ReduceMotion.Never };
      const entrance = { duration: 600, easing: Easing.out(Easing.cubic), ...ambient };

      floatY.value = 0;
      haloOpacity.value = 0.6;
      haloScale.value = 1;
      pulseScale.value = 0;
      spinProgress.value = 0;
      ctaShineX.value = -1.3;

      floatY.value = withRepeat(
        withTiming(-5, { duration: 3500, easing: Easing.inOut(Easing.sin), ...ambient }),
        -1,
        true,
        undefined,
        ReduceMotion.Never
      );
      haloOpacity.value = withRepeat(
        withTiming(0.85, { duration: 4000, easing: Easing.inOut(Easing.sin), ...ambient }),
        -1,
        true,
        undefined,
        ReduceMotion.Never
      );
      haloScale.value = withRepeat(
        withTiming(1.04, { duration: 4000, easing: Easing.inOut(Easing.sin), ...ambient }),
        -1,
        true,
        undefined,
        ReduceMotion.Never
      );
      pulseScale.value = 0;
      pulseScale.value = withRepeat(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin), ...ambient }),
        -1,
        true,
        undefined,
        ReduceMotion.Never
      );
      spinProgress.value = 0;
      spinProgress.value = withRepeat(
        withTiming(360, { duration: 42000, easing: Easing.linear, ...ambient }),
        -1,
        false,
        undefined,
        ReduceMotion.Never
      );
      ctaShineX.value = withRepeat(
        withTiming(2.7, { duration: 5000, easing: Easing.inOut(Easing.sin), ...ambient }),
        -1,
        false,
        undefined,
        ReduceMotion.Never
      );
      wave1.value = withDelay(50, withTiming(1, entrance), ReduceMotion.Never);
      wave2.value = withDelay(140, withTiming(1, entrance), ReduceMotion.Never);
      wave3.value = withDelay(240, withTiming(1, entrance), ReduceMotion.Never);
      wave4.value = withDelay(340, withTiming(1, entrance), ReduceMotion.Never);

      return () => {
        cancelAnimation(floatY);
        cancelAnimation(haloOpacity);
        cancelAnimation(haloScale);
        cancelAnimation(pulseScale);
        cancelAnimation(spinProgress);
        cancelAnimation(ctaShineX);
        cancelAnimation(wave1);
        cancelAnimation(wave2);
        cancelAnimation(wave3);
        cancelAnimation(wave4);
      };
    }, [
      ctaShineX,
      floatY,
      haloOpacity,
      haloScale,
      pulseScale,
      reduceMotionEnabled,
      spinProgress,
      wave1,
      wave2,
      wave3,
      wave4,
    ])
  );

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: haloOpacity.value,
    transform: [{ scale: haloScale.value }],
  }));

  const medallionPulseStyle = useAnimatedStyle(() => ({
    opacity: reduceMotionEnabled ? 0.55 : 0.95 - pulseScale.value * 0.78,
    transform: [{ scale: reduceMotionEnabled ? 1 : 0.92 + pulseScale.value * 0.22 }],
  }));

  const spinningGlowStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinProgress.value}deg` }],
  }));

  const ctaShineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: ctaShineX.value * 360 }, { skewX: '-18deg' }],
  }));

  const wave1Style = useEntranceStyle(wave1);
  const wave2Style = useEntranceStyle(wave2);
  const wave3Style = useEntranceStyle(wave3);
  const wave4Style = useEntranceStyle(wave4);

  useFocusEffect(
    React.useCallback(() => {
      if (previewMode || !isAuthenticated) {
        return;
      }

      if (!pendingFirstAnchorDraft) {
        navigation.replace('PrimeYourAnchor', { anchorId: anchor.id });
        return;
      }

      if (isFinalizingPendingFirstAnchor || pendingFirstAnchorError) {
        return;
      }

      let cancelled = false;
      void (async () => {
        const didFinalize = await finalizePendingFirstAnchorDraft();
        if (!cancelled && didFinalize) {
          useFirstAnchorFlowStore.getState().clearDraft();
          navigation.replace('PrimeYourAnchor', { anchorId: anchor.id });
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [
      finalizePendingFirstAnchorDraft,
      isAuthenticated,
      isFinalizingPendingFirstAnchor,
      navigation,
      pendingFirstAnchorDraft,
      pendingFirstAnchorError,
      previewMode,
    ])
  );

  const handleSaveAnchor = () => {
    AnalyticsService.track('save_progress_save_tapped', { anchor_id: anchor.id });
    navigation.navigate('SignUp', {
      context: 'save_progress',
      initialTab: 'signup',
      anchorId: anchor.id,
    });
  };

  const handleSignIn = () => {
    AnalyticsService.track('save_progress_signin_tapped', { anchor_id: anchor.id });
    navigation.navigate('Login', {
      context: 'save_progress',
      anchorId: anchor.id,
    });
  };

  const handleRetry = async () => {
    clearPendingFirstAnchorError();
    const didFinalize = await finalizePendingFirstAnchorDraft();
    if (didFinalize) {
      useFirstAnchorFlowStore.getState().clearDraft();
      navigation.replace('PrimeYourAnchor', { anchorId: anchor.id });
    }
  };

  const handleSwitchAccount = async () => {
    clearPendingFirstAnchorError();
    await AuthService.signOut().catch(() => undefined);
    await signOut();
  };

  if (isAuthenticated && !previewMode) {
    return (
      <View style={styles.screen}>
        <StatusBar style="light" />
        <BackgroundLayers />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.finalizeWrap}>
            <Text style={styles.eyebrowText}>SAVE YOUR ANCHOR</Text>
            <Text style={styles.finalizeTitle}>
              {isFinalizingPendingFirstAnchor ? 'Saving your first anchor' : 'Almost there'}
            </Text>
            <Text style={styles.finalizeBody}>
              {isFinalizingPendingFirstAnchor
                ? 'Attaching your first anchor to this account before you enter the Sanctuary.'
                : pendingFirstAnchorError ||
                  'You are signed in. Finish saving your first anchor to continue.'}
            </Text>
            <View style={styles.finalizeCard}>
              {isFinalizingPendingFirstAnchor ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={colors.anchor15.gilt} />
                  <Text style={styles.loadingText}>Finalizing account handoff...</Text>
                </View>
              ) : (
                <>
                  <Pressable style={styles.retryButton} onPress={handleRetry}>
                    <LinearGradient
                      colors={[GOLD_BRIGHT, GOLD_MID, GOLD_DEEP]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.retryGradient}
                    >
                      <Text style={styles.retryText}>Finish Saving My Anchor</Text>
                    </LinearGradient>
                  </Pressable>
                  <Pressable onPress={handleSwitchAccount} hitSlop={12}>
                    <Text style={styles.secondary}>Use a different account</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <BackgroundLayers />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.content,
            isShortLayout && styles.contentShort,
            { paddingBottom: Math.max(insets.bottom + 44, 64) },
          ]}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.header}>
            <Animated.View style={[styles.eyebrow, wave1Style]}>
              <View style={styles.eyebrowLineLeft} />
              <Text style={styles.eyebrowText}>SAVE YOUR ANCHOR</Text>
              <View style={styles.eyebrowLineRight} />
            </Animated.View>
            <Animated.Text style={[styles.title, wave1Style]}>
              YOUR FIRST ANCHOR{'\n'}IS <Text style={styles.titleGold}>READY.</Text>
            </Animated.Text>
            <Animated.Text style={[styles.body, wave2Style]}>
              You made this. Create a free account to keep it synced, recover it on a new phone,
              and return to it whenever you need it.
            </Animated.Text>
          </View>

          <Animated.View style={[styles.hero, wave3Style]}>
            <Animated.View style={[styles.medallion, floatStyle]}>
              <Animated.View style={[styles.halo, haloStyle]} />
              <Animated.View
                pointerEvents="none"
                renderToHardwareTextureAndroid
                style={[styles.spinningGlow, spinningGlowStyle]}
              >
                <SunburstGlow />
              </Animated.View>
              <View style={styles.orbit} />
              <View style={styles.ringInner} />
              <AnchorDisc anchor={anchor} />
              <Animated.View
                pointerEvents="none"
                style={[styles.medallionPulse, medallionPulseStyle]}
              />
            </Animated.View>
            <View style={styles.plateWrap}>
              <View style={styles.plateMeta}>
                <View style={styles.plateDot} />
                <Text style={styles.plateMetaLabel}>FORGED JUST NOW</Text>
              </View>
              <Text style={styles.plateName} numberOfLines={2}>
                {anchor.intentionText}
              </Text>
            </View>
          </Animated.View>

          <Animated.View style={[styles.trustBottomWrap, wave4Style]}>
            <View style={styles.trustStrip}>
              <TrustItem label="7-DAY TRIAL" />
              <View style={styles.trustDivider} />
              <TrustItem label="NO CARD" />
              <View style={styles.trustDivider} />
              <TrustItem label="CANCEL ANYTIME" />
            </View>
            <View style={styles.bottom}>
              <Text style={styles.trialNote}>Full access starts instantly. No card required.</Text>
              <Pressable
                style={styles.cta}
                onPress={handleSaveAnchor}
                android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
              >
                <LinearGradient
                  colors={[GOLD_BRIGHT, GOLD_MID, GOLD_DEEP]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.ctaGradient}
                >
                  {!reduceMotionEnabled ? (
                    <Animated.View pointerEvents="none" style={[styles.ctaShine, ctaShineStyle]} />
                  ) : null}
                  <Text style={styles.ctaLabel}>SAVE MY ANCHOR</Text>
                </LinearGradient>
              </Pressable>
              <Pressable onPress={handleSignIn} hitSlop={12}>
                <Text style={styles.secondary}>
                  I already have an <Text style={styles.secondaryUnderline}>account</Text>
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const BackgroundLayers = () => (
  <View pointerEvents="none" style={styles.background}>
    <LinearGradient
      colors={[colors.anchor15.creationTop, colors.anchor15.navy, colors.anchor15.ink]}
      locations={[0, 0.48, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
    <View style={[styles.bgOrb, styles.bgOrbSteel]} />
    <View style={[styles.bgOrb, styles.bgOrbGold]} />
    <View style={[styles.bgOrb, styles.bgOrbMid]} />
    <View style={styles.grainOverlay} />
    <LinearGradient
      colors={['rgba(8,11,15,0)', 'rgba(8,11,15,0.92)']}
      style={styles.floorVignette}
    />
  </View>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.anchor15.ink,
  },
  safeArea: {
    flex: 1,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  bgOrb: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.5,
  },
  bgOrbSteel: {
    width: 300,
    height: 300,
    top: -80,
    left: -70,
    backgroundColor: 'rgba(30,42,51,0.6)',
    shadowColor: colors.anchor15.steel,
    shadowOpacity: 0.5,
    shadowRadius: 58,
  },
  bgOrbGold: {
    width: 260,
    height: 260,
    bottom: 40,
    right: -70,
    backgroundColor: 'rgba(212,175,55,0.14)',
    shadowColor: colors.anchor15.gilt,
    shadowOpacity: 0.3,
    shadowRadius: 58,
  },
  bgOrbMid: {
    width: 220,
    height: 220,
    top: '38%',
    left: '28%',
    backgroundColor: 'rgba(96,72,140,0.12)',
    shadowColor: colors.anchor15.purpleAtmosphere,
    shadowOpacity: 0.2,
    shadowRadius: 58,
  },
  grainOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.08,
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  floorVignette: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 320,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  contentShort: {
    paddingTop: 0,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 72,
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eyebrowText: {
    fontFamily: typography.fonts.mono,
    fontSize: 10,
    letterSpacing: 4.2,
    color: colors.anchor15.gilt,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  eyebrowLineLeft: {
    width: 22,
    height: 1,
    backgroundColor: withAlpha(colors.anchor15.gilt, 0.22),
  },
  eyebrowLineRight: {
    width: 22,
    height: 1,
    backgroundColor: withAlpha(colors.anchor15.gilt, 0.22),
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontWeight: '500',
    fontSize: 27,
    lineHeight: 33.5,
    letterSpacing: 0.3,
    color: BONE,
    textAlign: 'center',
    marginTop: 18,
    textTransform: 'uppercase',
  },
  titleGold: {
    color: colors.anchor15.gilt,
  },
  body: {
    fontFamily: typography.fonts.body,
    fontSize: 15,
    lineHeight: 25.5,
    color: withAlpha(BONE, 0.68),
    textAlign: 'center',
    marginTop: 14,
    maxWidth: 288,
  },
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    minHeight: 424,
    paddingVertical: 6,
  },
  medallion: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 313,
    height: 313,
    alignSelf: 'center',
  },
  halo: {
    position: 'absolute',
    width: 297,
    height: 297,
    borderRadius: 149,
    backgroundColor: 'rgba(212,175,55,0.12)',
    shadowColor: colors.anchor15.gilt,
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 2,
  },
  medallionPulse: {
    position: 'absolute',
    width: 290,
    height: 290,
    borderRadius: 145,
    borderWidth: 4,
    borderColor: withAlpha(GOLD_BRIGHT, 0.82),
    backgroundColor: 'transparent',
  },
  spinningGlow: {
    position: 'absolute',
    width: SUN_GLOW_SIZE,
    height: SUN_GLOW_SIZE,
  },
  orbit: {
    position: 'absolute',
    top: ORBIT_OFFSET,
    left: ORBIT_OFFSET,
    width: ORBIT_SIZE,
    height: ORBIT_SIZE,
    borderRadius: ORBIT_SIZE / 2,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: withAlpha(colors.anchor15.gilt, 0.18),
  },
  ringInner: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1.2,
    borderColor: withAlpha(colors.anchor15.gilt, 0.16),
  },
  disc: {
    width: 272,
    height: 272,
    borderRadius: 136,
    backgroundColor: colors.anchor15.veil,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.anchor15.gilt,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 52,
    elevation: 12,
  },
  discRingOuter: {
    position: 'absolute',
    width: 269,
    height: 269,
    borderRadius: 135,
    borderWidth: 1.1,
    borderColor: withAlpha(colors.anchor15.gilt, 0.12),
  },
  discRingA: {
    position: 'absolute',
    width: 209,
    height: 209,
    borderRadius: 105,
    borderWidth: 0.6,
    borderColor: withAlpha(colors.anchor15.gilt, 0.14),
  },
  discRingB: {
    position: 'absolute',
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 0.6,
    borderColor: withAlpha(colors.anchor15.gilt, 0.12),
  },
  discRingC: {
    position: 'absolute',
    width: 87,
    height: 87,
    borderRadius: 43.5,
    borderWidth: 0.6,
    borderColor: withAlpha(colors.anchor15.gilt, 0.1),
  },
  discSigilWrap: {
    width: DISC_SIGIL_SIZE,
    height: DISC_SIGIL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discSigilImageClip: {
    width: DISC_SIGIL_SIZE,
    height: DISC_SIGIL_SIZE,
    borderRadius: DISC_ARTWORK_RADIUS,
    overflow: 'hidden',
  },
  discSigilImage: {
    width: DISC_SIGIL_SIZE,
    height: DISC_SIGIL_SIZE,
    borderRadius: DISC_ARTWORK_RADIUS,
  },
  plateWrap: {
    alignItems: 'center',
    gap: 8,
  },
  plateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  plateDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.anchor15.gilt,
    shadowColor: colors.anchor15.gilt,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  plateMetaLabel: {
    fontFamily: typography.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.8,
    color: '#8a6f23',
    textTransform: 'uppercase',
  },
  plateName: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 20,
    color: withAlpha(BONE, 0.82),
    letterSpacing: 0.3,
    textAlign: 'center',
    maxWidth: 300,
    paddingHorizontal: 12,
  },
  trustBottomWrap: {
    alignItems: 'stretch',
  },
  trustStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    marginBottom: 18,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    flexShrink: 0,
  },
  trustDivider: {
    width: 1,
    height: 14,
    backgroundColor: withAlpha(BONE, 0.14),
  },
  trustLabel: {
    fontFamily: typography.fonts.mono,
    fontSize: 11,
    letterSpacing: 0.9,
    color: withAlpha(BONE, 0.7),
    textTransform: 'uppercase',
  },
  bottom: {
    paddingHorizontal: 26,
    alignItems: 'center',
    gap: 14,
  },
  trialNote: {
    fontFamily: typography.fonts.body,
    fontSize: 12.5,
    lineHeight: 19.5,
    color: withAlpha(BONE, 0.38),
    textAlign: 'center',
    maxWidth: 260,
    marginBottom: 4,
  },
  cta: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.anchor15.gilt,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.34,
    shadowRadius: 34,
    elevation: 8,
  },
  ctaGradient: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ctaShine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '40%',
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  ctaLabel: {
    fontFamily: typography.fonts.heading,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 2.8,
    color: '#1a1408',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  secondary: {
    fontFamily: typography.fonts.body,
    fontSize: 14,
    color: withAlpha(BONE, 0.62),
    textAlign: 'center',
  },
  secondaryUnderline: {
    color: BONE,
    textDecorationLine: 'underline',
    textDecorationColor: withAlpha(colors.anchor15.gilt, 0.28),
  },
  finalizeWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  finalizeTitle: {
    fontFamily: typography.fonts.heading,
    color: BONE,
    fontSize: 27,
    lineHeight: 34,
    textAlign: 'center',
  },
  finalizeBody: {
    fontFamily: typography.fonts.body,
    color: withAlpha(BONE, 0.68),
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 300,
  },
  finalizeCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: withAlpha(colors.anchor15.gilt, 0.18),
    backgroundColor: withAlpha(colors.anchor15.veil, 0.72),
    padding: spacing.lg,
    gap: spacing.md,
    marginTop: spacing.md,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: typography.fonts.body,
    fontSize: 14,
    color: withAlpha(BONE, 0.68),
  },
  retryButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  retryGradient: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    fontFamily: typography.fonts.heading,
    fontSize: 13,
    letterSpacing: 1.8,
    color: '#1a1408',
    textTransform: 'uppercase',
  },
});
