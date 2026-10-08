import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, Extrapolation, interpolate, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { V2Button, V2EmptyState, V2InlineError } from '@/components/v2';
import { V2HomeChartSection, V2HomeBrandMark, V2HomeCreamSplice, V2HomeHeader, V2HomeHero, V2HomeProgressSection, V2HomeRecentActivitySection, V2HomeTodaySection, V2HomeVisionSection } from '@/components/v2/home';
import { getNextPractice, resolveVisionAlternateImage, resolveVisionHeroImage, useV2HomeModel } from '@/adapters/v2/home';
import { useHomePrewarm } from '@/hooks/v2/home';
import { useV2ReduceMotion, useV2Responsive } from '@/hooks/v2';
import { useCelebrationReduceMotion } from '@/hooks/useCelebrationReduceMotion';
import { VisualProfiler } from '@/utils/visualProfiler';
import { HomeStartupProfiler } from '@/utils/homeStartupProfiler';
import { useV2ThreadEventQueue } from '@/hooks/v2/threadEvents';
import { V2ThreadEventModal } from '@/components/v2/threadEvents';
import { anchorArtworkSvg } from '@/components/v2/anchors/anchorPresentation';
import { AnchorMotion, colors, getCategoryColor, typography } from '@/theme/v2';
import { localDateString } from '@/utils/primingAnalytics';
import { useSettingsStore } from '@/stores/settingsStore';
import { AnalyticsService } from '@/services/AnalyticsService';
import { useV2DailyShellIntents, type V2DailyShellParamList } from './dailyShell';
import { useHomeElasticScroll } from './homeElasticScroll';
import { V2_TRANSITION_SETTLE_MS } from '@/navigation/v2/transitions';
import { V2AssetPrewarm } from '@/components/v2/primitives/V2AssetPrewarm';
import { ANCHOR_DETAIL_EMPTY_ART, ANCHOR_DETAIL_HERO_ART } from '@/components/v2/anchors/anchorDetailArt';
import { GRID_ART_BY_PRACTICE } from '@/components/v2/practice/V2PracticeArtwork';
import { useSessionStore } from '@/stores/sessionStore';
import { HomeArrivalOverlay, HomeArrivalProvider, homeArrivalCelebrationId, useHomeArrival } from '@/components/v2/home/homeArrival';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';
import { useProgressiveFocusTransition, type AnchorWindowRect } from '@/navigation/v2/ProgressiveFocusTransition';
import { resolveAnchorDetailsHeroGeometry } from '@/navigation/v2/anchorHeroGeometry';
import { playCreationSound } from '@/services/CreationSounds';
import { useAuthStore } from '@/stores/authStore';
import { useTeachingQueue } from '@/hooks/v2/teaching/useTeachingQueue';
import { useTeachingFocus } from '@/hooks/v2/teaching/useTeachingFocus';
import { homeTeachingBeats } from '@/hooks/v2/teaching/homeTeaching';
import { ScreenTeaching } from '@/components/v2/teaching/ScreenTeaching';
import { measureTeachingTarget, scrollToTarget } from '@/components/v2/teaching/scrollToTarget';

type Nav = NativeStackNavigationProp<V2DailyShellParamList, 'V2Home'>;

/** Brief-mandated page inset for both zones. */
const PAGE_INSET = 20;

const CHART_LANDSCAPE_ART = require('@/../assets/chart/landscape.jpg');

/** How far the anchor-scoped content dims while the carousel moves. */
const CONTENT_VEIL_DIM = 0.38;

/** A focus within this window of the last context refresh reuses what Home already shows. */
const REFOCUS_REFRESH_MS = 30_000;
export const HOME_ARRIVAL_SOUND_PLAYED_KEY = '@anchor/v2/home-arrival-sound-played';
/**
 * Claimed synchronously, before the storage read, so two Home mounts in one app session cannot both
 * reach the sound. The storage key still decides once per install.
 */
let homeArrivalSoundClaimed = false;
/** Test-only: starts a fresh app session for the module-level claim. */
export function resetHomeArrivalSoundClaimForTests(): void {
  homeArrivalSoundClaimed = false;
}
const PRACTICE_ACTION_BY_MODE = {
  focus: 'Focus',
  deep_prime: 'Deep Prime',
  visualize: 'Visualize',
  release: 'Release',
} as const;

/** Changes whenever a practice is recorded, which is what moves Today, Thread and evidence. */
const practiceMarker = () => {
  const state = useSessionStore.getState();
  return `${state.lastSession?.id ?? ''}:${state.practiceHistory?.length ?? 0}`;
};

const track = (name: string, properties: Record<string, unknown> = {}) => {
  try {
    AnalyticsService.track(name, properties);
  } catch {
    /* analytics must never break Home */
  }
};

/**
 * The first-run empty state. It is the one place on Home with no Anchor to be
 * the hero, so a drawn gesture stands in for the artwork rather than leaving
 * the screen bare.
 */
