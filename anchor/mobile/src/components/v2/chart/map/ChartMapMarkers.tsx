import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import {
  MAP_W,
  type ChartMapAnimState,
  type ChartMapMarker,
  type WaypointPlacement,
} from './chartMapContracts';
import { clampCamera } from './chartMapGeometry';
import { getCategoryTextColor } from '@/theme/v2/categories';
import { CHART_MAP_TOKENS } from './chartMapTokens';

const PAPER = CHART_MAP_TOKENS.paper;
const INK = CHART_MAP_TOKENS.ink;

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const f = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(0) + 0.7152 * f(2) + 0.0722 * f(4);
}

/** WCAG contrast ratio of two #RRGGBB colours. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Mix toward ink in 10% steps until 4.5:1 on paper (used when no category name is given). */
function textOnPaper(color: string): string {
  if (contrastRatio(color, PAPER) >= 4.5) return color;
  const ch = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  const c = color.replace('#', '');
  const n = INK.replace('#', '');
  for (let t = 0.1; t <= 1; t += 0.1) {
    const mix = [0, 2, 4].map(i => Math.round(ch(c, i) + (ch(n, i) - ch(c, i)) * t).toString(16).padStart(2, '0')).join('');
    if (contrastRatio('#' + mix, PAPER) >= 4.5) return '#' + mix;
  }
  return INK;
}

/**
 * Numeral colour per marker state. Current: AA text colour on paper (ring stays
 * the raw category colour). Done: paper or ink, whichever contrasts more with
 * the category fill. Upcoming: unchanged.
 */
export function markerNumeralColor(state: 'done' | 'current' | 'upcoming', categoryColor: string, category?: string): string {
  if (state === 'done') return contrastRatio(PAPER, categoryColor) >= contrastRatio(INK, categoryColor) ? PAPER : INK;
  if (state === 'current') return category ? getCategoryTextColor(category, PAPER, INK) : textOnPaper(categoryColor);
  return 'rgba(17,24,32,0.45)';
}
/** Prototype: r30 ring, r52 hit, r44 halo (map units). */
const BASE_R = 30;
const HIT_R = 52;
const HALO_R = 44;
const MIN_TARGET = 44;

type MarkerProps = {
  marker: ChartMapMarker;
  cx: number;
  cy: number;
  ringR: number;
  k: number;
  anim: ChartMapAnimState;
  categoryColor: string;
  category?: string;
  interactive: boolean;
  onPress: (index: number) => void;
};

const Marker = memo(function Marker({ marker, cx, cy, ringR, k, anim, categoryColor, category, interactive, onPress }: MarkerProps) {
  const scale = ringR / BASE_R;
  const hitUnits = HIT_R * scale;
  const d = hitUnits * 2 * k; // px
  const slop = Math.max(0, (MIN_TARGET - d) / 2);
  const { state, selected, index } = marker;

  const stampStyle = useAnimatedStyle(() => ({
    transform: [{ scale: anim.stampIndex.value === index ? 1 + 0.28 * Math.sin(Math.PI * anim.stamp.value) : 1 }],
  }));

  const done = state === 'done';
  const current = state === 'current';
  const fill = done ? categoryColor : PAPER;
  const stroke = done || current ? categoryColor : 'rgba(17,24,32,0.42)';
  const strokeWidth = selected ? 6 : current ? 5 : done ? 3 : 2.5;
  const numeralColor = markerNumeralColor(state, categoryColor, category);

  const content = (
    <>
      <Animated.View style={[styles.fill, stampStyle]} pointerEvents="none">
        <Svg width={d} height={d} viewBox={`${-hitUnits} ${-hitUnits} ${hitUnits * 2} ${hitUnits * 2}`}>
          {current ? (
            <Circle cx={0} cy={0} r={HALO_R * scale} fill="none" stroke={categoryColor} strokeWidth={2} opacity={0.4} />
          ) : null}
          <Circle
            cx={0}
            cy={0}
            r={ringR}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={state === 'upcoming' ? '5 5' : undefined}
          />
        </Svg>
        <View style={styles.numeralWrap} pointerEvents="none">
          <Text
            allowFontScaling={false}
            style={[
              styles.numeral,
              { color: numeralColor, fontSize: 34 * scale * k, lineHeight: 40 * scale * k, marginTop: 2 * scale * k },
            ]}
          >
            {marker.number}
          </Text>
        </View>
      </Animated.View>
    </>
  );
  if (!interactive) {
    return (
      <View
        testID={"chart-map-marker-" + index}
        accessible
        accessibilityRole="image"
        accessibilityLabel={marker.accessibilityLabel}
        style={[styles.marker, { left: cx * k - d / 2, top: cy * k - d / 2, width: d, height: d }]}
      >
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={"chart-map-marker-" + index}
      accessibilityRole="button"
      accessibilityLabel={marker.accessibilityLabel}
      accessibilityState={{ selected }}
      hitSlop={slop > 0 ? { top: slop, bottom: slop, left: slop, right: slop } : undefined}
      onPress={() => onPress(index)}
      style={[styles.marker, { left: cx * k - d / 2, top: cy * k - d / 2, width: d, height: d }]}
    >
      {content}
    </Pressable>
  );
});

/**
 * Fog of war: the waypoint just beyond the current one only hints at itself. No numeral, no title, not
 * tappable, hidden from screen readers. It becomes a real marker when it becomes the current waypoint.
 */
const GhostMarker = memo(function GhostMarker({ cx, cy, ringR, k }: { cx: number; cy: number; ringR: number; k: number }) {
  const scale = ringR / BASE_R;
  const d = HIT_R * scale * 2 * k;
  const units = HIT_R * scale;
  return (
    <View
      testID="chart-map-ghost"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.marker, { left: cx * k - d / 2, top: cy * k - d / 2, width: d, height: d, opacity: 0.4 }]}
    >
      <Svg width={d} height={d} viewBox={`${-units} ${-units} ${units * 2} ${units * 2}`}>
        <Circle cx={0} cy={0} r={ringR} fill="none" stroke="rgba(17,24,32,0.5)" strokeWidth={2.5} strokeDasharray="4 7" />
      </Svg>
    </View>
  );
});

