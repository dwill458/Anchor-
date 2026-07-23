/**
 * AnchorLargeWidget — 4×4 home screen widget.
 *
 * 18-week × 7-day session history heatmap driven by real WidgetSnapshot
 * history (no placeholder data), with the anchor name, Day Thread count,
 * and a Focus / Deep Prime legend.
 *
 * Note: the glyph dims to 0.5 (not 0.9) when unprimed — intentional; the
 * heatmap itself carries the primed signal on this size. Do not "fix".
 */

import React from 'react';
import { FlexWidget, ImageWidget, OverlapWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import {
  addDays,
  localDateString,
  parseLocalDateString,
  startOfIsoWeek,
} from '@/utils/primingAnalytics';
import {
  WIDGET_HISTORY_WEEKS,
  type WidgetHistoryDay,
  type WidgetWeekDay,
} from '../widgetTypes';
import {
  BONE,
  buildGlyphSvg,
  colorizeAnchorSigilSvg,
  DIM_GLYPH,
  FAINT_LABEL,
  FONT_DISPLAY,
  FONT_DISPLAY_SEMIBOLD,
  FONT_SERIF_SEMIBOLD,
  GOLD,
  HEAT_DEEP,
  HEAT_GOLD,
  HEAT_VISUALIZE,
  RING_NOT_PRIMED,
  RING_PRIMED,
  SILVER_LABEL,
  WIDGET_BG,
  WIDGET_CORNER_RADIUS,
} from './widgetPalette';

interface AnchorLargeWidgetProps {
  primed: boolean;
  anchorName: string;
  sigilSvg: string | null;
  /** Final exported/rasterized visual when the selected anchor has one. */
  artworkImageUri: string | null;
  streak: number;
  threadStrength: number;
  totalSessions: number;
  focusSessions: number;
  deepPrimeSessions: number;
  visualizeSessions: number;
  deepPrimePercent: number;
  longestStreak: number;
  sensitivityLabel: string;
  sensitivityNote: string;
  currentWeek: WidgetWeekDay[];
  history: WidgetHistoryDay[];
  /** Local YYYY-MM-DD used as "today" for grid placement */
  today: string;
  /** Launcher-reported dimensions keep spacing stable across Android skins. */
  widgetWidth?: number;
  widgetHeight?: number;
}

/** radial-gradient(120% 60% at 82% -6%, rgba(62,44,91,0.24), transparent 60%) — both states */
function buildPurpleAuraSvg(): string {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 344 344" preserveAspectRatio="none">' +
    '<defs><radialGradient id="aura" cx="0.82" cy="-0.06" r="0.75">' +
    '<stop offset="0" stop-color="#3E2C5B" stop-opacity="0.24"/>' +
    '<stop offset="0.6" stop-color="#3E2C5B" stop-opacity="0"/>' +
    '</radialGradient></defs>' +
    '<rect x="0" y="0" width="344" height="344" fill="url(#aura)"/>' +
    '</svg>'
  );
}

// Keep this aspect ratio close to the dedicated SvgWidget below. Android uses
// FIT_CENTER for SVGs; a tall canvas was shrinking the entire calendar to fit
// vertically and leaving most of the lower card empty.
const MIN_CELL = 13;
const MAX_CELL = 19;
const GAP = 3;
const CELL_RADIUS = 4;
const MONTH_LABEL_HEIGHT = 13;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function heatmapSizing(availableWidth = 320) {
  const cell = Math.max(
    MIN_CELL,
    Math.min(MAX_CELL, Math.floor((availableWidth - (WIDGET_HISTORY_WEEKS - 1) * GAP) / WIDGET_HISTORY_WEEKS))
  );
  return {
    cell,
    width: WIDGET_HISTORY_WEEKS * cell + (WIDGET_HISTORY_WEEKS - 1) * GAP,
    height: MONTH_LABEL_HEIGHT + 7 * cell + 6 * GAP,
  };
}