function EmptyHomeGestureSvg() {
  return (
    <Svg width={220} height={200} viewBox="0 0 220 200" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* Soft paper circular foundation */}
      <Circle cx={110} cy={100} r={76} fill="#FBF9F4" stroke="#DAD6CD" strokeWidth={1} strokeDasharray="6 6" />

      {/* Dynamic irregular brush arcs echoing the hero's construction strokes */}
      <Ellipse cx={110} cy={100} rx={86} ry={82} stroke="#7C5CFA" strokeWidth={4} strokeDasharray="160 30 110 40" strokeLinecap="round" opacity={0.4} transform="rotate(-25 110 100)" />
      <Ellipse cx={110} cy={100} rx={90} ry={85} stroke="#3157D8" strokeWidth={3} strokeDasharray="70 20 180 50" strokeLinecap="round" opacity={0.3} />
      <Path d="M145 170 C175 160 196 135 198 105" stroke="#53BDCC" strokeWidth={4} strokeLinecap="round" opacity={0.45} />
      <Path d="M182 48 L188 32 M196 52 L206 42 M200 62 L212 60" stroke="#F28A2E" strokeWidth={2.5} strokeLinecap="round" opacity={0.8} />

      {/* Gentle center waypoint sigil */}
      <Circle cx={110} cy={100} r={16} stroke="#D8D2C8" strokeWidth={1.5} strokeDasharray="3 3" />
      <Circle cx={110} cy={100} r={5} fill="#F9A72F" />
    </Svg>
  );
}

/**
 * Anchor 2.0 Home.
 *
 * Two zones, one continuous surface: a cream hero world (header, Anchor
 * context, hero carousel, intention, compact Thread Strength) spliced into a
 * graphite system world (Today, All Practices, Vision, Chart, Progress).
 *
 * Every module below the splice is conditional on real data for the ACTIVE
 * Anchor. Absent is not loading: Vision and Chart render nothing at all when
 * the record does not exist, and nothing on this screen reserves space for a
 * feature the user has not created.
 */
