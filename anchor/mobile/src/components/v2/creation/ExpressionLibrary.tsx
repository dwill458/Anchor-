import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Check } from 'lucide-react-native';

import { AnchorMark } from '@/components/v2/anchor/AnchorMark';
import { EXPRESSION_COPY } from '@/constants/v2/creation';
import type { AIStyle, AnchorCategory } from '@/types';
import { useV2Responsive } from '@/hooks/v2';
import { colors, spacing, typography } from '@/theme/v2';
import { creationStyleLibrary, type CreationStyleOption } from './expressionOptions';

/**
 * The expression library, as a quiet grid of the user's own structure in each direction.
 *
 * Every thumbnail is the real structure (never a stock illustration), so the grid itself
 * says the thing the screen is about: the structure stays the same; its expression changes.
 * The whole production library is offered — the few suited to this intention first, then the
 * rest — with the original structure as the last, always-available choice.
 */
export function ExpressionLibrary({
  svg,
  category,
  intention,
  selectedStyle,
  keepOriginal,
  disabled,
  onSelect,
}: {
  svg: string;
  category?: AnchorCategory;
  intention: string;
  selectedStyle?: AIStyle;
  /** True when "keep the original structure" is the current choice. */
  keepOriginal: boolean;
  disabled?: boolean;
  onSelect: (option: CreationStyleOption | null) => void;
}) {
  const { width } = useWindowDimensions();
  const { gutter } = useV2Responsive();
  const columns = width >= 360 ? 3 : 2;
  const gap = spacing[2];
  const cardWidth = Math.floor((width - gutter * 2 - gap * (columns - 1)) / columns);
  const library = useMemo(() => creationStyleLibrary(category, intention), [category, intention]);
  const suggestedIds = useMemo(() => new Set(library.suggested.map((option) => option.styleChoice)), [library]);
  const rest = useMemo(() => library.all.filter((option) => !suggestedIds.has(option.styleChoice)), [library, suggestedIds]);

  const renderCard = (option: CreationStyleOption) => (
    <StyleCard
      key={option.styleChoice}
      option={option}
      svg={svg}
      category={category}
      width={cardWidth}
      selected={!keepOriginal && selectedStyle === option.styleChoice}
      disabled={disabled}
      onSelect={onSelect}
    />
  );

  return (
    <View style={styles.root} accessibilityRole="radiogroup">
      {library.suggested.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{EXPRESSION_COPY.suggested}</Text>
          <View style={[styles.grid, { gap }]}>{library.suggested.map(renderCard)}</View>
        </View>
      ) : null}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{`${EXPRESSION_COPY.all} · ${library.all.length}`}</Text>
        <View style={[styles.grid, { gap }]}>{rest.map(renderCard)}</View>
      </View>
      <Pressable
        onPress={() => onSelect(null)}
        disabled={disabled}
        accessibilityRole="radio"
        accessibilityState={{ selected: keepOriginal }}
        testID="expression-keep-original"
        style={({ pressed }) => [styles.original, keepOriginal && styles.originalSelected, pressed && styles.pressed]}
      >
        <View style={styles.originalCopy}>
          <Text style={styles.originalTitle}>{EXPRESSION_COPY.original}</Text>
          <Text style={styles.originalBody}>{EXPRESSION_COPY.originalBody}</Text>
        </View>
        {keepOriginal ? <View style={styles.check}><Check size={13} color={colors.canvas} strokeWidth={3} /></View> : null}
      </Pressable>
    </View>
  );
}

const StyleCard = memo(function StyleCard({
  option,
  svg,
  category,
  width,
  selected,
  disabled,
  onSelect,
}: {
  option: CreationStyleOption;
  svg: string;
  category?: AnchorCategory;
  width: number;
  selected: boolean;
  disabled?: boolean;
  /** Stable across renders, so a selection re-renders only the two cards it changes. */
  onSelect: (option: CreationStyleOption) => void;
}) {
  const thumb = width - spacing[2] * 2;
  return (
    <Pressable
      onPress={() => onSelect(option)}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={`${option.name}. ${option.descriptor}`}
      accessibilityState={{ selected }}
      testID={`expression-style-${option.styleChoice}`}
      style={({ pressed }) => [styles.card, { width }, selected && styles.cardSelected, pressed && styles.pressed]}
    >
      <View style={[styles.thumb, { height: Math.round(thumb * 0.82), backgroundColor: option.field }]} pointerEvents="none">
        <AnchorMark svg={svg} category={category} expression={option.expression} strokeColor={option.tint} size={Math.round(thumb * 0.82)} />
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{option.name}</Text>
      <Text style={styles.cardDescriptor} numberOfLines={2}>{option.descriptor}</Text>
      {selected ? <View style={styles.check}><Check size={13} color={colors.canvas} strokeWidth={3} /></View> : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  root: { gap: spacing[5] },
  section: { gap: spacing[3] },
  sectionLabel: { ...typography.labelSM, color: colors.text.secondary, letterSpacing: 1.2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: {
    padding: spacing[2],
    paddingBottom: spacing[3],
    gap: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(216, 210, 200, 0.7)',
    backgroundColor: '#FAF8F3',
    shadowColor: '#171717',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardSelected: { borderColor: colors.text.primary, borderWidth: 1.5, backgroundColor: '#F3ECE1' },
  thumb: { borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: spacing[1] },
  cardTitle: { ...typography.labelMD, color: colors.text.primary, letterSpacing: 0.1 },
  cardDescriptor: { ...typography.caption, color: colors.text.secondary, lineHeight: 15 },
  check: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.text.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  original: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(216, 210, 200, 0.7)',
    backgroundColor: '#FAF8F3',
  },
  originalSelected: { borderColor: colors.text.primary, borderWidth: 1.5, backgroundColor: '#F3ECE1' },
  originalCopy: { flex: 1, gap: 2, paddingRight: 28 },
  originalTitle: { ...typography.labelMD, color: colors.text.primary },
  originalBody: { ...typography.bodySM, color: colors.text.secondary },
  pressed: { opacity: 0.72 },
});
