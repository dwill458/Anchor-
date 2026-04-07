/**
 * Anchor App — Teaching Content Registry
 *
 * Single source of truth for all Micro-Teaching System copy and metadata.
 * Screens import `TEACHINGS` by teachingId — never inline copy.
 *
 * Copy limits (hard):
 *   inline_whisper / bottom_hint / burn_ash_line / reflection_extension: 80 chars
 *   glass_card body: 140 chars; title: 30 chars
 *   paywall_card body: 70 chars; title: 24 chars
 *   toast_achievement: 55 chars
 */

export type TeachingTone =
  | 'whisper'
  | 'grounding'
  | 'reframe'
  | 'encouragement'
  | 'closure';

export type TeachingPattern =
  | 'inline_whisper'        // Pattern 1: The Undertone
  | 'bottom_hint'           // Pattern 2: The Ground Note
  | 'glass_card'            // Pattern 3: The Veil Card (V2)
  | 'toast_achievement'     // Pattern 4: The Signal Pulse
  | 'reflection_extension'  // Pattern 5: The Seal Whisper
  | 'paywall_card'          // Pattern 6: The Gate Illuminator
  | 'settings_row'          // Pattern 7: The Anchor Note
  | 'burn_ash_line';        // Pattern 8: The Ash Line

export type TeachingTier = 'free' | 'pro' | 'both';

export type TeachingTrigger =
  | 'first_time'
  | 'streak_3'
  | 'streak_7'
  | 'hesitation'
  | 'post_complete'
  | 'pre_burn'
  | 'on_burn'
  | 'post_burn'
  | 'milestone'
  | 'always'
  | 'stale_anchor';

