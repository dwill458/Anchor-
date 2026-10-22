import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, MessageCircle } from 'lucide-react-native';
import { CircularAnchorRenderer } from '@/components/v2/anchor/CircularAnchorRenderer';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { CHART_MAP_TOKENS as T } from '../map/chartMapTokens';
import { panelAccent } from '../panel/chartPanelColors';
import type { ChartAnchorArt } from '../ChartLandscape';

type Props = {
  category: string | null | undefined;
  anchorArt: ChartAnchorArt | null;
  /** Opens the existing Anchor Details screen: there is no intermediate Anchor screen. */
  onOpenAnchor?: () => void;
  /** Opens Ask Chart. */
  onAskChart?: () => void;
};

/**
 * The person's own Anchor (tap for its details) beside "Help me move forward". Lives in the sheet's half tier, below
 * the next move; the board above is not touched.
 */
export const ChartSheetHelpRow = memo(function ChartSheetHelpRow({ category, anchorArt, onOpenAnchor, onAskChart }: Props) {
  if (!onAskChart && !onOpenAnchor) return null;
  const accent = panelAccent(category);
  return (
    <View style={styles.row} testID="chart-sheet-help-row">
      {onOpenAnchor && anchorArt?.svg ? (
        <Pressable accessibilityRole="button" accessibilityLabel={CHART_COPY.sheet.openAnchor} onPress={onOpenAnchor} hitSlop={6} style={styles.anchor} testID="chart-open-anchor">
          <CircularAnchorRenderer svg={anchorArt.svg} imageUrl={anchorArt.imageUrl} category={anchorArt.category ?? category} expression={anchorArt.expression ?? undefined} size={44} appearance="dark" accessibilityLabel="Your Anchor" />
        </Pressable>
      ) : null}
      {onAskChart ? (
        <Pressable accessibilityRole="button" accessibilityLabel={CHART_COPY.sheet.helpMeMoveForward} onPress={onAskChart} style={({ pressed }) => [styles.help, { borderColor: accent.fill }, pressed && styles.pressed]} testID="chart-help-forward">
          <MessageCircle size={18} color={accent.text} />
          <Text style={styles.helpText}>{CHART_COPY.sheet.helpMeMoveForward}</Text>
          <ChevronRight size={18} color={T.muted} />
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  anchor: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  help: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, backgroundColor: 'rgba(239,234,223,.04)' },
  pressed: { backgroundColor: 'rgba(239,234,223,.1)' },
  helpText: { flex: 1, fontFamily: T.sansStrong, fontSize: 15, lineHeight: 20, color: T.light },
});
