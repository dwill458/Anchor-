/**
 * AnchorMediumWidget — 4×2 home screen widget.
 *
 * Glyph + anchor name + state line, a metrics row scoped to the selected
 * anchor (the 4×4 shows practice-wide numbers; this shows just this anchor's),
 * and a full-width CTA:
 *  - not primed: solid gold "Prime Now" (spark icon)
 *  - primed:     quiet outlined "Open Focus" (arrow icon)
 * Both CTA states deep-link into the Practice tab (Focus session entry point).
 */

import React from 'react';
import { FlexWidget, OverlapWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import { WIDGET_PRACTICE_DEEP_LINK } from '../widgetTypes';
import {
  BONE,
  buildGlyphSvg,
  colorizeAnchorSigilSvg,
  CTA_BORDER_PRIMED,
  DIM_GLYPH,
  FONT_DISPLAY,
  FONT_DISPLAY_SEMIBOLD,
  FONT_SERIF_SEMIBOLD,
  GOLD,
  MUTED_LABEL,
  RING_NOT_PRIMED,
  RING_PRIMED,
  SILVER_LABEL,
  WIDGET_BG,
  WIDGET_CORNER_RADIUS,
} from './widgetPalette';

interface AnchorMediumWidgetProps {
  primed: boolean;
  anchorName: string;
  sigilSvg: string | null;
  /** Metrics scoped to this anchor only (not practice-wide) */
  anchorTotalSessions: number;
  anchorDayStreak: number;
  anchorDeepPrimeSessions: number;
}

/** State dot, with a soft halo when primed (0 0 6px rgba(212,175,55,0.7)) */
function buildStateDotSvg(primed: boolean): string {
  const halo = primed
    ? '<defs><radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">' +
      `<stop offset="0" stop-color="${GOLD}" stop-opacity="0.7"/>` +
      `<stop offset="0.55" stop-color="${GOLD}" stop-opacity="0.35"/>` +
      `<stop offset="1" stop-color="${GOLD}" stop-opacity="0"/>` +
      '</radialGradient></defs>' +
      '<circle cx="7" cy="7" r="7" fill="url(#halo)"/>'
    : '';
  const core = `<circle cx="7" cy="7" r="3.5" fill="${primed ? GOLD : DIM_GLYPH}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14">${halo}${core}</svg>`;
}

/** CTA icons — spark (not primed) / arrow (primed) */
function buildCtaIconSvg(primed: boolean): string {
  const stroke = primed ? GOLD : WIDGET_BG;
  const paths = primed
    ? '<path d="M5 12h13M13 6l6 6-6 6"/>'
    : '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/>';
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
    `<g fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${paths}</g>` +
    '</svg>'
  );
}

/** radial-gradient(120% 90% at 16% 20%, rgba(212,175,55,0.12), transparent 60%) */
function buildAuraSvg(): string {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 344 150" preserveAspectRatio="none">' +
    '<defs><radialGradient id="aura" cx="0.16" cy="0.2" r="0.9">' +
    `<stop offset="0" stop-color="${GOLD}" stop-opacity="0.12"/>` +
    `<stop offset="0.6" stop-color="${GOLD}" stop-opacity="0"/>` +
    '</radialGradient></defs>' +
    '<rect x="0" y="0" width="344" height="150" fill="url(#aura)"/>' +
    '</svg>'
  );
}

function Metric({ value, label, color = GOLD }: { value: string; label: string; color?: string }) {
  return (
    <FlexWidget style={{ flex: 1, alignItems: 'center', flexDirection: 'column' }}>
      <TextWidget
        text={value}
        style={{
          fontFamily: FONT_DISPLAY_SEMIBOLD,
          fontSize: 16,
          color: color as `#${string}`,
          textAlign: 'center',
        }}
      />
      <TextWidget
        text={label}
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 7,
          letterSpacing: 0.85,
          color: SILVER_LABEL,
          textAlign: 'center',
          marginTop: 2,
        }}
      />
    </FlexWidget>
  );
}