export function V2HomeScreen() {
  const hasCompletedOnboarding = useAuthStore((state) => state.hasCompletedOnboarding);
  const teachingAccountId = useAuthStore(state => state.user?.id ?? null);
  const teachingFocus = useTeachingFocus();
  const todayTeachingRef = useRef<View>(null);
  const progressTeachingRef = useRef<View>(null);
  const visionTeachingRef = useRef<View>(null);
  const chartTeachingRef = useRef<View>(null);
  const threadTeachingRef = useRef<View>(null);
  const scrollViewportRef = useRef<View>(null);
  const teachingScrollSize = useRef({ content: 0, viewport: 0 });
  const teachingScrollActive = useSharedValue(false);
  const [carouselMoving, setCarouselMoving] = useState(false);
  const [homeMotionActive, setHomeMotionActive] = useState(true);
  const navigation = useNavigation<Nav>();
  // Home never fades during an Anchor flight: it stays fully drawn until Details covers it,
  // and is already drawn when Details is removed. Only the travelling copy moves.
  const focusTransition = useProgressiveFocusTransition();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const model = useV2HomeModel();
  useEffect(() => {
    if (!hasCompletedOnboarding || homeArrivalSoundClaimed) return;
    homeArrivalSoundClaimed = true;
    void AsyncStorage.getItem(HOME_ARRIVAL_SOUND_PLAYED_KEY).then(async played => {
      if (played) return;
      await AsyncStorage.setItem(HOME_ARRIVAL_SOUND_PLAYED_KEY, '1');
      playCreationSound('homeArrival');
    }).catch(() => { /* Do not risk replaying the first-arrival sound if storage is unavailable. */ });
  }, [hasCompletedOnboarding]);
  const practiceHistory = useSessionStore((state) => state.practiceHistory);
  const reduceMotion = useV2ReduceMotion();
  // The arrival's Reduce Motion input: the celebration source (preference OR system), used only by the arrival.
  const arrivalReduceMotion = useCelebrationReduceMotion();
  const insets = useSafeAreaInsets();
  const { gutter } = useV2Responsive();
  const elastic = useHomeElasticScroll();
  const intents = useV2DailyShellIntents();
  const threadEvents = useV2ThreadEventQueue({
    channel: 'HOME_CONTEXT',
    enabled: Boolean(model.selectedAnchor),
  });

  const { refreshChart, refreshToday, refreshVision } = model;
  const todayLocalDate = localDateString(new Date());
  const selectedAnchorId = model.selectedAnchor?.id;
  const selectedAnchorLocalId = model.selectedAnchor?.localId;
  const completedToday = useMemo(() => selectedAnchorId
    ? practiceHistory
      .filter((session) => localDateString(new Date(session.completedAt)) === todayLocalDate &&
        session.accountId === model.selectedAnchor?.userId && (
          session.anchorId === selectedAnchorId || session.anchorServerId === selectedAnchorId ||
          Boolean(selectedAnchorLocalId && session.anchorLocalId === selectedAnchorLocalId)
        ))
      .sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt))
    : [], [model.selectedAnchor?.userId, practiceHistory, selectedAnchorId, selectedAnchorLocalId, todayLocalDate]);
  const completedModes = useMemo(() => new Set(completedToday.map((session) => session.practiceMode)), [completedToday]);
  const completedMode = completedToday[0]?.practiceMode;
  const nextPractice = useMemo(() => completedMode
    ? getNextPractice({
      completedModes,
      hasVision: model.vision.state === 'ready',
      chartArcComplete: model.chart.state === 'ready' && model.chart.isFinished,
    })
    : null, [completedModes, completedMode, model.chart, model.vision.state]);
  const nextMode = nextPractice && nextPractice !== 'all_practices' ? nextPractice : null;
  const settings = useSettingsStore.getState();
  const durationByMode = {
    focus: settings.focusSessionDuration,
    deep_prime: settings.primeSessionDuration,
    visualize: settings.visualizeSessionDuration,
  };
  const doneDuration = nextMode === 'release'
    ? undefined
    : nextMode
      ? model.today.state === 'ready' && model.today.mode === nextMode
        ? model.today.durationSeconds ?? durationByMode[nextMode]
        : durationByMode[nextMode]
      : undefined;
  const todayForDisplay = useMemo(() => completedMode && (model.today.state === 'ready' || nextMode || nextPractice === 'all_practices')
    ? {
      ...(model.today.state === 'ready' ? model.today : {
        state: 'ready' as const,
        mode: nextMode ?? 'focus',
        action: nextMode ? PRACTICE_ACTION_BY_MODE[nextMode] : 'Focus',
        reason: '',
        completionSignal: null,
        threadStrength: null,
        threadDelta: null,
        threadDeltaStatus: 'UNAVAILABLE' as const,
        durationSeconds: doneDuration,
      }),
      doneToday: {
        completedMode,
        nextMode,
        durationSeconds: doneDuration,
        completedDurationSeconds: completedToday[0]?.completedDurationSeconds,
      },
    }
    : model.today, [completedMode, doneDuration, model.today, nextMode, nextPractice]);
  const reportedHydratedAnchors = useRef(new Set<string>());
  const reportedFirstMeaningfulHome = useRef(false);
  // Each model already loads on mount, so the first focus is not a reason to refetch.
  const lastRefresh = useRef({ at: Date.now(), practice: practiceMarker() });
  const refreshHomeContext = useCallback(() => {
    lastRefresh.current = { at: Date.now(), practice: practiceMarker() };
    void refreshToday();
    void refreshVision();
    void refreshChart();
  }, [refreshChart, refreshToday, refreshVision]);

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshHomeContext();
    });
    return () => listener.remove();
  }, [refreshHomeContext]);


  /**
   * Returning from a Practice session must re-read Today, Thread and evidence.
   * Returning from anywhere else within a few seconds has nothing new to read.
   * Either way the refresh starts once the transition back to Home has
   * settled: its responses re-render Home, and they used to arrive mid-pop.
   * Every refresh is stale-while-revalidate, so nothing on screen empties.
   */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const cancel = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    const unsubscribeFocus = navigation.addListener('focus', () => {
      const previous = lastRefresh.current;
      if (Date.now() - previous.at < REFOCUS_REFRESH_MS && previous.practice === practiceMarker()) return;
      cancel();
      timer = setTimeout(refreshHomeContext, V2_TRANSITION_SETTLE_MS);
    });
    const unsubscribeBlur = navigation.addListener('blur', cancel);
    return () => {
      cancel();
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [navigation, refreshHomeContext]);

  useEffect(() => {
    track('v2_home_viewed', { anchorCount: model.anchorList.length });
  }, [model.anchorList.length]);

  /**
   * A just-created Anchor arrives here from creation. Home is posed while creation still
   * covers it — at the top of the page, with Home itself (not a pushed Details) in front — and
   * then assembles around the mark as creation lets go. See homeArrival.tsx.
   */
  const poseForArrival = useCallback(() => {
    (elastic.scrollRef.current as { scrollTo?: (options: { y: number; animated: boolean }) => void } | null)?.scrollTo?.({ y: 0, animated: false });
    const state = navigation.getState?.();
    // Creation stages the arrival while it is still on top (it stages as soon as the save
    // resolves, mid-seal). Popping to the top then would tear creation down before it hands off,
    // leaving Home posed and hidden: only a pushed screen such as Details is popped here.
    const topRoute: string | undefined = state?.routes?.[state.index]?.name;
    const creationOnTop = topRoute === 'AnchorCreationFlow' || topRoute === 'V2Creation';
    if (state && state.index > 0 && !creationOnTop) navigation.popToTop();
  }, [elastic.scrollRef, navigation]);
  const arrival = useHomeArrival({
    selectedAnchorIds: [model.selectedAnchor?.id, model.selectedAnchor?.localId],
    onPose: poseForArrival,
    reduceMotion: arrivalReduceMotion,
  });
  // A first arrival can be tapped through while the coordinator holds it as a skippable scene.
  const arrivalCelebrationId = arrival.arrival ? homeArrivalCelebrationId(arrival.arrival.id) : null;
  const arrivalSkippable = useCelebrationStore((state) => {
    const active = state.active;
    return Boolean(active && arrivalCelebrationId && active.id === arrivalCelebrationId && active.skippable);
  });

  useHomePrewarm(model.anchorList, model.selectedIndex);

  const selectedId = model.selectedAnchor?.id ?? null;
  const selectedCategory = model.selectedAnchor?.category?.toLowerCase() ?? '';

  useEffect(() => {
    if (selectedId) VisualProfiler.record('activeAnchorIdCommit', { anchorId: selectedId });
    if (reportedFirstMeaningfulHome.current) return;
    if (!selectedId && model.anchorState !== 'empty' && model.anchorState !== 'error') return;
    reportedFirstMeaningfulHome.current = true;
    HomeStartupProfiler.mark('first_meaningful_home_render', {
      anchorId: selectedId,
      anchorState: model.anchorState,
    });
  }, [model.anchorState, selectedId]);

  useEffect(() => {
    if (!selectedId || reportedHydratedAnchors.current.has(selectedId)) return;
    const dependenciesSettled =
      model.today.state !== 'loading' &&
      !model.progressLoading &&
      model.vision.state !== 'loading' &&
      model.chart.state !== 'resolving' &&
      model.chart.state !== 'loading';
    if (!dependenciesSettled) return;
    reportedHydratedAnchors.current.add(selectedId);
    HomeStartupProfiler.mark('final_home_hydration', {
      anchorId: selectedId,
      todayState: model.today.state,
      visionState: model.vision.state,
      chartState: model.chart.state,
      progressState: model.progress.state,
    });
  }, [model.chart.state, model.progress.state, model.progressLoading, model.today.state, model.vision.state, selectedId]);

  useEffect(() => {
    if (!__DEV__) return undefined;
    VisualProfiler.record('homeMounted');
    HomeStartupProfiler.mark('home_mounted');
    const start = navigation.addListener('transitionStart', (event) => {
      VisualProfiler.record('screenTransition', { screen: 'home', phase: 'start', closing: event.data.closing });
    });
    const end = navigation.addListener('transitionEnd', (event) => {
      VisualProfiler.record('screenTransition', { screen: 'home', phase: 'end', closing: event.data.closing });
    });
    return () => { start(); end(); };
  }, [navigation]);

  useEffect(() => {
    HomeStartupProfiler.mark('home_first_content_state', { anchorState: model.anchorState, hasAnchor: Boolean(selectedId) });
  }, [model.anchorState, selectedId]);

  /**
   * The two destinations one tap away from Home are Anchor Details and
   * Practice. Their large artwork is decoded here while Home is idle, so it is
   * already on screen in the first frame of the push (see V2AssetPrewarm).
   * Today's artwork is not listed: Home is already drawing it.
   */
  const hasChart = model.chart.state === 'ready';
  const nextScreenArt = useMemo(() => {
    const heroArt = ANCHOR_DETAIL_HERO_ART[selectedCategory];
    return [
      ...(heroArt ? [heroArt] : []),
      ...(hasChart ? [CHART_LANDSCAPE_ART] : []),
      ANCHOR_DETAIL_EMPTY_ART.chart,
      GRID_ART_BY_PRACTICE.focus,
      GRID_ART_BY_PRACTICE.deep_prime,
      GRID_ART_BY_PRACTICE.visualize,
      GRID_ART_BY_PRACTICE.release,
    ];
  }, [hasChart, selectedCategory]);
  const anchorArtUris = useMemo(
    () => model.anchorList.map((summary) => summary.anchor.enhancedImageUrl),
    [model.anchorList],
  );

  const categoryColor = getCategoryColor(model.selectedAnchor?.category);

  /**
   * Today borrows a Vision photograph only for Visualize. It rotates through
   * the available images that differ from the Vision card's featured image;
   * with one image, Today reuses it with a different crop.
   */
  const visionCoverUri = useMemo(() => resolveVisionHeroImage(model.vision) ?? undefined, [model.vision]);
  const visionAlternateUri = resolveVisionAlternateImage(model.vision) ?? undefined;
  const todayVisionUri = visionAlternateUri ?? visionCoverUri;
  const todayVisionIsReused = Boolean(todayVisionUri) && !visionAlternateUri;

  const prewarmRemoteUris = useMemo(() => {
    const uris = [...anchorArtUris];
    if (todayVisionUri) uris.push(todayVisionUri);
    if (visionCoverUri && visionCoverUri !== todayVisionUri) uris.push(visionCoverUri);
    return uris;
  }, [anchorArtUris, todayVisionUri, visionCoverUri]);

  const hasVision = useMemo(() => {
    if (model.vision.state !== 'ready') return false;
    const heroImage = resolveVisionHeroImage(model.vision);
    const statement = model.vision.title?.trim() || model.vision.previewText?.trim();
    return Boolean(heroImage || statement);
  }, [model.vision]);

  /**
   * Every handler below is stable. The sections are memoised, and a memoised
   * section with a freshly created arrow prop re-renders anyway - which is
   * exactly the cascade a carousel commit used to trigger across the whole
   * page. Inline arrows are cheap; the renders they force are not.
   */
  const { selectAnchor, refreshChart: refreshChartModel, refreshToday: refreshTodayModel, today, chart } = model;
  const chartCourseId = chart.state === 'ready' ? chart.courseId : undefined;
  const chartCourseIdRef = useRef(chartCourseId);
  chartCourseIdRef.current = chartCourseId;

  const handleCreateAnchor = useCallback(() => {
    track('v2_home_create_anchor_tapped');
    intents.onCreateAnchor();
  }, [intents]);

  /**
   * Home's anchor-scoped content is veiled while the carousel moves, swapped
   * under the veil once it rests, then revealed. 1 = fully shown.
   */
  const contentVeil = useSharedValue(1);
  const veilSwapPending = useRef(false);
  const veilFallback = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealContent = useCallback((duration: number) => {
    if (veilFallback.current) clearTimeout(veilFallback.current);
    veilFallback.current = null;
    contentVeil.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) });
  }, [contentVeil]);
  useEffect(() => () => { if (veilFallback.current) clearTimeout(veilFallback.current); }, []);

  const handleSelectAnchor = useCallback(
    (anchorId: string) => {
      // The reveal waits for React to commit this Anchor's content, so the swap happens under the veil.
      veilSwapPending.current = true;
      selectAnchor(anchorId);
      // Since 2026-10-07 this fires once per resting selection, not once per Anchor swiped past.
      track('v2_home_anchor_switched');
    },
    [selectAnchor],
  );

  const handleCarouselMotion = useCallback((moving: boolean) => {
    setCarouselMoving(moving);
    if (reduceMotion) return;
    if (moving) {
      if (veilFallback.current) clearTimeout(veilFallback.current);
      veilFallback.current = null;
      contentVeil.value = withTiming(CONTENT_VEIL_DIM, { duration: 140, easing: AnchorMotion.easing.enter });
    } else if (!veilSwapPending.current) {
      // An aborted swipe: nothing to swap, so the content simply returns.
      revealContent(200);
    } else {
      // The commit's own reveal normally lands first; this only guards a selection that never arrives.
      veilFallback.current = setTimeout(() => { veilSwapPending.current = false; revealContent(260); }, 600);
    }
  }, [contentVeil, reduceMotion, revealContent]);

  // Runs after React has committed the new Anchor's content, so it is always revealed, never hard-swapped.
  useLayoutEffect(() => {
    veilSwapPending.current = false;
    if (reduceMotion) {
      contentVeil.value = 1;
      return;
    }
    revealContent(260);
  }, [contentVeil, reduceMotion, revealContent, selectedAnchorId]);

  const contentVeilStyle = useAnimatedStyle(() => ({
    opacity: contentVeil.value,
    transform: [{ translateY: interpolate(contentVeil.value, [CONTENT_VEIL_DIM, 1], [6, 0], Extrapolation.CLAMP) }],
  }));

  useAnimatedReaction(
    () => contentVeil.value < 0.999 || elastic.dragging.value || Math.abs(elastic.overscroll.value) > 0.5 || (!teachingScrollActive.value && elastic.momentum.value),
    (moving, previous) => { if (moving !== previous) runOnJS(setHomeMotionActive)(moving); },
  );
  // Canonical Home idle gate: the queue also waits one InteractionManager turn after this clears.
  const homeIsIdle = teachingFocus.isFocused && !teachingFocus.transitioning && !arrival.context.active && !arrival.arrival &&
    !veilSwapPending.current && !carouselMoving && !homeMotionActive && !focusTransition.active && !threadEvents.active &&
    model.anchorState === 'ready' && Boolean(selectedId) && model.today.state !== 'loading' && !model.progressLoading &&
    model.vision.state !== 'loading' && model.chart.state !== 'loading' && model.chart.state !== 'resolving';
  const teachingQueue = useTeachingQueue({ screenId: 'home', accountId: teachingAccountId,
    eligible: homeTeachingBeats({ hasAnchor: Boolean(selectedId), hasVision, hasChart }), cap: 2, blocked: !homeIsIdle, isFocused: teachingFocus.isFocused });
  const getTeachingRect = useCallback(async (target: React.RefObject<View | null>) => {
    teachingScrollActive.value = true;
    try {
      const viewport = await measureTeachingTarget(scrollViewportRef.current);
      return await scrollToTarget(target, elastic.scrollRef, () => ({ y: elastic.scrollY.value, max: elastic.maxScroll.value, viewportTop: viewport?.y ?? 0 }), reduceMotion);
    } finally { teachingScrollActive.value = false; }
  }, [elastic.scrollRef, elastic.scrollY, elastic.maxScroll, reduceMotion, teachingScrollActive]);

  const handleOpenActive = useCallback(
    (anchorId: string, source?: AnchorWindowRect) => {
      const anchor = model.anchorList.find((item) => item.anchor.id === anchorId)?.anchor;
      if (!anchor) return;
      const destination = resolveAnchorDetailsHeroGeometry({
        width: windowWidth, height: windowHeight, topInset: insets.top, platform: Platform.OS,
      }).rect;
      const accepted = focusTransition.openAnchor(anchor, source ?? { x: NaN, y: NaN, width: 0, height: 0 }, destination, () => {
        VisualProfiler.record('detailsNavigationStart', { anchorId });
        navigation.navigate('V2AnchorDetails', { anchorId });
      });
      if (accepted) track('v2_anchor_details_viewed', { from: 'home' });
    },
    [focusTransition, insets.top, model.anchorList, navigation, windowHeight, windowWidth],
  );

  const handleOpenProgress = useCallback(() => {
    track('v2_home_progress_tapped');
    intents.onOpenProgress(selectedId ?? undefined);
  }, [intents, selectedId]);

  const handleOpenAllAnchors = useCallback(() => {
    track('v2_anchor_library_viewed', { from: 'home' });
    navigation.navigate('V2AnchorLibrary');
  }, [navigation]);

  const handleBeginToday = useCallback(() => {
    track('v2_home_practice_tapped');
    if (selectedId && todayForDisplay.state === 'ready') {
      if (todayForDisplay.doneToday?.nextMode) intents.onOpenPractice(selectedId, todayForDisplay.doneToday.nextMode);
      else if (todayForDisplay.doneToday) intents.onOpenPractice(selectedId);
      else intents.onOpenPractice(selectedId, todayForDisplay.mode);
    }
  }, [intents, selectedId, todayForDisplay]);

  const handleOpenAllPractices = useCallback(() => {
    track('v2_home_all_practices_tapped');
    if (selectedId) intents.onOpenPractice(selectedId);
  }, [intents, selectedId]);

  const handleRetryToday = useCallback(() => {
    void refreshTodayModel();
  }, [refreshTodayModel]);

  const handleRetryVision = useCallback(() => {
    void refreshVision();
  }, [refreshVision]);

  const handleOpenVision = useCallback(() => {
    track('v2_home_vision_tapped');
    if (selectedId) intents.onOpenVision(selectedId);
  }, [intents, selectedId]);

  const handleOpenChart = useCallback(() => {
    track('v2_home_chart_tapped');
    if (selectedId) intents.onOpenChart(selectedId, chartCourseIdRef.current);
  }, [intents, selectedId]);

  const header = (
    <View style={[styles.headerInset, { paddingHorizontal: gutter }]}>
      <V2HomeHeader
        greeting={model.greeting}
        profileInitial={model.profileInitial}
        profilePictureUrl={model.profilePictureUrl}
        showChartUtility={false}
        onCreateAnchor={handleCreateAnchor}
        onOpenProfile={intents.onOpenProfile}
      />
      {__DEV__ ? <View style={styles.materialLabRow}>
        <Pressable
          testID="v2-home-material-lab"
          accessibilityRole="button"
          accessibilityLabel="Open Evolving Anchors material lab"
          onPress={intents.onOpenMaterialLab}
          hitSlop={8}
        >
          <Text style={styles.materialLabLink}>Material lab  →</Text>
        </Pressable>
      </View> : null}
    </View>
  );

  if (model.anchorState === 'loading' || (model.anchorState === 'ready' && !model.selectedAnchor)) {
    return (
      <SafeAreaView edges={TOP_EDGE} style={styles.creamScreen} testID="v2-home-screen">
        {header}
        {/* A restrained layout skeleton, not a pile of independent loading cards. */}
        <View testID="v2-home-anchors-loading" style={styles.skeletonZone}>
          <View style={styles.skeletonDisc} />
          <View style={[styles.skeletonLine, styles.skeletonLineWide]} />
          <View style={[styles.skeletonLine, styles.skeletonLineNarrow]} />
        </View>
      </SafeAreaView>
    );
  }

  if (model.anchorState === 'error') {
    return (
      <SafeAreaView edges={TOP_EDGE} style={styles.creamScreen} testID="v2-home-screen">
        {header}
        <View testID="v2-home-anchors-error" style={styles.statusZone}>
          <V2InlineError message={model.anchorError ?? 'Unable to load your Anchors.'} onRetry={model.refreshAnchors} />
        </View>
      </SafeAreaView>
    );
  }

  if (model.anchorState === 'empty' && !model.selectedAnchor) {
    return (
      <SafeAreaView edges={TOP_EDGE} style={styles.creamScreen} testID="v2-home-screen">
        {header}
        <View style={styles.emptyZone}>
          <V2EmptyState
            gesture={<EmptyHomeGestureSvg />}
            title="No Anchor yet"
            message="Create your first Anchor to begin. Everything on Home orients around one selected Anchor."
            action={
              <V2Button accessibilityLabel="Create your first Anchor" onPress={handleCreateAnchor}>
                Create an Anchor
              </V2Button>
            }
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <HomeArrivalProvider value={arrival.context}>
    <SafeAreaView edges={TOP_EDGE} style={styles.creamScreen} testID="v2-home-screen">
      <V2AssetPrewarm sources={nextScreenArt} remoteUris={prewarmRemoteUris} />
      <GestureDetector gesture={elastic.elasticPan}>
      <View ref={scrollViewportRef} collapsable={false} style={styles.scrollHost}>
      <GestureDetector gesture={elastic.nativeScroll}>
      <Animated.ScrollView
        ref={elastic.scrollRef}
        onLayout={event => {
          teachingScrollSize.current.viewport = event.nativeEvent.layout.height;
          elastic.maxScroll.value = Math.max(0, teachingScrollSize.current.content - teachingScrollSize.current.viewport);
        }}
        onContentSizeChange={(_width, height) => {
          teachingScrollSize.current.content = height;
          elastic.maxScroll.value = Math.max(0, height - teachingScrollSize.current.viewport);
        }}
        onScroll={elastic.onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        // The hero must never be clipped or slide under the status bar.
        contentInsetAdjustmentBehavior="never"
        // iOS: native bounce and momentum are the target feel. Android: the
        // native stretch would distort the artwork, so the elastic edge is
        // drawn by `useHomeElasticScroll` instead.
        bounces
        overScrollMode={elastic.enabled ? 'never' : 'auto'}
      >
        <Animated.View style={[styles.elasticContent, elastic.elasticStyle]}>
        {/* ── Cream hero world ── */}
        <Animated.View style={arrival.headerStyle}>{header}</Animated.View>

        <View style={styles.heroEnvironment}>
          <Animated.View style={[styles.creamZone, arrival.heroStyle]}>
            <V2HomeHero
              testID="v2-home-hero"
              teachingThreadRef={threadTeachingRef}
              anchors={model.anchorList}
              selectedIndex={model.selectedIndex}
              thread={model.thread}
              reduceMotion={reduceMotion}
              frozen={focusTransition.active}
              onMotionChange={handleCarouselMotion}
              onSelect={handleSelectAnchor}
              onOpenActive={handleOpenActive}
              onOpenProgress={handleOpenProgress}
              onOpenAllAnchors={handleOpenAllAnchors}
            />
          </Animated.View>

          {/* The cream landscape terminates on its own at the keel point. */}
          <Animated.View style={arrival.lowerStyle}>
            <V2HomeCreamSplice testID="v2-home-splice" />
          </Animated.View>
        </View>

        {/* ── Graphite system world ── */}
        <Animated.View testID="v2-home-graphite-zone" style={[styles.graphiteZone, { paddingHorizontal: gutter, paddingBottom: 56 + insets.bottom }, arrival.lowerStyle]}>
          {/* Product signature: opens the ink field, beneath the keel and above Today. */}
          <V2HomeBrandMark testID="v2-home-brand-mark" />

          {/* Anchor-scoped content: veiled while the carousel moves, revealed once it commits. */}
          <Animated.View style={contentVeilStyle}>
          <View ref={todayTeachingRef} collapsable={false}>
          <V2HomeTodaySection
            testID="v2-home-today"
            today={todayForDisplay}
            visionCoverUri={todayVisionUri}
            visionCoverIsReused={todayVisionIsReused}
            onBegin={handleBeginToday}
            onOpenAllPractices={handleOpenAllPractices}
            onRetry={handleRetryToday}
          />
          </View>

          <View ref={visionTeachingRef} collapsable={false}>
          <V2HomeVisionSection vision={model.vision} categoryColor={categoryColor}
            onOpenVision={handleOpenVision} onRetry={handleRetryVision} />
          </View>

          {!hasVision ? <View ref={progressTeachingRef} collapsable={false}><V2HomeProgressSection progress={model.progress} thread={model.thread}
            categoryColor={categoryColor} onOpenProgress={handleOpenProgress} /></View> : null}

          <View ref={chartTeachingRef} collapsable={false}>
          <V2HomeChartSection
            chart={model.chart}
            anchorId={model.selectedAnchor!.id}
            onOpenChart={handleOpenChart}
            onRetry={refreshChartModel}
          />
          </View>
          </Animated.View>

          <V2HomeRecentActivitySection items={model.recentActivity ?? []} onViewAll={handleOpenProgress} />
        </Animated.View>

        {/* Keeps the graphite field unbroken under an overscroll bounce. */}
        <View style={styles.overscrollFill} pointerEvents="none" />
        </Animated.View>
      </Animated.ScrollView>
      </GestureDetector>
      </View>
      </GestureDetector>

      <ScreenTeaching screen="home" queue={teachingQueue} reducedMotion={reduceMotion} targets={{
        'home.today': { getRect: () => getTeachingRect(todayTeachingRef) }, 'home.progress': { getRect: () => getTeachingRect(progressTeachingRef) },
        'home.vision': { getRect: () => getTeachingRect(visionTeachingRef) }, 'home.chart': { getRect: () => getTeachingRect(chartTeachingRef) },
        'home.thread': { getRect: () => getTeachingRect(threadTeachingRef) },
      }} />
      <V2ThreadEventModal
        bundle={threadEvents.active}
        visible={Boolean(threadEvents.active)}
        anchorSvg={model.selectedAnchor ? anchorArtworkSvg(model.selectedAnchor) : undefined}
        anchorImageUrl={model.selectedAnchor?.enhancedImageUrl}
        category={model.selectedAnchor?.category}
        reducedMotion={reduceMotion}
        onPresented={() => {
          void threadEvents.claimActive().then(threadEvents.markPresented);
        }}
        onAcknowledge={() => {
          void threadEvents.acknowledge();
        }}
        onDismiss={() => {
          void threadEvents.dismiss();
        }}
      />

      {arrival.arrival ? (
        <HomeArrivalOverlay arrival={arrival.arrival} progress={arrival.context.progress} hold={arrival.context.overlayHold} flight={arrival.flight} origin={arrival.origin} onOrigin={arrival.reportOrigin} />
      ) : null}
      {/* Only while a first arrival is a skippable scene: a tap anywhere lands it on its end state. */}
      {arrivalSkippable && arrival.arrival?.kind === 'first' ? (
        <Pressable
          testID="v2-home-arrival-skip"
          accessible
          accessibilityRole="button"
          accessibilityLabel="Skip"
          style={StyleSheet.absoluteFill}
          onPress={() => { useCelebrationStore.getState().skip(); }}
        />
      ) : null}
    </SafeAreaView>
    </HomeArrivalProvider>
  );
}

const TOP_EDGE = ['top'] as const;

const styles = StyleSheet.create({
  creamScreen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scrollHost: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  elasticContent: {
    flexGrow: 1,
  },
  headerInset: {
    paddingTop: 6,
  },
  materialLabRow: {
    alignItems: 'flex-end',
    paddingBottom: 4,
  },
  materialLabLink: {
    ...typography.labelSM,
    color: colors.text.secondary,
    letterSpacing: 0.2,
  },
  heroEnvironment: {
    position: 'relative',
    backgroundColor: colors.canvas,
  },
  // Full-bleed on purpose. The carousel track measures itself and centres on
  // this zone, so a page gutter here would push its centre off the viewport
  // centre. The hero items apply the gutter to their own text instead.
  creamZone: {
    position: 'relative',
    paddingBottom: 0,
  },
  graphiteZone: {
    flexGrow: 1,
    // The brand mark carries the keel → Today rhythm itself, and its lower
    // gap already clears the Today artwork's upward bleed.
    paddingTop: 0,
    backgroundColor: colors.graphite.base,
  },
  overscrollFill: {
    // Overlaps the graphite zone by 2px: at the fractional offsets of an
    // elastic pull, abutting edges otherwise show a hairline of cream.
    height: 402,
    marginTop: -2,
    marginBottom: -400,
    backgroundColor: colors.graphite.base,
  },
  statusZone: {
    paddingHorizontal: PAGE_INSET,
    paddingVertical: 32,
  },
  emptyZone: {
    flex: 1,
    paddingHorizontal: PAGE_INSET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonZone: {
    paddingHorizontal: PAGE_INSET,
    paddingTop: 48,
    alignItems: 'center',
    gap: 20,
  },
  skeletonDisc: {
    width: 178,
    height: 178,
    borderRadius: 89,
    backgroundColor: colors.grouped,
  },
  skeletonLine: {
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.grouped,
    alignSelf: 'stretch',
  },
  skeletonLineWide: {
    marginTop: 8,
  },
  skeletonLineNarrow: {
    width: '60%',
    alignSelf: 'flex-start',
  },
});
