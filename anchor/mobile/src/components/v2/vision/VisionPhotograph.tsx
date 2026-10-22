import { memo, useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View, type ImageProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { resolveVisionFocal, visionCoverFrame } from './visionPhotoFocus';
import { visionImageFit } from './visionImageGeometry';
import { colors } from '@/theme/v2';

/**
 * Fits inside the existing aperture without changing print geometry. Uploads
 * that cannot safely fill it retain the original over the board's paper color.
 */
/**
 * The photograph's window on the UI thread, plus where the picture sits in it. With this, a `fill` photograph is laid
 * out by `visionCoverFrame`: it covers the window at its own proportions and shows the part of the overflow the focal
 * names. `focalY` below zero means "not set": the upper-biased automatic position is used until the person sets one.
 */
export type VisionFocalFrame = {
  windowWidth: SharedValue<number>;
  windowHeight: SharedValue<number>;
  focalX: SharedValue<number>;
  focalY: SharedValue<number>;
  /** Source aspect (width / height), 0 until the image has loaded. Written by the photograph. */
  aspect: SharedValue<number>;
};

export const VisionPhotograph = memo(function VisionPhotograph({ displayAspect, uploaded = false, fill = false, focalFrame, onLoad, onAssetReady, style, ...props }:
  Omit<ImageProps, 'resizeMode'> & { displayAspect: number; uploaded?: boolean; /** Always covers the window, centred; no blurred backdrop or contain bands. */ fill?: boolean; onAssetReady?: () => void;
    /** With `fill`: position the picture by a focal point instead of centring it. */ focalFrame?: VisionFocalFrame }) {
  const fallbackAspect = useSharedValue(0);
  const aspectValue = focalFrame?.aspect ?? fallbackAspect;
  const focalStyle = useAnimatedStyle(() => {
    if (!focalFrame) return {};
    const w = focalFrame.windowWidth.value, h = focalFrame.windowHeight.value, aspect = focalFrame.aspect.value;
    const focal = resolveVisionFocal(focalFrame.focalX.value, focalFrame.focalY.value, aspect, h > 0 ? w / h : 1);
    const frame = visionCoverFrame(aspect, w, h, focal);
    return { width: frame.width, height: frame.height, left: frame.left, top: frame.top };
  });
  const sourceKey = JSON.stringify(props.source);
  const [source, setSource] = useState<{ key: string; aspect: number } | null>(null);
  const [apertureAspect, setApertureAspect] = useState<number | null>(null);
  const [settledRecord, setSettledRecord] = useState<{ key: string; layers: Set<'backdrop' | 'foreground'>; fired: boolean } | null>(null);
  const settled = useRef<{ key: string; layers: Set<'backdrop' | 'foreground'>; fired: boolean }>({ key: sourceKey, layers: new Set(), fired: false });
  if (settled.current.key !== sourceKey) settled.current = { key: sourceKey, layers: new Set(), fired: false };
  const markLayerSettled = (layer: 'backdrop' | 'foreground') => {
    const current = settled.current;
    if (current.key !== sourceKey || current.fired) return;
    current.layers.add(layer);
    if (current.layers.size === (uploaded || fill ? 1 : 2)) {
      current.fired = true;
      setSettledRecord(current);
    }
  };
  useEffect(() => {
    if (settledRecord && settledRecord === settled.current) onAssetReady?.();
  }, [onAssetReady, settledRecord, sourceKey]);
  const sourceAspect = source?.key === sourceKey ? source.aspect : 0;
  const fit = fill ? 'cover' : visionImageFit(sourceAspect, uploaded ? apertureAspect ?? displayAspect : displayAspect, uploaded);
  const handleLayout: ImageProps['onLayout'] = event => {
    const { width, height } = event.nativeEvent.layout;
    if (uploaded && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      const aspect = width / height;
      setApertureAspect(previous => previous != null && Math.abs(previous - aspect) < .001 ? previous : aspect);
    }
    props.onLayout?.(event);
  };
  const handleLoad: ImageProps['onLoad'] = event => {
    const { width, height } = event.nativeEvent.source;
    if (width > 0 && height > 0) { setSource({ key: sourceKey, aspect: width / height }); aspectValue.value = width / height; }
    onLoad?.(event);
    markLayerSettled('foreground');
  };
  const handleError: ImageProps['onError'] = event => {
    props.onError?.(event);
    markLayerSettled('foreground');
  };
  const handleBackdropLoad = () => markLayerSettled('backdrop');
  const handleBackdropError: ImageProps['onError'] = () => markLayerSettled('backdrop');
  // One element tree for both fits. Switching fit only changes props on the same
  // images: swapping the tree once the aspect is known remounted the photograph,
  // so it showed an empty frame while it decoded again.
  // Android must downsample to the aperture before allocating a bitmap. Full-size
  // foreground/backdrop copies can exhaust Fresco's pool on an eight-photo board.
  const contained = fit === 'contain';
  if (fill && focalFrame) {
    return <View style={[style, styles.fitted]}>
      <Animated.View style={[styles.focal, focalStyle]}>
        <Image {...props} style={styles.whole} resizeMethod="resize" resizeMode="cover" fadeDuration={0} onLoad={handleLoad} onError={handleError} onLayout={handleLayout} />
      </Animated.View>
    </View>;
  }
  return <View style={[style, styles.fitted, uploaded && styles.uploadPaper]}>
    {!uploaded && !fill ? <>
      <Image source={props.source} resizeMethod="resize" resizeMode="cover" blurRadius={22} fadeDuration={0} onLoad={handleBackdropLoad} onError={handleBackdropError} style={[styles.backdrop, !contained && styles.hidden]} accessible={false} importantForAccessibility="no" />
      <View style={[styles.veil, !contained && styles.hidden]} pointerEvents="none" />
    </> : null}
    <Image {...props} style={styles.whole} resizeMethod="resize" resizeMode={contained ? 'contain' : 'cover'} fadeDuration={0} onLoad={handleLoad} onError={handleError} onLayout={handleLayout} />
  </View>;
});

const styles = StyleSheet.create({
  fitted: { overflow: 'hidden' },
  uploadPaper: { backgroundColor: colors.canvas },
  backdrop: { ...StyleSheet.absoluteFill, transform: [{ scale: 1.15 }] },
  veil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15,20,25,0.18)' },
  whole: { ...StyleSheet.absoluteFill },
  focal: { position: 'absolute', overflow: 'hidden' },
  hidden: { opacity: 0 },
});
