import React, { useState } from 'react';
import { Image, Pressable, StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { V2Button } from '@/components/v2';
import { colors, radii, spacing, typography } from '@/theme/v2';
import type { VisionPhotoSource } from '@/hooks/v2/vision/visionPhotoInput';
import { VisionHeaderRow, VisionIdentity, type VisionAnchorArt } from './VisionChrome';

type Props = {
  uri: string;
  source: VisionPhotoSource;
  anchorIntention: string;
  anchorCategory?: string | null;
  anchorArt?: VisionAnchorArt | null;
  anchorImageUrl?: string | null;
  /** Uploads and adds the photo. Returns an error message, or null when it was added. */
  onConfirm: () => Promise<string | null>;
  /** Picks another photo the same way, replacing this one. */
  onChooseAgain: () => void;
  onCancel: () => void;
  testID?: string;
};

/**
 * A photo the person picked or took, shown before anything leaves the device.
 * It joins the board only when they confirm.
 */
export function V2VisionAddPhoto({
  uri, source, anchorIntention, anchorCategory, anchorArt, anchorImageUrl, onConfirm, onChooseAgain, onCancel,
  testID = 'v2-vision-add-photo',
}: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const frameWidth = width - spacing[5] * 2;
  const frameHeight = Math.round(Math.max(300, Math.min(height * 0.5, frameWidth * 1.25)));

  const confirm = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    const message = await onConfirm();
    // On success the screen moves on and this view unmounts.
    setSaving(false);
    if (message) setError(message);
  };

  return (
    <View testID={testID} style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.ink.base} animated />
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <VisionHeaderRow title="Add to your Vision" onBack={saving ? undefined : onCancel} />
        <VisionIdentity intention={anchorIntention} category={anchorCategory} art={anchorArt} imageUrl={anchorImageUrl} />
        <View style={[styles.frame, { width: frameWidth, height: frameHeight }]}>
          <Image testID={`${testID}-image`} source={{ uri }} resizeMode="cover" accessibilityIgnoresInvertColors
            accessibilityLabel="The photo you chose" style={styles.image} />
        </View>
        <Text style={styles.hint}>This photo will be pinned to your board.</Text>
      </View>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[3] }]}>
        {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
        <V2Button size="large" accessibilityLabel="Add to Vision" loading={saving} disabled={saving} onPress={() => { void confirm(); }}>
          Add to Vision
        </V2Button>
        <View style={styles.secondaryRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={source === 'camera' ? 'Retake photo' : 'Choose another photo'}
            disabled={saving} onPress={onChooseAgain} style={[styles.secondary, saving && styles.disabled]}>
            <Text style={styles.secondaryText}>{source === 'camera' ? 'Retake' : 'Choose another'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel" disabled={saving} onPress={onCancel}
            style={[styles.secondary, saving && styles.disabled]}>
            <Text style={styles.secondaryText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink.base },
  page: { flex: 1, paddingHorizontal: spacing[5], gap: spacing[3] },
  frame: { alignSelf: 'center', borderRadius: radii.lg, overflow: 'hidden', backgroundColor: colors.ink.deep, borderWidth: 1, borderColor: colors.ink.hairlineStrong, marginTop: spacing[2] },
  image: { width: '100%', height: '100%' },
  hint: { ...typography.bodySM, color: colors.ink.text.secondary, textAlign: 'center' },
  footer: { paddingHorizontal: spacing[5], paddingTop: spacing[4], gap: spacing[3], backgroundColor: colors.canvas, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg },
  secondaryRow: { flexDirection: 'row', gap: spacing[2] },
  secondary: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md, borderWidth: 1, borderColor: colors.border.default, backgroundColor: colors.surface },
  secondaryText: { ...typography.labelMD, color: colors.text.primary },
  disabled: { opacity: 0.45 },
  error: { ...typography.caption, color: colors.semantic.error },
});
