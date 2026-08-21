import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronDown, ChevronLeft, Info, X } from 'lucide-react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PracticeStackParamList } from '@/types';
import {
  PRACTICE_MODE_LABELS,
  type PracticeMode,
  type WeaveRange,
  type WeaveScope,
} from '@/types/practice';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { calculateThreadStrengthScore, selectCanonicalPracticeEvents } from '@/utils/practiceMetrics';
import { localDateKey } from '@/utils/practiceTime';
import { getThreadStrengthState } from '@/utils/threadStrength';
import { colors, typography } from '@/theme';
import { ZenBackground } from '@/components/common';
import AuthHydrationService from '@/services/AuthHydrationService';
import { AnalyticsService } from '@/services/AnalyticsService';
import { useTeachingGate } from '@/utils/useTeachingGate';
import { useTeachingStore } from '@/stores/teachingStore';
import {
  buildWeaveData,
  eventMatchesAnchor,
  formatWeaveDuration,
  WEAVE_RANGE_CONFIG,
  type WeaveNode,
} from './weaveData';
import { buildWeaveGeometry } from './weaveGeometry';
import { WeaveCanvas } from './WeaveCanvas';

type WeaveRoute = RouteProp<PracticeStackParamList, 'TheWeave'>;
type WeaveNavigation = NativeStackNavigationProp<PracticeStackParamList, 'TheWeave'>;
type SheetKind = 'scope' | 'range' | 'node' | 'about' | null;
type HistoryStatus = 'loading' | 'ready' | 'error';

const MODE_COLORS: Record<PracticeMode, string> = {
  focus: '#AD99D2',
  visualize: '#78B4D1',
  deep_prime: '#F0CB6A',
  release: '#C8875A',
};

const MODE_ORDER: PracticeMode[] = ['focus', 'visualize', 'deep_prime', 'release'];
const SCREEN_WIDTH = Dimensions.get('window').width;
const PLOT_HEIGHT = 186;

