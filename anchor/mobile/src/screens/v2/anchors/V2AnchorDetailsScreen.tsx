import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StatusBar, StyleSheet, Text, useWindowDimensions, View, type ImageSourcePropType, type TextProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CircularAnchorRenderer, V2EmptyState, V2Screen, V2TopBar } from '@/components/v2';
import { ThreadStrength } from '@/components/v2/thread';
import { anchorArtworkSvg, categoryLabel, durationLabel, shortDate } from '@/components/v2/anchors';
import { useV2AnchorDetail } from '@/hooks/v2/anchors';
import { useV2Vision } from '@/hooks/v2/vision';
import { useCourseStore } from '@/stores/courseStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { resolveHomeChartState } from '@/adapters/v2/home/chartAdapter';
import { resolveEvolutionStage } from '@/adapters/v2/progress/progressAdapter';
import { fetchV2RecommendationContext } from '@/adapters/v2/practice';
import { V2_RECOMMENDATION_ACTION_TO_MODE, V2_PRACTICE_MODE_BY_ID, type V2PracticeMode } from '@/constants/v2/practice';
import { todayReasonCopy } from '@/components/v2/home/V2HomeTodaySection';
import { colors, getCategoryColor, getPracticeCardTheme, getPracticeColor, practiceDarkText, typography } from '@/theme/v2';
import { useV2DailyShellIntents, type V2DailyShellParamList } from '@/screens/v2/home/dailyShell';

type Nav = NativeStackNavigationProp<V2DailyShellParamList, 'V2AnchorDetails'>;
type Route = RouteProp<V2DailyShellParamList, 'V2AnchorDetails'>;
type Recommendation = { mode: V2PracticeMode; reason: string; delta: number | null; strength: number | null };
const DETAIL_ACTION_COPY = {
  visionTitle: 'Add Vision',
  visionPayoff: 'See where this leads.',
  chartTitle: 'Create Chart',
  chartPayoff: 'Map the path from here.',
};
const HERO_ART: Record<string, ImageSourcePropType> = {
  desire: require('@/assets/anchor-details/categories/desire-details.jpg'),
  health: require('@/assets/anchor-details/categories/health-details.jpg'),
  career: require('@/assets/anchor-details/categories/career-details-palette.jpg'),
  relationships: require('@/assets/anchor-details/categories/relationships-details.jpg'),
  creativity: require('@/assets/anchor-details/categories/creativity-details-palette.jpg'),
  spirituality: require('@/assets/anchor-details/categories/spirituality-details-palette.jpg'),
  abundance: require('@/assets/anchor-details/categories/abundance-details.jpg'),
  family: require('@/assets/anchor-details/categories/family-details-palette.jpg'),
  learning: require('@/assets/anchor-details/categories/learning-details.jpg'),
  adventure: require('@/assets/anchor-details/categories/adventure-details-palette.jpg'),
  focus: require('@/assets/anchor-details/categories/focus-details.jpg'),
  custom: require('@/assets/anchor-details/categories/custom-details-palette.jpg'),
};
const PRACTICE_ART: Record<V2PracticeMode, ImageSourcePropType> = {
  focus: require('@/assets/practice/today/focus.png'),
  deep_prime: require('@/assets/practice/today/deep-prime.png'),
  visualize: require('@/assets/practice/today/visualize.png'),
  release: require('@/assets/practice/today/release.png'),
};
const EMPTY_ART = {
  vision: require('@/assets/anchor-details/vision-empty.jpg'),
  chart: require('@/assets/anchor-details/chart-empty.jpg'),
} satisfies Record<'vision' | 'chart', ImageSourcePropType>;

function StickerText({ children, style, ...props }: TextProps & { children: string }) {
  const offsets = [[-2, -2], [0, -2], [2, -2], [-2, 0], [2, 0], [-2, 2], [0, 2], [2, 2]];
  return <View style={styles.stickerText}>
    {offsets.map(([left, top], index) => <Text
      key={index}
      {...props}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[style, styles.stickerOutline, { left, top }]}
    >{children}</Text>)}
    <Text {...props} style={style}>{children}</Text>
  </View>;
}

