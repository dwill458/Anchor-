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
    copy: 'Say it plainly, like you would out loud.',
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
    copy: 'If it reads like a headline, make it simpler.',
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
    copy: 'Rest your eyes on the anchor. Let the intention settle.',
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
    copy: 'Your chosen word becomes a shortcut for recall.',
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
    copy: 'Completion is not failure. It means this work moved through you.',
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
    copy: 'Typing it out slows the moment and asks for full attention.',
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
    copy: 'Released. The work stays with you; the anchor does not need to.',
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
    copy: 'Released. Give yourself time before the next anchor.',
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
    copy: "Your first anchor is set. Prime it when you're ready.",
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
    copy: 'First imprint made. Repeat until recall feels natural.',
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
    copy: 'Released. Begin the next work with a clean field.',
    pattern: 'toast_achievement',
    tone: 'closure',
    maxShows: 1,
    cooldownMs: 0,
  },

  // ── Mid Creation Flow ───────────────────────────────────────────────────────

  distillation_first_time_v1: {
    teachingId: 'distillation_first_time_v1',
    screen: 'distillation',
    trigger: 'first_time',
    guideOnly: true,
    tier: 'both',
    copy: 'Your sentence is becoming a smaller signal.',
    copySecondary: 'Words into form.',
    pattern: 'bottom_hint',
    tone: 'grounding',
    maxShows: 1,
    cooldownMs: 0,
  },

  structure_forge_first_time_v1: {
    teachingId: 'structure_forge_first_time_v1',
    screen: 'structure_forge',
    trigger: 'first_time',
    guideOnly: true,
    tier: 'both',
    copy: 'Choose the form that can hold focus, not decoration.',
    pattern: 'inline_whisper',
    tone: 'grounding',
    maxShows: 1,
    cooldownMs: 0,
  },

  lock_structure_first_time_v1: {
    teachingId: 'lock_structure_first_time_v1',
    screen: 'lock_structure',
    trigger: 'first_time',
    guideOnly: true,
    tier: 'both',
    copy: 'Locking keeps the core form tied to your intention.',
    pattern: 'bottom_hint',
    tone: 'grounding',
    maxShows: 1,
    cooldownMs: 0,
  },

  enhancement_choice_first_time_v1: {
    teachingId: 'enhancement_choice_first_time_v1',
    screen: 'enhancement_choice',
    trigger: 'first_time',
    guideOnly: true,
    tier: 'both',
    title: 'Keep or refine',
    copy: 'AI changes the visual finish only. The original anchor remains the source.',
    pattern: 'glass_card',
    tone: 'reframe',
    maxShows: 1,
    cooldownMs: 0,
  },

  style_selection_first_time_v1: {
    teachingId: 'style_selection_first_time_v1',
    screen: 'style_selection',
    trigger: 'first_time',
    guideOnly: true,
    tier: 'both',
    copy: 'Styles change the finish, not the meaning. Choose what holds your attention.',
    pattern: 'inline_whisper',
    tone: 'whisper',
    maxShows: 1,
    cooldownMs: 0,
  },

  // ── Practice / Focus ────────────────────────────────────────────────────────

  practice_thread_strength_v1: {
    teachingId: 'practice_thread_strength_v1',
    screen: 'practice_home',
    trigger: 'first_time',
    guideOnly: true,
    tier: 'both',
    title: 'Thread Strength',
    copy: "Thread Strength shows how recently you've returned. It can fade and rebuild.",
    pattern: 'glass_card',
    tone: 'grounding',
    maxShows: 1,
    cooldownMs: 0,
  },

  // The three practice modes — rendered as stacked blocks in the modes
  // explainer sheet. Ungated (shown on demand via an info chip).
  mode_prime_v1: {
    teachingId: 'mode_prime_v1',
    screen: 'practice_home',
    trigger: 'always',
    guideOnly: false,
    tier: 'both',
    title: 'Prime',
    copy: 'Prime strengthens recall of this anchor.',
    pattern: 'glass_card',
    tone: 'grounding',
    maxShows: 0,
    cooldownMs: 0,
  },

  mode_stabilize_v1: {
    teachingId: 'mode_stabilize_v1',
    screen: 'practice_home',
    trigger: 'always',
    guideOnly: false,
    tier: 'both',
    title: 'Stabilize',
    copy: 'Stabilize settles attention so the state carries forward.',
    pattern: 'glass_card',
    tone: 'grounding',
    maxShows: 0,
    cooldownMs: 0,
  },

  mode_release_v1: {
    teachingId: 'mode_release_v1',
    screen: 'practice_home',
    trigger: 'always',
    guideOnly: false,
    tier: 'both',
    title: 'Release',
    copy: 'Release closes completed work so you can move cleanly.',
    pattern: 'glass_card',
    tone: 'closure',
    maxShows: 0,
    cooldownMs: 0,
  },

  charge_setup_first_time_v1: {
    teachingId: 'charge_setup_first_time_v1',
    screen: 'charge_setup',
    trigger: 'first_time',
    guideOnly: true,
    tier: 'both',
    copy: 'Short sessions count. Consistency matters more than intensity.',
    pattern: 'inline_whisper',
    tone: 'encouragement',
    maxShows: 1,
    cooldownMs: 0,
  },

  evolve_intro_v1: {
    teachingId: 'evolve_intro_v1',
    screen: 'evolve',
    trigger: 'first_time',
    guideOnly: true,
    tier: 'both',
    copy: 'Evolve brings you back to an existing anchor instead of starting over.',
    pattern: 'inline_whisper',
    tone: 'grounding',
    maxShows: 1,
    cooldownMs: 0,
  },

  // ── Vault / Home / Detail ───────────────────────────────────────────────────

  vault_intro_first_time_v1: {
    teachingId: 'vault_intro_first_time_v1',
    screen: 'vault',
    trigger: 'first_time',
    guideOnly: true,
    tier: 'both',
    title: 'Your anchors',
    copy: 'Each anchor is a visual cue for one intention. Return to reconnect with that focus.',
    pattern: 'glass_card',
    tone: 'grounding',
    maxShows: 1,
    cooldownMs: 0,
  },

  anchor_reuse_v1: {
    teachingId: 'anchor_reuse_v1',
    screen: 'anchor_detail',
    trigger: 'first_time',
    guideOnly: true,
    tier: 'both',
    copy: 'You do not need a new anchor every time. Returning strengthens the one you have.',
    pattern: 'bottom_hint',
    tone: 'grounding',
    maxShows: 1,
    cooldownMs: 0,
  },

  anchor_history_v1: {
    teachingId: 'anchor_history_v1',
    screen: 'anchor_detail',
    trigger: 'always',
    guideOnly: false,
    tier: 'both',
    title: 'Your history',
    copy: 'Your history shows how often you return to this focus over time.',
    pattern: 'glass_card',
    tone: 'grounding',
    maxShows: 0,
    cooldownMs: 0,
  },

  // DEFERRED: freemium — paywall teaching cards removed; per-feature gates replaced by single trial expiry gate.
  // Restore these if per-feature upsell teaching cards are re-introduced post-RevenueCat.
  //
  // paywall_manual_forge_v1: {
  //   teachingId: 'paywall_manual_forge_v1',
  //   screen: 'paywall',
  //   trigger: 'always',
  //   guideOnly: false,
  //   tier: 'both',
  //   title: 'Your Hand, Your Signal',
  //   copy: 'Tracing the anchor by hand deepens the intention imprint.',
  //   pattern: 'paywall_card',
  //   tone: 'grounding',
  //   maxShows: 0,
  //   cooldownMs: 0,
  // },
  //
  // paywall_all_styles_v1: {
  //   teachingId: 'paywall_all_styles_v1',
  //   screen: 'paywall',
  //   trigger: 'always',
  //   guideOnly: false,
  //   tier: 'both',
  //   title: 'Full Aesthetic Range',
  //   copy: 'Twelve visual styles, each tuned to a different quality of attention.',
  //   pattern: 'paywall_card',
  //   tone: 'grounding',
  //   maxShows: 0,
  //   cooldownMs: 0,
  // },
  //
  // paywall_hd_export_v1: {
  //   teachingId: 'paywall_hd_export_v1',
  //   screen: 'paywall',
  //   trigger: 'always',
  //   guideOnly: false,
  //   tier: 'both',
  //   title: 'Take It Anywhere',
  //   copy: 'Print-quality export so your anchor lives beyond the screen.',
  //   pattern: 'paywall_card',
  //   tone: 'grounding',
  //   maxShows: 0,
  //   cooldownMs: 0,
  // },
};
