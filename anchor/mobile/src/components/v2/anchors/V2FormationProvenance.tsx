import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { V2Divider } from '@/components/v2';
import { colors, spacing, typography } from '@/theme/v2';
import { shortDate } from './anchorPresentation';
import type { V2FormationProvenance as Provenance } from '@/hooks/v2/anchors';

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

/**
 * "How this Anchor was formed" — clean editorial provenance. No occult
 * implementation terminology; the reduction and structure copy is grounded.
 */
export function V2FormationProvenance({ provenance }: { provenance: Provenance }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="How this Anchor was formed"
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
      >
        <Text style={styles.toggleLabel}>How this Anchor was formed</Text>
        {open ? (
          <ChevronUp size={18} color={colors.text.secondary} />
        ) : (
          <ChevronDown size={18} color={colors.text.secondary} />
        )}
      </Pressable>
      {open ? (
        <View style={styles.body}>
          <Field label="ORIGINAL INTENTION" value={provenance.originalIntention} />
          <Field label="DISTILLED FORM" value={provenance.distilledForm} />
          <Field label="LETTER REDUCTION" value={provenance.reductionExplainer} />
          <V2Divider style={styles.divider} />
          <Field label="CONSTRUCTION SYSTEM" value={provenance.structureName} />
          <Field label="" value={provenance.structureQualities} />
          <Field label="" value={provenance.structureDescription} />
          <Field label="WHY THIS SYSTEM" value={provenance.structureRationale} />
          <V2Divider style={styles.divider} />
          <Field label="CATEGORY" value={provenance.category} />
          <Field label="CREATED" value={shortDate(provenance.createdAt)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  pressed: { opacity: 0.7 },
  toggleLabel: { ...typography.headingSM, color: colors.text.primary },
  body: { gap: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[4] },
  divider: { marginVertical: spacing[1] },
  field: { gap: 3 },
  fieldLabel: { ...typography.labelSM, color: colors.text.secondary },
  fieldValue: { ...typography.bodyMD, color: colors.text.primary },
});