export function AnchorMediumWidget({
  primed,
  anchorName,
  sigilSvg,
  anchorTotalSessions,
  anchorDayStreak,
  anchorDeepPrimeSessions,
}: AnchorMediumWidgetProps) {
  const glyphSvg = colorizeAnchorSigilSvg(sigilSvg, primed ? GOLD : DIM_GLYPH) ?? buildGlyphSvg({
    strokeWidth: 5.2,
    stroke: primed ? GOLD : DIM_GLYPH,
    opacity: primed ? 1 : 0.9,
    glow: primed,
  });

  return (
    <OverlapWidget
      clickAction="OPEN_APP"
      accessibilityLabel={primed ? 'Anchor — primed today' : 'Anchor — ready to prime'}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: WIDGET_BG,
        borderRadius: WIDGET_CORNER_RADIUS,
        borderWidth: 1,
        borderColor: primed ? RING_PRIMED : RING_NOT_PRIMED,
        overflow: 'hidden',
      }}
    >
      {primed ? (
        <SvgWidget
          svg={buildAuraSvg()}
          style={{ height: 'match_parent', width: 'match_parent' }}
        />
      ) : null}
      <FlexWidget
        style={{
          height: 'match_parent',
          width: 'match_parent',
          flexDirection: 'column',
          justifyContent: 'space-between',
          paddingTop: 18,
          paddingHorizontal: 18,
          paddingBottom: 16,
        }}
      >
        {/* ── Header: glyph + name + state ── */}
        <FlexWidget
          style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}
        >
          <SvgWidget
            svg={glyphSvg}
            style={{ width: 30, height: 33, marginRight: 13 }}
          />
          <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
            <TextWidget
              text={anchorName}
              maxLines={1}
              truncate="END"
              style={{
                fontFamily: FONT_SERIF_SEMIBOLD,
                fontSize: 23,
                color: BONE,
                letterSpacing: 0.23,
                width: 'match_parent',
              }}
            />
            <FlexWidget
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 5,
              }}
            >
              <SvgWidget
                svg={buildStateDotSvg(primed)}
                style={{ width: 14, height: 14, marginRight: 7 }}
              />
              <TextWidget
                text={primed ? 'PRIMED TODAY' : 'READY TO PRIME'}
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 10,
                  letterSpacing: 1.6,
                  color: primed ? GOLD : MUTED_LABEL,
                }}
              />
            </FlexWidget>
          </FlexWidget>
        </FlexWidget>

        {/* ── This anchor's metrics (practice-wide numbers live on the 4×4) ── */}
        <FlexWidget
          style={{
            width: 'match_parent',
            height: 34,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Metric value={String(anchorTotalSessions)} label="SESSIONS" />
          <FlexWidget style={{ width: 1, height: 24, backgroundColor: '#FFFFFF12' }} />
          <Metric value={String(anchorDayStreak)} label="DAY THREAD" />
          <FlexWidget style={{ width: 1, height: 24, backgroundColor: '#FFFFFF12' }} />
          <Metric value={String(anchorDeepPrimeSessions)} label="DEEP PRIMES" color="#9D74CF" />
        </FlexWidget>

        {/* ── CTA — deep-links to the Practice tab in both states ── */}
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: WIDGET_PRACTICE_DEEP_LINK }}
          accessibilityLabel={primed ? 'Open Focus' : 'Prime Now'}
          style={{
            width: 'match_parent',
            height: 44,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: primed ? '#00000000' : GOLD,
            borderWidth: primed ? 1 : 0,
            borderColor: CTA_BORDER_PRIMED,
          }}
        >
          <TextWidget
            text={primed ? 'OPEN FOCUS' : 'PRIME NOW'}
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 12,
              letterSpacing: 2.16,
              color: primed ? GOLD : WIDGET_BG,
            }}
          />
          <SvgWidget
            svg={buildCtaIconSvg(primed)}
            style={{ width: 14, height: 14, marginLeft: 8 }}
          />
        </FlexWidget>
      </FlexWidget>
    </OverlapWidget>
  );
}