function useRecommendation(anchorId: string) {
  const [result, setResult] = useState<{ id: string; value: Recommendation | null; error: boolean }>({ id: '', value: null, error: false });
  useEffect(() => {
    if (!anchorId) return;
    const controller = new AbortController();
    setResult({ id: anchorId, value: null, error: false });
    fetchV2RecommendationContext(anchorId, controller.signal).then((context) => {
      if (controller.signal.aborted) return;
      setResult({ id: anchorId, error: false, value: {
        mode: V2_RECOMMENDATION_ACTION_TO_MODE[context.recommendation.action],
        reason: context.recommendation.reason,
        delta: context.thread.delta7dStatus === 'AVAILABLE' ? context.thread.delta7d : null,
        strength: context.thread.status === 'AVAILABLE' && typeof context.thread.strength === 'number' ? context.thread.strength : null,
      } });
    }).catch(() => { if (!controller.signal.aborted) setResult({ id: anchorId, value: null, error: true }); });
    return () => controller.abort();
  }, [anchorId]);
  return result.id === anchorId ? result : { id: anchorId, value: null, error: false };
}

function Hero({ anchor, height, onBack, onMore }: { anchor: NonNullable<ReturnType<typeof useV2AnchorDetail>['anchor']>; height: number; onBack: () => void; onMore: () => void }) {
  const accent = getCategoryColor(anchor.category);
  const art = HERO_ART[anchor.category?.toLowerCase() ?? ''];
  const anchorSize = Math.min(190, Math.max(160, height - 170));
  return <View style={[styles.hero, { height, backgroundColor: accent + '25' }]}>
    {art ? <Image source={art} style={styles.heroImage} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
    <View style={[styles.heroWash, { backgroundColor: 'rgba(251,249,244,0.32)' }]} />
    <View style={styles.heroNav}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={12}><ChevronLeft color={colors.text.primary} size={27} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="More Anchor options" onPress={onMore} hitSlop={12}><MoreHorizontal color={colors.text.primary} size={27} /></Pressable>
    </View>
    <CircularAnchorRenderer
      svg={anchorArtworkSvg(anchor)}
      imageUrl={anchor.enhancedImageUrl}
      category={anchor.category}
      size={anchorSize}
      appearance="paper"
      accessibilityLabel={categoryLabel(anchor.category) + ' Anchor artwork'}
      style={styles.glyph}
    />
    <View style={styles.heroCopy}>
      <StickerText accessibilityRole="header" numberOfLines={2} adjustsFontSizeToFit style={styles.intention}>{anchor.intentionText}</StickerText>
      <StickerText style={[styles.category, { color: accent }]}>{categoryLabel(anchor.category).toUpperCase()}</StickerText>
      <StickerText style={styles.created}>{`Created ${new Date(anchor.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}</StickerText>
    </View>
    <Svg width="100%" height={30} viewBox="0 0 400 30" preserveAspectRatio="none" style={styles.arc}><Path d="M0 0 Q200 60 400 0 L400 30 L0 30 Z" fill={colors.surface} /></Svg>
  </View>;
}

function ThreadSummary({ value, delta, accent, onPress }: { value: number | null; delta: number | null; accent: string; onPress: () => void; history: Array<number | null> }) {
  const level = value === null ? 'UNMEASURED' : resolveEvolutionStage(value).toUpperCase();
  const numericValue = typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  return <Pressable testID="v2-anchor-thread" accessibilityRole="button" onPress={onPress} style={styles.thread}>
    <View style={styles.sectionHeading}>
      <View style={styles.headingLabelGroup}>
        <Text style={styles.eyebrow}>THREAD STRENGTH</Text>
        <Svg width={12} height={12} viewBox="0 0 12 12" style={styles.headingIcon}>
          <Circle cx={6} cy={6} r={4.5} stroke={colors.text.primary} strokeWidth={1.5} fill="none" />
          <Circle cx={6} cy={6} r={1.5} fill={colors.text.primary} />
        </Svg>
      </View>
      <Text style={[styles.level, { color: accent }]}>{level}</Text>
    </View>
    <ThreadStrength
      percent={numericValue}
      color={accent}
      weeklyDelta={delta}
      showDelta={delta !== null}
      arrowStyle="arrow"
      duration={1400}
      height={48}
    />
    <Text testID="v2-thread-strength-value" style={styles.hiddenValueTest}>
      {value === null ? '—' : value}
    </Text>
  </Pressable>;
}

function TodayCard({ recommendation, error, duration, onPress }: { recommendation: Recommendation | null; error: boolean; duration: number; onPress: (mode: V2PracticeMode) => void }) {
  if (!recommendation) return <View style={styles.todayPending}><Text style={styles.eyebrow}>TODAY’S PRACTICE</Text><Text style={styles.quiet}>{error ? 'Today’s recommendation is unavailable.' : 'Loading today’s recommendation…'}</Text></View>;
  const mode = recommendation.mode;
  // Same cinematic surface as the Practice hub, at this card's smaller scale:
  // the recommendation carries its own practice identity instead of the fixed
  // violet the arrow used to assume.
  const theme = getPracticeCardTheme(mode);
  return <Pressable testID="v2-anchor-today" accessibilityRole="button" accessibilityLabel={'Practice this Anchor: ' + V2_PRACTICE_MODE_BY_ID[mode].title} onPress={() => onPress(mode)} style={({ pressed }) => [styles.todayCard, { backgroundColor: theme.dark.surface, borderColor: theme.dark.border }, pressed && styles.pressed]}>
    <View style={[styles.todayArtWrap, { backgroundColor: theme.dark.surface }]}>
      <Image source={PRACTICE_ART[mode]} style={styles.todayArt} resizeMode="cover" accessibilityIgnoresInvertColors />
      {/* Atmospheric dissolve so the scene and the body read as one object. */}
      <LinearGradient pointerEvents="none" colors={[...theme.dark.fade]} locations={[0, 0.58, 1]} style={styles.todayArtFade} />
    </View>
    <View style={styles.todayBody}><View style={styles.todayCopy}><Text style={styles.todayTitle}>{V2_PRACTICE_MODE_BY_ID[mode].title}{mode !== 'release' ? ' · ' + durationLabel(duration) : ''}</Text><Text style={styles.todayReason}>{todayReasonCopy(recommendation.reason, mode)}</Text></View><View style={[styles.todayArrow, { backgroundColor: theme.dark.actionBg }]}><ChevronRight size={23} color={theme.dark.arrow} /></View></View>
  </Pressable>;
}

function RecentPractice({ entries, onViewAll }: { entries: ReturnType<typeof useV2AnchorDetail>['recentPractice']; onViewAll: () => void }) {
  return <View style={styles.recent}><View style={styles.sectionHeading}><Text style={styles.eyebrow}>RECENT PRACTICE</Text><Text accessibilityRole="button" onPress={onViewAll} style={styles.viewAll}>View all →</Text></View>
    {entries.length ? entries.map((entry, i) => <View key={entry.id} style={styles.practiceRow}><View style={styles.timeline}><View style={[styles.marker, { backgroundColor: getPracticeColor(entry.mode) }]} />{i < entries.length - 1 ? <View style={styles.timelineLine} /> : null}</View><View style={styles.practiceCopy}><Text style={styles.practiceName}>{entry.label}</Text><Text style={styles.practiceMeta}>{shortDate(entry.completedAt)} · {durationLabel(entry.durationSeconds)}</Text></View>{entry.strengthDelta !== null ? <Text style={styles.practiceDelta}>{entry.strengthDelta > 0 ? '+' : ''}{entry.strengthDelta}%</Text> : null}</View>) : <Text style={styles.quiet}>No practice recorded for this Anchor yet.</Text>}
  </View>;
}

function EmptyCardArtwork({ source, testID }: { source: ImageSourcePropType; testID: string }) {
  return (
    <>
      <View pointerEvents="none" style={styles.emptyCardImageFrame}>
        <Image source={source} testID={testID} style={styles.emptyCardImage} resizeMode="stretch" accessibilityIgnoresInvertColors />
      </View>
      <View pointerEvents="none" style={styles.emptyArtScrim} />
    </>
  );
}

function VisionChartSection({
  accent,
  hasChart,
  chart,
  chartCourseId,
  visionTile,
  onOpenVision,
  onOpenChart,
}: {
  accent: string;
  hasChart: boolean;
  chart: ReturnType<typeof resolveHomeChartState>;
  chartCourseId?: string;
  visionTile: { imageUrl?: string | null } | null | undefined;
  onOpenVision: () => void;
  onOpenChart: (courseId?: string) => void;
}) {
  const hasVision = Boolean(visionTile?.imageUrl);
  return (
    <View style={styles.visionChart}>
      <Pressable accessibilityRole="button" accessibilityLabel="Vision" onPress={onOpenVision} style={({ pressed }) => [styles.visionCard, !hasVision && styles.emptyArtCard, pressed && styles.pressed]}>
        {!hasVision ? <EmptyCardArtwork source={EMPTY_ART.vision} testID="v2-vision-empty-art" /> : visionTile?.imageUrl ? (
          <Image source={{ uri: visionTile.imageUrl }} style={styles.visionReadyImage} />
        ) : null}
        <View style={hasVision ? styles.cardCopy : styles.emptyCardContent}>
          <Text style={hasVision ? styles.cardTitle : styles.emptyCardTitle}>{hasVision ? 'Your Vision' : DETAIL_ACTION_COPY.visionTitle}</Text>
          {!hasVision ? <Text style={styles.emptyCardPayoff}>{DETAIL_ACTION_COPY.visionPayoff}</Text> : null}
        </View>
        <ChevronRight size={18} color={hasVision ? colors.text.secondary : '#FFFFFF'} style={styles.emptyCardChevron} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Chart" onPress={() => onOpenChart(chartCourseId)} style={({ pressed }) => [styles.chartCard, !hasChart && styles.emptyArtCard, pressed && styles.pressed]}>
        {chart.state !== 'ready' ? <EmptyCardArtwork source={EMPTY_ART.chart} testID="v2-chart-empty-art" /> : <View style={styles.chartArt}><PathPreview accent={accent} reached={chart.reachedCount} total={chart.waypointCount} /></View>}
        <View style={hasChart ? styles.cardCopy : styles.emptyCardContent}>
          <Text style={hasChart ? styles.cardTitle : styles.emptyCardTitle}>{hasChart ? 'Your Chart' : DETAIL_ACTION_COPY.chartTitle}</Text>
          {!hasChart ? <Text style={styles.emptyCardPayoff}>{DETAIL_ACTION_COPY.chartPayoff}</Text> : null}
        </View>
        <ChevronRight size={18} color={hasChart ? colors.text.secondary : '#FFFFFF'} style={styles.emptyCardChevron} />
      </Pressable>
    </View>
  );
}

export function V2AnchorDetailsScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const { width, height } = useWindowDimensions();
  const intents = useV2DailyShellIntents();
  const detail = useV2AnchorDetail(params.anchorId);
  const anchorId = detail.anchor?.localId ?? detail.anchor?.id ?? '';
  const serverId = detail.anchor?.id ?? '';
  const recommendation = useRecommendation(serverId);
  const vision = useV2Vision(serverId);
  const courseStore = useCourseStore((s) => s);
  const accountId = useAuthStore((s) => s.user?.id ?? null);
  const activeAnchorCount = useAnchorStore((s) => s.anchors.filter((a) => !a.isReleased && !a.archivedAt).length);
  const focusDuration = useSettingsStore((s) => s.focusSessionDuration);
  const primeDuration = useSettingsStore((s) => s.primeSessionDuration);
  const visualizeDuration = useSettingsStore((s) => s.visualizeSessionDuration);
  const chart = resolveHomeChartState({
    anchor: detail.anchor, chartEnabled: courseStore.flags.chart_enabled, accountId,
    courseAccountId: courseStore.accountId, initializationStatus: courseStore.initializationStatus,
    courses: courseStore.courses, activeCourse: courseStore.activeCourse,
    errorCode: courseStore.errorCode, isOnlyActiveAnchor: activeAnchorCount === 1,
  });
  const history = useMemo(() => detail.recentPractice.slice().reverse().map((item) => item.strengthAfter), [detail.recentPractice]);
  if (!detail.anchor) return <V2Screen testID="v2-anchor-details-screen"><V2TopBar title="Anchor" onBackPress={() => navigation.goBack()} /><V2EmptyState title="Anchor not found" message="This Anchor may have been removed." /></V2Screen>;
  const accent = getCategoryColor(detail.anchor.category);
  const visionTile = vision.state.state === 'ready' ? vision.state.tiles.find((tile) => tile.imageUrl) : null;
  const hasChart = chart.state === 'ready';
  const chartCourseId = hasChart ? chart.courseId : undefined;
  const duration = recommendation.value?.mode === 'deep_prime' ? primeDuration : recommendation.value?.mode === 'visualize' ? visualizeDuration : focusDuration;
  const openPractice = (mode: V2PracticeMode) => { if (mode === 'release') intents.onReleaseAnchor(anchorId); else intents.onOpenPractice(anchorId, mode); };
  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}><StatusBar barStyle="dark-content" backgroundColor={colors.surface} /><ScrollView testID="v2-anchor-details-screen" showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
    <Hero anchor={detail.anchor} height={Math.max(330, Math.min(390, height * .43))} onBack={() => navigation.goBack()} onMore={() => Alert.alert('Anchor', undefined, [{ text: 'View Progress', onPress: () => intents.onOpenProgress(serverId) }, ...(!detail.anchor?.isReleased ? [{ text: 'Release this Anchor', onPress: () => intents.onReleaseAnchor(anchorId) }] : []), { text: 'Cancel', style: 'cancel' }])} />
    <View style={[styles.body, { paddingHorizontal: width < 370 ? 20 : 26 }]}>
      <ThreadSummary value={recommendation.value?.strength ?? detail.thread?.value ?? null} delta={recommendation.value?.delta ?? null} accent={accent} onPress={() => intents.onOpenProgress(serverId)} history={history} />
      <TodayCard recommendation={recommendation.value} error={recommendation.error} duration={duration} onPress={openPractice} />
      <RecentPractice entries={detail.recentPractice} onViewAll={() => intents.onOpenProgress(serverId)} />
      <VisionChartSection
        accent={accent}
        hasChart={hasChart}
        chart={chart}
        chartCourseId={chartCourseId}
        visionTile={visionTile}
        onOpenVision={() => intents.onOpenVision(serverId)}
        onOpenChart={(courseId) => intents.onOpenChart(serverId, courseId)}
      />
      {/* DEFERRED: The former illustrated release card used PRACTICE_ART.release here; that artwork remains available for practice surfaces. */}
      {!detail.anchor.isReleased ? <Pressable accessibilityRole="button" accessibilityLabel="Release this Anchor" onPress={() => intents.onReleaseAnchor(anchorId)} style={styles.release}><Text style={styles.releaseText}>Release this Anchor</Text><ChevronRight size={18} color={colors.text.secondary} /></Pressable> : null}
    </View>
  </ScrollView></SafeAreaView>;
}

function PathPreview({ accent, reached, total }: { accent: string; reached: number; total: number }) {
  if (!total) return <Text style={styles.emptySymbol}>＋</Text>;
  const segments = Math.max(total - 1, 1);
  const points = Array.from({ length: total }, (_, i) => ({ x: 5 + i * 55 / segments, y: 42 - i * 29 / segments }));
  const path = points.map((point, i) => (i ? 'L' : 'M') + point.x + ' ' + point.y).join(' ');
  return <Svg width={65} height={55} viewBox="0 0 65 55"><Path d={path} stroke={colors.border.strong} strokeWidth={1.5} fill="none" />{points.map((point, i) => <React.Fragment key={i}><Path d={'M' + point.x + ' ' + point.y + ' l0 .1'} stroke={i < reached ? accent : colors.border.strong} strokeWidth={i < reached ? 5 : 3} strokeLinecap="round" /></React.Fragment>)}</Svg>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface }, scroll: { paddingBottom: 28 },
  hero: { overflow: 'hidden', alignItems: 'center', justifyContent: 'space-between' }, heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' }, heroWash: { ...StyleSheet.absoluteFillObject },
  heroNav: { width: '100%', paddingHorizontal: 24, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', zIndex: 2 }, glyph: { marginTop: -3 }, heroCopy: { alignItems: 'center', maxWidth: '86%', marginBottom: 20, zIndex: 2 }, stickerText: { position: 'relative' }, stickerOutline: { position: 'absolute', color: '#FFFFFF' },
  intention: { fontFamily: typography.displayBold, fontSize: 27, lineHeight: 31, color: colors.text.primary, textAlign: 'center', letterSpacing: -.7 }, category: { fontFamily: typography.bodyBold, fontSize: 11, letterSpacing: 2, marginTop: 8 }, created: { fontFamily: typography.bodyMedium, fontSize: 12, color: colors.text.primary, marginTop: 5 }, arc: { position: 'absolute', bottom: -1 },
  body: { paddingTop: 14 }, sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, eyebrow: { fontFamily: typography.bodyBold, fontSize: 11, letterSpacing: 1.8, color: colors.text.primary }, level: { fontFamily: typography.bodyBold, fontSize: 11, letterSpacing: 1 },
  headingLabelGroup: { flexDirection: 'row', alignItems: 'center' },
  headingIcon: { marginLeft: 5 },
  hiddenValueTest: { position: 'absolute', opacity: 0, width: 0, height: 0 },
  thread: { marginBottom: 15 }, strengthRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 3 }, strength: { fontFamily: typography.displayBold, fontSize: 50, lineHeight: 57, color: colors.text.primary }, percent: { fontFamily: typography.displayBold, fontSize: 42, color: colors.text.primary }, delta: { fontFamily: typography.bodySemiBold, fontSize: 14, marginLeft: 16 }, graphEmpty: { fontFamily: typography.body, fontSize: 12, color: colors.text.secondary, height: 56, paddingTop: 18 },
  todayCard: { borderRadius: 14, overflow: 'hidden', borderWidth: 1, elevation: 3, shadowColor: colors.text.primary, shadowOpacity: .1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }, todayArtWrap: { position: 'relative', width: '100%', height: 105 }, todayArt: { width: '100%', height: 105 }, todayArtFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 38 }, todayBody: { minHeight: 75, paddingHorizontal: 15, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, todayCopy: { flex: 1, minWidth: 0 }, todayTitle: { fontFamily: typography.displaySemiBold, fontSize: 20, color: practiceDarkText.title }, todayReason: { fontFamily: typography.body, fontSize: 13, color: practiceDarkText.body, marginTop: 2 }, todayArrow: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' }, todayPending: { height: 90, justifyContent: 'center', gap: 8 }, quiet: { fontFamily: typography.body, fontSize: 13, color: colors.text.secondary, marginTop: 8 }, pressed: { opacity: .8 },
  recent: { marginTop: 22 }, viewAll: { fontFamily: typography.bodySemiBold, fontSize: 13, color: colors.text.primary }, practiceRow: { flexDirection: 'row', minHeight: 58, paddingTop: 13 }, timeline: { width: 32, alignItems: 'center' }, marker: { width: 13, height: 13, borderRadius: 7 }, timelineLine: { width: 1, flex: 1, backgroundColor: colors.border.default }, practiceCopy: { flex: 1 }, practiceName: { fontFamily: typography.bodySemiBold, fontSize: 15, color: colors.text.primary }, practiceMeta: { fontFamily: typography.body, fontSize: 12, color: colors.text.secondary, marginTop: 3 }, practiceDelta: { fontFamily: typography.bodySemiBold, fontSize: 13, color: colors.text.primary },
  visionChart: { gap: 10, marginTop: 18 },
  visionCard: { minHeight: 138, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface, paddingHorizontal: 15, paddingVertical: 15 },
  chartCard: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface, paddingHorizontal: 15, paddingVertical: 12 },
  emptyArtCard: { position: 'relative', borderColor: 'rgba(255,255,255,0.24)' },
  visionArt: { width: 126, height: 72, borderRadius: 8, overflow: 'hidden', position: 'relative', backgroundColor: colors.grouped },
  chartArt: { width: 92, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 8, overflow: 'hidden', position: 'relative', backgroundColor: colors.grouped },
  emptyCardImageFrame: { ...StyleSheet.absoluteFillObject },
  emptyCardImage: { width: '100%', height: '100%' },
  emptyArtScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,15,22,0.08)' },
  emptyCardContent: { flex: 1, minWidth: 0, zIndex: 1 },
  emptyCardTitle: { fontFamily: typography.displaySemiBold, fontSize: 18, lineHeight: 22, color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  emptyCardPayoff: { fontFamily: typography.body, fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,0.92)', marginTop: 4, textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  emptyCardChevron: { zIndex: 1 },
  visionReadyImage: { width: 126, height: 88, borderRadius: 8, backgroundColor: colors.grouped },
  cardCopy: { flex: 1, minWidth: 0 },
  cardTitle: { fontFamily: typography.displaySemiBold, fontSize: 18, lineHeight: 22, color: colors.text.primary },
  cardPayoff: { fontFamily: typography.body, fontSize: 13, lineHeight: 18, color: colors.text.secondary, marginTop: 4 },
  emptySymbol: { fontFamily: typography.body, fontSize: 23, color: colors.text.secondary },
  release: { minHeight: 44, marginTop: 20, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border.subtle, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  releaseText: { flexShrink: 1, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 18, color: colors.text.secondary },
});
