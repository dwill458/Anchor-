import { memo, useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View, type ImageProps } from 'react-native';
import { visionImageFit } from './visionImageGeometry';

/**
 * Stable aperture. A person's own photograph that a crop would damage keeps its
 * whole original, set over a soft blurred copy of itself, so nothing they chose
 * is cut off and the frame still has no empty bars.
 */
export const VisionPhotograph = memo(function VisionPhotograph({ displayAspect, uploaded = false, onLoad, onAssetReady, style, ...props }:
  Omit<ImageProps, 'resizeMode'> & { displayAspect: number; uploaded?: boolean; onAssetReady?: () => void }) {
  const sourceKey = JSON.stringify(props.source);
  const [source, setSource] = useState<{ key: string; aspect: number } | null>(null);
  const [settledRecord, setSettledRecord] = useState<{ key: string; layers: Set<'backdrop' | 'foreground'>; fired: boolean } | null>(null);
  const settled = useRef<{ key: string; layers: Set<'backdrop' | 'foreground'>; fired: boolean }>({ key: sourceKey, layers: new Set(), fired: false });
  if (settled.current.key !== sourceKey) settled.current = { key: sourceKey, layers: new Set(), fired: false };
  const markLayerSettled = (layer: 'backdrop' | 'foreground') => {
    const current = settled.current;
    if (current.key !== sourceKey || current.fired) return;
    current.layers.add(layer);
    if (current.layers.size === 2) {
      current.fired = true;
      setSettledRecord(current);
    }
  };
  useEffect(() => {
    if (settledRecord && settledRecord === settled.current) onAssetReady?.();
  }, [onAssetReady, settledRecord, sourceKey]);
  const sourceAspect = source?.key === sourceKey ? source.aspect : 0;
  const fit = visionImageFit(sourceAspect, displayAspect, uploaded);
  const handleLoad: ImageProps['onLoad'] = event => {
    const { width, height } = event.nativeEvent.source;
    if (width > 0 && height > 0) setSource({ key: sourceKey, aspect: width / height });
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
  return <View style={[style, styles.fitted]}>
    <Image source={props.source} resizeMethod="resize" resizeMode="cover" blurRadius={22} onLoad={handleBackdropLoad} onError={handleBackdropError} style={[styles.backdrop, !contained && styles.hidden]} accessible={false} importantForAccessibility="no" />
    <View style={[styles.veil, !contained && styles.hidden]} pointerEvents="none" />
    <Image {...props} style={styles.whole} resizeMethod="resize" resizeMode={contained ? 'contain' : 'cover'} onLoad={handleLoad} onError={handleError} />
  </View>;
});

const styles = StyleSheet.create({
  fitted: { overflow: 'hidden' },
  backdrop: { ...StyleSheet.absoluteFillObject, transform: [{ scale: 1.15 }] },
  veil: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,20,25,0.18)' },
  whole: { ...StyleSheet.absoluteFillObject },
  hidden: { opacity: 0 },
});
