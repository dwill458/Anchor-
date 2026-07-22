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
import { FlexWidget, OverlapWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
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
  HEAT_FOCUS,
  HEAT_GOLD,
  HEAT_RELEASE,
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
  streak: number;
  threadStrength: number;
  totalSessions: number;
  focusSessions: number;
  deepPrimeSessions: number;
  visualizeSessions: number;
  releaseSessions: number;
  deepPrimePercent: number;
  /** % of the trailing 30 days with a session — identical to the Thread Strength sheet's CONSTANCY stat. */
  constancyPercent: number;
  longestStreak: number;
  sensitivityLabel: string;
  sensitivityNote: string;
  currentWeek: WidgetWeekDay[];
  history: WidgetHistoryDay[];
  /** Local YYYY-MM-DD used as "today" for grid placement */
  today: string;
  /** Launcher-reported widget width (dp) — keeps heatmap cells square instead of stretched. */
  widgetWidth?: number;
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

// The SvgWidget below renders with scaleToFill (a non-uniform stretch), so
// picking a cell size whose grid aspect ratio is close to the actual
// available width keeps cells roughly square instead of visibly stretched.
const MIN_CELL = 13;
const MAX_CELL = 19;
const GAP = 3;
const CELL_RADIUS = 4;
const MONTH_LABEL_HEIGHT = 13;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function heatmapSizing(availableWidth = 320): { cell: number; gridWidth: number; gridHeight: number } {
  const cell = Math.max(
    MIN_CELL,
    Math.min(MAX_CELL, Math.floor((availableWidth - (WIDGET_HISTORY_WEEKS - 1) * GAP) / WIDGET_HISTORY_WEEKS))
  );
  return {
    cell,
    gridWidth: WIDGET_HISTORY_WEEKS * cell + (WIDGET_HISTORY_WEEKS - 1) * GAP,
    gridHeight: MONTH_LABEL_HEIGHT + 7 * cell + 6 * GAP,
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
  const active = Boolean(day.dominantMode) || day.hasFocus || day.hasDeep;
  const modeColor = day.dominantMode === 'focus'
    ? HEAT_FOCUS[3]
    : day.dominantMode === 'visualize'
      ? HEAT_VISUALIZE[3]
      : day.dominantMode === 'release'
        ? HEAT_RELEASE[3]
        : HEAT_GOLD[3];
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
          backgroundColor: active ? modeColor : '#161A1F',
          borderWidth: 1,
          borderColor: day.isToday ? GOLD : active ? modeColor : '#2A2E32',
        }}
      >
        <TextWidget
          text={active ? '✓' : day.isToday ? '·' : '—'}
          style={{
            fontFamily: FONT_DISPLAY_SEMIBOLD,
            fontSize: 8,
            color: active ? WIDGET_BG : GOLD,
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
  const { cell: CELL, gridWidth: GRID_WIDTH, gridHeight: GRID_HEIGHT } = heatmapSizing(availableWidth);
  const todayDate = parseLocalDateString(today);
  if (!todayDate) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID_WIDTH} ${GRID_HEIGHT}"></svg>`;
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
        `<text x="${col * (CELL + GAP)}" y="10" fill="${FAINT_LABEL}" opacity="0.85" ` +
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

      const x = col * (CELL + GAP);
      const y = MONTH_LABEL_HEIGHT + row * (CELL + GAP);
      const day = byDate.get(cellDate);
      const isToday = cellDate === today;

      let fill: string;
      if (isToday) {
        fill = day?.mode === 'visualize'
          ? HEAT_VISUALIZE[day.level || 1]
          : primed ? HEAT_GOLD[3] : HEAT_GOLD[0];
      } else if (day && day.level > 0) {
        const level = day.level as 1 | 2 | 3;
        fill = day.mode === 'visualize'
          ? HEAT_VISUALIZE[level]
          : day.dominantMode === 'focus'
          ? HEAT_FOCUS[level]
          : day.dominantMode === 'visualize'
            ? HEAT_VISUALIZE[level]
            : day.dominantMode === 'release'
              ? HEAT_RELEASE[level]
              : HEAT_GOLD[level];
      } else {
        fill = HEAT_GOLD[0];
      }

      if (isToday && primed) {
        // Glow approximation: soft gold halo + warm inner ring
        rects +=
          `<rect x="${x - 2.5}" y="${y - 2.5}" width="${CELL + 5}" height="${CELL + 5}" rx="${CELL_RADIUS + 1.5}" fill="${GOLD}" opacity="0.38"/>` +
          `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="${CELL_RADIUS}" fill="${fill}" stroke="#FFF0BE" stroke-opacity="0.6" stroke-width="1"/>`;
      } else {
        rects += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="${CELL_RADIUS}" fill="${fill}"/>`;
      }
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 -3 ${GRID_WIDTH + 6} ${GRID_HEIGHT + 6}">` +
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
  streak,
  threadStrength,
  totalSessions,
  focusSessions,
  deepPrimeSessions,
  visualizeSessions,
  releaseSessions,
  deepPrimePercent,
  constancyPercent,
  longestStreak,
  sensitivityLabel,
  sensitivityNote,
  currentWeek,
  history,
  today,
  widgetWidth,
}: AnchorLargeWidgetProps) {
  // 18 (horizontal padding) subtracted twice to account for the card's paddingHorizontal.
  const heatmapContentWidth = widgetWidth ? Math.max(220, widgetWidth - 36) : undefined;
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
          paddingTop: 16,
          paddingHorizontal: 18,
          paddingBottom: 13,
        }}
      >
        {/* ── Header: anchor identity + the same strength signal as the sheet ── */}
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
          <SvgWidget
            svg={glyphSvg}
            style={{ width: 26, height: 29, marginRight: 10 }}
          />
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
            marginTop: 6,
          }}
        >
          <Metric value={String(totalSessions)} label="TOTAL SESSIONS" />
          <FlexWidget style={{ width: 1, height: 19, backgroundColor: '#FFFFFF12' }} />
          <Metric value={`${constancyPercent}%`} label="CONSTANCY" />
          <FlexWidget style={{ width: 1, height: 19, backgroundColor: '#FFFFFF12' }} />
          <Metric value={String(longestStreak)} label="PRIME RECORD" />
          <FlexWidget style={{ width: 1, height: 19, backgroundColor: '#FFFFFF12' }} />
          <Metric value={`${deepPrimePercent}%`} label="DEEP PRIMES" color="#D4AF37" />
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

        <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', marginTop: 5 }}>
          <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <TextWidget
              text="SESSION BREAKDOWN"
              style={{ fontFamily: FONT_DISPLAY, fontSize: 7, letterSpacing: 1.05, color: SILVER_LABEL }}
            />
            <TextWidget
              text={`${deepPrimeSessions} DEEP PRIMES`}
              style={{ fontFamily: FONT_DISPLAY, fontSize: 6.5, letterSpacing: 0.55, color: '#D4AF37' }}
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
            <FlexWidget style={{ flex: Math.max(0.001, deepPrimeSessions), backgroundColor: '#D4AF37' }} />
            <FlexWidget style={{ flex: Math.max(0.001, visualizeSessions), backgroundColor: '#78B4D1' }} />
            <FlexWidget style={{ flex: Math.max(0.001, focusSessions), backgroundColor: '#AD99D2' }} />
            <FlexWidget style={{ flex: Math.max(0.001, releaseSessions), backgroundColor: '#C8875A' }} />
          </FlexWidget>
        </FlexWidget>

        {/* ── Current week rhythm ── */}
        {currentWeek.length === 7 ? (
          <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', marginTop: 5 }}>
            <TextWidget
              text="THIS WEEK"
              style={{ fontFamily: FONT_DISPLAY, fontSize: 7, letterSpacing: 1.05, color: SILVER_LABEL }}
            />
            <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', marginTop: 3 }}>
              {currentWeek.map((day) => <WeekDot key={day.date} day={day} />)}
            </FlexWidget>
          </FlexWidget>
        ) : null}

        {/* ── Session history — flexes to fill whatever room is left on the card ── */}
        <FlexWidget
          style={{
            width: 'match_parent',
            flexDirection: 'column',
            flex: 1,
            height: 0,
            justifyContent: 'flex-start',
            marginTop: 5,
            marginBottom: 5,
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
            svg={buildHeatmapSvg(history, today, primed, heatmapContentWidth)}
            scaleToFill
            style={{ width: 'match_parent', height: 'match_parent' }}
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
            <LegendSwatch color={HEAT_FOCUS[3]} />
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
            <LegendSwatch color={GOLD} marginLeft={15} />
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
