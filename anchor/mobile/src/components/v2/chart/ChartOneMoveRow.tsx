import type { ViewInstance } from 'react-native';
import { beginGuidanceAction } from '@/hooks/v2/guidance/guidanceActions';
import { useAuthStore } from '@/stores/authStore';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Check, ChevronDown, ChevronUp } from 'lucide-react-native';
import { askChartApi } from '@/services/v2/askChartApi';
import { trackChart } from '@/hooks/v2/chart/useAnchorChart';
import { setChatAppliedBatch, useChatAppliedBatch } from '@/hooks/v2/chart/chatAppliedBatch';
import type { MoveSummary } from '@/types/chart';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { CHART_MAP_TOKENS as T } from './map/chartMapTokens';
import type { PanelAccent } from './panel/chartPanelColors';

type ChartOneMoveRowProps = {
  firstBatchMoveCompleted?: boolean;
  accent: PanelAccent;
  move: MoveSummary;
  waypointTitle: string;
  /** What reaching the whole waypoint means (its completion criteria). Shown under "Toward". */
  waypointCriteria?: string | null;
  /** The waypoint's own progress ("1 of 3 done"). The row never invents a count of its own. */
  progressText?: string | null;
  checked: boolean;
  busy: boolean;
  reducedMotion: boolean;
  onCheck: () => Promise<boolean>;
  onExpandSheet?: () => void;
  rowRef?: React.RefObject<ViewInstance | null>;
  circleRef?: React.RefObject<ViewInstance | null>;
  bodyRef?: React.RefObject<ViewInstance | null>;
};

function optionalMoveDetail(move: MoveSummary, key: 'why' | 'doneWhen'): string | null {
  const value = key in move ? (move as unknown as Record<string, unknown>)[key] : null;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** The One Move has separate completion and reading targets. */
export function ChartOneMoveRow({
  accent, move, waypointTitle, waypointCriteria = null, progressText = null, checked, busy, reducedMotion, onCheck, onExpandSheet,
  rowRef, circleRef, bodyRef, firstBatchMoveCompleted = false,
}: ChartOneMoveRowProps) {
  const batch = useChatAppliedBatch();
  const accountId = useAuthStore(state => state.user?.id ?? null);
  const [undoing, setUndoing] = useState(false);
  const undoLock = useRef(false);
  const updated = batch && batch.accountId === accountId && batch.courseId === move.courseId && batch.batchId === move.batchId;
  const undo = async () => {
    if (!batch || undoLock.current) return;
    undoLock.current = true;
    setUndoing(true);
    try {
      await askChartApi.undoProposal(batch.courseId, batch.batchId);
      setChatAppliedBatch(null);
      trackChart('chat_proposal_undone');
    } catch {
      // Keep the action available for retry.
    } finally { undoLock.current = false; setUndoing(false); }
  };
  const [expanded, setExpanded] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const inFlight = useRef(false);
  const wasChecked = useRef(checked);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkScale = useSharedValue(1);
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.value }] }));
  // The move's own reason (`rationale` is what the server stores) comes first; the waypoint is only the fallback.
  const why = optionalMoveDetail(move, 'why') ?? (move.rationale?.trim() || null) ?? waypointTitle;
  // DEFERRED: const doneMeans = optionalMoveDetail(move, 'doneWhen') ?? CHART_COPY.sheet.doneFallback;
  // The detail only shows a "done when" the move actually carries; there is no filler.
  const doneWhen = optionalMoveDetail(move, 'doneWhen');
  const criteria = waypointCriteria?.trim() || null;
  useEffect(() => {
    setExpanded(false);
    setShowToast(false);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [move.id]);

  useEffect(() => {
    if (checked && !wasChecked.current && !reducedMotion) {
      checkScale.value = withSequence(
        withTiming(1.12, { duration: 240, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never }),
        withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never }),
      );
    } else {
      checkScale.value = 1;
    }
    wasChecked.current = checked;
  }, [checked, reducedMotion, checkScale]);

  const complete = async () => {
    if (checked || busy || inFlight.current) return;
    inFlight.current = true;
    try {
      const succeeded = await onCheck();
      if (!succeeded) return;
      setShowToast(true);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setShowToast(false), 1800);
    } catch {
      // The server action reports errors through the existing Chart action path.
    } finally {
      inFlight.current = false;
    }
  };

  const toggleExpanded = () => {
    const confirm = beginGuidanceAction(useAuthStore.getState().user?.id ?? 'guest', 'chart.next_move', 'target:words');
    const next = !expanded;
    setExpanded(next);
    if (next) { onExpandSheet?.(); confirm(true); }
  };

  return (
    <View ref={rowRef} collapsable={false} style={styles.wrap} testID="chart-one-move-row">
      <View style={styles.moveLabelRow}>
        <Text style={[styles.moveLabel, { color: accent.text }]}>{CHART_COPY.sheet.oneMove}</Text>
        {progressText ? <Text style={styles.count} testID="chart-one-move-progress">{progressText}</Text> : null}
      </View>
      <View style={[styles.card, checked && styles.cardDone]}>
        <View ref={circleRef} collapsable={false} style={styles.checkTarget}>
          <Pressable
            testID="chart-one-move-check"
            accessibilityRole="checkbox"
            accessibilityLabel={checked ? CHART_COPY.sheet.markMoveUndone : CHART_COPY.sheet.completeMove}
            accessibilityState={{ checked, busy, disabled: busy || checked }}
            disabled={busy || checked}
            onPress={() => void complete()}
            style={styles.checkHit}
          >
            <Animated.View style={[styles.checkCircle, checked && styles.checkCircleDone, { borderColor: checked ? SAGE : T.muted }, checkStyle]}>
              {checked ? <Check size={17} color={T.light} strokeWidth={3} /> : null}
            </Animated.View>
          </Pressable>
        </View>

        <Pressable
          ref={bodyRef}
          collapsable={false}
          accessibilityRole="button"
          accessibilityLabel={expanded ? CHART_COPY.sheet.showLess : CHART_COPY.sheet.readAll}
          accessibilityState={{ expanded }}
          onPress={toggleExpanded}
          style={styles.body}
          testID="chart-one-move-body"
        >
          <Text numberOfLines={expanded || checked ? undefined : 2} style={[styles.title, checked && styles.titleDone]} testID="chart-one-move-title">
            {move.title}
          </Text>
          <Text numberOfLines={expanded ? undefined : 2} style={styles.why} testID="chart-one-move-why">{why}</Text>
          {expanded && (doneWhen || criteria) ? (
            <View style={styles.details} testID="chart-one-move-details">
              {doneWhen ? (
                <>
                  <Text style={styles.detailLabel}>{CHART_COPY.sheet.doneWhen}</Text>
                  <Text style={styles.detailText} testID="chart-one-move-done-when">{doneWhen}</Text>
                </>
              ) : null}
              {criteria ? (
                <>
                  <Text style={styles.detailLabel}>{CHART_COPY.sheet.waypointReachedWhen}</Text>
                  <Text style={styles.detailText} testID="chart-one-move-criteria">{criteria}</Text>
                </>
              ) : null}
            </View>
          ) : null}
          {/* DEFERRED: the "Tap to read it all" hint row; the chevron below carries the affordance.
          <View style={styles.hintRow}>
            <Text style={styles.hint}>{expanded ? CHART_COPY.sheet.showLess : CHART_COPY.sheet.readAll}</Text>
            {expanded ? <ChevronUp size={16} color={T.muted} /> : <ChevronDown size={16} color={T.muted} />}
          </View> */}
        </Pressable>
        <View pointerEvents="none" style={styles.chevron}>{expanded ? <ChevronUp size={18} color={T.muted} /> : <ChevronDown size={18} color={T.muted} />}</View>
      </View>
      {updated ? <View style={styles.moveLabelRow}><Text style={styles.why}>Updated from chat</Text>{!firstBatchMoveCompleted && !checked ? <Pressable accessibilityRole="button" disabled={undoing} onPress={() => void undo()} testID="chat-proposal-undo"><Text style={styles.count}>Undo</Text></Pressable> : null}</View> : null}
      {/* DEFERRED: helper line "Tap the circle when it's done..."; the first-time teaching and the ? replay cover it. */}
      {showToast ? <Text accessibilityLiveRegion="polite" style={styles.toast} testID="chart-one-move-toast">{CHART_COPY.sheet.moveDoneToast}</Text> : null}
    </View>
  );
}

