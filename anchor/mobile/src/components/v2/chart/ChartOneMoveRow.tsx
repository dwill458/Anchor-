import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Check, ChevronDown, ChevronUp } from 'lucide-react-native';
import type { MoveSummary } from '@/types/chart';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { CHART_MAP_TOKENS as T } from './map/chartMapTokens';
import type { PanelAccent } from './panel/chartPanelColors';

type ChartOneMoveRowProps = {
  accent: PanelAccent;
  move: MoveSummary;
  waypointTitle: string;
  checked: boolean;
  busy: boolean;
  reducedMotion: boolean;
  onCheck: () => Promise<boolean>;
  onExpandSheet?: () => void;
  rowRef?: React.RefObject<View | null>;
  circleRef?: React.RefObject<View | null>;
  bodyRef?: React.RefObject<View | null>;
};

function optionalMoveDetail(move: MoveSummary, key: 'why' | 'doneWhen'): string | null {
  const value = key in move ? (move as unknown as Record<string, unknown>)[key] : null;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** The One Move has separate completion and reading targets. */
export function ChartOneMoveRow({
  accent, move, waypointTitle, checked, busy, reducedMotion, onCheck, onExpandSheet,
  rowRef, circleRef, bodyRef,
}: ChartOneMoveRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const inFlight = useRef(false);
  const wasChecked = useRef(checked);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkScale = useSharedValue(1);
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.value }] }));
  const why = optionalMoveDetail(move, 'why') ?? waypointTitle;
  const doneMeans = optionalMoveDetail(move, 'doneWhen') ?? CHART_COPY.sheet.doneFallback;
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
    const next = !expanded;
    setExpanded(next);
    if (next) onExpandSheet?.();
  };

  return (
    <View ref={rowRef} collapsable={false} style={styles.wrap} testID="chart-one-move-row">
      <View style={styles.moveLabelRow}>
        <Text style={[styles.moveLabel, { color: accent.text }]}>{CHART_COPY.sheet.oneMove}</Text>
        <Text style={styles.count}>
          {CHART_COPY.sheet.moveCount.replace('{done}', checked ? '1' : '0').replace('{total}', '1')}
        </Text>
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
          <Text numberOfLines={expanded ? undefined : 2} style={[styles.title, checked && styles.titleDone]} testID="chart-one-move-title">
            {move.title}
          </Text>
          {expanded ? (
            <View style={styles.details} testID="chart-one-move-details">
              <Text style={styles.detailLabel}>{CHART_COPY.sheet.whyThisMove}</Text>
              <Text style={styles.detailText}>{why}</Text>
              <Text style={styles.detailLabel}>{CHART_COPY.sheet.doneMeans}</Text>
              <Text style={styles.detailText}>{doneMeans}</Text>
              <Text style={styles.detailLabel}>{CHART_COPY.sheet.toward}</Text>
              <Text style={styles.detailText}>{waypointTitle}</Text>
            </View>
          ) : null}
          <View style={styles.hintRow}>
            <Text style={styles.hint}>{expanded ? CHART_COPY.sheet.showLess : CHART_COPY.sheet.readAll}</Text>
            {expanded ? <ChevronUp size={16} color={T.muted} /> : <ChevronDown size={16} color={T.muted} />}
          </View>
        </Pressable>
      </View>
      {!checked ? <Text style={styles.helper}>{CHART_COPY.sheet.helperIncomplete}</Text> : null}
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
  body: { flex: 1, minWidth: 0, paddingTop: 2, paddingBottom: 2 },
  title: { fontFamily: T.sans, fontSize: 14, lineHeight: 19, color: T.light },
  titleDone: { color: T.muted, textDecorationLine: 'line-through', textDecorationColor: T.muted },
  hintRow: { minHeight: 20, flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  hint: { fontFamily: T.sans, fontSize: 11, lineHeight: 16, color: T.muted },
  details: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(239,234,223,.18)', marginTop: 7, paddingTop: 8, paddingBottom: 3 },
  detailLabel: { marginTop: 7, fontFamily: T.sansStrong, fontSize: 9, lineHeight: 14, letterSpacing: 1, color: T.muted, textTransform: 'uppercase' },
  detailText: { fontFamily: T.sans, fontSize: 12, lineHeight: 17, color: T.light },
  helper: { fontFamily: T.sans, fontSize: 10, lineHeight: 14, color: T.muted },
  toast: { alignSelf: 'center', borderRadius: 16, backgroundColor: T.panel, paddingHorizontal: 12, paddingVertical: 7, fontFamily: T.sansStrong, fontSize: 11, lineHeight: 15, color: '#BBD2BE', overflow: 'hidden' },
});
