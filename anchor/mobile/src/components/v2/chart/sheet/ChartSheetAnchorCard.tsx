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
    <CircularAnchorRenderer svg={anchorArt.svg} imageUrl={anchorArt.imageUrl} category={anchorArt.category ?? category} expression={anchorArt.expression ?? undefined} size={56} appearance="dark" accessibilityLabel="Your Anchor" />
  );
  return (
    <View style={styles.card} testID="chart-anchor-card">
      <View style={styles.top}>
        {onOpenAnchor ? (
          <Pressable accessibilityRole="button" accessibilityLabel={CHART_COPY.sheet.openAnchor} onPress={onOpenAnchor} hitSlop={6} style={styles.mark} testID="chart-open-anchor">
            {mark}
          </Pressable>
        ) : (
          <View style={styles.mark}>{mark}</View>
        )}
        <View style={styles.copy}>
          <Text style={[styles.eyebrow, { color: accent.text }]}>{CHART_COPY.sheet.yourAnchor}</Text>
          <Text style={styles.line}>{practiced ? CHART_COPY.sheet.practicedToday : CHART_COPY.sheet.keepStrong}</Text>
          {strength !== null ? (
            <Text style={styles.strength} accessibilityLabel={`Thread Strength ${strength} percent`} testID="chart-anchor-strength">
              {CHART_COPY.sheet.threadStrength} · {strength}%
            </Text>
          ) : null}
        </View>
        {practiced ? <Check size={18} color={accent.text} strokeWidth={2.5} /> : null}
      </View>
      {onOpenPractice ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={practiced ? COPY.deepFocus : COPY.focus}
          onPress={() => onOpenPractice(practiced ? 'deep_prime' : 'focus')}
          style={({ pressed }) => [styles.focus, { backgroundColor: accent.fill }, pressed && styles.pressed]}
          testID="chart-practice-row"
        >
          <Play size={16} color={accent.onFill} fill={accent.onFill} />
          <Text style={[styles.focusText, { color: accent.onFill }]}>{practiced ? COPY.deepFocus : COPY.focus}</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: { gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: T.line, backgroundColor: T.panel },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mark: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 2 },
  eyebrow: { fontFamily: T.sansStrong, fontSize: 10, lineHeight: 14, letterSpacing: 1.1 },
  line: { fontFamily: T.sansStrong, fontSize: 15, lineHeight: 20, color: T.light },
  strength: { fontFamily: T.sans, fontSize: 12, lineHeight: 16, color: T.muted },
  focus: { minHeight: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  pressed: { opacity: 0.85 },
  focusText: { fontFamily: T.sansStrong, fontSize: 15, lineHeight: 20 },
});
