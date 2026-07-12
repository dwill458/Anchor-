/**
 * AnchorSmallWidget — 2×2 home screen widget.
 *
 * Symbol + state, nothing else: dim glyph when unprimed (with the required
 * visible silver ring — Fix #1), glowing gold glyph over a soft aura when
 * primed. Tapping opens this anchor's prime picker when the widget has an
 * active anchor snapshot.
 */

import React from 'react';
import { FlexWidget, SvgWidget } from 'react-native-android-widget';
import { buildWidgetPrimeDeepLink } from '../widgetTypes';
import {
  buildGlyphMarkup,
  colorizeAnchorSigilSvg,
  DIM_GLYPH,
  GOLD,
  RING_NOT_PRIMED,
  RING_PRIMED,
  WIDGET_BG,
  WIDGET_CORNER_RADIUS,
} from './widgetPalette';

interface AnchorSmallWidgetProps {
  primed: boolean;
  anchorId: string | null;
  sigilSvg: string | null;
}

/**
 * Aura + glyph in one 150×150 composition. The glyph occupies 46% of the
 * widget width, centered (matches the approved prototype).
 */
function buildSmallWidgetSvg(primed: boolean, sigilSvg: string | null): string {
  const glyphWidth = 150 * 0.46; // 69
  const scale = glyphWidth / 120; // 0.575
  const glyphHeight = 130 * scale; // 74.75
  const translateX = (150 - glyphWidth) / 2;
  const translateY = (150 - glyphHeight) / 2;

  // radial-gradient(circle at 50% 46%, rgba(212,175,55,0.16), transparent 62%)
  const aura = primed
    ? '<defs><radialGradient id="aura" cx="0.5" cy="0.46" r="0.62">' +
      `<stop offset="0" stop-color="${GOLD}" stop-opacity="0.16"/>` +
      `<stop offset="1" stop-color="${GOLD}" stop-opacity="0"/>` +
      '</radialGradient></defs>' +
      '<rect x="0" y="0" width="150" height="150" fill="url(#aura)"/>'
    : '';

  const color = primed ? GOLD : DIM_GLYPH;
  const actualSigil = colorizeAnchorSigilSvg(sigilSvg, color);
  const glyph = actualSigil
    ? actualSigil.replace(
        /<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/i,
        (_match, attrs: string, content: string) => {
          const viewBox = attrs.match(/\bviewBox\s*=\s*["'][^"']+["']/i)?.[0] ?? 'viewBox="0 0 100 100"';
          return `<svg x="30" y="30" width="90" height="90" ${viewBox} preserveAspectRatio="xMidYMid meet" opacity="${primed ? 1 : 0.9}">${content}</svg>`;
        }
      )
    : `<g>${buildGlyphMarkup({
        strokeWidth: 4.6,
        stroke: color,
        opacity: primed ? 1 : 0.9,
        glow: primed,
      })}</g>`;

  const renderedGlyph = actualSigil
    ? glyph
    : `<g transform="translate(${translateX} ${translateY}) scale(${scale})">${glyph}</g>`;

  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 150">' +
    aura +
    renderedGlyph +
    '</svg>'
  );
}

export function AnchorSmallWidget({ primed, anchorId, sigilSvg }: AnchorSmallWidgetProps) {
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
      <SvgWidget
        svg={buildSmallWidgetSvg(primed, sigilSvg)}
        style={{ height: 'match_parent', width: 'match_parent' }}
      />
    </FlexWidget>
  );
}
