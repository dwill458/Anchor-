import React, { memo, useEffect } from 'react';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { Path } from 'react-native-svg';
import { colors } from '@/theme';
import { segmentPath, type SegmentGeometry } from './courseMapGeometry';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const ILLUMINATE_DURATION_MS = 600;

export type RouteSegmentVariant = 'reached' | 'current' | 'upcoming' | 'blocked' | 'destinationReached' | 'destinationUpcoming';

const GOLD = colors.gold;
const VIOLET = colors.practiceMode.focus.primary;
const AMBER = colors.warning;
const MUTED = 'rgba(255,255,255,0.14)';

function strokeFor(variant: RouteSegmentVariant): string {
  switch (variant) {
    case 'reached':
    case 'destinationReached':
      return GOLD;
    case 'current':
      return VIOLET;
    case 'blocked':
      return AMBER;
    default:
      return MUTED;
  }
}

function opacityFor(variant: RouteSegmentVariant): number {
  switch (variant) {
    case 'reached':
      return 0.85;
    case 'current':
      return 0.9;
    case 'blocked':
      return 0.7;
    case 'destinationReached':
      return 0.6;
    case 'destinationUpcoming':
      return 0.22;
    default:
      return 0.28;
  }
}

function dashArrayFor(variant: RouteSegmentVariant): string | undefined {
  if (variant === 'upcoming' || variant === 'destinationUpcoming') return '2 10';
  if (variant === 'blocked') return '6 6';
  return undefined;
}

export type RouteSegmentProps = {
  segment: Pick<SegmentGeometry, 'x1' | 'y1' | 'x2' | 'y2' | 'controlX' | 'controlY'>;
  variant: RouteSegmentVariant;
  strokeWidth?: number;
  /** One-shot illumination fade-in, used only during a committed advancement. */
  illuminating?: boolean;
  reducedMotion?: boolean;
  testID?: string;
};

const RouteSegmentComponent: React.FC<RouteSegmentProps> = ({
  segment,
  variant,
  strokeWidth = 3,
  illuminating = false,
  reducedMotion = false,
  testID,
}) => {
  const targetOpacity = opacityFor(variant);
  const fadeProgress = useSharedValue(1);

  useEffect(() => {
    if (!illuminating || reducedMotion) {
      fadeProgress.value = 1;
      return;
    }
    fadeProgress.value = 0.15;
    fadeProgress.value = withTiming(1, { duration: ILLUMINATE_DURATION_MS });
  }, [illuminating, reducedMotion, fadeProgress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeOpacity: targetOpacity * fadeProgress.value,
  }));

  if (!illuminating) {
    return (
      <Path
        testID={testID}
        d={segmentPath(segment)}
        stroke={strokeFor(variant)}
        strokeOpacity={targetOpacity}
        strokeWidth={variant === 'current' || variant === 'reached' ? strokeWidth : strokeWidth * 0.75}
        strokeDasharray={dashArrayFor(variant)}
        strokeLinecap="round"
        fill="none"
      />
    );
  }

  return (
    <AnimatedPath
      testID={testID}
      d={segmentPath(segment)}
      stroke={strokeFor(variant)}
      animatedProps={animatedProps}
      strokeWidth={strokeWidth}
      strokeDasharray={dashArrayFor(variant)}
      strokeLinecap="round"
      fill="none"
    />
  );
};

function propsEqual(prev: RouteSegmentProps, next: RouteSegmentProps): boolean {
  return (
    prev.variant === next.variant &&
    prev.strokeWidth === next.strokeWidth &&
    prev.illuminating === next.illuminating &&
    prev.reducedMotion === next.reducedMotion &&
    prev.segment.x1 === next.segment.x1 &&
    prev.segment.y1 === next.segment.y1 &&
    prev.segment.x2 === next.segment.x2 &&
    prev.segment.y2 === next.segment.y2 &&
    prev.segment.controlX === next.segment.controlX &&
    prev.segment.controlY === next.segment.controlY
  );
}

export const RouteSegment = memo(RouteSegmentComponent, propsEqual);
