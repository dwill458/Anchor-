import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
} from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SvgXml } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';
import { colors, spacing, typography } from '@/theme';
import { OptimizedImage } from './OptimizedImage';

const EXPORT_WIDTH = 1080;
const EXPORT_HEIGHT = 1920;

export interface AnchorArtworkExportCanvasHandle {
  capture: () => Promise<string>;
}

interface AnchorArtworkExportCanvasProps {
  anchorName: string;
  intentionText: string;
  enhancedImageUrl?: string | null;
  sigilSvg?: string | null;
}

export const AnchorArtworkExportCanvas = forwardRef<
  AnchorArtworkExportCanvasHandle,
  AnchorArtworkExportCanvasProps
>(function AnchorArtworkExportCanvas(
  {
    anchorName,
    intentionText,
    enhancedImageUrl,
    sigilSvg,
  },
  ref
) {
  const viewShotRef = useRef<any>(null);
  const showImage = Boolean(enhancedImageUrl);
  const showSvg = !showImage && Boolean(sigilSvg);

  useImperativeHandle(ref, () => ({
    async capture() {
      const uri = await viewShotRef.current?.capture?.();
      if (!uri) {
        throw new Error('Unable to generate anchor artwork right now.');
      }
      return uri;
    },
  }), []);

  return (
    <View pointerEvents="none" style={styles.hiddenStage}>
      <ViewShot
        ref={viewShotRef}
        options={{
          fileName: 'anchor-artwork',
          format: 'png',
          quality: 1,
          result: 'tmpfile',
        }}
      >
        <View style={styles.canvas}>
          <LinearGradient
            colors={['#040610', '#120B27', '#1A1138']}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <LinearGradient
            colors={['rgba(222, 184, 78, 0.18)', 'rgba(222, 184, 78, 0)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.55 }}
            style={styles.topGlow}
          />
          <View style={[styles.orb, styles.orbTop]} />
          <View style={[styles.orb, styles.orbBottom]} />
          <View style={styles.frame}>
            <View style={styles.frameBorder} />
            <Text style={styles.brand}>ANCHOR</Text>
            <Text style={styles.kicker}>LOCK INTO THE SYMBOL</Text>

            <View style={styles.artStage}>
              <LinearGradient
                colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.01)']}
                style={styles.artPanel}
              >
                <View style={styles.artGlow} />
                {showImage ? (
                  <OptimizedImage
                    uri={enhancedImageUrl ?? ''}
                    style={styles.artImage}
                    resizeMode="cover"
                  />
                ) : showSvg ? (
                  <View style={styles.svgPanel}>
                    <View style={styles.svgHalo} />
                    <SvgXml xml={sigilSvg ?? ''} width={520} height={520} />
                  </View>
                ) : (
                  <View style={styles.emptyGlyph}>
                    <Text style={styles.emptyGlyphText}>A</Text>
                  </View>
                )}
              </LinearGradient>
            </View>

            <View style={styles.copyWrap}>
              <Text style={styles.anchorName} numberOfLines={2}>
                {anchorName}
              </Text>
              <Text style={styles.intention} numberOfLines={4}>
                {intentionText}
              </Text>
              <Text style={styles.footer}>
                Save this PNG and set it as your wallpaper from your device settings.
              </Text>
            </View>
          </View>
        </View>
      </ViewShot>
    </View>
  );
});

const styles = StyleSheet.create({
  hiddenStage: {
    position: 'absolute',
    left: -EXPORT_WIDTH * 2,
    top: 0,
  },
  canvas: {
    width: EXPORT_WIDTH,
    height: EXPORT_HEIGHT,
    overflow: 'hidden',
    backgroundColor: colors.background.primary,
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: EXPORT_HEIGHT * 0.45,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(160, 118, 255, 0.08)',
  },
  orbTop: {
    width: 520,
    height: 520,
    top: 180,
    right: -100,
  },
  orbBottom: {
    width: 620,
    height: 620,
    bottom: -120,
    left: -140,
    backgroundColor: 'rgba(222, 184, 78, 0.08)',
  },
  frame: {
    flex: 1,
    margin: 52,
    borderRadius: 48,
    paddingHorizontal: 72,
    paddingTop: 88,
    paddingBottom: 96,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  frameBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: 'rgba(222, 184, 78, 0.26)',
    backgroundColor: 'rgba(8, 10, 22, 0.52)',
  },
  brand: {
    color: '#F5E8B8',
    fontSize: 40,
    letterSpacing: 8,
    textAlign: 'center',
    fontFamily: typography.fontFamily.serif,
  },
  kicker: {
    marginTop: spacing.sm,
    color: 'rgba(245, 232, 184, 0.7)',
    fontSize: 22,
    letterSpacing: 4,
    textAlign: 'center',
    fontFamily: typography.fontFamily.sans,
  },
  artStage: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  artPanel: {
    width: 760,
    height: 940,
    borderRadius: 38,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(7, 8, 18, 0.8)',
  },
  artGlow: {
    position: 'absolute',
    width: 540,
    height: 540,
    borderRadius: 270,
    backgroundColor: 'rgba(222, 184, 78, 0.14)',
  },
  artImage: {
    width: '100%',
    height: '100%',
  },
  svgPanel: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  svgHalo: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  emptyGlyph: {
    width: 320,
    height: 320,
    borderRadius: 160,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyGlyphText: {
    color: '#F5E8B8',
    fontSize: 180,
    fontFamily: typography.fontFamily.serif,
  },
  copyWrap: {
    alignItems: 'center',
    paddingHorizontal: 36,
  },
  anchorName: {
    color: colors.text.primary,
    fontSize: 58,
    lineHeight: 70,
    textAlign: 'center',
    fontFamily: typography.fontFamily.serif,
  },
  intention: {
    marginTop: spacing.md,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 30,
    lineHeight: 44,
    textAlign: 'center',
    fontFamily: typography.fontFamily.sans,
  },
  footer: {
    marginTop: spacing.xl,
    color: 'rgba(245, 232, 184, 0.72)',
    fontSize: 22,
    lineHeight: 32,
    textAlign: 'center',
    fontFamily: typography.fontFamily.sans,
  },
});

export const ANCHOR_ARTWORK_EXPORT_SIZE = {
  width: EXPORT_WIDTH,
  height: EXPORT_HEIGHT,
};
