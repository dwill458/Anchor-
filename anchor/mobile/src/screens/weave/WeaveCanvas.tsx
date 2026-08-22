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
 * The wavefront carries a flickering glow (a strobed opacity envelope) and
 * each node flashes a brief spark as the front reaches it, so the reveal
 * reads as a lightning strike building the weave rather than a smooth wipe.
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
    // A quick overshoot past full size sells the "struck" pop before the
    // mark relaxes to its resting bloom.
    bloom.value = withDelay(
      delay,
      withSequence(
        withTiming(1.18, { duration: NODE_DURATION * 0.6, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: NODE_DURATION * 0.4, easing: Easing.inOut(Easing.quad) }),
      ),
    );
    spark.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: 70, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 320, easing: Easing.out(Easing.quad) }),
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
    r: (position.radius + (selected ? 7 : 5)) * (0.5 + 0.5 * Math.min(1, bloom.value)),
    opacity: Math.min(1, bloom.value) * (selected ? 0.34 : 0.2),
  }));
  const sparkProps = useAnimatedProps(() => ({
    r: position.radius + 2 + spark.value * 10,
    opacity: spark.value * 0.85,
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
  // Strobes the wavefront's brightness during its travel so the reveal reads
  // as a bolt crackling across rather than a smooth wipe.
  const flicker = useSharedValue(1);

  useEffect(() => {
    if (still) {
      sweep.value = 1;
      flicker.value = 1;
      return undefined;
    }
    sweep.value = 0;
    sweep.value = withDelay(
      SWEEP_START,
      withTiming(1, { duration: SWEEP_TRAVEL + NODE_DURATION, easing: Easing.bezier(0.22, 1, 0.36, 1) }),
    );
    flicker.value = 1;
    flicker.value = withDelay(
      SWEEP_START,
      withSequence(
        withTiming(1, { duration: 40 }),
        withTiming(0.35, { duration: 30 }),
        withTiming(1, { duration: 55 }),
        withTiming(0.6, { duration: 90 }),
        withTiming(1, { duration: 45 }),
        withTiming(0.5, { duration: 120 }),
        withTiming(1, { duration: 60 }),
        withTiming(0.75, { duration: 180 }),
        withTiming(1, { duration: 300 }),
      ),
    );
    return () => {
      cancelAnimation(sweep);
      cancelAnimation(flicker);
    };
  }, [animationKey, still, sweep, flicker]);

  const revealStyle = useAnimatedStyle(() => ({ width: width * sweep.value }));
  // A bolt of light rides the leading edge, so the reveal reads as the weave
  // being struck into place rather than a panel being uncovered.
  const wavefrontStyle = useAnimatedStyle(() => {
    const envelope = sweep.value <= 0 || sweep.value >= 1 ? 0 : Math.sin(Math.PI * sweep.value) ** 0.6;
    return {
      opacity: envelope * flicker.value,
      transform: [{ translateX: width * sweep.value - 1 }],
    };
  });

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
                  key={`${segment.id}:glow`}
                  d={segment.path}
                  stroke={modeColors[segment.mode]}
                  strokeOpacity={segment.opacity * 0.55}
                  strokeWidth={segment.strokeWidth + 5.5}
                  strokeLinecap="round"
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
                      r={position.radius + (selected ? 7 : 5)}
                      fill={color}
                      opacity={selected ? 0.34 : 0.2}
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
        <Animated.View pointerEvents="none" style={[styles.wavefrontWrap, { height }, wavefrontStyle]}>
          <View style={[styles.wavefrontLayer, styles.wavefrontGlow]} />
          <View style={[styles.wavefrontLayer, styles.wavefrontHalo]} />
          <View style={[styles.wavefrontLayer, styles.wavefrontCore]} />
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wavefrontWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 1,
  },
  wavefrontLayer: {
    position: 'absolute',
    top: 0,
    height: '100%',
  },
  wavefrontGlow: {
    left: -11,
    width: 22,
    backgroundColor: 'rgba(240,203,106,0.18)',
  },
  wavefrontHalo: {
    left: -4,
    width: 8,
    backgroundColor: 'rgba(255,246,214,0.42)',
  },
  wavefrontCore: {
    left: -1,
    width: 2,
    backgroundColor: '#FFF9EA',
  },
});

export default WeaveCanvas;