function displayDate(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? dateKey
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function displayRange(start: string, end: string): string {
  return start === end ? displayDate(start) : `${displayDate(start)} – ${displayDate(end)}`;
}

function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function axisTicks(range: WeaveRange, startDateKey: string): string[] {
  const { days } = WEAVE_RANGE_CONFIG[range];
  const count = range === '4w' ? 3 : range === '12w' ? 4 : range === '6m' ? 5 : 6;
  return Array.from({ length: count }, (_, index) => {
    if (index === count - 1) return 'NOW';
    const dateKey = addDays(startDateKey, Math.round(((days - 1) * index) / Math.max(1, count - 1)));
    const date = new Date(`${dateKey}T12:00:00`);
    return range === '4w'
      ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : date.toLocaleDateString(undefined, { month: 'short' });
  });
}

function scopeLabel(scope: WeaveScope, names: Map<string, string>): string {
  return scope.kind === 'all' ? 'All Practice' : names.get(scope.anchorId) ?? 'This Anchor';
}

export const TheWeaveScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<WeaveNavigation>();
  const route = useRoute<WeaveRoute>();
  const { navigateToPractice, navigateToVault, returnToAnchorDetail: canonicalReturnToAnchorDetail } = useTabNavigation();
  const returnToAnchorDetail = canonicalReturnToAnchorDetail ?? ((anchorId: string) => navigateToVault('AnchorDetail', { anchorId }));
  const anchors = useAnchorStore((state) => state.anchors);
  const currentAnchorId = useAnchorStore((state) => state.currentAnchorId);
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const isOffline = useAuthStore((state) => state.isOfflineMode);
  const history = useSessionStore((state) => state.practiceHistory);
  const sensitivity = useSettingsStore((state) => state.threadStrengthSensitivity);
  const restDays = useSettingsStore((state) => state.restDays);
  const reduceMotion = useReducedMotion();
  const originAnchorId = route.params.originAnchorId;
  const [scope, setScope] = useState<WeaveScope>(
    route.params.initialScope ??
      (originAnchorId ? { kind: 'anchor', anchorId: originAnchorId } : currentAnchorId ? { kind: 'anchor', anchorId: currentAnchorId } : { kind: 'all' }),
  );
  const [range, setRange] = useState<WeaveRange>('12w');
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [selectedNode, setSelectedNode] = useState<WeaveNode | null>(null);
  const [historyStatus, setHistoryStatus] = useState<HistoryStatus>('loading');
  const historyRequestRef = useRef(0);
  const weaveTeaching = useTeachingGate({ screenId: 'the_weave', candidateIds: ['weave_intro_v1'] });
  const recordTeachingShown = useTeachingStore((state) => state.recordShown);
  const [showTeaching, setShowTeaching] = useState(Boolean(weaveTeaching));
  const bottomPadding = 64 + Math.max(46, insets.bottom + 12) + 64;
  const anchorNames = useMemo(
    () => {
      const names = new Map<string, string>();
      anchors.forEach((anchor) => {
        const name = anchor.intentionText || 'Untitled Anchor';
        names.set(anchor.id, name);
        if (anchor.localId) names.set(anchor.localId, name);
      });
      return names;
    },
    [anchors],
  );
  const selectedAnchorAliases = useMemo(() => {
    if (scope.kind !== 'anchor') return undefined;
    const anchor = anchors.find((candidate) => candidate.id === scope.anchorId || candidate.localId === scope.anchorId);
    return [scope.anchorId, anchor?.id, anchor?.localId];
  }, [anchors, scope]);
  const data = useMemo(() => buildWeaveData({ history, accountId, scope, range, anchorAliases: selectedAnchorAliases }), [accountId, history, range, scope, selectedAnchorAliases]);
  const width = Math.max(280, SCREEN_WIDTH - 40);
  const geometry = useMemo(() => buildWeaveGeometry({ modes: MODE_ORDER, nodesByMode: data.nodesByMode, bucketCount: data.bucketCount, width, height: PLOT_HEIGHT }), [data.bucketCount, data.nodesByMode, width]);
  const ticks = useMemo(() => axisTicks(range, data.startDateKey), [data.startDateKey, range]);
  const strength = useMemo(
    () => scope.kind === 'anchor' && data.events.length > 0
      ? calculateThreadStrengthScore(data.events, localDateKey(new Date()), sensitivity, restDays)
      : null,
    [data.events, restDays, scope.kind, sensitivity],
  );
  const mostPracticedMode = useMemo(() => {
    if (data.metrics.sessions < 8) return null;
    return MODE_ORDER.slice().sort((left, right) => data.metrics.modeCounts[right] - data.metrics.modeCounts[left])[0];
  }, [data.metrics]);
  const recentEvents = useMemo(() => data.events.slice().sort((left, right) => new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime()).slice(0, 3), [data.events]);
  const knownCanonicalHistory = useMemo(() => selectCanonicalPracticeEvents(history, accountId).length > 0, [accountId, history]);
  const anchorThreadStrength = useMemo(() => new Map(anchors.map((anchor) => {
    const events = selectCanonicalPracticeEvents(history, accountId).filter((event) => eventMatchesAnchor(event, [anchor.id, anchor.localId]));
    const score = events.length ? calculateThreadStrengthScore(events, localDateKey(new Date()), sensitivity, restDays) : 0;
    return [anchor.id, score] as const;
  })), [accountId, anchors, history, restDays, sensitivity]);

  const expandProgress = useSharedValue(reduceMotion ? 1 : 0);
  const scopeKey = scope.kind === 'anchor' ? scope.anchorId : 'all';

  useEffect(() => {
    if (reduceMotion) {
      expandProgress.value = 1;
      return;
    }
    expandProgress.value = 0;
    expandProgress.value = withTiming(1, {
      duration: 700,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
  }, [scopeKey, range, data.startDateKey, reduceMotion, expandProgress]);

  const animatedPlotStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expandProgress.value, [0, 0.15, 1], [0.3, 0.75, 1]),
    transform: [
      { scaleY: interpolate(expandProgress.value, [0, 1], [0.94, 1]) },
    ],
  }));

  const animatedHeroStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expandProgress.value, [0, 0.3, 1], [0, 0.55, 1]),
    transform: [
      { translateY: interpolate(expandProgress.value, [0, 1], [8, 0]) },
    ],
  }));

  const retryHistory = useCallback(async () => {
    const requestId = historyRequestRef.current + 1;
    historyRequestRef.current = requestId;
    if (!accountId) {
      setHistoryStatus('ready');
      return;
    }
    if (isOffline) {
      setHistoryStatus('ready');
      return;
    }
    setHistoryStatus('loading');
    try {
      await AuthHydrationService.rehydrateSessionFromExport({ throwOnError: true });
      if (historyRequestRef.current === requestId) setHistoryStatus('ready');
    } catch {
      if (historyRequestRef.current === requestId) setHistoryStatus('ready');
    }
  }, [accountId, isOffline]);

  useEffect(() => {
    if (knownCanonicalHistory || !accountId) {
      setHistoryStatus('ready');
      return;
    }
    void retryHistory();
  }, [accountId, knownCanonicalHistory, retryHistory]);

  useEffect(() => {
    if (!weaveTeaching || !showTeaching) return;
    recordTeachingShown(weaveTeaching.teachingId, weaveTeaching.pattern, weaveTeaching.maxShows);
    AnalyticsService.track('teaching_shown', { teaching_id: weaveTeaching.teachingId, pattern: weaveTeaching.pattern, screen: 'the_weave', trigger: weaveTeaching.trigger });
  }, [recordTeachingShown, showTeaching, weaveTeaching]);

  const leave = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    if (route.params?.origin === 'anchorDetail' && originAnchorId) {
      returnToAnchorDetail(originAnchorId);
      return;
    }
    navigateToPractice();
  };

  const openNode = (node: WeaveNode) => {
    setSelectedNode(node);
    setSheet('node');
  };

  const isHistoryLoading = historyStatus === 'loading' && data.events.length === 0;
  const historyUnavailable = data.events.length === 0 && isOffline && !knownCanonicalHistory;
  const noConfirmedHistory = data.events.length === 0 && historyStatus === 'ready' && !historyUnavailable;
  const primaryAnchorName = scope.kind === 'anchor' ? scopeLabel(scope, anchorNames) : null;

  return (
    <View style={styles.root}>
      <ZenBackground variant="weave" showGrain showVignette performanceTier="medium" />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Back to ${route.params.origin === 'anchorDetail' ? 'Anchor' : 'Practice'}`}
            onPress={leave}
            style={styles.backButton}
          >
            <ChevronLeft color="#87939D" size={18} />
            <Text style={styles.backLabel}>{route.params.origin === 'anchorDetail' ? 'Anchor' : 'Practice'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="About The Weave"
            onPress={() => setSheet('about')}
            style={styles.aboutButton}
            testID="weave-about"
          >
            <Info color="rgba(217,179,108,0.7)" size={18} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]} showsVerticalScrollIndicator={false}>
          <View accessible accessibilityRole="header" style={styles.titleBlock}>
            <Text style={styles.eyebrow}>PRACTICE HISTORY</Text>
            <Text style={styles.title}>THE WEAVE</Text>
            <Text style={styles.intro}>What you have been reinforcing.</Text>
          </View>
          {showTeaching && weaveTeaching ? (
            <View style={styles.teachingCard} accessibilityRole="alert">
              <View style={styles.teachingCopy}>
                <Text style={styles.teachingTitle}>How to read the weave</Text>
                <Text style={styles.teachingText}>{weaveTeaching.copy}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Dismiss weave introduction" onPress={() => setShowTeaching(false)} hitSlop={10}>
                <X color={colors.gold} size={16} />
              </Pressable>
            </View>
          ) : null}

          <View style={styles.controls}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Scope: ${scopeLabel(scope, anchorNames)}`}
              onPress={() => setSheet('scope')}
              style={styles.control}
            >
              <Text style={styles.controlLabel}>SCOPE</Text>
              <Text style={styles.controlValueScope} numberOfLines={1} ellipsizeMode="tail">
                {scopeLabel(scope, anchorNames)}
              </Text>
              <ChevronDown color="#87939D" size={14} style={styles.controlChevron} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Range: ${WEAVE_RANGE_CONFIG[range].label}`}
              onPress={() => setSheet('range')}
              style={styles.control}
            >
              <Text style={styles.controlLabel}>RANGE</Text>
              <Text style={styles.controlValueRange}>
                {WEAVE_RANGE_CONFIG[range].label}
              </Text>
              <ChevronDown color="rgba(217,179,108,0.7)" size={14} style={styles.controlChevron} />
            </Pressable>
          </View>

          {isHistoryLoading ? (
            <View style={styles.statusBlock} accessibilityRole="progressbar" accessibilityLabel="Loading practice history">
              <ActivityIndicator color={colors.gold} />
              <Text style={styles.statusTitle}>Gathering your practice history</Text>
              <Text style={styles.statusText}>Your saved returns are being woven together.</Text>
            </View>
          ) : historyUnavailable ? (
            <View style={styles.statusBlock} accessibilityRole="alert">
              <Text style={styles.statusTitle}>History unavailable offline</Text>
              <Text style={styles.statusText}>Reconnect to refresh this Anchor’s practice history.</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Retry loading practice history" onPress={() => void retryHistory()} style={styles.retryButton}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : historyStatus === 'error' && data.events.length === 0 ? (
            <View style={styles.statusBlock} accessibilityRole="alert">
              <Text style={styles.statusTitle}>We couldn’t refresh the weave.</Text>
              <Text style={styles.statusText}>Your practice is safe. Try again when the connection is steady.</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Retry loading practice history" onPress={() => void retryHistory()} style={styles.retryButton}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : noConfirmedHistory ? (
            <View style={styles.statusBlock}>
              <Text style={styles.statusTitle}>The weave begins with a return.</Text>
              <Text style={styles.statusText}>Completed practice will appear here for this range.</Text>
            </View>
          ) : (
            <>
              {isOffline ? <Text style={styles.cachedLabel}>Showing saved history while offline</Text> : null}
              <Text style={styles.plotSummary} accessibilityRole="summary">{`${scopeLabel(scope, anchorNames)}, ${WEAVE_RANGE_CONFIG[range].label}: ${data.metrics.sessions} completed practice sessions across ${data.metrics.practiceDays} practice days. Each node opens its completed-session detail.`}</Text>
              <Animated.View style={[styles.plot, { width }, animatedPlotStyle]} accessible={false}>
                <WeaveCanvas
                  width={width}
                  height={PLOT_HEIGHT}
                  geometry={geometry}
                  nodes={data.nodes}
                  modeColors={MODE_COLORS}
                  backgroundColor="#080D12"
                  selectedNodeId={sheet === 'node' ? selectedNode?.id ?? null : null}
                  animationKey={`${scopeKey}:${range}:${data.startDateKey}`}
                  still={reduceMotion}
                />
                {data.nodes.map((node) => {
                  const position = geometry.nodePositions[node.id];
                  if (!position) return null;
                  const anchorLabel = scope.kind === 'all'
                    ? (node.events.length === 1 ? anchorNames.get(node.events[0]?.anchorId ?? '') ?? 'An Anchor' : 'Across Anchors')
                    : primaryAnchorName ?? 'This Anchor';
                  return (
                    <Pressable
                      key={`${node.id}:target`}
                      accessibilityRole="button"
                      accessibilityLabel={`${PRACTICE_MODE_LABELS[node.mode]}, ${displayRange(node.startDateKey, node.endDateKey)}, ${node.sessionCount} ${node.sessionCount === 1 ? 'session' : 'sessions'}, ${formatWeaveDuration(node.durationSeconds)}, ${anchorLabel}`}
                      onPress={() => openNode(node)}
                      style={[styles.nodeTarget, { left: position.left - 22, top: position.top - 22 }]}
                    />
                  );
                })}
              </Animated.View>
              <View style={styles.axis} accessible={false}>
                {ticks.map((tick, index) => (
                  <Text key={`${tick}:${index}`} style={tick === 'NOW' ? styles.axisNow : styles.axisLabel}>
                    {tick}
                  </Text>
                ))}
              </View>
              <View style={styles.legend}>
                {MODE_ORDER.map((mode) => (
                  <View key={mode} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: MODE_COLORS[mode] }]} />
                    <Text style={styles.legendText}>{PRACTICE_MODE_LABELS[mode]}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {strength !== null ? (
            <Animated.View style={animatedHeroStyle}>
              <View style={styles.rule} />
              <View
                style={styles.strengthHero}
                accessible
                accessibilityRole="summary"
                accessibilityLabel={`Thread Strength ${strength} out of 100, ${getThreadStrengthState(strength).label}`}
              >
                <Text style={styles.strengthHeroLabel}>THREAD STRENGTH</Text>
                <View style={styles.strengthScoreRow}>
                  <Text style={styles.strengthScore}>{strength}</Text>
                  <Text style={styles.strengthMax}>/ 100</Text>
                </View>
                <View style={styles.strengthStateRow}>
                  <View style={styles.strengthStateDash} />
                  <Text style={styles.strengthStateLabel}>{getThreadStrengthState(strength).label}</Text>
                  <View style={styles.strengthStateDash} />
                </View>
                <Text style={styles.strengthContext}>{getThreadStrengthState(strength).description}</Text>
              </View>
            </Animated.View>
          ) : null}

          <View style={styles.rule} />
          <View style={styles.metricsGrid}>
            <Metric label="SESSIONS" value={`${data.metrics.sessions}`} />
            <Metric label="PRACTICE DAYS" value={`${data.metrics.practiceDays}`} />
            <Metric label="ACTIVE WEEKS" value={`${data.metrics.activeWeeks}`} />
            <Metric label="PRACTICED" value={formatWeaveDuration(data.metrics.practicedSeconds)} />
          </View>

          <View style={styles.rule} />
          <Text style={styles.sectionLabel}>PRACTICE MIX</Text>
          {MODE_ORDER.map((mode) => {
            const count = data.metrics.modeCounts[mode];
            const fraction = data.metrics.sessions ? Math.round((count / data.metrics.sessions) * 100) : 0;
            return (
              <View key={mode} style={styles.mixRow}>
                <View style={[styles.mixDot, { backgroundColor: MODE_COLORS[mode] }]} />
                <Text style={styles.mixName}>{PRACTICE_MODE_LABELS[mode]}</Text>
                <View style={styles.mixTrack}>
                  <View
                    style={[
                      styles.mixFill,
                      { width: `${fraction}%`, backgroundColor: MODE_COLORS[mode] },
                    ]}
                  />
                </View>
                <Text style={styles.mixPercent}>{fraction}%</Text>
              </View>
            );
          })}

          <View style={styles.rule} />
          <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
          {recentEvents.length ? (
            recentEvents.map((event) => (
              <View key={event.id} style={styles.activityRow}>
                <View style={[styles.activityDot, { backgroundColor: MODE_COLORS[event.practiceMode] }]} />
                <View style={styles.activityCopy}>
                  <Text style={styles.activityTitle}>{PRACTICE_MODE_LABELS[event.practiceMode]}</Text>
                  <Text style={styles.activityDetail}>
                    {displayDate(event.localDateKey)} · {formatWeaveDuration(event.completedDurationSeconds)}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyRecent}>Your completed returns will appear here.</Text>
          )}

          <View style={styles.rule} />
          <Text style={styles.sectionLabel}>INSIGHTS</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Open weave insights" onPress={() => setSheet('about')} style={styles.insightButton}>
            <Text style={styles.insightText}>{mostPracticedMode ? `Most often, you return through ${PRACTICE_MODE_LABELS[mostPracticedMode]}.` : 'Insights deepen after eight completed sessions.'}</Text>
            <ChevronDown color={colors.gold} size={16} />
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      <Modal visible={sheet !== null} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.scrim} onPress={() => setSheet(null)} accessibilityLabel="Close sheet">
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {sheet === 'scope' ? 'Choose scope' : sheet === 'range' ? 'Choose range' : sheet === 'about' ? 'About The Weave' : 'Practice detail'}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setSheet(null)} style={styles.closeButton}>
                <X color={colors.gold} size={18} />
              </Pressable>
            </View>
            {sheet === 'scope' ? (
              <>
                <SheetOption label="All Practice" selected={scope.kind === 'all'} onPress={() => { setScope({ kind: 'all' }); setSheet(null); }} />
                {anchors.map((anchor) => (
                  <SheetOption
                    key={anchor.id}
                    label={anchor.intentionText || 'Untitled Anchor'}
                    detail={`${anchor.isReleased || anchor.archivedAt ? 'Released · ' : ''}${anchorThreadStrength.get(anchor.id) ?? 0} Thread Strength`}
                    selected={scope.kind === 'anchor' && scope.anchorId === anchor.id}
                    onPress={() => { setScope({ kind: 'anchor', anchorId: anchor.id }); setSheet(null); }}
                  />
                ))}
              </>
            ) : sheet === 'range' ? (
              <View style={styles.rangeGrid}>
                {(Object.keys(WEAVE_RANGE_CONFIG) as WeaveRange[]).map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: range === value }}
                    onPress={() => { setRange(value); setSheet(null); }}
                    style={[styles.rangeCell, range === value && styles.rangeCellSelected]}
                  >
                    <Text style={[styles.rangeCellText, range === value && styles.rangeCellTextSelected]}>
                      {WEAVE_RANGE_CONFIG[value].label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : sheet === 'about' ? (
              <View style={styles.aboutSheetBody}>
                <Text style={styles.aboutSheetLead}>
                  Every completed return becomes a node. The four threads cross as the density and rhythm of your practice changes.
                </Text>
                <Text style={styles.aboutSheetHeading}>Reading the threads</Text>
                <Text style={styles.aboutSheetText}>
                  Brighter, wider lines show modes you have practiced more often in this range. Larger nodes gather multiple completed sessions from the same period.
                </Text>
                <Text style={styles.aboutSheetHeading}>Insights</Text>
                <Text style={styles.aboutSheetText}>
                  {mostPracticedMode ? `Your strongest recurring mode in this view is ${PRACTICE_MODE_LABELS[mostPracticedMode]}.` : 'After eight completed sessions, The Weave begins to name the mode you return through most often.'}
                </Text>
              </View>
            ) : selectedNode ? (
              <View style={styles.nodeSheetBody}>
                <Text style={[styles.nodeMode, { color: MODE_COLORS[selectedNode.mode] }]}>{PRACTICE_MODE_LABELS[selectedNode.mode]}</Text>
                <Text style={styles.nodeDate}>{displayRange(selectedNode.startDateKey, selectedNode.endDateKey)}</Text>
                <Text style={styles.nodeSummary}>{selectedNode.sessionCount === 1 ? '1 completed session' : `${selectedNode.sessionCount} completed sessions`} · {formatWeaveDuration(selectedNode.durationSeconds)}</Text>
                <Text style={styles.nodeAnchor}>{scope.kind === 'all' ? (selectedNode.events.length === 1 ? anchorNames.get(selectedNode.events[0]?.anchorId ?? '') ?? 'Anchor unavailable' : 'Across all anchors') : primaryAnchorName}</Text>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const Metric = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.metricCard}>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

const SheetOption = ({ label, detail, selected, onPress }: { label: string; detail?: string; selected: boolean; onPress: () => void }) => (
  <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={styles.sheetOption}>
    <View>
      <Text style={styles.sheetOptionText}>{label}</Text>
      {detail ? <Text style={styles.sheetOptionDetail}>{detail}</Text> : null}
    </View>
    <View style={[styles.radio, selected && styles.radioSelected]} />
  </Pressable>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F1419' },
  safe: { flex: 1 },
  header: {
    minHeight: 54,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(217,179,108,0.11)',
  },
  backButton: {
    minWidth: 88,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backLabel: {
    color: '#87939D',
    fontFamily: typography.fontFamily.sans,
    fontSize: 14,
  },
  aboutButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 38,
  },
  titleBlock: {
    marginTop: 22,
    alignItems: 'center',
  },
  eyebrow: {
    color: '#87939D',
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 11,
    letterSpacing: 2.2,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  title: {
    color: '#F4EFE6',
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 28,
    letterSpacing: 2.0,
    textAlign: 'center',
    marginTop: 6,
    textTransform: 'uppercase',
  },
  intro: {
    color: 'rgba(135,147,157,0.95)',
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 6,
    marginHorizontal: 16,
  },
  teachingCard: {
    marginTop: 18,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(217,179,108,0.18)',
    backgroundColor: 'rgba(18,24,32,0.6)',
    borderRadius: 8,
  },
  teachingCopy: { flex: 1 },
  teachingTitle: {
    color: '#F4EFE6',
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 14,
    letterSpacing: 1.0,
  },
  teachingText: {
    color: 'rgba(244,239,230,0.65)',
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 14,
    lineHeight: 19,
    marginTop: 4,
  },
  controls: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 22,
  },
  control: {
    flex: 1,
    minHeight: 56,
    position: 'relative',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(217,179,108,0.18)',
    paddingBottom: 8,
  },
  controlLabel: {
    color: '#87939D',
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 10,
    letterSpacing: 2.0,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  controlValueScope: {
    color: '#F4EFE6',
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 15,
    letterSpacing: 1.0,
    textTransform: 'uppercase',
    paddingRight: 20,
    flexShrink: 1,
    minWidth: 0,
  },
  controlValueRange: {
    color: '#F2DFA8',
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 12,
    letterSpacing: 2.0,
    textTransform: 'uppercase',
    paddingRight: 20,
  },
  controlChevron: {
    position: 'absolute',
    right: 0,
    bottom: 8,
  },
  plotSummary: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  plot: {
    height: PLOT_HEIGHT,
    marginTop: 24,
    position: 'relative',
    alignSelf: 'center',
  },
  nodeTarget: {
    width: 44,
    height: 44,
    borderRadius: 22,
    position: 'absolute',
  },
  axis: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  axisLabel: {
    color: 'rgba(135,147,157,0.6)',
    fontFamily: typography.fontFamily.sans,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  axisNow: {
    color: 'rgba(217,179,108,0.7)',
    fontFamily: typography.fontFamily.sans,
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
    marginTop: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  legendText: {
    color: 'rgba(135,147,157,0.85)',
    fontFamily: typography.fontFamily.sans,
    fontSize: 11,
  },
  statusBlock: {
    paddingVertical: 56,
    paddingHorizontal: 18,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(217,179,108,0.12)',
  },
  statusTitle: {
    color: '#F4EFE6',
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 18,
    textAlign: 'center',
    marginTop: 10,
  },
  statusText: {
    color: 'rgba(244,239,230,0.58)',
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
  retryButton: {
    minHeight: 44,
    marginTop: 16,
    paddingHorizontal: 18,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(217,179,108,0.42)',
    borderRadius: 999,
  },
  retryText: {
    color: colors.gold,
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  cachedLabel: {
    color: 'rgba(217,179,108,0.6)',
    fontFamily: typography.fontFamily.sans,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 18,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(217,179,108,0.12)',
    marginTop: 26,
  },
  strengthHero: {
    alignItems: 'center',
    paddingTop: 22,
    paddingBottom: 6,
  },
  strengthHeroLabel: {
    color: '#87939D',
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 11,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  strengthScoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  strengthScore: {
    color: '#F4EFE6',
    fontFamily: typography.fontFamily.sans,
    fontSize: 58,
    fontWeight: '200',
    letterSpacing: -2,
    lineHeight: 64,
  },
  strengthMax: {
    color: 'rgba(135,147,157,0.6)',
    fontFamily: typography.fontFamily.sans,
    fontSize: 12,
    marginLeft: 6,
  },
  strengthStateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  strengthStateDash: {
    width: 14,
    height: 1,
    backgroundColor: 'rgba(217,179,108,0.5)',
  },
  strengthStateLabel: {
    color: '#F2DFA8',
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 12,
    letterSpacing: 2.6,
    textTransform: 'uppercase',
  },
  strengthContext: {
    color: 'rgba(244,239,230,0.55)',
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 12,
    marginHorizontal: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingTop: 18,
    rowGap: 18,
  },
  metricCard: {
    width: '46%',
    paddingVertical: 4,
  },
  metricValue: {
    color: '#F4EFE6',
    fontFamily: typography.fontFamily.sans,
    fontSize: 32,
    fontWeight: '200',
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  metricLabel: {
    color: '#87939D',
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 10,
    letterSpacing: 2.0,
    textTransform: 'uppercase',
    marginTop: 5,
  },
  sectionLabel: {
    color: '#87939D',
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 11,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 14,
  },
  mixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 28,
    gap: 10,
  },
  mixDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  mixName: {
    width: 86,
    fontFamily: typography.fontFamily.sans,
    fontSize: 13,
    color: 'rgba(244,239,230,0.82)',
  },
  mixTrack: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(135,147,157,0.14)',
  },
  mixFill: {
    height: 1.5,
    opacity: 0.85,
  },
  mixPercent: {
    width: 36,
    color: 'rgba(244,239,230,0.7)',
    fontFamily: typography.fontFamily.sans,
    fontSize: 12,
    textAlign: 'right',
  },
  activityRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(217,179,108,0.08)',
  },
  activityDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 10,
  },
  activityCopy: { flex: 1 },
  activityTitle: {
    color: 'rgba(244,239,230,0.86)',
    fontFamily: typography.fontFamily.sans,
    fontSize: 13,
  },
  activityDetail: {
    color: 'rgba(135,147,157,0.9)',
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 13,
    marginTop: 2,
  },
  emptyRecent: {
    color: 'rgba(244,239,230,0.55)',
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 14,
    paddingBottom: 8,
  },
  insightButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  insightText: {
    flex: 1,
    color: 'rgba(244,239,230,0.68)',
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 15,
    lineHeight: 22,
    paddingBottom: 12,
  },
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#161D25',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(217,179,108,0.15)',
    paddingHorizontal: 20,
    paddingBottom: 28,
    maxHeight: '72%',
  },
  sheetHeader: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(217,179,108,0.13)',
  },
  sheetTitle: {
    color: '#F4EFE6',
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 17,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOption: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(217,179,108,0.08)',
  },
  sheetOptionText: {
    maxWidth: SCREEN_WIDTH - 105,
    color: '#F4EFE6',
    fontFamily: typography.fontFamily.sans,
    fontSize: 14,
  },
  sheetOptionDetail: {
    color: 'rgba(217,179,108,0.6)',
    fontFamily: typography.fontFamily.sans,
    fontSize: 11,
    marginTop: 2,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(217,179,108,0.35)',
  },
  radioSelected: {
    borderWidth: 5,
    borderColor: colors.gold,
  },
  rangeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 18,
  },
  rangeCell: {
    width: '47%',
    minHeight: 68,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(217,179,108,0.24)',
    borderRadius: 8,
  },
  rangeCellSelected: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(217,179,108,0.08)',
  },
  rangeCellText: {
    color: 'rgba(244,239,230,0.68)',
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  rangeCellTextSelected: {
    color: colors.gold,
  },
  aboutSheetBody: { paddingTop: 22 },
  aboutSheetLead: {
    color: '#F4EFE6',
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 17,
    lineHeight: 24,
  },
  aboutSheetHeading: {
    color: '#87939D',
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 11,
    letterSpacing: 2.0,
    textTransform: 'uppercase',
    marginTop: 21,
  },
  aboutSheetText: {
    color: 'rgba(244,239,230,0.68)',
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 7,
  },
  nodeSheetBody: { paddingTop: 22 },
  nodeMode: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 11,
    letterSpacing: 2.0,
    textTransform: 'uppercase',
  },
  nodeDate: {
    color: '#F4EFE6',
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 20,
    marginTop: 7,
  },
  nodeSummary: {
    color: 'rgba(244,239,230,0.7)',
    fontFamily: typography.fontFamily.sans,
    fontSize: 13,
    marginTop: 7,
  },
  nodeAnchor: {
    color: 'rgba(217,179,108,0.75)',
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 14,
    marginTop: 12,
  },
});
