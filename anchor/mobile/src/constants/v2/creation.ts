/** Hard cap on the intention text in V2 creation (the backend accepts up to 500). */
export const CREATION_MAX_INTENTION_LENGTH = 140;

export const CANONICAL_STRUCTURES =['focused', 'contained', 'raw', 'drawn'] as const;
export type CanonicalStructure = (typeof CANONICAL_STRUCTURES)[number];

/**
 * The creation state machine, in order. One route; these are store-internal states.
 *
 *   intention    ENTERING_INTENTION (+ VALIDATING on submit)
 *   distillation DISTILLING — the real reduction, played on the user's own words
 *   formation    GENERATING — the real grid, points and path, drawn
 *   reveal       REVEALING — the finished mark; structure is locked from here
 *   expression   EXPLORING_EXPRESSION → SAVING_EXPRESSION (saveState) — the one server write
 *   destination  SETTING_DESTINATION — optional Vision description, Anchor already saved
 *   handoff      FINALIZING → TRANSITIONING_HOME → COMPLETE
 *
 * Errors are carried on the draft (`formationError`, `saveState: 'error'`,
 * `destinationState: 'error'`) rather than as a separate step, so a retry resumes exactly
 * where it failed.
 */
export const CREATION_STEPS = [
  'intention',
  'distillation',
  'formation',
  'reveal',
  'expression',
  'destination',
  'handoff',
] as const;
export type CreationStep = (typeof CREATION_STEPS)[number];

export const ANCHOR_EXPRESSIONS = [
  'original', 'monoline', 'architectural', 'foil', 'embossed', 'etched', 'ink',
  'halo', 'glass', 'radiant', 'organic', 'woven', 'cut_paper',
] as const;
export type AnchorExpression = (typeof ANCHOR_EXPRESSIONS)[number];

export const EXPRESSION_LABELS: Record<AnchorExpression, string> = {
  original: 'Original', monoline: 'Monoline', architectural: 'Architectural',
  foil: 'Foil', embossed: 'Embossed', etched: 'Etched', ink: 'Ink', halo: 'Halo',
  glass: 'Glass', radiant: 'Radiant', organic: 'Organic', woven: 'Woven', cut_paper: 'Cut Paper',
};

/** One-line finish descriptions (the established UI-B expression copy). */
export const EXPRESSION_DESCRIPTIONS: Record<AnchorExpression, string> = {
  original: 'Baseline generated form',
  monoline: 'Ultra-fine technical line',
  architectural: 'Precision guide construction',
  foil: 'Warm metallic finish',
  embossed: 'Tactile paper relief',
  etched: 'Fine engraved finish',
  ink: 'Textured drawn finish',
  halo: 'Soft luminous edge',
  glass: 'Refractive transparent finish',
  radiant: 'Focal vertex light',
  organic: 'Textured natural line',
  woven: 'Textured fiber finish',
  cut_paper: 'Layered dimensional relief',
};

/**
 * The expressions offered while creating an Anchor, in rail order. Every one is a local,
 * deterministic treatment of the same stored geometry — browsing them never calls the
 * server. The remaining vocabulary (halo, glass, radiant, organic, woven) stays valid for
 * Anchors that already carry it and renders through its nearest treatment; it is not offered
 * because its character (glow, luminous edges) belongs to the mystical framing 2.0 retired.
 */
export const CREATION_EXPRESSIONS = [
  'original', 'monoline', 'architectural', 'ink', 'etched', 'foil', 'embossed', 'cut_paper',
] as const satisfies readonly AnchorExpression[];

/** Every structure created in 2.0 is the generator's focused (balanced) form. */
export const CREATION_STRUCTURE: CanonicalStructure = 'focused';

/**
 * Letter Distillation copy. The status line names the pass currently on screen, so the user
 * is told what they are watching instead of being shown a finished result.
 */