function buildStrengthRingSvg(value: number): string {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const circumference = 100.53;
  const dashOffset = circumference * (1 - clamped / 100);
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44">' +
    '<circle cx="22" cy="22" r="16" fill="#0D1119" fill-opacity="0.7" stroke="#FFFFFF" stroke-opacity="0.08" stroke-width="3.5"/>' +
    `<circle cx="22" cy="22" r="16" fill="none" stroke="${GOLD}" stroke-opacity="0.95" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}" transform="rotate(-90 22 22)"/>` +
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
          fontSize: 14,
          color: color as `#${string}`,
          textAlign: 'center',
        }}
      />
      <TextWidget
        text={label}
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 6.5,
          letterSpacing: 0.75,
          color: SILVER_LABEL,
          textAlign: 'center',
          marginTop: 2,
        }}
      />
    </FlexWidget>
  );
}

function WeekDot({ day }: { day: WidgetWeekDay }) {
  const active = day.hasFocus || day.hasDeep || day.hasVisualize || day.isToday;
  const modeColor = day.hasVisualize
    ? HEAT_VISUALIZE[2]
    : day.hasDeep
      ? HEAT_DEEP[2]
      : day.hasFocus || day.isToday
        ? HEAT_GOLD[1]
        : HEAT_GOLD[0];
  return (
    <FlexWidget style={{ flex: 1, alignItems: 'center', flexDirection: 'column' }}>
      <TextWidget
        text={day.label.slice(0, 1)}
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 6.5,
          letterSpacing: 0.35,
          color: FAINT_LABEL,
          marginBottom: 3,
        }}
      />
      <FlexWidget
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: modeColor as `#${string}`,
          borderWidth: day.isToday ? 0 : 1,
          borderColor: (day.hasVisualize ? HEAT_VISUALIZE[3] : day.hasDeep ? HEAT_DEEP[3] : '#2A2E32') as `#${string}`,
        }}
      >
        <TextWidget
          text={active ? '✓' : '—'}
          style={{
            fontFamily: FONT_DISPLAY_SEMIBOLD,
            fontSize: 8,
            color: day.isToday ? WIDGET_BG : day.hasVisualize ? BONE : GOLD,
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}

/**
 * Builds the heatmap SVG: columns = ISO weeks (oldest → current), rows =
 * Mon → Sun. Cells are placed by calendar date so partial data ranges and
 * the current partial week land correctly; future days render empty.
 */
export function buildHeatmapSvg(
  history: WidgetHistoryDay[],
  today: string,
  primed: boolean,
  availableWidth?: number
): string {
  const { cell, width: gridWidth, height: gridHeight } = heatmapSizing(availableWidth);
  const todayDate = parseLocalDateString(today);
  if (!todayDate) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${gridWidth} ${gridHeight}"></svg>`;
  }

  const byDate = new Map<string, WidgetHistoryDay>();
  for (const day of history) {
    byDate.set(day.date, day);
  }

  // Grid starts on the Monday (WIDGET_HISTORY_WEEKS - 1) weeks before this week's Monday.
  const gridStart = addDays(startOfIsoWeek(todayDate), -7 * (WIDGET_HISTORY_WEEKS - 1));

  let monthLabels = '';
  let lastMonth = -1;
  for (let col = 0; col < WIDGET_HISTORY_WEEKS; col += 1) {
    const weekStart = addDays(gridStart, col * 7);
    const month = weekStart.getMonth();
    if (month !== lastMonth) {
      monthLabels +=
        `<text x="${col * (cell + GAP)}" y="10" fill="${FAINT_LABEL}" opacity="0.85" ` +
        'font-family="sans-serif" font-size="8" letter-spacing="0.4">' +
        `${MONTHS[month]}</text>`;
    }
    lastMonth = month;
  }

  let rects = '';
  for (let col = 0; col < WIDGET_HISTORY_WEEKS; col += 1) {
    for (let row = 0; row < 7; row += 1) {
      const cellDate = localDateString(addDays(gridStart, col * 7 + row));
      if (cellDate > today) {
        continue; // future days in the current week stay empty
      }

      const x = col * (cell + GAP);
      const y = MONTH_LABEL_HEIGHT + row * (cell + GAP);
      const day = byDate.get(cellDate);
      const isToday = cellDate === today;

      let fill: string;
      if (isToday) {
        fill = day?.mode === 'visualize'
          ? HEAT_VISUALIZE[day.level || 1]
          : day?.mode === 'deep_prime' || (day?.mode == null && day?.deep)
            ? HEAT_DEEP[(day?.level || 1) as 1 | 2 | 3]
            : primed ? HEAT_GOLD[3] : HEAT_GOLD[0];
      } else if (day && day.level > 0) {
        fill = day.mode === 'visualize'
          ? HEAT_VISUALIZE[day.level as 1 | 2 | 3]
          : day.mode === 'deep_prime' || (day.mode == null && day.deep)
            ? HEAT_DEEP[day.level as 1 | 2 | 3]
            : HEAT_GOLD[day.level];
      } else {
        fill = HEAT_GOLD[0];
      }

      if (isToday && primed) {
        // Glow approximation: soft gold halo + warm inner ring
        rects +=
          `<rect x="${x - 2.5}" y="${y - 2.5}" width="${cell + 5}" height="${cell + 5}" rx="${CELL_RADIUS + 1.5}" fill="${fill}" opacity="0.38"/>` +
          `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="${CELL_RADIUS}" fill="${fill}" stroke="#FFF0BE" stroke-opacity="0.6" stroke-width="1"/>`;
      } else {
        rects += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="${CELL_RADIUS}" fill="${fill}"/>`;
      }
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 -3 ${gridWidth + 6} ${gridHeight + 6}">` +
    monthLabels +
    rects +
    '</svg>'
  );
}

function LegendSwatch({ color, marginLeft = 0 }: { color: string; marginLeft?: number }) {
  return (
    <FlexWidget
      style={{
        width: 9,
        height: 9,
        borderRadius: 2.5,
        backgroundColor: color as `#${string}`,
        marginLeft,
      }}
    />
  );
}

export function AnchorLargeWidget({
  primed,
  anchorName,
  sigilSvg,
  artworkImageUri,
  streak,
  threadStrength,
  totalSessions,
  focusSessions,
  deepPrimeSessions,
  visualizeSessions,
  deepPrimePercent,
  longestStreak,
  sensitivityLabel,
  sensitivityNote,
  currentWeek,
  history,
  today,
  widgetWidth,
  widgetHeight,
}: AnchorLargeWidgetProps) {
  const contentWidth = Math.max(1, (widgetWidth ?? 344) - 24);
  const availableHeight = widgetHeight ?? 344;
  // Keep the calendar as the flexible section. The old 118dp floor left the
  // 4×4 card visually empty on launchers that report a compact height.
  const heatmapHeight = Math.max(164, Math.min(232, availableHeight - 176));
  const glyphSvg = colorizeAnchorSigilSvg(sigilSvg, primed ? GOLD : DIM_GLYPH) ?? buildGlyphSvg({
    strokeWidth: 5.4,
    stroke: primed ? GOLD : DIM_GLYPH,
    opacity: primed ? 1 : 0.5,
    glow: primed,
  });

  return (
    <OverlapWidget
      clickAction="OPEN_APP"
      accessibilityLabel={`Anchor session history — ${streak} day thread`}
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
      <SvgWidget
        svg={buildPurpleAuraSvg()}
        style={{ height: 'match_parent', width: 'match_parent' }}
      />
      <FlexWidget
        style={{
          height: 'match_parent',
          width: 'match_parent',
          flexDirection: 'column',
          padding: 12,
        }}
      >
        {/* ── Header: anchor identity + the same strength signal as the sheet ── */}
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
          {artworkImageUri ? (
            <ImageWidget
              image={artworkImageUri as `data:image${string}`}
              imageWidth={34}
              imageHeight={34}
              radius={17}
              resizeMode="contain"
              style={{ width: 34, height: 34, marginRight: 10 }}
            />
          ) : (
            <SvgWidget
              svg={glyphSvg}
              style={{ width: 34, height: 34, marginRight: 10 }}
            />
          )}
          <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
            <TextWidget
              text={anchorName}
              maxLines={1}
              truncate="END"
              style={{
                fontFamily: FONT_SERIF_SEMIBOLD,
                fontSize: 17,
                color: BONE,
                letterSpacing: 0.19,
                width: 'match_parent',
              }}
            />
            <TextWidget
              text="THREAD STRENGTH · PRACTICE, COMPOUNDED"
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 7,
                letterSpacing: 1.1,
                color: FAINT_LABEL,
                marginTop: 3,
              }}
            />
          </FlexWidget>
          <FlexWidget
            style={{ width: 52, alignItems: 'center', flexDirection: 'column', marginRight: 2 }}
          >
            <OverlapWidget style={{ width: 42, height: 42 }}>
              <SvgWidget svg={buildStrengthRingSvg(threadStrength)} style={{ width: 42, height: 42 }} />
              <TextWidget
                text={`${Math.round(threadStrength)}%`}
                style={{
                  fontFamily: FONT_DISPLAY_SEMIBOLD,
                  fontSize: 8.5,
                  color: GOLD,
                  textAlign: 'center',
                  marginTop: 16,
                }}
              />
            </OverlapWidget>
            <TextWidget
              text="THREAD STRENGTH"
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 5.25,
                letterSpacing: 0.45,
                color: SILVER_LABEL,
                marginTop: 2,
                textAlign: 'center',
              }}
            />
          </FlexWidget>
        </FlexWidget>

        {/* ── Four sheet metrics ── */}
        <FlexWidget
          style={{
            width: 'match_parent',
            height: 28,
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 8,
          }}
        >
          <Metric value={String(totalSessions)} label="TOTAL SESSIONS" />
          <FlexWidget style={{ width: 1, height: 19, backgroundColor: '#FFFFFF12' }} />
          <Metric value={String(streak)} label="CONSTANCY" />
          <FlexWidget style={{ width: 1, height: 19, backgroundColor: '#FFFFFF12' }} />
          <Metric value={String(longestStreak)} label="PRIME RECORD" />
          <FlexWidget style={{ width: 1, height: 19, backgroundColor: '#FFFFFF12' }} />
          <Metric value={`${deepPrimePercent}%`} label="DEEP PRIMES" color="#9D74CF" />
        </FlexWidget>

        {/* ── Sensitivity + session breakdown ── */}
        <FlexWidget
          style={{
            width: 'match_parent',
            height: 17,
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 4,
            paddingHorizontal: 8,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: '#D4AF371F',
            backgroundColor: '#D4AF370D',
          }}
        >
          <FlexWidget style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: GOLD, marginRight: 6 }} />
          <TextWidget
            text={`SENSITIVITY: ${sensitivityLabel} · ${sensitivityNote}`}
            maxLines={1}
            truncate="END"
            style={{ fontFamily: FONT_DISPLAY, fontSize: 6.5, letterSpacing: 0.45, color: SILVER_LABEL }}
          />
        </FlexWidget>

        <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', marginTop: 8 }}>
          <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <TextWidget
              text="SESSION BREAKDOWN"
              style={{ fontFamily: FONT_DISPLAY, fontSize: 7, letterSpacing: 1.05, color: SILVER_LABEL }}
            />
            <TextWidget
              text={`${focusSessions} F · ${deepPrimeSessions} D · ${visualizeSessions} V`}
              style={{ fontFamily: FONT_DISPLAY, fontSize: 6.5, letterSpacing: 0.55, color: SILVER_LABEL }}
            />
          </FlexWidget>
          <FlexWidget
            style={{
              width: 'match_parent',
              height: 5,
              flexDirection: 'row',
              marginTop: 3,
              borderRadius: 3,
              overflow: 'hidden',
              backgroundColor: '#FFFFFF0F',
            }}
          >
            <FlexWidget style={{ flex: Math.max(0.001, focusSessions), backgroundColor: '#D4AF37' }} />
            <FlexWidget style={{ flex: Math.max(0.001, deepPrimeSessions), backgroundColor: '#7E58A6' }} />
            <FlexWidget style={{ flex: Math.max(0.001, visualizeSessions), backgroundColor: HEAT_VISUALIZE[3] as `#${string}` }} />
          </FlexWidget>
        </FlexWidget>

        {/* ── Current week rhythm ── */}
        {currentWeek.length === 7 ? (
          <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', marginTop: 8 }}>
            <TextWidget
              text="THIS WEEK"
              style={{ fontFamily: FONT_DISPLAY, fontSize: 7, letterSpacing: 1.05, color: SILVER_LABEL }}
            />
            <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', marginTop: 3 }}>
              {currentWeek.map((day) => <WeekDot key={day.date} day={day} />)}
            </FlexWidget>
          </FlexWidget>
        ) : null}

        {/* ── Session history ── */}
        <FlexWidget
          style={{
            width: 'match_parent',
            flexDirection: 'column',
            height: heatmapHeight,
            justifyContent: 'center',
            marginTop: 8,
            marginBottom: 4,
          }}
        >
          <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <TextWidget
              text="SESSION HISTORY"
              style={{ fontFamily: FONT_DISPLAY, fontSize: 7, letterSpacing: 1.05, color: SILVER_LABEL }}
            />
            <TextWidget
              text={`LAST ${WIDGET_HISTORY_WEEKS} WEEKS`}
              style={{ fontFamily: FONT_DISPLAY, fontSize: 6.5, letterSpacing: 0.55, color: FAINT_LABEL }}
            />
          </FlexWidget>
          <SvgWidget
            svg={buildHeatmapSvg(history, today, primed, contentWidth)}
            scaleToFill
            style={{ width: 'match_parent', height: heatmapHeight - 17 }}
          />
        </FlexWidget>

        {/* ── Legend ── */}
        <FlexWidget
          style={{
            width: 'match_parent',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
            <LegendSwatch color={GOLD} />
            <TextWidget
              text="FOCUS"
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 7,
                letterSpacing: 0.8,
                color: SILVER_LABEL,
                marginLeft: 6,
              }}
            />
            <LegendSwatch color={HEAT_DEEP[3]} marginLeft={15} />
            <TextWidget
              text="DEEP PRIME"
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 7,
                letterSpacing: 0.8,
                color: SILVER_LABEL,
                marginLeft: 6,
              }}
            />
            <LegendSwatch color={HEAT_VISUALIZE[3]} marginLeft={12} />
            <TextWidget
              text="VISUALIZE"
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 7,
                letterSpacing: 0.8,
                color: SILVER_LABEL,
                marginLeft: 6,
              }}
            />
          </FlexWidget>
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextWidget
              text="LESS"
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 6.5,
                letterSpacing: 0.7,
                color: FAINT_LABEL,
                marginRight: 5,
              }}
            />
            <LegendSwatch color={HEAT_GOLD[0]} />
            <LegendSwatch color={HEAT_GOLD[1]} marginLeft={5} />
            <LegendSwatch color={HEAT_GOLD[2]} marginLeft={5} />
            <LegendSwatch color={HEAT_GOLD[3]} marginLeft={5} />
            <TextWidget
              text="MORE"
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 6.5,
                letterSpacing: 0.7,
                color: FAINT_LABEL,
                marginLeft: 5,
              }}
            />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>
    </OverlapWidget>
  );
}
