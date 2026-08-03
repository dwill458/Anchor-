import React, { memo, useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ban, Circle, CircleCheckBig, SkipForward, TriangleAlert } from 'lucide-react-native';
import { colors, typography } from '@/theme';
import type { WaypointSummary } from '@/types/chart';
import type { WaypointEmphasis } from './courseMapLayout';
import { CurrentWaypointHalo } from './CurrentWaypointHalo';

const SETTLE_DURATION_MS = 480;

/**
 * One-shot (non-repeating) settle-in used only during the ~1s advancement
 * window. This is transient, not the map's continuous animation budget item
 * — that's CurrentWaypointHalo's breathing loop.
 */
const useSettleStyle = (isSettling: boolean, reducedMotion: boolean) => {
  const progress = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) {
      progress.value = 1;
      return;
    }
    if (isSettling) {
      progress.value = 0;
      progress.value = withTiming(1, { duration: SETTLE_DURATION_MS });
    }
  }, [isSettling, reducedMotion, progress]);

  return useAnimatedStyle(() => ({
    opacity: 0.55 + progress.value * 0.45,
    transform: [{ scale: 0.9 + progress.value * 0.1 }],
  }));
};

const DOMINANT_SIZE = 60;
const REACHED_SIZE = 40;
const SUBDUED_SIZE = 34;
const MIN_HIT_TARGET = 44;

const AMBER = colors.warning;

function nodeSize(emphasis: WaypointEmphasis): number {
  if (emphasis === 'dominant') return DOMINANT_SIZE;
  if (emphasis === 'reached') return REACHED_SIZE;
  return SUBDUED_SIZE;
}

const NodeGlyph: React.FC<{ waypoint: WaypointSummary; emphasis: WaypointEmphasis; iconSize: number }> = ({
  waypoint,
  emphasis,
  iconSize,
}) => {
  switch (waypoint.state) {
    case 'REACHED':
      return <CircleCheckBig size={iconSize} color={colors.gold} strokeWidth={2.25} />;
    case 'BLOCKED':
      return <TriangleAlert size={iconSize} color={AMBER} strokeWidth={2.25} />;
    case 'SKIPPED':
      return <SkipForward size={iconSize} color={colors.text.tertiary} strokeWidth={2} />;
    case 'CANCELLED':
      return <Ban size={iconSize} color={colors.text.tertiary} strokeWidth={2} />;
    case 'CURRENT':
      return <Circle size={iconSize} color={colors.navy} fill={colors.gold} strokeWidth={0} />;
    default:
      return (
        <Circle
          size={iconSize}
          color={emphasis === 'subdued' ? colors.text.disabled : colors.text.tertiary}
          strokeWidth={2}
        />
      );
  }
};

function nodeFillStyle(waypoint: WaypointSummary, isDominant: boolean) {
  if (isDominant && waypoint.state === 'BLOCKED') {
    return { backgroundColor: 'rgba(255,193,7,0.14)', borderColor: `${AMBER}66` };
  }
  if (isDominant) {
    return { backgroundColor: 'rgba(212,175,55,0.16)', borderColor: `${colors.gold}88` };
  }
  switch (waypoint.state) {
    case 'REACHED':
      return { backgroundColor: 'rgba(212,175,55,0.1)', borderColor: 'rgba(212,175,55,0.32)' };
    case 'SKIPPED':
    case 'CANCELLED':
      return { backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.08)' };
    default:
      return { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.12)' };
  }
}

export type WaypointNodeProps = {
  waypoint: WaypointSummary;
  emphasis: WaypointEmphasis;
  isDominant: boolean;
  labelSide: 'left' | 'right';
  reducedMotion: boolean;
  onPress: (waypointId: string) => void;
  /** Position in the CourseMap's logical viewBox, and that viewBox's size. */
  x: number;
  y: number;
  mapWidth: number;
  mapHeight: number;
  /** true only while this node is the subject of a just-committed advancement. */
  isSettling?: boolean;
  testID?: string;
};

