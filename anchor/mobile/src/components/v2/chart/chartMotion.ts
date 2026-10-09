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
  /**
   * Creation stays over the permanent Chart after "Explore your Chart" until the Chart's map canvases have drawn
   * (measured on the S24: land ~5 frames, overlay ~8), then fades out. Both show the same map, so the fade is invisible.
   */
  handoffHold: 260,
  handoffFade: 160,
  /** Permanent Chart content cards entering. */
  cardIn: 460,
  cardStagger: 70,
} as const;

/** First-open Chart intro choreography. Offsets are measured from its first frame. */
export const CHART_INTRO_TIMING = {
  airFadeIn: 600,
  openAt: 150,
  contourAt: 200,
  contour: 3200,
  toneAt: 1300,
  tone: 3600,
  cameraAt: 100,
  camera: 6000,
  cameraFrom: 1.1,
  cameraTo: 1,
  routeAt: 4100,
  route: 2600,
  copyAt: 4800,
  copy: 1100,
  continueAt: 6200,
  continue: 1000,
  markerAt: 6300,
  marker: 600,
  duckAt: 6900,
  /** Mount the settled Skia layers under zero opacity before the UI-clock land fade begins. */
  landPrepareAt: 6100,
  landCrossfadeAt: 6500,
  landCrossfade: 700,
  shortInk: 1200,
  shortRoute: 1000,
  shortLandCrossfadeAt: 500,
  shortCopyAt: 1200,
  shortCopy: 400,
  shortDuration: 1600,
  skip: 250,
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

/** Full Chart ↔ focused waypoint camera choreography. */
export const CHART_CAMERA_TIMING = {
  focus: 760,
  return: 680,
  reduced: 220,
} as const;

/**
 * withTiming with Chart's explicit reduced-motion policy.
 *
 * Deliberately no callback parameter: callbacks passed through a custom
 * wrapper are not guaranteed to be auto-workletized by the Reanimated Babel
 * transform. Observe completion with `useAnimatedReaction` and cross to JS
 * with `runOnJS` instead.
 */
export function chartTiming(toValue: number, config: Omit<WithTimingConfig, 'reduceMotion'> = {}) {
  'worklet';
  return withTiming(toValue, { ...config, reduceMotion: ReduceMotion.Never });
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

/**
 * Chart map sequences (open, move check, waypoint tap, reach, arrival).
 * Prototype values (chart-build-prompt.md section 10) run at x1.0; device tuning
 * scales `timeScale` (applied by the sequence runner, not baked in here) and
 * keeps the ratios. Every `at` is an offset in ms from sequence start.
 */
export const CHART_MAP_TIMING = {
  /** Multiplier the runner applies to every duration and offset. 1 = prototype. */
  timeScale: 1,
  // DEFERRED: fade-in open (map fades up, then the route draws).
  // open: { mapFade: 300, routeAt: 300, route: 700, flagAt: 1000, flagDrop: 250, cameraAt: 1000, camera: 450, panelAt: 1250, panel: 350, scale: 1.3 },
  /** First open of the day: the weather parts over the charted corridor, then the pen draws. */
  open: {
    /**
     * Camera starts pushed in at this scale, centred here, and eases back to overview. cy was 650; at 650 the
     * summit (map y 112) sat about 24dp under the header on the first frame. 560 keeps the push-in and clears it.
     */
    startCamera: { cx: 405, cy: 560, s: 1.08 },
    closed: 520,
    cover: 720,
    camera: 900,
    inkAt: 250,
    route: 850,
    flagAt: 1000,
    flagDrop: 250,
    panelAt: 1200,
    panel: 350,
  },
  /** Later opens the same day: nothing redraws, the weather takes one breath. */
  later: {
    breathPeak: 0.03,
    breathUp: 1200,
    breathDown: 1200,
    /** Opened from the frame-one veil's closed cover: the clouds part (and the camera eases home) over this. */
    part: 480,
    panelAt: 300,
    reducedPanelAt: 120,
  },
  moveCheck: {
    checkFill: 200,
    routeAt: 200,
    route: 400,
    /** The cloud cover follows the extended tip. */
    coverAt: 120,
    cover: 600,
    pulseAt: 200,
    pulse: 650,
    dayClosedAt: 850,
  },
  /**
   * One Move done (M1, about 2.8s; registered 2.5s, so not skippable). The shipped circle and toast run in the
   * row; the current leg inks forward to its 90% hold (500-1700) and the waypoint marker stays open.
   */
  moveHold: {
    checkAt: 0,
    routeAt: 500,
    route: 1200,
    /** The cloud cover follows the tip so the new ink is never under cloud. */
    coverAt: 500,
    cover: 1200,
    pulseAt: 500,
    pulse: 650,
    /** The day-closed card replaces the move card after the toast has gone out. */
    dayClosedAt: 2200,
    /** The scene rests until here (the registered scene length). */
    settleAt: 2500,
    /** The leg holds here, as a fraction of its length: a move never reaches the marker. */
    holdFraction: 0.9,
  },
  waypointTap: {
    camera: 350,
    panelCrossfade: 200,
    scale: 1.45,
  },
  /**
   * Waypoint reached (W1, about 3.2s). The leg inks to the waypoint (0-1100), the marker fills with the one note
   * and Light haptic (1000), a ring pulses (1000-2100), the contours turn to ink around it (1100-2300), then the
   * flag, camera and commit card move on (1700) and the scene rests until `settleAt`.
   */
  reach: {
    // DEFERRED: stampAt: 150, stamp: 300, routeAt: 150, route: 350, pulseAt: 500, fogBreathAt: 500,
    // fogBreathDownAt: 850, coverAt: 500, cover: 900, revealAt: 500, flagAt: 900, cameraAt: 1200, panelAt: 1500
    // (the first reach timing: the stamp landed as the leg started to ink).
    /** The marker fills and pops here (scale peak centred ~1200); the single note and Light haptic land with it. */
    stampAt: 1000,
    stamp: 400,
    routeAt: 0,
    /** The leg to this waypoint draws in ink; the next-leg reveal (1100) takes over the same value. */
    route: 1100,
    pulseAt: 1000,
    pulse: 1100,
    fogBreathAt: 1100,
    fogBreathUp: 350,
    fogBreathDownAt: 1450,
    fogBreathDown: 350,
    /** Peak of the fog breath (clear fraction). Larger values clear half the map. */
    // DEFERRED: fogBreathPeak: 0.035,
    fogBreathPeak: 0.02,
    /** The cloud cover rolls this fraction of the next leg back after a reach. */
    coverAt: 1100,
    cover: 1200,
    coverLead: 0.3,
    revealAt: 1100,
    /** The next-leg reveal's length (the pen length used for its sound in ChartActiveView), so it stays 600. */
    reveal: 600,
    flagAt: 1700,
    flagDrop: 250,
    cameraAt: 1700,
    camera: 500,
    /** The reached label hands over to the commit card here. */
    panelAt: 1700,
    scale: 1.45,
    /** The scene rests, settled, until here (the registered scene length). */
    settleAt: 3200,
  },
  /**
   * Summit: the destination is reached (S1, about 7.6s, L4, skippable). The final leg inks to the X (0-1300),
   * the Chart goes still (1400-2000), the gold flag plants with the one Heavy haptic, a thud and the chord (2000),
   * a glow blooms (2200-3500), the Anchor's artwork opens in a circle where the X was (2600-3500), the contours
   * turn to ink outward from the X (3300-4900), it rests, then the sheet gives way to the cream completion panel
   * (5500-6300) and the scene rests until `settleAt`.
   */
  summit: {
    routeAt: 0,
    route: 1300,
    cameraAt: 100,
    camera: 900,
    /** The Chart is silent from here until the flag (the air bed hushes). */
    stillAt: 1400,
    stillHold: 1100,
    /** The flag plants: the one Heavy haptic, the thud and the chord land here. */
    flagAt: 2000,
    flagDrop: 280,
    glowAt: 2200,
    glow: 1300,
    glyphAt: 2600,
    glyph: 900,
    fogAt: 3300,
    fog: 1600,
    panelAt: 5500,
    panel: 800,
    /** Reduce Motion registers a scene this short, so it is never skippable. */
    reducedMs: 200,
    /** The scene rests, settled, until here (the registered scene length). */
    settleAt: 7600,
  },
  /**
   * Route revised (R1, about 3.2s, L1, registered 2.5s so it is never skippable). The old route fades (0-900), the new
   * one is drawn by the pen in two halves (700-1800) and then settles into pencil (2000-2500): a plan is not progress.
   * The new open waypoint appears with the one Light haptic (1800-2050).
   */
  routeRevised: {
    fadeAt: 0,
    fade: 900,
    penAt: 700,
    penHalf: 550,
    popAt: 1800,
    pop: 250,
    pencilAt: 2000,
    pencil: 500,
    registeredMs: 2500,
    settleAt: 3200,
  },
} as const;

/** Reduced motion: state changes as short cross-fades only. */
export const CHART_MAP_REDUCED_FADE = 180;
