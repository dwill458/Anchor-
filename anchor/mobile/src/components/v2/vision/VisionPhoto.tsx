import React from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, getCategoryColor } from '@/theme/v2';

export type VisionPhotoScrim = 'none' | 'top' | 'bottom' | 'both';

type Props = {
  /** A bundled photo or a remote Vision image URL. */
  source: ImageSourcePropType | string | null | undefined;
  category?: string | null;
  /**
   * Category wash strength (0-1). Bundled "possible future" photography uses
   * ~0.12 so it still reads as a photograph; a person's own Vision imagery is
   * never tinted.
   */
  tint?: number;
  /** Gradient protection for text laid over the photograph. */
  scrim?: VisionPhotoScrim;
  /** Scrim colour; defaults to ink so light text stays legible. */
  scrimColor?: string;
  /** Bottom scrim colour when it should dissolve into a different surface (e.g. the cream canvas). */
  bottomScrimColor?: string;
  blurRadius?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children?: React.ReactNode;
};

function withAlpha(hex: string, alpha: number): string {
  const value = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
  return `${hex.slice(0, 7)}${value}`;
}

/**
 * One photograph, cropped by cover, optionally washed with the category and
 * protected by a gradient. The image is sized explicitly (not absoluteFill):
 * an absoluteFill Image inside an absolutely positioned frame renders hugely
 * zoomed on Android.
 */
export function VisionPhoto({
  source, category, tint = 0, scrim = 'none', scrimColor = colors.ink.base, bottomScrimColor, blurRadius, style, testID, children,
}: Props) {
  const bottomColor = bottomScrimColor ?? scrimColor;
  const imageSource = typeof source === 'string' ? { uri: source } : source;
  const wash = tint > 0 ? getCategoryColor(category) : null;
  return (
    <View testID={testID} style={[styles.frame, style]}>
      {imageSource ? (
        <Image
          accessibilityIgnoresInvertColors
          source={imageSource}
          resizeMode="cover"
          blurRadius={blurRadius}
          style={styles.image}
        />
      ) : null}
      {wash ? <View pointerEvents="none" style={[styles.fill, { backgroundColor: wash, opacity: tint }]} /> : null}
      {scrim === 'top' || scrim === 'both' ? (
        <LinearGradient
          pointerEvents="none"
          colors={[withAlpha(scrimColor, 0.82), withAlpha(scrimColor, 0.35), withAlpha(scrimColor, 0)]}
          locations={[0, 0.42, 1]}
          style={[styles.scrim, styles.scrimTop]}
        />
      ) : null}
      {scrim === 'bottom' || scrim === 'both' ? (
        <LinearGradient
          pointerEvents="none"
          colors={[withAlpha(bottomColor, 0), withAlpha(bottomColor, 0.45), withAlpha(bottomColor, bottomScrimColor ? 1 : 0.9)]}
          locations={[0, 0.5, 1]}
          style={[styles.scrim, styles.scrimBottom]}
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: colors.ink.deep },
  image: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  fill: { ...StyleSheet.absoluteFillObject },
  scrim: { position: 'absolute', left: 0, right: 0, height: '55%' },
  scrimTop: { top: 0 },
  scrimBottom: { bottom: 0 },
});