export const DISTILLATION_COPY = {
  eyebrow: 'LETTER DISTILLATION',
  title: 'Your words, taking shape.',
  status: {
    whole: 'Starting with your intention',
    vowels: 'Removing vowels',
    repeats: 'Removing repeated letters',
    compact: 'Keeping each remaining letter, in order',
    settled: 'The form beneath the words',
  },
  howThisWorks: 'How this works',
  sheetIntro: 'We remove vowels and repeated letters. The remaining sequence is used to build your Anchor.',
  /** The three mechanism lines in the "How this works" sheet, in order. */
  mechanism: [
    'Remove vowels.',
    'Remove repeated letters, keeping the first of each.',
    'Keep the remaining letters, in order.',
  ],
} as const;

/** Formation: the distilled letters become points on a grid, and one line connects them. */
export const FORMATION_COPY = {
  eyebrow: 'FORMATION',
  title: 'Building your Anchor.',
  status: {
    grid: 'Each letter becomes a point.',
    path: 'One line connects them, in order.',
    settle: 'Formed from your words alone.',
  },
  error: 'Your Anchor could not be formed. Your intention is safe.',
  retry: 'Try again',
} as const;

export const REVEAL_COPY = {
  eyebrow: 'YOUR ANCHOR',
  title: 'This is your Anchor.',
  cta: 'Choose how it appears',
  howItFormed: 'See how it was formed',
  /** The formation sheet's second half, after the distillation mechanism. */
  gridIntro:
    'Each remaining letter becomes a number, and each number a point on a grid chosen by the kind of intention it is. One unbroken line joins the points in the order you wrote them.',
} as const;

export const EXPRESSION_COPY = {
  eyebrow: 'EXPRESSION',
  title: 'How it appears.',
  principle: 'Structure stays yours. Expression changes how it appears.',
  cta: 'Keep this Anchor',
} as const;

/** Save failures, by what the user can do about them. */
export const CREATION_SAVE_ERRORS = {
  network: 'You look to be offline. Your Anchor is safe here. Try again when you are connected.',
  auth: 'Sign in to keep this Anchor. It will be waiting right here.',
  server: 'Your Anchor was not saved. Nothing was lost. Try again.',
  limit: 'You have created the most Anchors allowed for today. This one will be here tomorrow.',
  second_anchor: 'Your first Anchor is free. More Anchors are part of Pro. This one will wait here.',
} as const;

export const DESTINATION_COPY = {
  eyebrow: 'DESTINATION',
  title: 'What does getting there look like?',
  fromLabel: 'FROM YOUR INTENTION',
  fieldLabel: 'PICTURE THIS',
  guidance: 'Describe the moment it is true: where you are, what you notice, how it feels.',
  cta: 'Set destination',
  skip: 'Not now',
  /** The Vision description contract's own minimum. */
  minLength: 12,
  maxLength: 400,
  error: 'Your destination was not saved. Try again, or add it later from your Anchor.',
} as const;

/**
 * Category-matched examples for the Destination field. They are placeholders that show the
 * kind of sentence that works — never pre-filled, never submitted on the user's behalf.
 */
export const DESTINATION_EXAMPLES: Record<string, string> = {
  career: 'I walk out of the review knowing the work spoke for itself.',
  abundance: 'I check my account without flinching and decide what to build next.',
  health: 'I finish the morning run with breath to spare and the day ahead of me.',
  relationships: 'We laugh at dinner and nobody reaches for a phone.',
  family: 'The kids tell me about their day and I hear every word.',
  creativity: 'I close the notebook on a finished piece I am proud of.',
  learning: 'I explain it out loud, simply, and it makes sense.',
  desire: 'I am standing in the place I kept picturing, and it feels ordinary now.',
  spirituality: 'I sit in the quiet and nothing in me is rushing.',
  adventure: 'I step off the train somewhere new, and I am calm.',
  custom: 'I notice it has become normal, and I am proud of how I got here.',
};

/**
 * The whole flow is a single central route; the steps above are store-internal state,
 * never route params.
 */
export const CREATION_ROUTE_NAME = 'V2Creation' as const;

/** Integration manifest for central V2 navigation. */
export const CREATION_ROUTE_MANIFEST = {
  routeName: CREATION_ROUTE_NAME,
  entryComponent: 'V2CreationScreen',
  steps: CREATION_STEPS,
  requiredProps: ['saveAnchor', 'saveDestination', 'onComplete'] as const,
  optionalProps: ['onExit', 'onPaywall', 'onSignIn'] as const,
} as const;
