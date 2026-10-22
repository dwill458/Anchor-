import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RELEASE_EVOLVE_COPY } from '@/constants/v2/release';
import { normalizeReleaseReason } from '@/adapters/v2/release';
import { colors, radii } from '@/theme/v2';
import { releaseTypography } from './releaseTypography';

export type V2ReleaseChoiceId = 'release' | 'evolve';

/**
 * The choice is only asked when the context has not already decided why the Anchor is being
 * released. A manual release (no reason, or a free string such as 'practice_prepare'), the plain
 * "no longer aligned" reason and Evolve itself ask it; the three completion reasons never do.
 */
export function releaseChoiceApplies(rawReason: string | null | undefined): boolean {
  const reason = normalizeReleaseReason(rawReason);
  return reason === undefined || reason === 'no_longer_aligned' || reason === 'evolve';
}

interface Props {
  value: V2ReleaseChoiceId;
  onChange: (choice: V2ReleaseChoiceId) => void;
  /** The sealed successor, when one is attached: shown as the "Evolving into" line. */
  successorIntention?: string | null;
  disabled?: boolean;
  testID?: string;
}

const OPTIONS: Array<{ id: V2ReleaseChoiceId; label: string; descriptor: string }> = [
  { id: 'release', label: RELEASE_EVOLVE_COPY.releaseLabel, descriptor: RELEASE_EVOLVE_COPY.releaseDescriptor },
  { id: 'evolve', label: RELEASE_EVOLVE_COPY.evolveLabel, descriptor: RELEASE_EVOLVE_COPY.evolveDescriptor },
];

/** "Release it" / "Evolve it": two cards asked before the hold. Choosing Evolve opens creation. */
export function V2ReleaseChoice({ value, onChange, successorIntention, disabled = false, testID }: Props) {
  return (
    <View style={styles.wrap} testID={testID ?? 'v2-release-choice'}>
      <View style={styles.cards} accessibilityRole="radiogroup">
        {OPTIONS.map((option) => {
          const selected = option.id === value;
          return (
            <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{ selected, disabled }}
              accessibilityLabel={`${option.label}. ${option.descriptor}`} disabled={disabled}
              onPress={() => onChange(option.id)} style={[styles.card, selected && styles.cardSelected]}
              testID={`v2-release-choice-${option.id}`}>
              <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
              <Text style={styles.descriptor}>{option.descriptor}</Text>
            </Pressable>
          );
        })}
      </View>
      {value === 'evolve' && successorIntention ? (
        <Text style={styles.evolvingInto} accessibilityLiveRegion="polite" testID="v2-release-evolving-into">
          {`${RELEASE_EVOLVE_COPY.evolvingInto} “${successorIntention}”`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  cards: { flexDirection: 'row', gap: 10 },
  card: {
    flex: 1, minHeight: 44, gap: 4, padding: 14, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.frameEdge, backgroundColor: 'transparent',
  },
  cardSelected: { borderColor: colors.ink.base, backgroundColor: colors.frame },
  label: { ...releaseTypography.label, color: colors.text.secondary },
  labelSelected: { color: colors.ink.base },
  descriptor: { ...releaseTypography.small, color: colors.text.secondary },
  evolvingInto: { ...releaseTypography.small, color: colors.ink.base },
});
