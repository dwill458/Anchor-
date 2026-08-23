/**
 * WeaveCanvas — the shared rendering of The Weave, used by both the Anchor
 * Detail preview and the full Weave screen.
 *
 * The entrance is a direct port of the reference weave's CSS stagger: each
 * thread segment fades in independently, left → right, and every node blooms
 * shortly after the thread beneath it arrives — no shared wipe or mask, just
 * per-element timing, matching the reference exactly:
 *
 *   `.wv-line`   lineIn 640ms cubic-bezier(.22,1,.36,1), 120 + t*620ms
 *   `.wv-node`   nodeIn 300ms ease-out,                  380 + t*620ms
 *   `.wv-recent` pulseOnce 1600ms ease-in-out, 1400ms delay
 *
 * Under reduced motion — or when the node count would make per-node
 * animation expensive — the weave renders in its final state immediately.
 */
import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { PracticeMode } from '@/types/practice';
import type { WeaveNode } from './weaveData';
import type { WeaveGeometry, WeaveNodePosition, WeaveSegment } from './weaveGeometry';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Reference stagger, in milliseconds. */
const SWEEP_START = 120;
const SWEEP_TRAVEL = 620;
const LINE_DURATION = 640;
const NODE_LEAD = 260;
const NODE_DURATION = 300;
const PULSE_DELAY = 1400;
const PULSE_DURATION = 800;
/** Above this many nodes the bloom is dropped and the sweep carries the reveal. */
const MAX_ANIMATED_NODES = 48;

export interface WeaveCanvasProps {
  width: number;
  height: number;
  geometry: WeaveGeometry;
  nodes: readonly WeaveNode[];
  modeColors: Record<PracticeMode, string>;
  /** Painted behind each thread so crossings read as over/under. */
  backgroundColor: string;
  selectedNodeId?: string | null;
  /** Changing this replays the entrance (scope or range switches). */
  animationKey?: string;
  still?: boolean;
}

const NodeMark: React.FC<{
  position: WeaveNodePosition;
  color: string;
  selected: boolean;
  notable: boolean;
  still: boolean;
  animationKey: string;
}> = ({ position, color, selected, notable, still, animationKey }) => {
  const bloom = useSharedValue(still ? 1 : 0);
  const pulse = useSharedValue(1);
  // Flashes bright the instant the wavefront reaches this node, like a
  // strike landing, then burns off while the mark settles to its bloom.
  const spark = useSharedValue(0);
  const delay = SWEEP_START + NODE_LEAD + position.travel * SWEEP_TRAVEL;

  useEffect(() => {
    if (still) {
      bloom.value = 1;
      pulse.value = 1;
      spark.value = 0;
      return undefined;
    }
    bloom.value = 0;
    spark.value = 0;
    // A gentle overshoot past full size sells the "struck" pop before the
    // mark relaxes to its resting bloom.
    bloom.value = withDelay(
      delay,
      withSequence(
        withTiming(1.1, { duration: NODE_DURATION * 0.6, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: NODE_DURATION * 0.4, easing: Easing.inOut(Easing.quad) }),
      ),
    );
    spark.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: 80, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) }),
      ),
    );
    if (position.latest) {
      pulse.value = withDelay(
        PULSE_DELAY,
        withSequence(
          withTiming(0.35, { duration: PULSE_DURATION * 0.44, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: PULSE_DURATION * 0.56, easing: Easing.inOut(Easing.quad) }),
        ),
      );
    }
    return () => {
      cancelAnimation(bloom);
      cancelAnimation(pulse);
      cancelAnimation(spark);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationKey, delay, position.latest, still]);

  // nodeIn scales from 0.5; animating the radius reads the same on an SVG
  // circle and avoids a transform-origin round trip.
  const markProps = useAnimatedProps(() => ({
    r: position.radius * (0.5 + 0.5 * bloom.value),
    opacity: Math.min(1, bloom.value) * pulse.value,
  }));
  const glowProps = useAnimatedProps(() => ({
    r: (position.radius + (selected ? 6 : 4)) * (0.5 + 0.5 * Math.min(1, bloom.value)),
    opacity: Math.min(1, bloom.value) * (selected ? 0.28 : 0.16),
  }));
  const sparkProps = useAnimatedProps(() => ({
    r: position.radius + 2 + spark.value * 7,
    opacity: spark.value * 0.65,
  }));

  return (
    <>
      {(notable || selected) && (
        <AnimatedCircle
          animatedProps={glowProps}
          cx={position.left}
          cy={position.top}
          fill={color}
        />
      )}
      <AnimatedCircle
        animatedProps={markProps}
        cx={position.left}
        cy={position.top}
        fill={selected ? '#F4EFE6' : color}
        stroke={selected ? color : undefined}
        strokeWidth={selected ? 1.5 : 0}
      />
      <AnimatedCircle animatedProps={sparkProps} cx={position.left} cy={position.top} fill="#FFF7E6" />
    </>
  );
};

