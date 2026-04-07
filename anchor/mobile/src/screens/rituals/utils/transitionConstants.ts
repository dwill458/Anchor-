/**
 * Sacred Ritual Threshold - Transition Constants
 *
 * Timing values and easing functions for the sacred entry sequence
 * and threshold transition choreography.
 *
 * Design Principle: Time must feel slower on this screen than anywhere else.
 */

import { Easing } from 'react-native';

export const TIMING = {
  // ══════════════════════════════════════════════════════════════
  // SACRED ENTRY SEQUENCE
  // ══════════════════════════════════════════════════════════════

  /**
   * Initial anchor fade-in duration
   * Anchor appears first, alone, establishing visual dominance
   */
  ANCHOR_FADE_IN: 400,

  /**
   * Stillness delay after anchor appears
   * Critical: Creates sacred pause before UI elements emerge
   * This is intentional, not a loading state
   */
  ENTRY_STILLNESS: 800,

  /**
   * Invitational prompt fade-in duration
   * "How long do you want to stay with this symbol?"
   */
  PROMPT_FADE_IN: 500,

  /**
   * Depth cards fade-in duration
   * Light and Deep cards appear together, last in sequence
   */
  DEPTH_CARDS_FADE_IN: 600,

  // ══════════════════════════════════════════════════════════════
  // ANCHOR BREATHING ANIMATION
  // ══════════════════════════════════════════════════════════════

  /**
   * Full breathing cycle duration (inhale + exhale)
   * Intentionally slower than typical UI animation (7s vs 2-3s)
   * Creates calming, meditative rhythm
   */
  BREATH_CYCLE_DURATION: 7000,

  /**
   * Minimum scale value during breathing
   * Anchor rests at normal size
   */
  BREATH_SCALE_MIN: 1.0,

  /**
   * Maximum scale value during breathing
   * Subtle expansion (2% growth) - noticeable but not distracting
   */
  BREATH_SCALE_MAX: 1.02,

  /**
   * Minimum glow opacity during breathing
   * Glow at exhale/rest state
   */
  GLOW_OPACITY_MIN: 0.3,

  /**
   * Maximum glow opacity during breathing
   * Glow at peak inhale
   */
  GLOW_OPACITY_MAX: 0.6,

  // ══════════════════════════════════════════════════════════════
  // SHIMMER SWEEP EFFECT
  // ══════════════════════════════════════════════════════════════

  /**
   * Duration of shimmer sweep across anchor
   * Slow, directional light pass
   */
  SHIMMER_SWEEP_DURATION: 3000,

  /**
   * Pause duration between shimmer sweeps
   * One shimmer every ~12 seconds (3s sweep + 9s pause)
   * Rare enough to be noticed when it happens
   */
  SHIMMER_PAUSE_DURATION: 9000,

  // ══════════════════════════════════════════════════════════════
  // THRESHOLD TRANSITION SEQUENCE
  // ══════════════════════════════════════════════════════════════

  /**
   * CTA button glow intensification on enable
   * Quick feedback when selections complete
   */
  CTA_GLOW_INTENSITY: 150,

  /**
   * UI withdrawal phase duration
   * Depth cards, prompt, and other UI elements fade out
   */
  UI_WITHDRAWAL: 350,

  /**
   * Anchor takeover phase duration
   * Anchor scales up and moves to screen center
   * This is the core of the threshold crossing experience
   */
  ANCHOR_TAKEOVER: 600,

  /**
   * Stillness beat duration
   * Anchor holds at center, no motion, pure presence
   * Critical moment: user feels the transition threshold
   */
  STILLNESS_BEAT: 300,

  /**
   * Final fade duration before navigation
   * Anchor fades out as ritual screen appears
   */
  FINAL_FADE: 200,

  /**
   * Total transition duration
   * Sum of all transition phases: ~1400ms
   * Intentionally slower than standard navigation (300-400ms)
   */
  get TOTAL_TRANSITION(): number {
    return (
      this.CTA_GLOW_INTENSITY +
      this.UI_WITHDRAWAL +
      this.ANCHOR_TAKEOVER +
      this.STILLNESS_BEAT +
      this.FINAL_FADE
    );
  },

  // ══════════════════════════════════════════════════════════════
  // SCALE VALUES
  // ══════════════════════════════════════════════════════════════

  /**
   * Anchor scale during takeover phase
   * 18% increase creates sense of anchor growing/opening
   */
  ANCHOR_TAKEOVER_SCALE: 1.18,

  /**
   * Background darken amount during transition
   * Subtle darkening focuses attention on anchor
   */
  BACKGROUND_DARKEN_AMOUNT: 0.3,

  /**
   * Ritual screen fade-in stagger delay
   * Time between each ritual UI element fading in
   */
  RITUAL_ENTRY_STAGGER: 200,

  /**
   * Ritual screen element fade-in duration
   * Duration for ring, instructions, timer to appear
   */
  RITUAL_ENTRY_FADE: 500,

  // ══════════════════════════════════════════════════════════════
  // DURATION PICKER
  // ══════════════════════════════════════════════════════════════

  /**
   * Duration picker fade-in when depth selected
   */
  DURATION_PICKER_FADE: 300,
} as const;

