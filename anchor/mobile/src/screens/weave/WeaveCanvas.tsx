/**
 * WeaveCanvas — the shared rendering of The Weave, used by both the Anchor
 * Detail preview and the full Weave screen.
 *
 * The entrance is a port of the reference weave's CSS stagger: the threads
 * are revealed left → right by a travelling wavefront, and every node blooms
 * as that wavefront reaches it, so the eye is carried from one completed
 * session to the next. The reference timings map to Reanimated as:
 *
 *   `.wv-line`   lineIn 640ms cubic-bezier(.22,1,.36,1), 120 + t*620ms
 *   `.wv-node`   nodeIn 300ms ease-out,                  380 + t*620ms
 *   `.wv-recent` pulseOnce 1600ms ease-in-out, 1400ms delay
 *
 * Under reduced motion — or when the node count would make per-node
 * animation expensive — the weave renders in its final state immediately.
 */
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { PracticeMode } from '@/types/practice';
import type { WeaveNode } from './weaveData';
import type { WeaveGeometry, WeaveNodePosition } from './weaveGeometry';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Reference stagger, in milliseconds. */
const SWEEP_START = 120;
const SWEEP_TRAVEL = 620;
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
  const delay = SWEEP_START + NODE_LEAD + position.travel * SWEEP_TRAVEL;

  useEffect(() => {
    if (still) {
      bloom.value = 1;
      pulse.value = 1;
      return undefined;
    }
    bloom.value = 0;
    bloom.value = withDelay(delay, withTiming(1, { duration: NODE_DURATION, easing: Easing.out(Easing.quad) }));
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationKey, delay, position.latest, still]);

  // nodeIn scales from 0.5; animating the radius reads the same on an SVG
  // circle and avoids a transform-origin round trip.
  const markProps = useAnimatedProps(() => ({
    r: position.radius * (0.5 + 0.5 * bloom.value),
    opacity: bloom.value * pulse.value,
  }));
  const glowProps = useAnimatedProps(() => ({
    r: (position.radius + (selected ? 6 : 3)) * (0.5 + 0.5 * bloom.value),
    opacity: bloom.value * (selected ? 0.24 : 0.12),
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
  const sweep = useSharedValue(still ? 1 : 0);

  useEffect(() => {
    if (still) {
      sweep.value = 1;
      return undefined;
    }
    sweep.value = 0;
    sweep.value = withDelay(
      SWEEP_START,
      withTiming(1, { duration: SWEEP_TRAVEL + NODE_DURATION, easing: Easing.bezier(0.22, 1, 0.36, 1) }),
    );
    return () => cancelAnimation(sweep);
  }, [animationKey, still, sweep]);

  const revealStyle = useAnimatedStyle(() => ({ width: width * sweep.value }));
  // A thread of light rides the leading edge, so the reveal reads as the
  // weave being drawn rather than a panel being uncovered.
  const wavefrontStyle = useAnimatedStyle(() => ({
    opacity: sweep.value <= 0 || sweep.value >= 1 ? 0 : 0.5 * Math.sin(Math.PI * sweep.value) ** 0.6,
    transform: [{ translateX: width * sweep.value - 1 }],
  }));

  return (
    <View style={{ width, height }} accessible={false}>
      <Animated.View style={[{ width, height, overflow: 'hidden' }, revealStyle]}>
        <Svg width={width} height={height} accessible={false}>
          {passes.map((pass, layer) => (
            <React.Fragment key={`pass:${layer}`}>
              {pass.map((segment) => (
                <Path
                  key={`${segment.id}:halo`}
                  d={segment.haloPath}
                  stroke={backgroundColor}
                  strokeOpacity={0.94}
                  strokeWidth={segment.strokeWidth + 3.4}
                  fill="none"
                />
              ))}
              {pass.map((segment) => (
                <Path
                  key={`${segment.id}:line`}
                  d={segment.path}
                  stroke={modeColors[segment.mode]}
                  strokeOpacity={segment.opacity}
                  strokeWidth={segment.strokeWidth}
                  strokeLinecap="round"
                  fill="none"
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
                      r={position.radius + (selected ? 6 : 3)}
                      fill={color}
                      opacity={selected ? 0.24 : 0.12}
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
      </Animated.View>
      {!still && (
        <Animated.View pointerEvents="none" style={[styles.wavefront, { height }, wavefrontStyle]} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wavefront: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 2,
    backgroundColor: '#F0CB6A',
  },
});

export default WeaveCanvas;
