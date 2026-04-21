/**
 * SigilSvg - Wrapper component for displaying SVG sigils
 *
 * Renders anchor sigils from SVG XML strings using react-native-svg.
 */

import React, { memo } from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

export interface SigilSvgProps {
  xml: string;
  width: number | string;
  height: number | string;
  color?: string;
}

const NORMALIZED_SVG_CACHE = new Map<string, string>();

function normalizeSvgXml(xml: string): string {
  const cached = NORMALIZED_SVG_CACHE.get(xml);
  if (cached) {
    return cached;
  }

  const normalized = xml.trim().replace(/>\s+</g, '><');

  if (NORMALIZED_SVG_CACHE.size >= 250) {
    NORMALIZED_SVG_CACHE.clear();
  }

  NORMALIZED_SVG_CACHE.set(xml, normalized);
  return normalized;
}

function normalizeDimension(value: number | string): string | number {
  if (typeof value === 'number') {
    return value;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && !value.includes('%')
    ? parsed
    : value;
}

/**
 * SigilSvg Component
 *
 * Simple wrapper around SvgXml for consistent sigil rendering.
 */
export const SigilSvg: React.FC<SigilSvgProps> = memo(function SigilSvg({
  xml,
  width,
  height,
  color,
}) {
  const resolvedWidth = normalizeDimension(width);
  const resolvedHeight = normalizeDimension(height);

  if (!xml) {
    return <View style={{ width: resolvedWidth, height: resolvedHeight }} />;
  }

  return (
    <SvgXml
      xml={normalizeSvgXml(xml)}
      width={resolvedWidth}
      height={resolvedHeight}
      color={color}
    />
  );
}, (prevProps, nextProps) => (
  prevProps.xml === nextProps.xml
  && prevProps.width === nextProps.width
  && prevProps.height === nextProps.height
  && prevProps.color === nextProps.color
));
