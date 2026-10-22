import type { ViewInstance } from 'react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, Leaf, RotateCcw, TrendingUp } from 'lucide-react-native';
import { CircularAnchorRenderer, circularAnchorArtworkShare } from '@/components/v2/anchor/CircularAnchorRenderer';
import { anchorRenderProps } from '@/components/v2/anchors/anchorPresentation';
import { NOTIFICATION_MOTION, useNotificationReduceMotion } from '@/components/v2/notifications/notificationMotion';
import { Reveal } from '@/components/v2/notifications/Reveal';
import { V2Button } from '@/components/v2/primitives/V2Button';
import { recordInvitationOutcomeInStorage } from '@/hooks/useNotificationController';
import { leaveInvitationFlowToHome } from '@/navigation/v2/invitationHandoff';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { useAnchorStore } from '@/stores/anchorStore';
import { useReminderInvitationStore } from '@/stores/v2/reminderInvitationStore';
import type { ArrivalRect } from '@/stores/v2/homeArrivalStore';
import type { PracticeDepartureMeasure } from '@/stores/v2/practiceDeparture';
import { AnchorMotion, colors, spacing, typography } from '@/theme/v2';
import type { Anchor } from '@/types';
import { INVITATION_COPY } from './invitationCopy';
import { INVITATION_TOKENS, invitationStyles as shared } from './invitationTheme';

export const REMINDER_TIME_ROUTE = 'V2ReminderTime' as const;

/** Longest a window measurement may take before the screen continues without it. */
const MEASURE_TIMEOUT_MS = 200;
/** Reveals wait this many stagger steps when the Anchor flies in, so text rises as the mark settles. */
const FLIGHT_REVEAL_OFFSET = Math.round((NOTIFICATION_MOTION.anchorFlightMs * 0.7) / NOTIFICATION_MOTION.staggerMs);
/** Damping ratio for the flight's duration-based spring: a soft landing, no visible bounce. */
const FLIGHT_DAMPING_RATIO = 0.9;

/** The invitation fades its own chrome for this long when leaving for Home (PRACTICE_HANDOFF.chromeMs). */
const LEAVE_CHROME_MS = 300;

/** When the footer (CTA + Maybe later) has finished appearing and may take touches. */
export function invitationFooterReadyMs(flies: boolean, reduceMotion: boolean): number {
  if (reduceMotion) return NOTIFICATION_MOTION.reducedMs;
  const base = flies ? FLIGHT_REVEAL_OFFSET : 1;
  return (base + 2 + 3) * NOTIFICATION_MOTION.staggerMs + NOTIFICATION_MOTION.textRevealMs;
}

const BENEFIT_ICONS = { return: RotateCcw, progress: TrendingUp, grounded: Leaf } as const;

/** Invitation analytics fire once per route instance, whatever StrictMode or a remount does. */
const shownRouteKeys = new Set<string>();
export function resetInvitationScreenForTests(): void {
  shownRouteKeys.clear();
}

function measureWindow(node: unknown): Promise<ArrivalRect | null> {
  const target = node as { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void } | null;
  return new Promise((resolve) => {
    if (!target || typeof target.measureInWindow !== 'function') {
      resolve(null);
      return;
    }
    const timer = setTimeout(() => resolve(null), MEASURE_TIMEOUT_MS);
    target.measureInWindow((x, y, width, height) => {
      clearTimeout(timer);
      resolve([x, y, width, height].every(Number.isFinite) && width > 0 ? { x, y, width, height } : null);
    });
  });
}

/** The mark's own square inside the bare hero disc (what the practice/Home flights fly and scale). */
function markSquare(circle: ArrivalRect, hasImage: boolean): ArrivalRect {
  const share = hasImage ? 1 : circularAnchorArtworkShare('bare', circle.width, false);
  const side = circle.width * share;
  return { x: circle.x + (circle.width - side) / 2, y: circle.y + (circle.height - side) / 2, width: side, height: side };
}

/** Hero block height as a multiple of the mark size (the mark is centred in it). */
const HERO_BLOCK_RATIO = 1.3;

/**
 * Soft hills, mist and a faint sunrise ring behind the mark. Full-bleed: it spans the whole window
 * width and each hill fades to transparent at the bottom, so no edge is visible. Static art; only its
 * opacity animates. Geometry is in dp for the given window size.
 */
