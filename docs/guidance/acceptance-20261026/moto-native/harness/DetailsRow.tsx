import React from 'react';import {View,Text,Pressable,StyleSheet} from 'react-native';
import {HandDrawnThreadLine} from '@/components/v2/thread/HandDrawnThreadLine';
import {getThreadStrengthLevel} from '@/constants/v2/threadEvents';
import {getCategoryColor} from '@/theme/v2/categories';
import {detailsFonts,detailsPalette,withAlpha} from '@/components/v2/anchors/anchorDetailsTokens';
export function ThreadRow({
  value,
  delta,
  category,
  size,
  active,
  onPress,
  onExplain,
}: {
  value: number | null;
  delta: number | null;
  category: string;
  size: 'centered' | 'header';
  active: boolean;
  onPress: () => void;
  onExplain: () => void;
}) {
  const centered = size === 'centered';
  const accent = getCategoryColor(category);
  const isEstablished = value !== null && typeof value === 'number' && Number.isFinite(value);
  const numeric = isEstablished ? Math.min(100, Math.max(0, Math.round(value))) : 0;
  const level = isEstablished ? getThreadStrengthLevel(numeric).toUpperCase() : 'NOT ESTABLISHED';
  const deltaPhrase = typeof delta === 'number' && delta !== 0 ? `, ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta)} percent this week` : '';
  const label = `Thread Strength ${!isEstablished ? 'not established' : `${numeric} percent, ${level.toLowerCase()}`}${deltaPhrase}. Open progress.`;

  return (
    <View style={styles.threadRow}>
    <Pressable
      testID="v2-anchor-thread-explain"
      accessibilityRole="button"
      accessibilityLabel={`Thread Strength ${!isEstablished ? 'not established' : `${numeric} percent`}. Explain Thread Strength.`}
      onPress={onExplain}
      disabled={!active}
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 4 }}
      style={styles.threadGroup}
    >
      <Text style={[styles.metaNumeral, { fontSize: centered ? 15 : 14, color: isEstablished ? detailsPalette.ink : withAlpha(detailsPalette.ink, 0.5) }]}>
        {!isEstablished ? '—' : `${numeric}%`}
      </Text>
      <Text style={[styles.metaStatus, styles.threadStrengthLabel]}>Thread Strength</Text>
    </Pressable>
    <Pressable
      testID="v2-anchor-thread"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={!active}
      hitSlop={{ top: 12, bottom: 12, left: 4, right: 8 }}
      style={styles.threadGroup}
    >
      <HandDrawnThreadLine
        percent={numeric}
        color={accent}
        trackColor={withAlpha(detailsPalette.ink, 0.25)}
        unmeasured={!isEstablished}
        compact
        showLabel={false}
        width={centered ? 72 : 56}
        testID={`v2-thread-line-${size}`}
      />
      <Text
        style={[
          styles.metaStatus,
          {
            color: isEstablished ? accent : withAlpha(detailsPalette.ink, 0.55),
            fontSize: 10,
            letterSpacing: 1.6,
          },
        ]}
      >
        {level}
      </Text>
    </Pressable>
    </View>
  );
}

const styles=StyleSheet.create({  threadRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 5,
    minHeight: 20,
  },
  threadGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaNumeral: {
    fontFamily: detailsFonts.serif,
  },
  metaStatus: {
    fontFamily: detailsFonts.uiStrong,
  },
  threadStrengthLabel: { color: withAlpha(detailsPalette.ink, 0.5), fontSize: 10, letterSpacing: 1.6 },
});
