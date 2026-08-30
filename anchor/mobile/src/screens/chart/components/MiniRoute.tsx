import React, { memo, Fragment } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polygon, Rect } from 'react-native-svg';
import { colors } from '@/theme';
import type { WaypointState } from '@/types/chart';
import type { MiniRouteProps, MiniRouteWaypoint } from './courseMapTypes';

const SIZE_CONFIG = {
  small: { dot: 5, gap: 13, stroke: 1.25 },
  medium: { dot: 7, gap: 17, stroke: 1.5 },
} as const;

const GOLD = colors.gold;
const VIOLET = colors.practiceMode.focus.primary;
const AMBER = colors.warning;
const MUTED = 'rgba(255,255,255,0.32)';
const MUTED_LINE = 'rgba(255,255,255,0.14)';

function isTraveled(state: WaypointState): boolean {
  return state === 'REACHED' || state === 'CURRENT' || state === 'BLOCKED';
}

const MiniRouteNode: React.FC<{ state: WaypointState; cx: number; cy: number; dot: number; stroke: number }> = ({
  state,
  cx,
  cy,
  dot,
  stroke,
}) => {
  switch (state) {
    case 'REACHED':
      return <Circle cx={cx} cy={cy} r={dot} fill={GOLD} />;
    case 'CURRENT':
      return <Circle cx={cx} cy={cy} r={dot * 1.15} fill={GOLD} stroke={VIOLET} strokeWidth={stroke * 1.4} />;
    case 'BLOCKED':
      return (
        <Circle cx={cx} cy={cy} r={dot} fill="none" stroke={AMBER} strokeWidth={stroke * 1.4} strokeDasharray={`${dot * 0.6} ${dot * 0.5}`} />
      );
    case 'SKIPPED':
      return (
        <Polygon
          points={`${cx},${cy - dot} ${cx + dot},${cy} ${cx},${cy + dot} ${cx - dot},${cy}`}
          fill="none"
          stroke={MUTED}
          strokeWidth={stroke}
        />
      );
    case 'CANCELLED':
      return (
        <Rect x={cx - dot * 0.8} y={cy - dot * 0.8} width={dot * 1.6} height={dot * 1.6} rx={1.5} fill="none" stroke={MUTED} strokeWidth={stroke} />
      );
    default:
      return <Circle cx={cx} cy={cy} r={dot} fill="none" stroke={MUTED} strokeWidth={stroke} />;
  }
};

/**
 * Compact, decorative progress strip for summary surfaces (Chart summary
 * cards, completed-journey rows, Course details). Props only — no store
 * reads, no navigation, no expensive animation.
 */
const MiniRouteComponent: React.FC<MiniRouteProps> = ({ waypoints, completed = false, size = 'small', testID }) => {
  const { dot, gap, stroke } = SIZE_CONFIG[size];
  const items: MiniRouteWaypoint[] = waypoints.slice(0, 7);
  const count = items.length;
  const width = count > 0 ? (count - 1) * gap + dot * 2 : dot * 2;
  const height = dot * 2.6;
  const cy = height / 2;

  if (count === 0) {
    return (
      <View
        testID={testID}
        style={{ width: dot * 2, height }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    );
  }

  return (
    <View
      testID={testID}
      style={{ width, height }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={width} height={height}>
        {items.map((wp, index) => {
          if (index === 0) return null;
          const prevCx = dot + (index - 1) * gap;
          const cx = dot + index * gap;
          const lit = completed || isTraveled(items[index].state);
          return (
            <Line
              key={`line-${wp.id}`}
              x1={prevCx + dot}
              y1={cy}
              x2={cx - dot}
              y2={cy}
              stroke={lit ? GOLD : MUTED_LINE}
              strokeOpacity={lit ? 0.7 : 1}
              strokeWidth={stroke}
            />
          );
        })}
        {items.map((wp, index) => {
          const cx = dot + index * gap;
          const state: WaypointState = completed ? 'REACHED' : wp.state;
          return (
            <Fragment key={wp.id}>
              <MiniRouteNode state={state} cx={cx} cy={cy} dot={dot} stroke={stroke} />
            </Fragment>
          );
        })}
      </Svg>
    </View>
  );
};

function propsEqual(prev: MiniRouteProps, next: MiniRouteProps): boolean {
  if (prev.completed !== next.completed || prev.size !== next.size) return false;
  if (prev.waypoints.length !== next.waypoints.length) return false;
  return prev.waypoints.every((wp, i) => wp.id === next.waypoints[i]?.id && wp.state === next.waypoints[i]?.state);
}

export const MiniRoute = memo(MiniRouteComponent, propsEqual);