function HeroDepth({ width, height, size }: { width: number; height: number; size: number }) {
  const W = width;
  const H = height;
  return (
    <Svg width={W} height={H}>
      <Defs>
        <LinearGradient id="invitationHillFar" x1={0} y1={0.62 * H} x2={0} y2={H} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#E7DFCF" stopOpacity={0.75} />
          <Stop offset="1" stopColor="#E7DFCF" stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id="invitationHillNear" x1={0} y1={0.74 * H} x2={0} y2={H} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#DED4C1" stopOpacity={0.6} />
          <Stop offset="1" stopColor="#DED4C1" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Circle cx={W / 2} cy={H / 2} r={size * 0.58} fill="none" stroke={INVITATION_TOKENS.gold} strokeOpacity={0.22} strokeWidth={1} />
      <Circle cx={W / 2} cy={H / 2} r={size * 0.46} fill={INVITATION_TOKENS.warm} fillOpacity={0.55} />
      <Path
        d={`M0 ${0.66 * H} C ${0.2 * W} ${0.54 * H}, ${0.36 * W} ${0.58 * H}, ${0.52 * W} ${0.66 * H} S ${0.86 * W} ${0.6 * H}, ${W} ${0.56 * H} L ${W} ${H} L 0 ${H} Z`}
        fill="url(#invitationHillFar)"
      />
      <Path
        d={`M0 ${0.8 * H} C ${0.25 * W} ${0.7 * H}, ${0.5 * W} ${0.74 * H}, ${0.66 * W} ${0.78 * H} S ${0.9 * W} ${0.72 * H}, ${W} ${0.76 * H} L ${W} ${H} L 0 ${H} Z`}
        fill="url(#invitationHillNear)"
      />
    </Svg>
  );
}

