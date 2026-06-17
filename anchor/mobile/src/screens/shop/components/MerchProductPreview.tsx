import React from 'react';
import { DimensionValue, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { OptimizedImage, SigilSvg } from '@/components/common';
import { colors, typography } from '@/theme';
import {
  MerchBackgroundOption,
  MerchLayoutOption,
  MerchProductType,
  MERCH_BACKGROUND_OPTIONS,
} from '../merchCatalog';

interface MerchProductPreviewProps {
  artworkUri?: string;
  background: MerchBackgroundOption;
  compact?: boolean;
  intentionText?: string;
  layout: MerchLayoutOption;
  productType: MerchProductType;
  scale?: number;
  showIntention?: boolean;
  sigilSvg: string;
}

const PRODUCT_SHELLS: Record<
  MerchProductType,
  {
    frameStyle: {
      width: DimensionValue;
      aspectRatio: number;
      borderRadius: number;
      padding: number;
    };
    artworkBoxStyle: {
      width: DimensionValue;
      aspectRatio: number;
      borderRadius: number;
    };
    previewSize: { width: number; height: number };
    title: string;
  }
> = {
  'desk-mat': {
    frameStyle: { width: '92%', aspectRatio: 1.9, borderRadius: 24, padding: 10 },
    artworkBoxStyle: { width: '60%', aspectRatio: 1, borderRadius: 14 },
    previewSize: { width: 170, height: 170 },
    title: 'Desk Mat',
  },
  'phone-case': {
    frameStyle: { width: '48%', aspectRatio: 0.52, borderRadius: 32, padding: 8 },
    artworkBoxStyle: { width: '94%', aspectRatio: 0.5, borderRadius: 22 },
    previewSize: { width: 120, height: 120 },
    title: 'Phone Case',
  },
  print: {
    frameStyle: { width: '58%', aspectRatio: 0.78, borderRadius: 10, padding: 10 },
    artworkBoxStyle: { width: '72%', aspectRatio: 1, borderRadius: 2 },
    previewSize: { width: 150, height: 150 },
    title: 'Wall Print',
  },
};

export function MerchProductPreview({
  artworkUri,
  background,
  compact = false,
  intentionText,
  layout,
  productType,
  scale = 1,
  showIntention = false,
  sigilSvg,
}: MerchProductPreviewProps) {
  const backgroundConfig =
    MERCH_BACKGROUND_OPTIONS.find((option) => option.id === background) ?? MERCH_BACKGROUND_OPTIONS[0];
  const shell = PRODUCT_SHELLS[productType];
  const hasArtwork = Boolean(artworkUri);
  const scaleFactor = layout === 'minimal' ? 0.52 : layout === 'focus' ? 0.92 : 1.08;
  const artworkScale = Math.max(0.52, Math.min(scaleFactor * scale, 1.3));
  const sigilWidth = shell.previewSize.width * scaleFactor * scale;
  const sigilHeight = shell.previewSize.height * scaleFactor * scale;
  const sigilPositionStyle =
    layout === 'focus'
      ? { alignItems: 'flex-end' as const, justifyContent: 'flex-end' as const, paddingBottom: 18, paddingRight: 22 }
      : { alignItems: 'center' as const, justifyContent: 'center' as const, paddingBottom: layout === 'minimal' ? 2 : 0 };

  return (
    <LinearGradient colors={backgroundConfig.colors} style={[styles.canvas, compact && styles.canvasCompact]}>
      <View style={styles.glowLarge} />
      <View style={styles.glowSmall} />
      <View style={[styles.productFrame, shell.frameStyle]}>
        <View
          style={[
            styles.productSurface,
            productType === 'desk-mat' && styles.deskMatSurface,
            productType === 'phone-case' && styles.phoneCaseSurface,
            productType === 'print' && styles.printSurface,
          ]}
        >
          <View
            style={[
              styles.artworkStage,
              productType === 'desk-mat' && styles.deskMatStage,
              productType === 'phone-case' && styles.phoneCaseStage,
              productType === 'print' && styles.printStage,
            ]}
          >
            {hasArtwork ? (
              <View style={[styles.artworkPlacement, sigilPositionStyle]}>
                <View style={[styles.artworkBox, shell.artworkBoxStyle, { transform: [{ scale: artworkScale }] }]}>
                  <OptimizedImage
                    uri={artworkUri!}
                    resizeMode="contain"
                    style={styles.artworkImage}
                  />
                </View>
              </View>
            ) : (
              <View style={[styles.sigilLayer, sigilPositionStyle]}>
                <SigilSvg xml={sigilSvg} width={sigilWidth} height={sigilHeight} color={colors.gold} />
              </View>
            )}

            {productType === 'desk-mat' ? <View pointerEvents="none" style={styles.deskMatEdge} /> : null}
            {productType === 'phone-case' ? (
              <View pointerEvents="none" style={styles.phoneCaseCameraIsland}>
                <View style={styles.phoneCaseLens} />
                <View style={styles.phoneCaseLens} />
                <View style={styles.phoneCaseLensSmall} />
              </View>
            ) : null}
            {productType === 'print' ? <View pointerEvents="none" style={styles.printMatInset} /> : null}
          </View>
          {showIntention && intentionText ? (
            <Text style={styles.intention}>{`"${intentionText}"`}</Text>
          ) : null}
        </View>
      </View>
      {compact ? null : <Text style={styles.productLabel}>{shell.title}</Text>}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  canvas: {
    minHeight: 260,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
    backgroundColor: '#140f21',
  },
  canvasCompact: {
    minHeight: 132,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  glowLarge: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    top: -52,
    right: -68,
    backgroundColor: 'rgba(88, 53, 130, 0.32)',
  },
  glowSmall: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    bottom: -54,
    left: -36,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
  },
  productFrame: {
    borderWidth: 1,
    borderColor: 'rgba(245, 245, 220, 0.08)',
    backgroundColor: 'rgba(9, 11, 17, 0.62)',
    shadowColor: colors.gold,
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  productSurface: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#0d1118',
  },
  deskMatSurface: {
    borderRadius: 16,
    padding: 8,
    backgroundColor: '#161117',
  },
  deskMatStage: {
    borderRadius: 12,
    backgroundColor: '#090c14',
  },
  deskMatEdge: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  phoneCaseSurface: {
    borderRadius: 24,
    backgroundColor: '#17131d',
    padding: 4,
  },
  phoneCaseStage: {
    borderRadius: 22,
    backgroundColor: '#0f121b',
  },
  phoneCaseCameraIsland: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(8, 10, 14, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 6,
    gap: 4,
  },
  phoneCaseLens: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(220, 224, 233, 0.78)',
  },
  phoneCaseLensSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(123, 131, 149, 0.86)',
    alignSelf: 'center',
  },
  printSurface: {
    borderRadius: 4,
    padding: 12,
    backgroundColor: '#171313',
  },
  printStage: {
    borderRadius: 2,
    backgroundColor: '#e6e0d6',
    padding: 14,
  },
  printMatInset: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(11, 11, 14, 0.08)',
  },
  artworkStage: {
    flex: 1,
    overflow: 'hidden',
  },
  artworkPlacement: {
    flex: 1,
  },
  artworkBox: {
    overflow: 'hidden',
  },
  artworkImage: {
    width: '100%',
    height: '100%',
  },
  sigilLayer: {
    flex: 1,
  },
  intention: {
    position: 'absolute',
    bottom: 18,
    left: 18,
    right: 18,
    textAlign: 'center',
    color: 'rgba(245, 245, 220, 0.78)',
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.42)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  productLabel: {
    marginTop: 14,
    color: 'rgba(245, 245, 220, 0.56)',
    fontFamily: typography.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
});
