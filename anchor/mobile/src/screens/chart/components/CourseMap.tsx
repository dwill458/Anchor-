import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import type { WaypointState } from '@/types/chart';
import { buildCourseMapLayout } from './courseMapLayout';
import { RouteSegment, type RouteSegmentVariant } from './RouteSegment';
import { WaypointNode } from './WaypointNode';
import { DestinationMarker } from './DestinationMarker';
import { resolveSafeAdvancement, useCourseMapAdvancement } from './useCourseMapAnimation';
import type { CourseMapProps } from './courseMapTypes';

function segmentVariantForTargetState(state: WaypointState): RouteSegmentVariant {
  switch (state) {
    case 'REACHED':
      return 'reached';
    case 'CURRENT':
      return 'current';
    case 'BLOCKED':
      return 'blocked';
    default:
      return 'upcoming';
  }
}

function safeDestinationText(destinationText: string): string | null {
  const trimmed = typeof destinationText === 'string' ? destinationText.trim() : '';
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * The decorative visual route map. Fully prop-driven — no store reads, no
 * API calls, no derivation of authoritative lifecycle state. The linear
 * waypoint list rendered elsewhere on ChartHome remains the accessible
 * comprehension surface; this entire tree is hidden from assistive tech.
 */
export const CourseMap: React.FC<CourseMapProps> = ({
  destinationText,
  waypoints,
  currentWaypointId,
  completed,
  reducedMotion = false,
  onWaypointPress,
  advancement,
  orientation = 'vertical',
}) => {
  const { geometry, nodes } = useMemo(
    () => buildCourseMapLayout(waypoints, currentWaypointId, orientation),
    [waypoints, currentWaypointId, orientation],
  );
  const scrollRef = useRef<ScrollView>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  useEffect(() => {
    if (orientation !== 'horizontal') return;
    const current = nodes.find((node) => node.waypoint.id === currentWaypointId);
    if (!current) return;
    scrollRef.current?.scrollTo({ x: Math.max(0, current.x - (viewportWidth || 350) / 2), animated: false });
  }, [currentWaypointId, nodes, orientation, viewportWidth]);

  // Blocked destinations never animate — guard before the animation hook
  // ever sees the trigger, so no replay/partial-animate path exists for it.
  const safeAdvancement = resolveSafeAdvancement(advancement, waypoints);

  const { isAdvancing, completedWaypointId, nextWaypointId, courseCompleted } = useCourseMapAdvancement(
    safeAdvancement,
    reducedMotion,
  );

  const destText = safeDestinationText(destinationText);
  const aspectRatio = geometry.width / geometry.height;

  const illuminateDestinationSegment =
    isAdvancing && courseCompleted && nextWaypointId === null && geometry.destinationSegment
      ? nodes[nodes.length - 1]?.waypoint.id === completedWaypointId
      : false;

  const canvas = (
    <View
      style={orientation === 'horizontal'
        ? [styles.horizontalCanvas, { width: geometry.width }]
        : [styles.container, { aspectRatio: Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1 }]}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${geometry.width} ${geometry.height}`} style={StyleSheet.absoluteFill}>
        {orientation === 'horizontal' ? (
          <>
            <Path d="M 0 62 Q 330 28 680 56" stroke="rgba(155,130,212,0.08)" strokeWidth="1" fill="none" />
            <Path d="M 0 154 Q 310 182 680 144" stroke="rgba(212,175,55,0.06)" strokeWidth="1" fill="none" />
            <Path d="M 0 94 Q 330 70 680 92" stroke="rgba(255,255,255,0.05)" strokeWidth="1" fill="none" />
            {[{ x: 72, y: 48 }, { x: 146, y: 26 }, { x: 258, y: 52 }, { x: 398, y: 28 }, { x: 548, y: 42 }, { x: 652, y: 76 }].map((star) => (
              <Circle key={`${star.x}-${star.y}`} cx={star.x} cy={star.y} r="1.2" fill="rgba(245,240,232,0.22)" />
            ))}
          </>
        ) : null}
        {geometry.segments.map((segment) => {
          const toNode = nodes[segment.toIndex ?? -1];
          const variant = toNode ? segmentVariantForTargetState(toNode.waypoint.state) : 'upcoming';
          const illuminating =
            isAdvancing &&
            !!toNode &&
            nodes[segment.fromIndex]?.waypoint.id === completedWaypointId &&
            toNode.waypoint.id === nextWaypointId;
          return (
            <RouteSegment
              key={`segment-${segment.fromIndex}-${segment.toIndex}`}
              segment={segment}
              variant={variant}
              strokeWidth={orientation === 'horizontal' ? 1.6 : undefined}
              illuminating={illuminating}
              reducedMotion={reducedMotion}
            />
          );
        })}
        {geometry.destinationSegment ? (
          <RouteSegment
            key="segment-destination"
            segment={geometry.destinationSegment}
            variant={completed ? 'destinationReached' : 'destinationUpcoming'}
            strokeWidth={orientation === 'horizontal' ? 1.6 : undefined}
            illuminating={illuminateDestinationSegment}
            reducedMotion={reducedMotion}
          />
        ) : null}
      </Svg>

      {nodes.map((node) => (
        <WaypointNode
          key={node.waypoint.id}
          waypoint={node.waypoint}
          emphasis={node.emphasis}
          isDominant={node.isDominant}
          labelSide={node.labelSide}
          reducedMotion={reducedMotion}
          onPress={onWaypointPress}
          x={node.x}
          y={node.y}
          mapWidth={geometry.width}
          mapHeight={geometry.height}
          horizontal={orientation === 'horizontal'}
          isSettling={isAdvancing && (node.waypoint.id === completedWaypointId || node.waypoint.id === nextWaypointId)}
          testID={`course-map-waypoint-${node.waypoint.id}`}
        />
      ))}

      <DestinationMarker
        destinationText={destText}
        x={geometry.destination.x}
        y={geometry.destination.y}
        mapWidth={geometry.width}
        mapHeight={geometry.height}
        completed={completed}
        reducedMotion={reducedMotion}
        testID="course-map-destination"
      />
    </View>
  );

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
      style={orientation === 'horizontal' ? styles.horizontalViewport : undefined}
    >
      {orientation === 'horizontal' ? (
        <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalContent}>
          {canvas}
        </ScrollView>
      ) : canvas}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
  },
  horizontalViewport: { width: '100%', height: 196, overflow: 'hidden' },
  horizontalContent: { minWidth: 680 },
  horizontalCanvas: { width: 680, height: 196, position: 'relative' },
});
