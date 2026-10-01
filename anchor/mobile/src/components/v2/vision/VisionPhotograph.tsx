import { memo, useState } from 'react';
import { Image, type ImageProps } from 'react-native';
import { visionImageFit } from './visionImageGeometry';

/** Stable aperture; uploads with a severe crop keep their whole original. */
export const VisionPhotograph = memo(function VisionPhotograph({ displayAspect, uploaded = false, onLoad, ...props }:
  Omit<ImageProps, 'resizeMode'> & { displayAspect: number; uploaded?: boolean }) {
  const sourceKey = JSON.stringify(props.source);
  const [source, setSource] = useState<{ key: string; aspect: number } | null>(null);
  const sourceAspect = source?.key === sourceKey ? source.aspect : 0;
  return <Image {...props} resizeMode={visionImageFit(sourceAspect, displayAspect, uploaded)} onLoad={event => {
    const { width, height } = event.nativeEvent.source;
    if (width > 0 && height > 0) setSource({ key: sourceKey, aspect: width / height });
    onLoad?.(event);
  }} />;
});