type Props = {
  width: number;
  height: number;
  anim: ChartMapAnimState;
  placement: WaypointPlacement;
  markers: ChartMapMarker[];
  categoryColor: string;
  category?: string;
  interactive?: boolean;
  arrived: boolean;
  onMarkerPress: (index: number) => void;
};

/**
 * RN marker layer. Real Pressables (role, label, TalkBack order 1..N) inside
 * one container that follows the same camera maths as the canvases:
 * translate(tx, ty) scale(s), applied about the container centre.
 */
export const ChartMapMarkers = memo(function ChartMapMarkers({
  width, height, anim, placement, markers, categoryColor, category, interactive = true, arrived, onMarkerPress,
}: Props) {
  const k = width / MAP_W;
  const ordered = useMemo(() => [...markers].sort((a, b) => a.index - b.index), [markers]);
  // Progressive discovery: reached and current waypoints are real; one ghost hints at the next; the rest stay in the fog.
  const currentIndex = useMemo(() => ordered.find(marker => marker.state === 'current')?.index ?? -1, [ordered]);

  const cameraStyle = useAnimatedStyle(() => {
    const s = anim.camera.s.value;
    const c = clampCamera(anim.camera.cx.value, anim.camera.cy.value, s, width, height);
    // Scale about the centre (RN default origin): T' = T + (s - 1) * centre.
    return {
      transform: [
        { translateX: c.tx + ((s - 1) * width) / 2 },
        { translateY: c.ty + ((s - 1) * height) / 2 },
        { scale: s },
      ],
    };
  });

  return (
    <Animated.View style={[{ width, height }, styles.layer, cameraStyle]} pointerEvents="box-none">
      {ordered.map(marker => {
        const p = placement.points[marker.index];
        if (!p) return null;
        if (marker.state === 'upcoming') {
          if (arrived || currentIndex < 0 || marker.index !== currentIndex + 1) return null;
          return <GhostMarker key={marker.id} cx={p.x} cy={p.y} ringR={placement.markerRadius} k={k} />;
        }
        return (
          <Marker
            key={marker.id}
            marker={marker}
            cx={p.x}
            cy={p.y}
            ringR={placement.markerRadius}
            k={k}
            anim={anim}
            categoryColor={categoryColor}
            category={category}
            interactive={interactive}
            onPress={onMarkerPress}
          />
        );
      })}
      {arrived ? (
        <View
          testID="chart-map-summit"
          accessible
          accessibilityRole="image"
          accessibilityLabel="Destination reached"
          pointerEvents="none"
          style={[
            styles.marker,
            { left: placement.summit.x * k - 24, top: placement.summit.y * k - 24, width: 48, height: 48 },
          ]}
        />
      ) : null}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, top: 0 },
  marker: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  fill: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  numeralWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  numeral: { fontFamily: CHART_MAP_TOKENS.serif, textAlign: 'center', includeFontPadding: false },
});
