/**
 * SigilSvg - Wrapper component for displaying SVG sigils
 *
 * Renders anchor sigils from SVG XML strings using react-native-svg.
 */

import React from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

export interface SigilSvgProps {
  xml: string;
  width: number | string;
  height: number | string;
}

/**
 * SigilSvg Component
 *
 * Simple wrapper around SvgXml for consistent sigil rendering.
 */
export const SigilSvg: React.FC<SigilSvgProps> = ({ xml, width, height }) => {
  const numWidth = typeof width === 'number' ? width : parseInt(width as string, 10);
  const numHeight = typeof height === 'number' ? height : parseInt(height as string, 10);

  if (!xml) {
    return <View style={{ width: numWidth, height: numHeight }} />;
  }

  return (
    <SvgXml
      xml={xml}
      width={numWidth}
      height={numHeight}
    />
  );
};
