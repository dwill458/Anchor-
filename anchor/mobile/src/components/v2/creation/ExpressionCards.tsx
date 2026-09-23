import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

import type { AnchorExpression } from '@/constants/v2/creation';
import type { AnchorCategory } from '@/types';
import { useV2Responsive } from '@/hooks/v2';
import { colors, spacing, typography } from '@/theme/v2';
import { recommendedCreationExpressions, type CreationExpressionOption } from './expressionOptions';

function Artwork({ option }: { option: CreationExpressionOption }) {
  const ink = colors.ink.base;
  const warm = '#B08A48';
  const moss = '#6C806F';
  return (
    <View style={styles.artwork} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 160 112" fill="none">
        {option.icon === 'architectural' ? (
          <G opacity={0.82} stroke={ink} strokeWidth={1}>
            {[22, 48, 74, 100, 126, 148].map((x) => <Line key={`v-${x}`} x1={x} y1={12} x2={x - 10} y2={100} opacity={0.22} />)}
            {[24, 48, 72, 96].map((y) => <Line key={`h-${y}`} x1={12} y1={y} x2={148} y2={y - 5} opacity={0.2} />)}
            <Path d="M25 84L64 46L87 70L132 24" stroke={ink} strokeWidth={3} strokeLinecap="square" />
            <Circle cx="64" cy="46" r="4" fill={colors.canvas} stroke={ink} />
            <Circle cx="132" cy="24" r="4" fill={colors.canvas} stroke={ink} />
          </G>
        ) : null}
        {option.icon === 'etched' ? (
          <G stroke={ink} opacity={0.8}>
            <Circle cx="80" cy="56" r="34" strokeWidth={1.2} />
            <Circle cx="80" cy="56" r="24" strokeWidth={0.8} opacity={0.55} />
            <Path d="M18 68C36 36 57 22 93 22C116 22 136 35 148 54" strokeWidth={1} opacity={0.45} />
            <Path d="M21 83C48 58 76 50 108 58C123 62 135 70 143 82" strokeWidth={2.3} />
            <Circle cx="119" cy="30" r="6" fill={warm} stroke="none" opacity={0.55} />
          </G>
        ) : null}
        {option.icon === 'ink' ? (
          <G>
            <Path d="M24 86C42 30 60 28 72 59C84 91 97 88 112 41C118 23 130 24 138 40" stroke={ink} strokeWidth={9} strokeLinecap="round" opacity={0.16} />
            <Path d="M24 86C42 30 60 28 72 59C84 91 97 88 112 41C118 23 130 24 138 40" stroke={ink} strokeWidth={3.4} strokeLinecap="round" />
            <Path d="M30 92C58 72 83 81 124 34" stroke={ink} strokeWidth={1} opacity={0.45} />
            <Circle cx="34" cy="24" r="3" fill={ink} opacity={0.36} /><Circle cx="126" cy="78" r="2" fill={ink} opacity={0.3} />
          </G>
        ) : null}
        {option.icon === 'foil' ? (
          <G>
            <Circle cx="80" cy="56" r="39" fill={warm} opacity={0.12} />
            <Path d="M25 82L60 45L81 67L133 27" stroke={warm} strokeWidth={6} opacity={0.15} strokeLinecap="round" />
            <Path d="M25 82L60 45L81 67L133 27" stroke={warm} strokeWidth={2.5} strokeLinecap="round" />
            {[22, 38, 119, 141].map((x, index) => <Circle key={x} cx={x} cy={index % 2 ? 22 : 88} r={index % 2 ? 2 : 1.5} fill={warm} opacity={0.7} />)}
          </G>
        ) : null}
        {option.icon === 'monoline' ? (
          <G stroke={ink} strokeLinecap="round">
            <Path d="M36 82L67 47L82 62L123 30" strokeWidth={1.5} />
            <Line x1="67" y1="47" x2="67" y2="83" strokeWidth={1.1} opacity={0.55} />
            <Line x1="82" y1="62" x2="112" y2="92" strokeWidth={1.1} opacity={0.35} />
            <Circle cx="123" cy="30" r="2.5" fill={colors.canvas} strokeWidth={1} />
          </G>
        ) : null}
        {option.icon === 'embossed' ? (
          <G>
            <Rect x="30" y="18" width="100" height="76" rx="7" fill={moss} opacity={0.13} />
            <Path d="M32 78L62 44L84 66L128 30" stroke="#FFFFFF" strokeWidth={6} opacity={0.65} strokeLinecap="square" />
            <Path d="M32 81L62 47L84 69L128 33" stroke={ink} strokeWidth={5} opacity={0.22} strokeLinecap="square" />
            <Path d="M32 78L62 44L84 66L128 30" stroke={colors.canvas} strokeWidth={3} strokeLinecap="square" />
          </G>
        ) : null}
      </Svg>
    </View>
  );
}

