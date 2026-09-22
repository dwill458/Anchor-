import { Easing } from 'react-native-reanimated';

/**
 * Shared motion language for Anchor 2.0. These are intentional defaults, not
 * a mandate to animate every state change. Use motion to communicate state,
 * hierarchy, and cause/effect before adding ornament.
 */
export const AnchorMotion = {
  duration: {
    /** Immediate tactile acknowledgement: buttons, toggles, and tiny changes. */
    micro: 120,
    /** Compact selections and crossfades. */
    quick: 180,
    /** Normal component entrances and content movement. */
    standard: 280,
    /** Important acknowledgement and major state transitions. */
    expressive: 420,
    /** Slow environmental motion only, such as Focus breathing. */
    ambient: 3200,
  },
  easing: {
    /** Entering content settles into place without overshooting. */
    enter: Easing.bezier(0.16, 1, 0.3, 1),
    /** Exiting content leaves decisively rather than lingering. */
    exit: Easing.bezier(0.7, 0, 0.84, 1),
    /** Default physical interface movement. */
    standard: Easing.bezier(0.2, 0, 0, 1),
    /** High-importance acknowledgement or reveal. */
    emphasized: Easing.bezier(0.05, 0.7, 0.1, 1),
    /** Restrained reversible ambient movement. */
    gentle: Easing.inOut(Easing.sin),
  },
  spring: {
    snap: { damping: 24, stiffness: 280, mass: 0.8 },
    soft: { damping: 20, stiffness: 160, mass: 1.0 },
    /**
     * The Home Anchor carousel settle. Damping ratio
     * ζ = damping / (2·√(stiffness·mass)) ≈ 0.81 at a natural frequency of
     * ≈ 17 rad/s: ~1% overshoot from rest, more when a flick hands it velocity,
     * settled in ~290ms. It sits between the two earlier profiles: 28/300/0.8
     * (ζ≈0.90) landed with no perceptible settle, and 19/190/0.9 (ζ≈0.73)
     * overshot ~4% with a ~380ms tail after a fast flick. The rest
     * thresholds are deliberate - Reanimated's defaults
     * keep a spring alive for a long sub-pixel tail, and on Android every one
     * of those frames is a Fabric commit that buys nothing the eye can see.
     */
    carousel: {
      damping: 22,
      stiffness: 230,
      mass: 0.8,
      restDisplacementThreshold: 0.5,
      restSpeedThreshold: 2,
    },
    /** Interactive sheets: the carousel's physics, so every dragged surface lands the same way. */
    sheet: {
      damping: 22,
      stiffness: 230,
      mass: 0.8,
      restDisplacementThreshold: 0.5,
      restSpeedThreshold: 2,
    },
    reveal: { damping: 18, stiffness: 140, mass: 1.2 },
  },
} as const;

/** @deprecated Prefer `AnchorMotion`; retained for existing V2 callers. */
export const motion = {
  instant: 0,
  fast: AnchorMotion.duration.quick,
  standard: AnchorMotion.duration.standard,
  slow: AnchorMotion.duration.expressive,
  celebration: AnchorMotion.duration.expressive,
  easing: { standard: 'easeOut', enter: 'easeOut', exit: 'easeIn' },
} as const;
