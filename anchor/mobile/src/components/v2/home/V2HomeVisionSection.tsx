import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { V2Button, V2SectionHeader } from '@/components/v2';
import { colors, radii, spacing, typography } from '@/theme/v2';
import type { HomeVisionState } from '@/adapters/v2/home';

type Props = {
  vision: HomeVisionState;
  onOpenVision?: () => void;
  onCreateVision?: () => void;
};

/**
 * Supports both "Vision exists" and "Vision missing" honestly. No generated
 * imagery is fabricated; the current Vision domain persists text only.
 */
export function V2HomeVisionSection({ vision, onOpenVision, onCreateVision }: Props) {
  if (vision.state === 'none') {
    return (
      <View style={styles.section}>
        <V2SectionHeader title="Vision" supportingCopy="What does this future look like in full?" />
        <V2Button variant="secondary" accessibilityLabel="Add a Vision" onPress={onCreateVision}>
          Add a Vision
        </V2Button>
      </View>
    );
  }
  return (
    <View style={styles.section}>
      <V2SectionHeader title="Vision" actionLabel="View Vision" onActionPress={onOpenVision} />
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={`Vision: ${vision.previewText}`}
        style={styles.preview}
      >
        <Text numberOfLines={4} style={styles.previewText}>
          {vision.previewText}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing[3] },
  preview: {
    padding: spacing[4],
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  previewText: { ...typography.bodyMD, color: colors.text.primary },
});
