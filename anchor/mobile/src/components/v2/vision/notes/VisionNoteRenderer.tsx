import React, { memo } from 'react';
import { Image, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { VisionNotePresentation, VisionNoteStyleId } from '@/adapters/v2/vision';
import { radii, spacing } from '@/theme/v2';
import { noteAssets } from '@/assets/vision/notes/noteAssets';
import { getVisionNotePreset, resolveVisionNoteTextStyle, type VisionNoteAssetKey } from './visionNoteStyles';

export type VisionNoteRendererProps = {
  styleId: VisionNoteStyleId;
  text: string;
  width: number;
  height: number;
  presentation?: Omit<VisionNotePresentation, 'styleId'> | VisionNotePresentation;
  colorOverride?: string;
  surfaceColorOverride?: string;
  surfaceAssetOverride?: VisionNoteAssetKey | null;
  rotationOverride?: number;
  scaleOverride?: number;
  shadowOverride?: 'soft' | 'none';
  typographyOverride?: Partial<{ fontFamily: string; fontSize: number; lineHeight: number }>;
  testID?: string;
  scrollText?: boolean;
};

/** Native note surface and live text, suitable for preview or board composition. */
export const VisionNoteRenderer = memo(function VisionNoteRenderer({
  styleId, text, width, height, presentation, colorOverride, surfaceColorOverride, surfaceAssetOverride,
  rotationOverride, scaleOverride, shadowOverride, typographyOverride, testID = 'vision-note-renderer', scrollText = true,
}: VisionNoteRendererProps) {
  const preset = getVisionNotePreset(styleId);
  const noteWidth = presentation ? presentation.width * width : width;
  const noteHeight = presentation ? presentation.height * height : height;
  const resolvedPreset = { ...preset, ...typographyOverride };
  const textHeight = noteHeight * (1 - (preset.textInsetBottom ?? 0));
  const textStyle = resolveVisionNoteTextStyle(text, resolvedPreset, { width: noteWidth, height: textHeight });
  const assetKey = surfaceAssetOverride === undefined ? preset.surfaceAsset : surfaceAssetOverride;
  const noteAsset = assetKey ? noteAssets[assetKey] : null;
  const silhouetteShadow = Boolean(noteAsset && preset.family === 'paper' && shadowOverride !== 'none' && preset.shadow === 'soft');
  const frame: ViewStyle = presentation ? {
    position: 'absolute',
    left: presentation.x * width - noteWidth / 2,
    top: presentation.y * height - noteHeight / 2,
    width: noteWidth,
    height: noteHeight,
    zIndex: presentation.layerOrder,
    transform: [{ rotate: `${rotationOverride ?? presentation.rotation}deg` }, { scale: scaleOverride ?? presentation.scale }],
  } : { width: noteWidth, height: noteHeight, transform: [{ rotate: `${rotationOverride ?? preset.rotation}deg` }, { scale: scaleOverride ?? 1 }] };
  const shadow = shadowOverride ?? preset.shadow;
  const surfaceColor = surfaceColorOverride ?? preset.surfaceColor;

  return (
    <View testID={testID} accessible accessibilityRole="image" accessibilityLabel={text || 'Empty note preview'}
      style={[styles.shadowFrame, frame, shadow === 'soft' && !silhouetteShadow && styles.shadow]}>
      <View style={[styles.surface, { backgroundColor: noteAsset ? 'transparent' : surfaceColor, borderColor: preset.borderColor ?? 'transparent' }]}>
        {noteAsset ? <>
          {silhouetteShadow ? <Image source={noteAsset} resizeMode="stretch" style={styles.assetShadow} /> : null}
          <Image source={noteAsset} resizeMode="stretch" style={StyleSheet.absoluteFill} />
          {preset.family === 'paper' ? <Image source={noteAsset} resizeMode="stretch"
            style={[StyleSheet.absoluteFill, styles.assetTint, { tintColor: surfaceColor }]} /> : null}
        </> : null}
        {preset.ruled ? <View pointerEvents="none" style={styles.rules}>{[0, 1, 2, 3].map(line =>
          <View key={line} style={[styles.rule, { top: `${28 + line * 16}%`, borderColor: `${preset.inkColor}22` }]} />,
        )}</View> : null}
      <ScrollView style={[styles.textViewport, preset.textInsetBottom ? { marginBottom: noteHeight * preset.textInsetBottom } : null]} contentContainerStyle={styles.textContent} nestedScrollEnabled
        scrollEnabled={scrollText} showsVerticalScrollIndicator={false} accessibilityElementsHidden>
        <Text allowFontScaling maxFontSizeMultiplier={2} textBreakStrategy="simple" selectable={false}
          style={{ fontFamily: typographyOverride?.fontFamily ?? preset.fontFamily, fontSize: typographyOverride?.fontSize ?? textStyle.fontSize, lineHeight: typographyOverride?.lineHeight ?? textStyle.lineHeight,
            color: colorOverride ?? preset.inkColor, textAlign: preset.family === 'editorial' ? 'left' : 'center' }}>
          {text}
        </Text>
      </ScrollView>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  shadowFrame: { backgroundColor: 'transparent', overflow: 'visible' },
  surface: { flex: 1, borderRadius: radii.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent', overflow: 'hidden', justifyContent: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  shadow: { shadowColor: '#251F18', shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  assetShadow: { ...StyleSheet.absoluteFillObject, tintColor: '#251F18', opacity: 0.18, transform: [{ translateY: 4 }] },
  assetTint: { opacity: 0.52 },
  rules: { ...StyleSheet.absoluteFillObject },
  rule: { position: 'absolute', left: spacing[3], right: spacing[3], borderTopWidth: StyleSheet.hairlineWidth },
  textViewport: { flex: 1, zIndex: 1 },
  textContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: spacing[1] },
});
