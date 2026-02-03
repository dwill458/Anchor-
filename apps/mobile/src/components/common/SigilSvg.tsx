import React, { memo, useMemo } from 'react';
import { Platform } from 'react-native';
import { SvgXml, XmlProps } from 'react-native-svg';

export interface SigilSvgProps extends XmlProps {
  xml?: string | null;
}

export const SigilSvg = memo(({ xml, ...props }: SigilSvgProps) => {
  const normalizedXml = useMemo(() => (xml ? xml.trim() : null), [xml]);

  if (!normalizedXml) return null;

  const platformProps = Platform.OS === 'ios'
    ? { shouldRasterizeIOS: props.shouldRasterizeIOS ?? true }
    : { renderToHardwareTextureAndroid: props.renderToHardwareTextureAndroid ?? true };

  return (
    <SvgXml
      xml={normalizedXml}
      {...platformProps}
      {...props}
    />
  );
}, (prev, next) => (
  prev.xml === next.xml &&
  prev.width === next.width &&
  prev.height === next.height &&
  prev.opacity === next.opacity &&
  prev.color === next.color &&
  prev.style === next.style
));

SigilSvg.displayName = 'SigilSvg';