/** One thread chunk — fades in on its own delay, matching `.wv-line` exactly. */
const SegmentMark: React.FC<{
  segment: WeaveSegment;
  color: string;
  backgroundColor: string;
  still: boolean;
  animationKey: string;
}> = ({ segment, color, backgroundColor, still, animationKey }) => {
  const reveal = useSharedValue(still ? 1 : 0);
  const delay = SWEEP_START + segment.travel * SWEEP_TRAVEL;

  useEffect(() => {
    if (still) {
      reveal.value = 1;
      return undefined;
    }
    reveal.value = 0;
    reveal.value = withDelay(
      delay,
      withTiming(1, { duration: LINE_DURATION, easing: Easing.bezier(0.22, 1, 0.36, 1) }),
    );
    return () => cancelAnimation(reveal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationKey, delay, still]);

  const haloProps = useAnimatedProps(() => ({ strokeOpacity: 0.94 * reveal.value }));
  const lineProps = useAnimatedProps(() => ({ strokeOpacity: segment.opacity * reveal.value }));

  return (
    <>
      <AnimatedPath
        d={segment.haloPath}
        stroke={backgroundColor}
        animatedProps={haloProps}
        strokeWidth={segment.strokeWidth + 3.4}
        fill="none"
      />
      <AnimatedPath
        d={segment.path}
        stroke={color}
        animatedProps={lineProps}
        strokeWidth={segment.strokeWidth}
        strokeLinecap="round"
        fill="none"
      />
    </>
  );
};

export const WeaveCanvas: React.FC<WeaveCanvasProps> = ({
  width,
  height,
  geometry,
  nodes,
  modeColors,
  backgroundColor,
  selectedNodeId = null,
  animationKey = 'weave',
  still = false,
}) => {
  // Under-passes are laid down complete — backing strokes, then lines — before
  // the over-passes go on top. Within a pass no backing stroke is ever painted
  // after a line, so a joint can never be cut out of a thread.
  const passes = useMemo(() => {
    const all = geometry.strands.flatMap((strand) => strand.segments);
    return [0, 1].map((layer) =>
      all.filter((segment) => segment.layer === layer).sort((left, right) => left.travel - right.travel),
    );
  }, [geometry.strands]);
  const animateNodes = !still && nodes.length <= MAX_ANIMATED_NODES;

  return (
    <View style={{ width, height }} accessible={false}>
      <Svg width={width} height={height} accessible={false}>
        {passes.map((pass, layer) => (
          <React.Fragment key={`pass:${layer}`}>
            {pass.map((segment) => (
              <SegmentMark
                key={segment.id}
                segment={segment}
                color={modeColors[segment.mode]}
                backgroundColor={backgroundColor}
                still={still}
                animationKey={animationKey}
              />
            ))}
          </React.Fragment>
        ))}
        {nodes.map((node) => {
          const position = geometry.nodePositions[node.id];
          if (!position) return null;
          const selected = selectedNodeId === node.id;
          const notable = node.sessionCount >= 2;
          const color = modeColors[node.mode];
          if (!animateNodes) {
            return (
              <React.Fragment key={node.id}>
                {(notable || selected) && (
                  <Circle
                    cx={position.left}
                    cy={position.top}
                    r={position.radius + (selected ? 6 : 4)}
                    fill={color}
                    opacity={selected ? 0.28 : 0.16}
                  />
                )}
                <Circle
                  cx={position.left}
                  cy={position.top}
                  r={position.radius}
                  fill={selected ? '#F4EFE6' : color}
                  stroke={selected ? color : undefined}
                  strokeWidth={selected ? 1.5 : 0}
                />
              </React.Fragment>
            );
          }
          return (
            <NodeMark
              key={node.id}
              position={position}
              color={color}
              selected={selected}
              notable={notable}
              still={still}
              animationKey={animationKey}
            />
          );
        })}
      </Svg>
    </View>
  );
};

export default WeaveCanvas;