export interface TeachingContent {
  /** Stable identifier. Format: 'screen_trigger_variant_v1' */
  teachingId: string;
  screen: string;
  trigger: TeachingTrigger;
  /** true = [on-only] requires guideMode; false = [both] always surfaces */
  guideOnly: boolean;
  tier: TeachingTier;
  /** Primary copy. Hard char limits vary by pattern — see file header. */
  copy: string;
  /** Optional second line (Ground Note secondary, card subtext). */
  copySecondary?: string;
  /** Headline for card patterns (paywall_card, glass_card). Max 30 chars. */
  title?: string;
  pattern: TeachingPattern;
  tone: TeachingTone;
  /** 1 = once lifetime; 0 = unlimited (never added to exhaustedIds). */
  maxShows: number;
  /** Per-teaching cooldown ms after show. 0 = no cooldown. */
  cooldownMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// MVP Teaching Registry
// ─────────────────────────────────────────────────────────────────────────────

export const TEACHINGS: Record<string, TeachingContent> = {

  // ── IntentionInput ──────────────────────────────────────────────────────────

  intention_input_first_time_v1: {
    teachingId: 'intention_input_first_time_v1',
    screen: 'intention_input',
    trigger: 'first_time',
    guideOnly: true,
    tier: 'both',
    copy: "Write it like you'd say it out loud. No flourish.",
    pattern: 'inline_whisper',
    tone: 'whisper',
    maxShows: 1,
    cooldownMs: 0,
  },

  intention_input_hesitation_v1: {
    teachingId: 'intention_input_hesitation_v1',
    screen: 'intention_input',
    trigger: 'hesitation',
    guideOnly: true,
    tier: 'both',
    copy: 'If it sounds like a headline, make it shorter.',
    pattern: 'inline_whisper',
    tone: 'whisper',
    maxShows: 1,
    cooldownMs: 0,
  },

  // ── Activation / Charge ─────────────────────────────────────────────────────

  activation_ground_note_v1: {
    teachingId: 'activation_ground_note_v1',
    screen: 'activation',
    trigger: 'first_time',
    guideOnly: true,
    tier: 'both',
    copy: 'Look at the sigil. Let the intention settle.',
    copySecondary: 'Stillness is enough.',
    pattern: 'bottom_hint',
    tone: 'grounding',
    maxShows: 1,
    cooldownMs: 0,
  },

  // ── CompletionModal / Seal Whisper ──────────────────────────────────────────

  completion_seal_whisper_v1: {
    teachingId: 'completion_seal_whisper_v1',
    screen: 'completion_modal',
    trigger: 'post_complete',
    guideOnly: true,
    tier: 'both',
    copy: 'The word you choose becomes a mental shortcut. It trains recall.',
    pattern: 'reflection_extension',
    tone: 'whisper',
    maxShows: 1,
    cooldownMs: 0,
  },

  // ── ConfirmBurn ─────────────────────────────────────────────────────────────

  confirm_burn_reflect_v1: {
    teachingId: 'confirm_burn_reflect_v1',
    screen: 'confirm_burn',
    trigger: 'pre_burn',
    guideOnly: true,
    tier: 'both',
    copy: 'Completion is not failure. It means the work moved through you.',
    pattern: 'inline_whisper',
    tone: 'reframe',
    maxShows: 1,
    cooldownMs: 0,
  },

  confirm_burn_release_v1: {
    teachingId: 'confirm_burn_release_v1',
    screen: 'confirm_burn',
    trigger: 'pre_burn',
    guideOnly: true,
    tier: 'both',
    copy: 'The act of spelling it out is part of the ritual. It asks for your full attention.',
    pattern: 'inline_whisper',
    tone: 'whisper',
    maxShows: 1,
    cooldownMs: 0,
  },

  // ── BurningRitual / Ash Line ────────────────────────────────────────────────

  burn_ash_line_v1: {
    teachingId: 'burn_ash_line_v1',
    screen: 'burning_ritual',
    trigger: 'on_burn',
    guideOnly: true,
    tier: 'both',
    copy: 'Released. The work remains in you. The symbol no longer needs to.',
    pattern: 'burn_ash_line',
    tone: 'closure',
    maxShows: 1,
    cooldownMs: 0,
  },

  // ── Post-burn Signal Pulse ──────────────────────────────────────────────────

  post_burn_toast_v1: {
    teachingId: 'post_burn_toast_v1',
    screen: 'burning_ritual',
    trigger: 'post_burn',
    guideOnly: false,  // [both] — fires for all users, every burn
    tier: 'both',
    copy: 'The seal is complete. Take time before creating the next anchor.',
    pattern: 'toast_achievement',
    tone: 'closure',
    maxShows: 0,       // unlimited — never exhausted
    cooldownMs: 0,
  },

  // ── Milestone Toasts (M1, M2, M6) ──────────────────────────────────────────

  milestone_first_anchor_v1: {
    teachingId: 'milestone_first_anchor_v1',
    screen: 'any',
    trigger: 'milestone',
    guideOnly: false,
    tier: 'both',
    copy: "Your first anchor is set. Begin the first charge when you're ready.",
    pattern: 'toast_achievement',
    tone: 'encouragement',
    maxShows: 1,
    cooldownMs: 0,
  },

  milestone_first_charge_v1: {
    teachingId: 'milestone_first_charge_v1',
    screen: 'any',
    trigger: 'milestone',
    guideOnly: false,
    tier: 'both',
    copy: 'First imprint made. Repeat until it requires no thought.',
    pattern: 'toast_achievement',
    tone: 'closure',
    maxShows: 1,
    cooldownMs: 0,
  },

  milestone_first_burn_v1: {
    teachingId: 'milestone_first_burn_v1',
    screen: 'any',
    trigger: 'milestone',
    guideOnly: false,
    tier: 'both',
    copy: 'Released. The work that comes next begins with a clean field.',
    pattern: 'toast_achievement',
    tone: 'closure',
    maxShows: 1,
    cooldownMs: 0,
  },

  // ── Gate Illuminator (Paywall Teaching Cards) ───────────────────────────────

  paywall_manual_forge_v1: {
    teachingId: 'paywall_manual_forge_v1',
    screen: 'paywall',
    trigger: 'always',
    guideOnly: false,   // Guide Mode exempt — always shows
    tier: 'both',
    title: 'Your Hand, Your Signal',
    copy: 'Tracing the sigil yourself deepens the intention imprint.',
    pattern: 'paywall_card',
    tone: 'grounding',
    maxShows: 0,        // unlimited — always shows
    cooldownMs: 0,
  },

  paywall_all_styles_v1: {
    teachingId: 'paywall_all_styles_v1',
    screen: 'paywall',
    trigger: 'always',
    guideOnly: false,
    tier: 'both',
    title: 'Full Aesthetic Range',
    copy: 'Twelve visual styles, each tuned to a different quality of attention.',
    pattern: 'paywall_card',
    tone: 'grounding',
    maxShows: 0,
    cooldownMs: 0,
  },

  paywall_hd_export_v1: {
    teachingId: 'paywall_hd_export_v1',
    screen: 'paywall',
    trigger: 'always',
    guideOnly: false,
    tier: 'both',
    title: 'Take It Anywhere',
    copy: 'Print-quality export so your anchor lives beyond the screen.',
    pattern: 'paywall_card',
    tone: 'grounding',
    maxShows: 0,
    cooldownMs: 0,
  },
};
