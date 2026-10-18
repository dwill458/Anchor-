import React, { memo } from 'react';
import { Image, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import type { VisionNoteFontId, VisionNotePresentation, VisionNoteStyleId } from '@/adapters/v2/vision';
import { radii, spacing } from '@/theme/v2';
import { noteAssets } from '@/assets/vision/notes/noteAssets';
import { getVisionNoteFont, getVisionNotePreset, resolveVisionNoteTextStyle, type VisionNoteAssetKey } from './visionNoteStyles';
import { resolveNoteAssetFrame } from './noteAssetGeometry';

export type VisionNoteRendererProps = {
  styleId: VisionNoteStyleId;
  fontId?: VisionNoteFontId;
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
  /** Reduced surface for previews embedded in the Vision editorial strip. */
  compact?: boolean;
};

/** Native note surface and live text, suitable for preview or board composition. */
export const VisionNoteRenderer = memo(function VisionNoteRenderer({
  styleId, text, width, height, presentation, fontId = presentation?.fontId, colorOverride, surfaceColorOverride, surfaceAssetOverride,
  rotationOverride, scaleOverride, shadowOverride, typographyOverride, testID = 'vision-note-renderer', scrollText = true, compact = false,
}: VisionNoteRendererProps) {
  const preset = getVisionNotePreset(styleId);
  const noteWidth = presentation ? presentation.width * width : width;
  const noteHeight = presentation ? presentation.height * height : height;
  const selectedFont = fontId && preset.family !== 'editorial' ? getVisionNoteFont(fontId) : null;
  const resolvedPreset = { ...preset, ...(selectedFont ? { fontFamily: selectedFont.fontFamily, fontSize: Math.min(preset.fontSize, selectedFont.sizeCap) } : {}), ...typographyOverride };
  const bottomInset = compact ? Math.min(0.12, preset.textInsetBottom ?? 0) : (preset.textInsetBottom ?? 0);
  const textHeight = noteHeight * (1 - bottomInset);
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
      style={[styles.shadowFrame, frame, shadow === 'soft' && !silhouetteShadow && styles.shadow,
        preset.family === 'sticky' && { backgroundColor: surfaceColor, borderRadius: 1 }]}>
      <View style={[styles.surface, preset.family === 'paper' && styles.paperSurface, preset.family === 'sticky' && styles.stickySurface,
        { backgroundColor: noteAsset ? 'transparent' : surfaceColor, borderColor: preset.borderColor ?? 'transparent' }]}>
        {preset.family === 'sticky' ? <View pointerEvents="none" style={styles.stickyAdhesive} /> : null}
        {noteAsset ? <>
          {silhouetteShadow ? <Image source={noteAsset} resizeMode="stretch" style={[styles.assetShadow, resolveNoteAssetFrame(assetKey!, noteWidth, noteHeight)]} /> : null}
          <Image source={noteAsset} resizeMode="stretch" style={resolveNoteAssetFrame(assetKey!, noteWidth, noteHeight)} />
          {preset.family === 'paper' ? <Image source={noteAsset} resizeMode="stretch"
            style={[styles.assetTint, resolveNoteAssetFrame(assetKey!, noteWidth, noteHeight), { tintColor: surfaceColor }]} /> : null}
        </> : null}
        <EditorialDetails id={styleId} compact={compact} />
        {preset.ruled ? <View pointerEvents="none" style={styles.rules}>{[0, 1, 2, 3].map(line =>
          <View key={line} style={[styles.rule, { top: `${28 + line * 16}%`, borderColor: `${preset.inkColor}22` }]} />,
        )}</View> : null}
      <ScrollView style={[styles.textViewport, bottomInset ? { marginBottom: noteHeight * bottomInset } : null]} contentContainerStyle={styles.textContent} nestedScrollEnabled
        scrollEnabled={scrollText} showsVerticalScrollIndicator={false} accessibilityElementsHidden>
        <Text allowFontScaling maxFontSizeMultiplier={2} textBreakStrategy="simple" selectable={false}
          style={{ fontFamily: typographyOverride?.fontFamily ?? resolvedPreset.fontFamily, fontSize: typographyOverride?.fontSize ?? textStyle.fontSize, lineHeight: typographyOverride?.lineHeight ?? textStyle.lineHeight,
            color: colorOverride ?? preset.inkColor, textAlign: preset.family === 'editorial' ? (preset.textAlign ?? 'left') : 'center' }}>
          {text}
        </Text>
      </ScrollView>
      </View>
    </View>
  );
});

