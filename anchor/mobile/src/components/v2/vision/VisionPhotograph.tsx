import { memo, useState } from 'react';
import { Image, StyleSheet, View, type ImageProps } from 'react-native';
import { visionImageFit } from './visionImageGeometry';

/**
 * Stable aperture. A person's own photograph that a crop would damage keeps its
 * whole original, set over a soft blurred copy of itself, so nothing they chose
 * is cut off and the frame still has no empty bars.
 */
export const VisionPhotograph = memo(function VisionPhotograph({ displayAspect, uploaded = false, onLoad, style, ...props }:
  Omit<ImageProps, 'resizeMode'> & { displayAspect: number; uploaded?: boolean }) {
  const sourceKey = JSON.stringify(props.source);
  const [source, setSource] = useState<{ key: string; aspect: number } | null>(null);
  const sourceAspect = source?.key === sourceKey ? source.aspect : 0;
  const fit = visionImageFit(sourceAspect, displayAspect, uploaded);
  const handleLoad: ImageProps['onLoad'] = event => {
    const { width, height } = event.nativeEvent.source;
    if (width > 0 && height > 0) setSource({ key: sourceKey, aspect: width / height });
    onLoad?.(event);
  };
  if (fit === 'cover') return <Image {...props} style={style} resizeMode="cover" onLoad={handleLoad} />;
  return <View style={[style, styles.fitted]}>
    <Image source={props.source} resizeMode="cover" blurRadius={22} style={styles.backdrop} accessible={false} importantForAccessibility="no" />
    <View style={styles.veil} pointerEvents="none" />
    <Image {...props} style={styles.whole} resizeMode="contain" onLoad={handleLoad} />
  </View>;
});

const styles = StyleSheet.create({
  fitted: { overflow: 'hidden' },
  backdrop: { ...StyleSheet.absoluteFillObject, transform: [{ scale: 1.15 }] },
  veil: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,20,25,0.18)' },
  whole: { ...StyleSheet.absoluteFillObject },
});
