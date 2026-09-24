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
 *   expression   EXPLORING_EXPRESSION — local expression choice or original-structure save
 *   generating   DEVELOPING_EXPRESSION — the only networked step
 *   choose      CHOOSING_CANDIDATE — two finished circular interpretations
 *   handoff      FINALIZING → TRANSITIONING_HOME → COMPLETE
 *
 * Errors are carried on the draft (`formationError`, `generationError`, `saveState: 'error'`)
 * rather than as a separate step, so a retry resumes exactly where it failed.
 */
export const CREATION_STEPS = [
  'intention',
  'distillation',
  'formation',
  'reveal',
  'expression',
  'generating',
  'choose',
  'handoff',
] as const;
export type CreationStep = (typeof CREATION_STEPS)[number];

export const ANCHOR_EXPRESSIONS = [
  'original', 'monoline', 'architectural', 'foil', 'embossed', 'etched', 'ink',
  'halo', 'glass', 'radiant', 'organic', 'woven', 'cut_paper',
] as const;
export type AnchorExpression = (typeof ANCHOR_EXPRESSIONS)[number];

/** A finished AI interpretation kept beside the canonical structure. */
export type GeneratedAnchorCandidate = {
  imageUrl: string;
  variationId?: string;
  structureMatchScore?: number;
  structurePreserved?: boolean;
  classification?: string;
  provider?: string;
  model?: string;
};

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
    grid: 'Each letter becomes a number on the square.',
    map: 'Each number becomes a point.',
    path: 'One line connects them, in order.',
    settle: 'Formed from your words alone.',
  },
  error: 'Your Anchor could not be formed. Your intention is safe.',
  retry: 'Try again',
} as const;

export const REVEAL_COPY = {
  eyebrow: 'YOUR ANCHOR',
  title: 'This is your Anchor.',
  body: 'Formed from your words alone.',
  cta: 'Choose how it appears',
  howItFormed: 'See how it was formed',
  replay: 'Watch it form again',
  /** The formation sheet's second half, after the distillation mechanism. */
  gridIntro:
    'Each remaining letter becomes a number, and each number a point on a grid chosen by the kind of intention it is. One unbroken line joins the points in the order you wrote them.',
} as const;

export const EXPRESSION_COPY = {
  eyebrow: 'EXPRESSION',
  title: 'How should it appear?',
  structureLabel: 'YOUR STRUCTURE',
  principle: 'The structure stays the same. Its expression changes.',
  suggested: 'SUGGESTED FOR THIS ANCHOR',
  all: 'ALL EXPRESSIONS',
  microcopy: 'Each expression adapts uniquely to your Anchor.',
  generate: 'Generate Anchor →',
  original: 'Keep original structure',
  originalBody: 'Use the structure formed from your words, unchanged.',
} as const;

export const GENERATION_COPY = {
  eyebrow: 'CREATING',
  title: 'Bringing your Anchor to life.',
  body: 'Your structure stays present while the expression develops around it.',
  /** Named for what is on screen, never for how far the server has got. */
  phase: {
    structure: 'Your structure, exactly as it was formed.',
    expression: 'Its expression develops around it.',
    surface: 'Bringing it into its final form.',
    extended: 'Still developing. Some expressions take a little longer.',
  },
  retry: 'Try again',
  back: 'Back to expressions',
  previous: 'Return to your previous pair',
} as const;

export const CHOOSE_COPY = {
  eyebrow: 'YOUR ANCHOR',
  title: 'Choose your Anchor.',
  body: 'Two interpretations of the same structure.',
  keep: 'Keep this Anchor →',
  retry: 'Try again',
} as const;

/** Save failures, by what the user can do about them. */
export const CREATION_SAVE_ERRORS = {
  network: 'You look to be offline. Your Anchor is safe here. Try again when you are connected.',
  auth: 'Sign in to keep this Anchor. It will be waiting right here.',
  server: 'Your Anchor was not saved. Nothing was lost. Try again.',
  limit: 'You have created the most Anchors allowed for today. This one will be here tomorrow.',
  second_anchor: 'Your first Anchor is free. More Anchors are part of Pro. This one will wait here.',
} as const;

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
  requiredProps: ['saveAnchor', 'generateExpression', 'onComplete'] as const,
  optionalProps: ['onExit', 'onPaywall', 'onSignIn'] as const,
} as const;