function EditorialDetails({ id, compact }: { id: VisionNoteStyleId; compact: boolean }) {
  const stroke = compact ? 0.65 : 1;
  switch (id) {
    case 'editorial_vintage_letter': return null;
    case 'editorial_golden_hour': return null;
    case 'editorial_misty_mountains': return null;
    case 'editorial_rose_editorial': return <Svg pointerEvents="none" style={StyleSheet.absoluteFill} viewBox="0 0 100 100"><Line x1="9" y1="7" x2="9" y2="93" stroke="#A77E7D" strokeWidth={stroke} opacity={0.5}/><Line x1="13" y1="7" x2="13" y2="93" stroke="#A77E7D" strokeWidth={stroke} opacity={0.3}/><Line x1="13" y1="87" x2="93" y2="87" stroke="#A77E7D" strokeWidth={stroke} opacity={0.4}/></Svg>;
    case 'editorial_architectural': return <Svg pointerEvents="none" style={StyleSheet.absoluteFill} viewBox="0 0 100 100"><Rect x="69" y="8" width="23" height="84" fill="none" stroke="#657274" strokeWidth={stroke} opacity={0.42}/><Line x1="75" y1="8" x2="75" y2="92" stroke="#657274" strokeWidth={stroke} opacity={0.3}/><Line x1="69" y1="25" x2="92" y2="25" stroke="#657274" strokeWidth={stroke} opacity={0.3}/></Svg>;
    case 'editorial_midnight_editorial': return <Svg pointerEvents="none" style={StyleSheet.absoluteFill} viewBox="0 0 100 100"><Rect x="4" y="4" width="92" height="92" fill="none" stroke="#D5BE8A" strokeWidth={stroke} opacity={0.65}/><Line x1="18" y1="81" x2="82" y2="81" stroke="#D5BE8A" strokeWidth={stroke} opacity={0.65}/></Svg>;
    case 'editorial_minimal_quote': return <Svg pointerEvents="none" style={StyleSheet.absoluteFill} viewBox="0 0 100 100"><Rect x="5" y="5" width="90" height="90" fill="none" stroke="#C8B27D" strokeWidth={stroke} opacity={0.5}/></Svg>;
    default: return null;
  }
}

const styles = StyleSheet.create({
  shadowFrame: { backgroundColor: 'transparent', overflow: 'visible' },
  surface: { flex: 1, borderRadius: radii.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent', overflow: 'hidden', justifyContent: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  paperSurface: { overflow: 'visible' },
  stickySurface: { borderRadius: 1, borderWidth: 0 },
  stickyAdhesive: { position: 'absolute', top: 0, left: 0, right: 0, height: '11%', backgroundColor: '#FFFFFF', opacity: .08,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#00000015' },
  shadow: { shadowColor: '#251F18', shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  assetShadow: { position: 'absolute', tintColor: '#251F18', opacity: 0.08, transform: [{ translateY: 2 }] },
  assetTint: { position: 'absolute', opacity: 0.52 },
  rules: { ...StyleSheet.absoluteFill },
  rule: { position: 'absolute', left: spacing[3], right: spacing[3], borderTopWidth: StyleSheet.hairlineWidth },
  textViewport: { flex: 1, zIndex: 1 },
  textContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: spacing[1] },
});