const WaypointNodeComponent: React.FC<WaypointNodeProps> = ({
  waypoint,
  emphasis,
  isDominant,
  labelSide,
  reducedMotion,
  onPress,
  x,
  y,
  mapWidth,
  mapHeight,
  isSettling = false,
  testID,
}) => {
  const size = nodeSize(emphasis);
  const iconSize = Math.round(size * 0.44);
  const hitTarget = Math.max(MIN_HIT_TARGET, size);
  const fill = nodeFillStyle(waypoint, isDominant);
  const showHalo = isDominant && waypoint.state !== 'BLOCKED';
  const anchorAvailable = waypoint.anchorLink?.anchorAvailable === true;
  const leftPct = `${(x / mapWidth) * 100}%` as const;
  const topPct = `${(y / mapHeight) * 100}%` as const;

  const handlePress = useCallback(() => {
    onPress(waypoint.id);
  }, [onPress, waypoint.id]);

  const settleStyle = useSettleStyle(isSettling, reducedMotion);

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      hitSlop={Math.max(0, (hitTarget - size) / 2)}
      style={[
        styles.hitWrapper,
        {
          left: leftPct,
          top: topPct,
          width: hitTarget,
          height: hitTarget,
          transform: [{ translateX: -hitTarget / 2 }, { translateY: -hitTarget / 2 }],
        },
      ]}
    >
      {showHalo ? (
        <CurrentWaypointHalo size={size + 24} reducedMotion={reducedMotion} settling={isSettling} />
      ) : null}
      <Animated.View
        style={[
          styles.node,
          { width: size, height: size, borderRadius: size / 2 },
          fill,
          isDominant && styles.nodeDominant,
          isSettling && settleStyle,
        ]}
      >
        <NodeGlyph waypoint={waypoint} emphasis={emphasis} iconSize={iconSize} />
      </Animated.View>
      {isDominant ? (
        <View style={[styles.pill, labelSide === 'right' ? styles.pillRight : styles.pillLeft]}>
          <Text style={[styles.pillText, waypoint.state === 'BLOCKED' && styles.pillTextBlocked]} numberOfLines={1}>
            {waypoint.state === 'BLOCKED' ? 'BLOCKED' : 'CURRENT'}
          </Text>
        </View>
      ) : null}
      <View style={[styles.label, labelSide === 'right' ? styles.labelRight : styles.labelLeft]} pointerEvents="none">
        <Text
          style={[styles.labelText, isDominant && styles.labelTextDominant]}
          numberOfLines={isDominant ? 2 : 1}
        >
          {waypoint.title}
        </Text>
        {waypoint.anchorLink ? (
          <View style={[styles.anchorDot, { backgroundColor: anchorAvailable ? colors.gold : colors.text.disabled }]} />
        ) : null}
      </View>
    </Pressable>
  );
};

function propsEqual(prev: WaypointNodeProps, next: WaypointNodeProps): boolean {
  return (
    prev.waypoint.id === next.waypoint.id &&
    prev.waypoint.state === next.waypoint.state &&
    prev.waypoint.title === next.waypoint.title &&
    prev.waypoint.blockedReason === next.waypoint.blockedReason &&
    prev.waypoint.anchorLink?.anchorAvailable === next.waypoint.anchorLink?.anchorAvailable &&
    prev.emphasis === next.emphasis &&
    prev.isDominant === next.isDominant &&
    prev.labelSide === next.labelSide &&
    prev.reducedMotion === next.reducedMotion &&
    prev.onPress === next.onPress &&
    prev.isSettling === next.isSettling &&
    prev.x === next.x &&
    prev.y === next.y &&
    prev.mapWidth === next.mapWidth &&
    prev.mapHeight === next.mapHeight
  );
}

export const WaypointNode = memo(WaypointNodeComponent, propsEqual);

const styles = StyleSheet.create({
  hitWrapper: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  node: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  nodeDominant: {
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  pill: {
    position: 'absolute',
    top: -18,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(15,20,25,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.4)',
  },
  pillRight: { left: '50%', transform: [{ translateX: -20 }] },
  pillLeft: { left: '50%', transform: [{ translateX: -20 }] },
  pillText: { ...typography.caption, fontSize: 9, letterSpacing: 1, color: colors.gold },
  pillTextBlocked: { color: colors.warning },
  label: { position: 'absolute', top: '100%', width: 118, marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  labelRight: { left: '50%', marginLeft: -12 },
  labelLeft: { right: '50%', marginRight: -12, justifyContent: 'flex-end' },
  labelText: { ...typography.caption, color: colors.text.secondary, flexShrink: 1 },
  labelTextDominant: { ...typography.caption, fontFamily: typography.fonts.bodyBold, color: colors.text.primary, fontSize: 13 },
  anchorDot: { width: 5, height: 5, borderRadius: 2.5 },
});
