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
import { WIDGET_HISTORY_WEEKS, type WidgetHistoryDay } from '../widgetTypes';
import {
  BONE,
  buildGlyphSvg,
  FAINT_LABEL,
  FONT_DISPLAY,
  FONT_DISPLAY_SEMIBOLD,
  FONT_SERIF_SEMIBOLD,
  GOLD,
  HEAT_DEEP,
  HEAT_GOLD,
  RING_NOT_PRIMED,
  RING_PRIMED,
  SILVER_LABEL,
  WIDGET_BG,
  WIDGET_CORNER_RADIUS,
} from './widgetPalette';

interface AnchorLargeWidgetProps {
  primed: boolean;
  anchorName: string;
  streak: number;
  history: WidgetHistoryDay[];
  /** Local YYYY-MM-DD used as "today" for grid placement */
  today: string;
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

const CELL = 9;
const GAP = 3;
const CELL_RADIUS = 2.5;
const GRID_WIDTH = WIDGET_HISTORY_WEEKS * CELL + (WIDGET_HISTORY_WEEKS - 1) * GAP;
const GRID_HEIGHT = 7 * CELL + 6 * GAP;

/**
 * Builds the heatmap SVG: columns = ISO weeks (oldest → current), rows =
 * Mon → Sun. Cells are placed by calendar date so partial data ranges and
 * the current partial week land correctly; future days render empty.
 */
export function buildHeatmapSvg(
  history: WidgetHistoryDay[],
  today: string,
  primed: boolean
): string {
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

  let rects = '';
  for (let col = 0; col < WIDGET_HISTORY_WEEKS; col += 1) {
    for (let row = 0; row < 7; row += 1) {
      const cellDate = localDateString(addDays(gridStart, col * 7 + row));
      if (cellDate > today) {
        continue; // future days in the current week stay empty
      }

      const x = col * (CELL + GAP);
      const y = row * (CELL + GAP);
      const day = byDate.get(cellDate);
      const isToday = cellDate === today;

      let fill: string;
      if (isToday) {
        // Spec: today's cell is level-3 gold when primed, empty when not —
        // regardless of raw session counts.
        fill = primed ? HEAT_GOLD[3] : HEAT_GOLD[0];
      } else if (day && day.level > 0) {
        fill = day.deep ? HEAT_DEEP[day.level as 1 | 2 | 3] : HEAT_GOLD[day.level];
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
  streak,
  history,
  today,
}: AnchorLargeWidgetProps) {
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
          paddingTop: 20,
          paddingHorizontal: 20,
          paddingBottom: 17,
        }}
      >
        {/* ── Header: glyph · name/subtitle · Day Thread count ── */}
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
          <SvgWidget
            svg={buildGlyphSvg({
              strokeWidth: 5.4,
              stroke: GOLD,
              opacity: primed ? 1 : 0.5,
              glow: primed,
            })}
            style={{ width: 30, height: 33, marginRight: 12 }}
          />
          <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
            <TextWidget
              text={anchorName}
              maxLines={1}
              truncate="END"
              style={{
                fontFamily: FONT_SERIF_SEMIBOLD,
                fontSize: 19,
                color: BONE,
                letterSpacing: 0.19,
                width: 'match_parent',
              }}
            />
            <TextWidget
              text={`SESSION HISTORY · LAST ${WIDGET_HISTORY_WEEKS} WEEKS`}
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 8.5,
                letterSpacing: 1.7,
                color: FAINT_LABEL,
                marginTop: 3,
              }}
            />
          </FlexWidget>
          <FlexWidget style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
            <TextWidget
              text={String(streak)}
              style={{
                fontFamily: FONT_DISPLAY_SEMIBOLD,
                fontSize: 22,
                color: GOLD,
                textAlign: 'right',
              }}
            />
            <TextWidget
              text="DAY THREAD"
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 8,
                letterSpacing: 1.28,
                color: FAINT_LABEL,
                marginTop: 3,
              }}
            />
          </FlexWidget>
        </FlexWidget>

        {/* ── Heatmap ── */}
        <FlexWidget
          style={{
            width: 'match_parent',
            flex: 1,
            flexDirection: 'column',
            justifyContent: 'center',
            marginTop: 15,
            marginBottom: 12,
          }}
        >
          <SvgWidget
            svg={buildHeatmapSvg(history, today, primed)}
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
            <LegendSwatch color={GOLD} />
            <TextWidget
              text="FOCUS"
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 8.5,
                letterSpacing: 1.19,
                color: SILVER_LABEL,
                marginLeft: 6,
              }}
            />
            <LegendSwatch color={HEAT_DEEP[3]} marginLeft={15} />
            <TextWidget
              text="DEEP PRIME"
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 8.5,
                letterSpacing: 1.19,
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
                fontSize: 8,
                letterSpacing: 0.96,
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
                fontSize: 8,
                letterSpacing: 0.96,
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
