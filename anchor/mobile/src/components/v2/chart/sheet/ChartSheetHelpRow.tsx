import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Map as RouteIcon, MessageCircle } from 'lucide-react-native';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { CHART_MAP_TOKENS as T } from '../map/chartMapTokens';
import { panelAccent } from '../panel/chartPanelColors';

type Props = {
  category: string | null | undefined;
  /** Opens Ask Chart. */
  onAskChart?: () => void;
  /** Raises the sheet to its full tier, where the whole route is listed. */
  onViewRoute?: () => void;
};

/**
 * The two ways onward from the next move: ask for help, or look at the whole route. The Anchor (and its Focus action)
 * sits directly above in `ChartSheetAnchorCard`; nothing here repeats it.
 */
export const ChartSheetHelpRow = memo(function ChartSheetHelpRow({ category, onAskChart, onViewRoute }: Props) {
  if (!onAskChart && !onViewRoute) return null;
  const accent = panelAccent(category);
  return (
    <View style={styles.row} testID="chart-sheet-help-row">
      {onAskChart ? (
        <Pressable accessibilityRole="button" accessibilityLabel={CHART_COPY.sheet.helpMeMoveForward} onPress={onAskChart} style={({ pressed }) => [styles.button, { borderColor: accent.fill }, pressed && styles.pressed]} testID="chart-help-forward">
          <MessageCircle size={18} color={accent.text} />
          <Text style={styles.text} numberOfLines={2}>{CHART_COPY.sheet.helpMeMoveForward}</Text>
        </Pressable>
      ) : null}
      {onViewRoute ? (
        <Pressable accessibilityRole="button" accessibilityLabel={CHART_COPY.sheet.viewRoute} onPress={onViewRoute} style={({ pressed }) => [styles.button, styles.quiet, pressed && styles.pressed]} testID="chart-view-route">
          <RouteIcon size={18} color={T.muted} />
          <Text style={styles.text} numberOfLines={2}>{CHART_COPY.sheet.viewRoute}</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  button: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1, backgroundColor: 'rgba(239,234,223,.04)' },
  quiet: { borderColor: T.line },
  pressed: { backgroundColor: 'rgba(239,234,223,.1)' },
  text: { flex: 1, fontFamily: T.sansStrong, fontSize: 14, lineHeight: 18, color: T.light },
});