const SAGE = '#6F8F74';
const styles = StyleSheet.create({
  wrap: { gap: 4 },
  moveLabelRow: { minHeight: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 },
  moveLabel: { fontFamily: T.sansStrong, fontSize: 10, lineHeight: 14, letterSpacing: 1.1, textTransform: 'uppercase', flexShrink: 1 },
  count: { flexShrink: 0, fontFamily: T.sansStrong, fontSize: 11, lineHeight: 14, color: T.light },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(239,234,223,.12)', backgroundColor: T.panel, paddingVertical: 0, paddingLeft: 6, paddingRight: 10 },
  cardDone: { borderColor: 'rgba(111,143,116,.3)', backgroundColor: 'rgba(111,143,116,.12)' },
  checkTarget: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  checkHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  checkCircle: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkCircleDone: { borderColor: SAGE, backgroundColor: SAGE },
  body: { flex: 1, minWidth: 0, paddingTop: 8, paddingBottom: 8 },
  title: { fontFamily: T.sans, fontSize: 14, lineHeight: 19, color: T.light },
  titleDone: { color: T.light },
  why: { marginTop: 2, fontFamily: T.sans, fontSize: 12, lineHeight: 17, color: T.muted },
  chevron: { width: 20, height: 44, alignItems: 'center', justifyContent: 'center' },
  hintRow: { minHeight: 20, flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  hint: { fontFamily: T.sans, fontSize: 11, lineHeight: 16, color: T.muted },
  details: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(239,234,223,.18)', marginTop: 7, paddingTop: 8, paddingBottom: 3 },
  detailLabel: { marginTop: 7, fontFamily: T.sansStrong, fontSize: 9, lineHeight: 14, letterSpacing: 1, color: T.muted, textTransform: 'uppercase' },
  detailText: { fontFamily: T.sans, fontSize: 12, lineHeight: 17, color: T.light },
  helper: { fontFamily: T.sans, fontSize: 10, lineHeight: 14, color: T.muted },
  toast: { alignSelf: 'center', borderRadius: 16, backgroundColor: T.panel, paddingHorizontal: 12, paddingVertical: 7, fontFamily: T.sansStrong, fontSize: 11, lineHeight: 15, color: '#BBD2BE', overflow: 'hidden' },
});
