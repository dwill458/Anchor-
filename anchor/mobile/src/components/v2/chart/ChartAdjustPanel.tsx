import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, Info } from 'lucide-react-native';
import { V2Button } from '@/components/v2/primitives/V2Button';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import type { ChartAdjustmentReason } from '@/services/v2/chartV2Api';
import { colors, radii, spacing, typography } from '@/theme/v2';
import { ChartTextArea } from './ChartChrome';

export type ChartAdjustRequest = { reason: ChartAdjustmentReason; detail: string | null };

/**
 * "Where does the route need to change?" — structured options and optional detail.
 * The conversation happens under the hood; the person never sees a chat.
 */
export function ChartAdjustPanel({
  onSubmit,
  loading,
  error,
  protectedNote,
  categoryColor,
  testID,
}: {
  onSubmit: (request: ChartAdjustRequest) => void;
  loading?: boolean;
  error?: string | null;
  /** Shown on an active Chart: reached waypoints are never rewritten. */
  protectedNote?: boolean;
  categoryColor?: string;
  testID?: string;
}) {
  const [reason, setReason] = useState<ChartAdjustmentReason | null>(null);
  const [detail, setDetail] = useState('');

  // Primary CTA is disabled until a chip is selected OR text is entered.
  // When 'OTHER' is selected, detail is required.
  const effectiveReason = reason ?? (detail.trim().length > 0 ? 'OTHER' : null);
  const canSubmit = Boolean(effectiveReason) && (effectiveReason !== 'OTHER' || detail.trim().length > 0);

  return (
    <View testID={testID} style={styles.panel}>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {CHART_COPY.reasons.map((option) => {
          const selected = reason === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => setReason(selected ? null : option.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
              style={({ pressed }) => [
                styles.chip,
                selected && {
                  backgroundColor: categoryColor ?? colors.text.primary,
                  borderColor: categoryColor ?? colors.text.primary,
                },
                pressed && styles.pressed,
              ]}
              testID={`chart-adjust-${option.key}`}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ChartTextArea
        tone="cream"
        value={detail}
        onChangeText={setDetail}
        placeholder="Tell Anchor what feels too difficult, too easy, or missing"
        maxLength={500}
        accessibilityLabel="Tell us more about what should change"
        testID="chart-adjust-detail"
      />

      {protectedNote ? (
        <View style={styles.infoNoteRow}>
          <Info size={16} color={colors.text.secondary} style={styles.infoIcon} />
          <Text style={styles.note}>{CHART_COPY.adjust.protected}</Text>
        </View>
      ) : null}

      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <V2Button
        size="large"
        onPress={() => effectiveReason && onSubmit({ reason: effectiveReason, detail: detail.trim() || null })}
        disabled={!canSubmit || loading}
        loading={loading}
        style={canSubmit && categoryColor ? { backgroundColor: categoryColor } : undefined}
        iconRight={<ArrowRight size={18} color={canSubmit ? colors.text.inverse : colors.text.disabled} />}
        accessibilityLabel={CHART_COPY.adjust.cta}
        testID="chart-adjust-submit"
      >
        {CHART_COPY.adjust.cta}
      </V2Button>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing[4] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing[4],
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipText: {
    ...typography.labelMD,
    color: colors.text.primary,
  },
  chipTextSelected: {
    color: colors.text.inverse,
    fontWeight: '600',
  },
  infoNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  infoIcon: {
    marginTop: 1,
  },
  note: {
    flex: 1,
    ...typography.bodySM,
    color: colors.text.secondary,
  },
  error: {
    ...typography.bodySM,
    color: colors.semantic.error,
  },
  pressed: {
    opacity: 0.8,
  },
});