// ══════════════════════════════════════════════════════════════
// EASING FUNCTIONS
// ══════════════════════════════════════════════════════════════

/**
 * Easing functions for different animation phases
 * Chosen for smooth, organic, non-mechanical feel
 */
export const EASING = {
  /**
   * Entry sequence easing
   * Ease-out cubic: starts faster, slows at end
   * Good for fade-ins that feel natural
   */
  ENTRY: Easing.out(Easing.cubic),

  /**
   * Breathing animation easing
   * Sine wave: most organic, mimics natural breathing
   * Smooth acceleration/deceleration
   */
  BREATH: Easing.inOut(Easing.sin),

  /**
   * Transition sequence easing
   * Ease-in-out cubic: smooth start and end
   * Creates deliberate, ceremonial movement
   */
  TRANSITION: Easing.inOut(Easing.cubic),

  /**
   * Exit/fade-out easing
   * Ease-in cubic: starts slow, accelerates
   * Good for elements disappearing
   */
  EXIT: Easing.in(Easing.cubic),

  /**
   * Linear easing for shimmer sweep
   * Constant speed across the anchor
   */
  LINEAR: Easing.linear,
} as const;

// ══════════════════════════════════════════════════════════════
// GLOW COLORS
// ══════════════════════════════════════════════════════════════

/**
 * Gradient colors for glow effects
 * Using gold (#D4AF37) from theme with varying opacity
 */
export const GLOW_COLORS = {
  /**
   * Radial gradient center color
   * 60% opacity gold at anchor center
   */
  RADIAL_CENTER: 'rgba(212, 175, 55, 0.6)',

  /**
   * Radial gradient edge color
   * Fully transparent at edges for smooth fade
   */
  RADIAL_EDGE: 'rgba(212, 175, 55, 0)',

  /**
   * Shimmer gradient colors
   * Transparent → Gold (40%) → Transparent
   */
  SHIMMER: [
    'transparent',
    'rgba(212, 175, 55, 0.4)',
    'transparent',
  ] as const,

  /**
   * CTA button glow color when enabled
   * Soft gold shadow
   */
  CTA_GLOW: 'rgba(212, 175, 55, 0.5)',
} as const;

// ══════════════════════════════════════════════════════════════
// TYPE EXPORTS
// ══════════════════════════════════════════════════════════════

export type TransitionPhase = 'entering' | 'idle' | 'transitioning';
export type DepthType = 'light' | 'deep';

/**
 * Animation state for tracking transition progress
 */
export interface TransitionState {
  phase: TransitionPhase;
  canNavigate: boolean;
  isAnimating: boolean;
}
