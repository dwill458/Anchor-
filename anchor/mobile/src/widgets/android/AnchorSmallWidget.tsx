/**
 * AnchorSmallWidget — 2×2 home screen widget.
 *
 * Symbol + state, nothing else: dim glyph when unprimed (with the required
 * visible silver ring — Fix #1), glowing gold glyph over a soft aura when
 * primed. Tapping opens this anchor's prime picker when the widget has an
 * active anchor snapshot.
 */

import React from 'react';
import { FlexWidget, ImageWidget, OverlapWidget, SvgWidget } from 'react-native-android-widget';
import { buildWidgetPrimeDeepLink } from '../widgetTypes';
import {
  buildGlyphMarkup,
  colorizeAnchorSigilSvg,
  DIM_GLYPH,
  GOLD,
  RING_NOT_PRIMED,
  RING_PRIMED,
  SILVER_LABEL,
  WIDGET_BG,
  WIDGET_CORNER_RADIUS,
} from './widgetPalette';

interface AnchorSmallWidgetProps {
  primed: boolean;
  anchorId: string | null;
  sigilSvg: string | null;
  artworkImageUri: string | null;
}

/**
 * Aura + artwork in one 150×150 composition. The artwork occupies 64% of
 * the shortest dimension with a safe inset, preserving its original viewBox.
 */
export function buildSmallWidgetSvg(primed: boolean, sigilSvg: string | null): string {
  const canvas = 150;
  const artworkSize = canvas * 0.64;

  // radial-gradient(circle at 50% 46%, rgba(212,175,55,0.16), transparent 62%)
  const aura = primed
    ? '<defs><radialGradient id="aura" cx="0.5" cy="0.46" r="0.62">' +
      `<stop offset="0" stop-color="${GOLD}" stop-opacity="0.16"/>` +
      `<stop offset="1" stop-color="${GOLD}" stop-opacity="0"/>` +
      '</radialGradient></defs>' +
      '<rect x="0" y="0" width="150" height="150" fill="url(#aura)"/>'
    : '';

  const color = primed ? GOLD : SILVER_LABEL;
  const actualSigil = colorizeAnchorSigilSvg(sigilSvg, color);
  const sigilMatch = actualSigil?.match(/<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/i);
  const viewBox = sigilMatch?.[1].match(/\bviewBox\s*=\s*["']\s*([-+\d.eE]+)[\s,]+([-+\d.eE]+)[\s,]+([-+\d.eE]+)[\s,]+([-+\d.eE]+)\s*["']/i);
  const glyph = sigilMatch && viewBox
    ? (() => {
        const [, minX, minY, width, height] = viewBox;
        const sourceWidth = Number(width);
        const sourceHeight = Number(height);
        const scale = artworkSize / Math.max(sourceWidth, sourceHeight);
        const translateX = (canvas - sourceWidth * scale) / 2 - Number(minX) * scale;
        const translateY = (canvas - sourceHeight * scale) / 2 - Number(minY) * scale;
        return `<g transform="translate(${translateX} ${translateY}) scale(${scale})" opacity="${primed ? 1 : 0.82}">${sigilMatch[2]}</g>`;
      })()
    : `<g transform="translate(42 23) scale(0.55)">${buildGlyphMarkup({
        strokeWidth: 4.6,
        stroke: color,
        opacity: primed ? 1 : 0.82,
        glow: primed,
      })}</g>`;

  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 150">' +
    '<defs><clipPath id="artworkClip"><circle cx="75" cy="75" r="48"/></clipPath></defs>' +
    aura +
    `<g clip-path="url(#artworkClip)">${glyph}</g>` +
    '</svg>'
  );
}

export function AnchorSmallWidget({ primed, anchorId, sigilSvg, artworkImageUri }: AnchorSmallWidgetProps) {
  return (
    <FlexWidget
      clickAction={anchorId ? 'OPEN_URI' : 'OPEN_APP'}
      clickActionData={anchorId ? { uri: buildWidgetPrimeDeepLink(anchorId) } : undefined}
      accessibilityLabel={primed ? 'Anchor — primed today' : 'Anchor — ready to prime'}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: WIDGET_BG,
        borderRadius: WIDGET_CORNER_RADIUS,
        borderWidth: 1,
        borderColor: primed ? RING_PRIMED : RING_NOT_PRIMED,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <OverlapWidget style={{ height: 'match_parent', width: 'match_parent' }}>
        <SvgWidget
          svg={buildSmallWidgetSvg(primed, sigilSvg)}
          style={{ height: 'match_parent', width: 'match_parent' }}
        />
        {artworkImageUri ? (
          <ImageWidget
            image={artworkImageUri as `data:image${string}`}
            imageWidth={92}
            imageHeight={92}
            radius={46}
            resizeMode="contain"
            style={{ width: 92, height: 92, marginLeft: 29, marginTop: 29 }}
          />
        ) : null}
      </OverlapWidget>
    </FlexWidget>
  );
}