export function ExpressionCards({
  selected,
  category,
  intention,
  disabled,
  onSelect,
}: {
  selected: AnchorExpression;
  category?: AnchorCategory;
  intention: string;
  disabled?: boolean;
  onSelect: (expression: AnchorExpression) => void;
}) {
  const { width } = useWindowDimensions();
  const { gutter } = useV2Responsive();
  const cardWidth = Math.floor((width - gutter * 2 - spacing[2]) / 2);
  const options = React.useMemo(
    // Ordering is recommendation-driven when the established library has a signal, but there
    // is no badge: a quiet reorder is more honest than calling a style “Recommended” here.
    () => recommendedCreationExpressions(category, intention),
    [category, intention],
  );

  return (
    <View style={styles.root}>
      <View style={styles.grid}>
        {options.map((option) => (
          <ExpressionCard key={option.expression} option={option} cardWidth={cardWidth} selected={selected === option.expression} disabled={disabled} onPress={() => onSelect(option.expression)} />
        ))}
      </View>
      <Text style={styles.note}>Each expression adapts uniquely to your Anchor.</Text>
      <Pressable
        onPress={() => onSelect('original')}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ selected: selected === 'original' }}
        testID="expression-keep-original"
        style={({ pressed }) => [styles.original, selected === 'original' && styles.originalSelected, pressed && styles.pressed]}
      >
        <Text style={styles.originalTitle}>Keep original structure</Text>
        <Text style={styles.originalBody}>Use the structure formed from your words, unchanged.</Text>
      </Pressable>
    </View>
  );
}

const ExpressionCard = memo(function ExpressionCard({ option, cardWidth, selected, disabled, onPress }: { option: CreationExpressionOption; cardWidth: number; selected: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={`${option.name}. ${option.descriptor}`}
      accessibilityState={{ selected }}
      testID={`expression-card-${option.expression}`}
      style={({ pressed }) => [styles.card, { width: cardWidth }, selected && styles.cardSelected, pressed && styles.pressed]}
    >
      <Artwork option={option} />
      <View style={styles.cardCopy}>
        <Text style={styles.cardTitle}>{option.name}</Text>
        <Text style={styles.cardDescriptor}>{option.descriptor}</Text>
        <Text style={styles.cardMeta}>{option.material} · {option.composition}</Text>
      </View>
      {selected ? <View style={styles.check}><Text style={styles.checkText}>✓</Text></View> : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  root: { gap: spacing[3] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  card: { minHeight: 184, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: 16, backgroundColor: colors.surface, overflow: 'hidden' },
  cardSelected: { borderColor: colors.text.primary, backgroundColor: '#F6F0E4' },
  artwork: { height: 104, backgroundColor: '#EEE6D7', padding: spacing[2] },
  cardCopy: { gap: 3, padding: spacing[3], paddingTop: spacing[2] },
  cardTitle: { ...typography.headingSM, color: colors.text.primary, fontSize: 15 },
  cardDescriptor: { ...typography.bodySM, color: colors.text.secondary, lineHeight: 17 },
  cardMeta: { ...typography.caption, color: colors.text.tertiary, marginTop: 3, textTransform: 'capitalize' },
  check: { position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.text.primary, alignItems: 'center', justifyContent: 'center' },
  checkText: { color: colors.canvas, fontSize: 13, fontWeight: '700' },
  note: { ...typography.caption, color: colors.text.secondary, textAlign: 'center' },
  original: { padding: spacing[3], borderTopWidth: 1, borderTopColor: colors.border.subtle, gap: 2 },
  originalSelected: { backgroundColor: colors.grouped },
  originalTitle: { ...typography.labelMD, color: colors.text.primary },
  originalBody: { ...typography.bodySM, color: colors.text.secondary },
  pressed: { opacity: 0.72 },
});
