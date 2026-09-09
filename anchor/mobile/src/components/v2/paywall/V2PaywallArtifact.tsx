import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { CircularAnchorRenderer } from '@/components/v2/anchor';
import { colors, radii, spacing, typography } from '@/theme/v2';
import type { V2PaywallArtifact as ArtifactModel } from '@/hooks/v2/paywall';
import type { PaywallToneColors } from './paywallTone';

type Props = { artifact: ArtifactModel; tone: PaywallToneColors; testID?: string };

/**
 * The user's own Anchor or Vision, shown compact near the top of the sheet.
 * Never a fabricated preview: `none` renders nothing and a missing Vision falls
 * back to an honest placeholder, never to Anchor artwork.
 */
export function V2PaywallArtifact({ artifact, tone, testID }: Props) {
  if (artifact.kind === 'none') return null;

  if (artifact.kind === 'anchor') {
    return (
      <View style={[styles.row, { backgroundColor: tone.wash, borderColor: colors.border.subtle }]} testID={testID ?? 'v2-paywall-artifact-anchor'}>
        <CircularAnchorRenderer svg={artifact.svg} category={artifact.category} size="thumbnail" />
        <View style={styles.rowCopy}>
          <Text style={[styles.eyebrow, { color: tone.deep }]}>ACTIVE ANCHOR</Text>
          <Text numberOfLines={1} style={styles.intention}>{`“${artifact.intention}”`}</Text>
          <Text style={styles.caption}>{artifact.categoryLabel}</Text>
        </View>
      </View>
    );
  }

  if (artifact.kind === 'vision') {
    return (
      <View style={styles.visionBlock} testID={testID ?? 'v2-paywall-artifact-vision'}>
        <Text style={[styles.eyebrow, { color: tone.deep }]}>YOUR VISION</Text>
        {artifact.previewUri ? (
          <Image
            accessibilityRole="image"
            accessibilityLabel="Your Vision"
            source={{ uri: artifact.previewUri }}
            style={styles.visionImage}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.visionText}>{`“${artifact.previewText ?? ''}”`}</Text>
        )}
        <Text style={styles.caption}>Continue building from what you already created.</Text>
      </View>
    );
  }

  // vision-placeholder
  return (
    <View style={styles.visionBlock} testID={testID ?? 'v2-paywall-artifact-vision-placeholder'}>
      <Text style={[styles.eyebrow, { color: tone.deep }]}>YOUR VISION</Text>
      <View style={[styles.placeholder, { borderColor: colors.border.default }]}>
        <Text style={styles.placeholderText}>Your Vision will appear here</Text>
      </View>
      <Text style={styles.caption}>Start your trial to turn this direction into a scene you can return to.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  rowCopy: { flex: 1, minWidth: 0 },
  eyebrow: { ...typography.labelSM, textTransform: 'uppercase', letterSpacing: 0.6 },
  intention: { ...typography.labelLG, color: colors.text.primary, marginTop: 3 },
  caption: { ...typography.bodySM, color: colors.text.secondary, marginTop: 2 },
  visionBlock: { gap: spacing[2] },
  visionImage: { width: '100%', height: 110, borderRadius: radii.md, backgroundColor: colors.grouped },
  visionText: { ...typography.bodyMD, color: colors.text.primary },
  placeholder: {
    width: '100%',
    height: 88,
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.grouped,
  },
  placeholderText: { ...typography.bodySM, color: colors.text.secondary },
});
