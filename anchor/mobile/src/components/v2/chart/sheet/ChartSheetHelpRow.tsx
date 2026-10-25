import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { CHART_MAP_TOKENS as T } from '../map/chartMapTokens';
import { panelAccent } from '../panel/chartPanelColors';

type Props = {
  category: string | null | undefined;
  /** Opens Ask Chart. */
  onAskChart?: () => void;
};

/**
 * The two ways onward from the next move: ask for help, or look at the whole route. The Anchor (and its Focus action)
 * sits directly above in `ChartSheetAnchorCard`; nothing here repeats it.
 */
export const ChartSheetHelpRow = memo(function ChartSheetHelpRow({ category, onAskChart }: Props) {
  if (!onAskChart) return null;
  const accent = panelAccent(category);
  return (
    <View style={styles.row} testID="chart-sheet-help-row">
      <Pressable accessibilityRole="button" accessibilityLabel={CHART_COPY.sheet.helpMeMoveForward} onPress={onAskChart} style={({ pressed }) => [styles.button, pressed && styles.pressed]} testID="chart-help-forward">
        <MessageCircle size={18} color={accent.text} />
        <Text style={styles.text} numberOfLines={2}>{CHART_COPY.sheet.helpMeMoveForward}</Text>
      </Pressable>
      {/* DEFERRED: "View your route" button, replaced by the sheet detents and the route list (see ChartRouteList).
      {onViewRoute ? (
        <Pressable accessibilityRole="button" accessibilityLabel={CHART_COPY.sheet.viewRoute} onPress={onViewRoute} style={({ pressed }) => [styles.button, styles.quiet, pressed && styles.pressed]} testID="chart-view-route">
          <RouteIcon size={18} color={T.muted} />
          <Text style={styles.text} numberOfLines={2}>{CHART_COPY.sheet.viewRoute}</Text>
        </Pressable>
      ) : null} */}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  button: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 4, paddingVertical: 10 },
  pressed: { opacity: 0.6 },
  text: { flexShrink: 1, fontFamily: T.sansStrong, fontSize: 14.5, lineHeight: 19, color: T.light },
});
