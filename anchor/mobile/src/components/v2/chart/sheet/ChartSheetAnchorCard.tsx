import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, Play } from 'lucide-react-native';
import { CircularAnchorRenderer } from '@/components/v2/anchor/CircularAnchorRenderer';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { CHART_MAP_TOKENS as T } from '../map/chartMapTokens';
import { CHART_PANEL_COPY as COPY } from '../map/chartRhythm';
import { panelAccent } from '../panel/chartPanelColors';
import type { ChartAnchorArt } from '../ChartLandscape';

type Props = {
  category: string | null | undefined;
  /** The person's own generated Anchor. The card is not rendered without it (the Practice row stands in). */
  anchorArt: ChartAnchorArt;
  /** The Anchor's stored Thread Strength, 0–100, as the existing thread adapter reports it. Null when unmeasured. */
  threadStrength?: number | null;
  /** Practiced today: the same flag the Practice row used. Changes the action to Deep Focus. */
  practiced: boolean;
  /** Opens the existing Anchor Details screen. */
  onOpenAnchor?: () => void;
  /** Launches the existing Practice flow. Premium restrictions and the completion experience live there. */
  onOpenPractice?: (mode: 'focus' | 'deep_prime') => void;
};

/**
 * The person's real Anchor, how strong its thread is, and the one way to practice it from the Chart. It replaces the
 * generic Practice row on the half tier; Thread Strength is only displayed (the value comes from the existing adapter),
 * and it stays a separate measure from Chart progress.
 */
export const ChartSheetAnchorCard = memo(function ChartSheetAnchorCard({ category, anchorArt, threadStrength = null, practiced, onOpenAnchor, onOpenPractice }: Props) {
  const accent = panelAccent(category);
  const strength = typeof threadStrength === 'number' && Number.isFinite(threadStrength) ? Math.min(100, Math.max(0, Math.round(threadStrength))) : null;
  const mark = (
    <CircularAnchorRenderer svg={anchorArt.svg} imageUrl={anchorArt.imageUrl} category={anchorArt.category ?? category} expression={anchorArt.expression ?? undefined} size={48} appearance="dark" accessibilityLabel="Your Anchor" />
  );
  const label = practiced ? COPY.deepFocus : COPY.focus;
  return (
    <View style={styles.card} testID="chart-anchor-card">
      {onOpenAnchor ? (
        <Pressable accessibilityRole="button" accessibilityLabel={CHART_COPY.sheet.openAnchor} onPress={onOpenAnchor} hitSlop={6} style={styles.mark} testID="chart-open-anchor">
          {mark}
        </Pressable>
      ) : (
        <View style={styles.mark}>{mark}</View>
      )}
      <View style={styles.copy}>
        {/* DEFERRED: the YOUR ANCHOR eyebrow; the compact row reads without it. */}
        <Text style={styles.line} numberOfLines={2}>{practiced ? CHART_COPY.sheet.practicedToday : CHART_COPY.sheet.keepStrong}</Text>
        {strength !== null ? (
          <View style={styles.strengthBlock} accessible accessibilityLabel={`Thread Strength ${strength} percent`} testID="chart-anchor-strength">
            <View style={styles.strengthRow}>
              <Text style={styles.strength} numberOfLines={1}>{CHART_COPY.sheet.threadStrength}</Text>
              <Text style={styles.strength}>{strength}%</Text>
            </View>
            <View style={styles.track}><View style={[styles.fill, { width: `${strength}%`, backgroundColor: accent.text }]} /></View>
          </View>
        ) : null}
      </View>
      {/* DEFERRED: the check beside the pill; "Practiced today" already says it and the row had no room. */}
      {onOpenPractice ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => onOpenPractice(practiced ? 'deep_prime' : 'focus')}
          style={({ pressed }) => [styles.focus, { backgroundColor: accent.fill }, pressed && styles.pressed]}
          testID="chart-practice-row"
        >
          <Play size={13} color={accent.onFill} fill={accent.onFill} />
          <Text style={[styles.focusText, { color: accent.onFill }]} numberOfLines={1}>{label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: T.line, backgroundColor: T.panel },
  mark: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  line: { fontFamily: T.sansStrong, fontSize: 15, lineHeight: 20, color: T.light },
  strengthBlock: { gap: 4 },
  strengthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  strength: { fontFamily: T.sans, fontSize: 12, lineHeight: 16, color: T.muted },
  track: { alignSelf: 'stretch', height: 6, borderRadius: 3, backgroundColor: '#2C3449', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  focus: { minHeight: 44, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 14, flexShrink: 0 },
  pressed: { opacity: 0.85 },
  focusText: { fontFamily: T.sansStrong, fontSize: 15, lineHeight: 20 },
});
