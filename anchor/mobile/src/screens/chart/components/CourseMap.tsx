import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg from 'react-native-svg';
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
}) => {
  const { geometry, nodes } = useMemo(
    () => buildCourseMapLayout(waypoints, currentWaypointId),
    [waypoints, currentWaypointId],
  );

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

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.container, { aspectRatio: Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1 }]}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${geometry.width} ${geometry.height}`} style={StyleSheet.absoluteFill}>
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
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
  },
});