export function V2NotificationInvitationScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const anchorId: string | undefined = route.params?.anchorId;
  const reduceMotion = useNotificationReduceMotion();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const anchors = useAnchorStore((state) => state.anchors) as Anchor[] | undefined;
  const anchor = useMemo(
    () => (anchorId ? (anchors ?? []).find((a) => a.id === anchorId || a.localId === anchorId) : undefined),
    [anchorId, anchors],
  );
  const render = anchor ? anchorRenderProps(anchor) : null;
  const hasImage = typeof render?.imageUrl === 'string' && render.imageUrl.length > 0;
  // Short windows (e.g. 890dp tall) shrink the mark so all three benefit rows clear the fixed footer.
  const heroSize = Math.round(Math.min(188, Math.max(132, width * 0.4), Math.max(124, height * 0.18)));
  const heroBlockHeight = Math.round(heroSize * HERO_BLOCK_RATIO);
  const compact = height < 800;

  // Decided once at mount: later preference changes never restart the arrival.
  const fliesRef = useRef(route.params?.anchorTransition === true && !reduceMotion);
  const revealBase = fliesRef.current ? FLIGHT_REVEAL_OFFSET : 1;

  const markRef = useRef<ViewInstance>(null);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const heroOpacity = useSharedValue(0);
  const depth = useSharedValue(0);
  const arrivalStartedRef = useRef(false);

  const heroStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));
  // Whole-screen fade (Reduce Motion only: the push itself does not animate) and the chrome fade on leaving.
  const screenOpacity = useSharedValue(reduceMotion ? 0 : 1);
  const chrome = useSharedValue(1);
  const depthStyle = useAnimatedStyle(() => ({ opacity: depth.value * chrome.value }));
  const chromeStyle = useAnimatedStyle(() => ({ opacity: chrome.value }));
  const screenStyle = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));
  useEffect(() => {
    if (!reduceMotion) return;
    screenOpacity.value = withTiming(1, { duration: NOTIFICATION_MOTION.reducedMs, easing: AnchorMotion.easing.enter });
    // Mount-only: the entrance is decided once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The footer takes touches only once it has appeared. A plain timer, so a missed animation
  // callback can never leave the person without a way forward.
  const [footerReady, setFooterReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFooterReady(true), invitationFooterReadyMs(fliesRef.current, reduceMotion));
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fadeHeroIn = useCallback(() => {
    heroOpacity.value = withTiming(1, {
      duration: reduceMotion ? NOTIFICATION_MOTION.reducedMs : NOTIFICATION_MOTION.textRevealMs,
      easing: AnchorMotion.easing.enter,
    });
  }, [heroOpacity, reduceMotion]);

  const handleHeroLayout = useCallback(() => {
    if (arrivalStartedRef.current) return;
    arrivalStartedRef.current = true;
    const fromRect = fliesRef.current && anchorId ? useReminderInvitationStore.getState().takeFromRect(anchorId) : null;
    depth.value = withDelay(
      fromRect ? NOTIFICATION_MOTION.anchorFlightMs * 0.45 : 0,
      withTiming(1, {
        duration: reduceMotion ? NOTIFICATION_MOTION.reducedMs : NOTIFICATION_MOTION.textRevealMs,
        easing: AnchorMotion.easing.enter,
      }),
    );
    if (!fromRect) {
      fadeHeroIn();
      return;
    }
    void measureWindow(markRef.current).then((circle) => {
      if (!circle) {
        fadeHeroIn();
        return;
      }
      const hero = markSquare(circle, hasImage);
      const startX = fromRect.x + fromRect.width / 2 - (hero.x + hero.width / 2);
      const startY = fromRect.y + fromRect.height / 2 - (hero.y + hero.height / 2);
      const startScale = fromRect.width / hero.width;
      const spring = { duration: NOTIFICATION_MOTION.anchorFlightMs, dampingRatio: FLIGHT_DAMPING_RATIO };
      tx.value = withSequence(withTiming(startX, { duration: 0 }), withSpring(0, spring));
      ty.value = withSequence(withTiming(startY, { duration: 0 }), withSpring(0, spring));
      scale.value = withSequence(withTiming(startScale, { duration: 0 }), withSpring(1, spring));
      heroOpacity.value = 1;
    });
  }, [anchorId, depth, fadeHeroIn, hasImage, heroOpacity, reduceMotion, scale, tx, ty]);

  // Shown: once per route instance (StrictMode double effects and remounts included). No private content.
  useEffect(() => {
    const key = String(route.key ?? 'invitation');
    if (shownRouteKeys.has(key)) return;
    shownRouteKeys.add(key);
    AnalyticsService.track(AnalyticsEvents.NOTIFICATION_INVITATION_SHOWN, { source: 'first_practice' });
  }, [route.key]);

  const measureDeparture = useCallback(async (): Promise<PracticeDepartureMeasure | null> => {
    const circle = await measureWindow(markRef.current);
    return circle ? { fromRect: markSquare(circle, hasImage), number: null, glow: null } : null;
  }, [hasImage]);

  const leavingRef = useRef(false);
  const choosingRef = useRef(false);

  const leave = useCallback((action: 'maybe_later' | 'not_now' | 'back') => {
    // The CTA already took this screen on to the time step: nothing else may navigate.
    if (leavingRef.current || choosingRef.current) return;
    leavingRef.current = true;
    if (!reduceMotion) {
      // Everything but the mark fades while Home poses; the hand-off then flies the mark there.
      chrome.value = withTiming(0, { duration: LEAVE_CHROME_MS, easing: Easing.linear });
    }
    AnalyticsService.track(AnalyticsEvents.NOTIFICATION_INVITATION_DISMISSED, { action });
    void recordInvitationOutcomeInStorage('dismissed');
    const sessionId = useReminderInvitationStore.getState().staged?.sessionId ?? null;
    void leaveInvitationFlowToHome(navigation, { anchor, sessionId, measure: measureDeparture }, { reduceMotion });
  }, [anchor, chrome, measureDeparture, navigation, reduceMotion]);

  const handleChoose = useCallback(() => {
    if (leavingRef.current || choosingRef.current) return;
    choosingRef.current = true;
    AnalyticsService.track(AnalyticsEvents.NOTIFICATION_INVITATION_ACCEPTED, { step: 'choose_time' });
    navigation.navigate(REMINDER_TIME_ROUTE, { anchorId });
  }, [anchorId, navigation]);

  // Coming back from the time screen re-arms the CTA (never while leaving).
  useEffect(() => {
    const unsubscribe = navigation.addListener?.('focus', () => {
      choosingRef.current = false;
    });
    return typeof unsubscribe === 'function' ? unsubscribe : undefined;
  }, [navigation]);

  // Hardware back is "Not now": it persists the dismissal and hands the Anchor Home, once.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (typeof navigation.isFocused === 'function' && !navigation.isFocused()) return false;
      leave('back');
      return true;
    });
    return () => subscription.remove();
  }, [leave, navigation]);

  return (
    <Animated.View style={[shared.root, screenStyle]} testID="notification-invitation-screen">
      <Animated.View style={[shared.topBar, { paddingTop: insets.top }, chromeStyle]}>
        <Text style={shared.wordmark} accessibilityRole="text">{INVITATION_COPY.wordmark}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={INVITATION_COPY.notNow}
          onPress={() => leave('not_now')}
          hitSlop={8}
          style={shared.notNowHit}
          testID="notification-invitation-not-now"
        >
          <Text style={shared.notNow}>{INVITATION_COPY.notNow}</Text>
        </Pressable>
      </Animated.View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={[styles.hero, { height: heroBlockHeight }]}>
          <Animated.View
            pointerEvents="none"
            style={[styles.depth, { left: -spacing[5], width, height: heroBlockHeight }, depthStyle]}
            testID="notification-invitation-depth"
          >
            <HeroDepth width={width} height={heroBlockHeight} size={heroSize} />
          </Animated.View>
          <Animated.View
            ref={markRef}
            collapsable={false}
            onLayout={handleHeroLayout}
            style={[{ width: heroSize, height: heroSize }, heroStyle]}
          >
            {render ? (
              <CircularAnchorRenderer
                {...render}
                size={heroSize}
                appearance="bare"
                accessibilityLabel="Your Anchor"
                testID="notification-invitation-anchor"
              />
            ) : null}
          </Animated.View>
        </View>

        <Animated.View style={chromeStyle}>
        <Reveal index={revealBase} reduceMotion={reduceMotion}>
          <Text accessibilityRole="header" style={shared.headline}>{INVITATION_COPY.headline}</Text>
        </Reveal>
        <Reveal index={revealBase + 1} reduceMotion={reduceMotion} style={styles.supportWrap}>
          <Text style={shared.support}>{INVITATION_COPY.support}</Text>
        </Reveal>

        <View style={[shared.card, styles.benefits, compact && styles.benefitsCompact]}>
          {INVITATION_COPY.benefits.map((benefit, i) => {
            const Icon = BENEFIT_ICONS[benefit.key];
            return (
              <Reveal key={benefit.key} index={revealBase + 2 + i} reduceMotion={reduceMotion}>
                <View
                  style={[
                    styles.benefitRow,
                    compact && styles.benefitRowCompact,
                    i < INVITATION_COPY.benefits.length - 1 && styles.benefitDivider,
                  ]}
                  accessible
                  accessibilityLabel={`${benefit.title} ${benefit.subtitle}`}
                  testID={`notification-invitation-benefit-${benefit.key}`}
                >
                  <View style={styles.iconDisc}>
                    <Icon size={18} color={INVITATION_TOKENS.gold} strokeWidth={1.8} />
                  </View>
                  <View style={styles.benefitText}>
                    <Text style={styles.benefitTitle}>{benefit.title}</Text>
                    <Text style={styles.benefitSubtitle}>{benefit.subtitle}</Text>
                  </View>
                </View>
              </Reveal>
            );
          })}
        </View>
        </Animated.View>
      </ScrollView>

      <Animated.View
        style={chromeStyle}
        pointerEvents={footerReady ? 'auto' : 'none'}
        testID="notification-invitation-footer"
      >
      <Reveal
        index={revealBase + 2 + INVITATION_COPY.benefits.length}
        reduceMotion={reduceMotion}
        style={[shared.footer, { paddingBottom: Math.max(insets.bottom, spacing[3]) }]}
      >
        <V2Button
          size="large"
          onPress={handleChoose}
          iconRight={<ArrowRight size={18} color={colors.text.inverse} />}
          accessibilityLabel={INVITATION_COPY.cta}
          testID="notification-invitation-cta"
        >
          {INVITATION_COPY.cta}
        </V2Button>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={INVITATION_COPY.maybeLater}
          onPress={() => leave('maybe_later')}
          style={shared.secondaryHit}
          testID="notification-invitation-maybe-later"
        >
          <Text style={shared.secondaryText}>{INVITATION_COPY.maybeLater}</Text>
        </Pressable>
      </Reveal>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing[5], paddingBottom: spacing[4] },
  hero: { alignItems: 'center', justifyContent: 'center', marginTop: spacing[2] },
  depth: { position: 'absolute', top: 0 },
  supportWrap: { marginTop: spacing[3], paddingHorizontal: spacing[2] },
  benefits: { marginTop: spacing[6], paddingHorizontal: spacing[4] },
  benefitsCompact: { marginTop: spacing[4] },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[4] },
  benefitRowCompact: { paddingVertical: spacing[3] },
  benefitDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: INVITATION_TOKENS.line },
  iconDisc: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: INVITATION_TOKENS.goldSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: INVITATION_TOKENS.goldEdge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: { flex: 1, minWidth: 0, gap: 2 },
  benefitTitle: { ...typography.labelLG, color: INVITATION_TOKENS.ink },
  benefitSubtitle: { ...typography.bodySM, color: INVITATION_TOKENS.inkSoft },
});

export default V2NotificationInvitationScreen;
