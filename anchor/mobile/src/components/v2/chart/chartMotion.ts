/**
 * Chart motion: one place for every duration, so device tuning is one edit.
 *
 * Personality: calm, physical, precise, navigational. Opacity, small scale,
 * path drawing and a few points of parallax — never bounce, never bloom.
 *
 * Reduced motion is decided by the app (`useV2ReduceMotion`, which honours the
 * in-app override) and handled explicitly by each component. Reanimated's own
 * default follows the OS flag, which on Android is also set when the animator
 * duration scale is 0 — every `withTiming` would then jump to its end while
 * the JS timers still advance. Chart animations therefore opt out of the
 * implicit check, exactly as creation does.
 */
import { Easing, ReduceMotion, withDelay, withRepeat, withSequence, withTiming, type WithTimingConfig } from 'react-native-reanimated';

export const CHART_EASING = {
  /** Things arriving and settling. */
  settle: Easing.bezier(0.22, 1, 0.36, 1),
  /** Deliberate transitions between surfaces. */
  deliberate: Easing.bezier(0.4, 0, 0.2, 1),
  /** Things leaving. */
  exit: Easing.bezier(0.4, 0, 1, 1),
  /** A pen drawing a route: starts decisively, eases as it reaches. */
  draw: Easing.bezier(0.45, 0.05, 0.25, 1),
} as const;

/**
 * The mapping sequence (see ChartGenerationStage). Ceremonial, once per Chart,
 * paced for a phone at arm's length rather than a desktop prototype.
 */
export const CHART_MAPPING_TIMING = {
  /** Phase 1 — terrain resolves out of the dark. */
  terrain: 900,
  /** Phase 2 — HERE: the Anchor settles at the start. */
  hereAt: 650,
  here: 650,
  /** Phase 3 — THERE: the destination resolves in the distance. */
  thereAt: 1350,
  there: 700,
  /** Phase 4a — the survey trace reaches toward THERE while the request runs. */
  surveyAt: 2000,
  survey: 2200,
  /** Hold: a quiet reading sweep along the survey trace, until data exists. */
  holdSweep: 3400,
  /** Phase 4b — the real route draws; waypoints resolve as it passes them. */
  route: 2600,
  /** Phase 5 — one light pass along the finished route, then everything settles. */
  sweep: 1100,
  settle: 700,
  /** Copy that has been showing for less than this is not replaced yet. */
  minStageCopy: 900,
  /** Long-wait reassurance while the request is still running. */
  longWait: [12_000, 22_000],
  /** Reduced motion: state changes as short cross-fades. */
  reducedFade: 260,
} as const;

/** Review → reveal → permanent Chart. */
export const CHART_TRANSITION_TIMING = {
  /** Cream review panel rising over the finished map. */
  panelIn: 620,
  /** Cream panel falling away on "Looks right". */
  panelOut: 560,
  /** Headline cross-fades between stages. */
  copyOut: 220,
  copyIn: 420,
  /** Reveal settles, then the CTA appears. */
  revealCta: 520,
  /** "Explore your Chart": chrome recedes while the map rises into place. */
  explore: 760,
  /** Permanent Chart content cards entering. */
  cardIn: 460,
  cardStagger: 70,
} as const;

/** Permanent Chart state changes. */
export const CHART_PROGRESS_TIMING = {
  /** Route settling on entry. */
  entryRoute: 900,
  /** Reached: the Anchor travels the segment it just completed. */
  travelDelay: 500,
  travel: 1600,
  /** The completed waypoint engraves (fills). */
  engrave: 520,
  /** The next stretch draws in once the Anchor arrives. */
  nextStretch: 900,
  banner: 420,
  bannerHold: 4200,
  bannerHoldReduced: 2600,
} as const;

/** withTiming with Chart's explicit reduced-motion policy. */
export function chartTiming(toValue: number, config: Omit<WithTimingConfig, 'reduceMotion'> = {}, callback?: (finished?: boolean) => void) {
  'worklet';
  return withTiming(toValue, { ...config, reduceMotion: ReduceMotion.Never }, callback);
}

export function chartDelay(delayMs: number, animation: number): number {
  'worklet';
  return withDelay(delayMs, animation, ReduceMotion.Never);
}

export function chartSequence(...animations: number[]): number {
  'worklet';
  return withSequence(ReduceMotion.Never, ...animations);
}

export function chartRepeat(animation: number, reverse = false): number {
  'worklet';
  return withRepeat(animation, -1, reverse, undefined, ReduceMotion.Never);
}
