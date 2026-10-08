// DEFERRED: replaced by VisionCeremony develop → keep → seal for single photos.
import { useRef, useState } from 'react';
import { Image, Pressable, StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVisionImageArrival } from './VisionImageArrival';
import { V2Button } from '@/components/v2';
import { colors, radii, spacing, typography } from '@/theme/v2';
import type { VisionPhotoSource } from '@/hooks/v2/vision/visionPhotoInput';
import { VisionHeaderRow, VisionIdentity, type VisionAnchorArt } from './VisionChrome';
import { VisionPhotograph } from './VisionPhotograph';
import { VISION_HERO_ASPECT } from './board/visionBoardLayouts';

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
  const arrival = useVisionImageArrival();
  const frameRef = useRef<View>(null);
  const sourceRect = useRef<{ x: number; y: number; width: number; height: number } | undefined>(undefined);
  const measure = () => frameRef.current?.measureInWindow?.((x, y, width, height) => { sourceRect.current = { x, y, width, height }; });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const frameWidth = width - spacing[5] * 2;
  const frameHeight = Math.round(frameWidth / VISION_HERO_ASPECT);

  const confirm = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    if (sourceRect.current) arrival?.begin(uri, sourceRect.current);
    let message: string | null;
    try { message = await onConfirm(); } catch { message = "Your photo could not be saved. Please try again."; }
    if (message) arrival?.cancel();
    // On success the screen moves on and this view unmounts.
    setSaving(false);
    if (message) setError(message);
  };

  return (
    <View testID={testID} style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.ink.base} animated />
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <VisionHeaderRow title="Add Image" onBack={saving ? undefined : onCancel} />
        <VisionIdentity intention={anchorIntention} category={anchorCategory} art={anchorArt} imageUrl={anchorImageUrl} />
        <View ref={frameRef} collapsable={false} onLayout={measure} style={[styles.frame, { width: frameWidth, height: frameHeight }]}>
          <VisionPhotograph testID={`${testID}-image`} source={{ uri }} displayAspect={VISION_HERO_ASPECT} uploaded accessibilityIgnoresInvertColors
            accessibilityLabel="The photo you chose" style={styles.image} />
        </View>
        <Text style={styles.hint}>Bring this photo into your Vision.</Text>
      </View>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[3] }]}>
        {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
        <V2Button size="large" variant="secondary" accessibilityLabel="Use This Image" loading={saving} disabled={saving} onPress={() => { void confirm(); }}>
          Use This Image
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
  footer: { paddingHorizontal: spacing[5], paddingTop: spacing[4], gap: spacing[3], backgroundColor: colors.ink.base, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg },
  secondaryRow: { flexDirection: 'row', gap: spacing[2] },
  secondary: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md, borderWidth: 1, borderColor: colors.border.default, backgroundColor: colors.ink.raised },
  secondaryText: { ...typography.labelMD, color: colors.ink.text.primary },
  disabled: { opacity: 0.45 },
  error: { ...typography.caption, color: colors.semantic.error },
});
