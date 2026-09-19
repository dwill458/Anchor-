/** Hard cap on the intention text in V2 creation (the backend accepts up to 500). */
export const CREATION_MAX_INTENTION_LENGTH = 140;

export const CANONICAL_STRUCTURES =['focused', 'contained', 'raw', 'drawn'] as const;
export type CanonicalStructure = (typeof CANONICAL_STRUCTURES)[number];

export const CREATION_STEPS = [
  'intention',
  'distillation',
  'structure',
  'draw',
  'expression',
  'generation',
  'candidates',
  'save',
  'continue',
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

export const STRUCTURE_LABELS: Record<CanonicalStructure, string> = {
  focused: 'Focused',
  contained: 'Contained',
  raw: 'Raw',
  drawn: 'Drawn',
};

export const STRUCTURE_DESCRIPTIONS: Record<CanonicalStructure, string> = {
  focused: 'A clear center for what matters most.',
  contained: 'A form held within a defined boundary.',
  raw: 'Less framing. More of the original form remains visible.',
  drawn: 'Shape the form with your own hand.',
};

/**
 * Letter Distillation copy. The headline moves exactly once — from the phrase being reduced
 * to the form left behind — and the status line names the pass currently on screen, so the
 * user is told what they are watching instead of being shown a finished result.
 */
export const DISTILLATION_COPY = {
  eyebrow: 'LETTER DISTILLATION',
  /** While the phrase is still being reduced. */
  titleTransforming: 'Your words, taking shape.',
  /** Once the surviving letters have compacted and settled. */
  titleSettled: 'The form beneath the words.',
  status: {
    whole: 'Starting with your intention',
    vowels: 'Removing vowels',
    repeats: 'Removing repeated letters',
    compact: 'Keeping each remaining letter, in order',
  },
  settledLabel: 'DISTILLED FORM',
  settledCopy: 'These letters become the source material for your Anchor.',
  /** Shown in place of the primary action while the reduction is still playing. */
  ctaPending: 'Distilling\u2026',
  cta: 'Choose structure',
  howThisWorks: 'How this works',
  sheetIntro: 'We remove vowels and repeated letters. The remaining sequence is used to build your Anchor.',
  /** The three mechanism lines in the "How this works" sheet, in order. */
  mechanism: [
    'Remove vowels.',
    'Remove repeated letters, keeping the first of each.',
    'Keep the remaining letters, in order.',
  ],
} as const;

/**
 * The whole flow is a single central route; the nine steps above are store-internal state,
 * never route params. The integration branch registers exactly one screen.
 */
export const CREATION_ROUTE_NAME = 'V2Creation' as const;

/**
 * Integration manifest for central V2 navigation. UI-C does not edit
 * `navigation/v2/{AnchorV2Navigator,routes,types}.ts` itself — the integration branch registers
 * `V2CreationScreen` under `CREATION_ROUTE_NAME` and supplies the adapters listed in
 * `ANCHOR_2_UI_C_CREATION_MECHANICS.md` › REQUIRED_INTEGRATION_CHANGES.
 */
export const CREATION_ROUTE_MANIFEST = {
  routeName: CREATION_ROUTE_NAME,
  entryComponent: 'V2CreationScreen',
  steps: CREATION_STEPS,
  requiredProps: ['saveAnchor', 'onContinue'] as const,
  optionalProps: ['generateCandidates'] as const,
  continuations: ['home', 'vision', 'chart', 'vision_and_chart'] as const,
} as const;

/** @deprecated kept for the earlier design record; prefer {@link CREATION_ROUTE_MANIFEST}. */
export const creationRouteDefinitions = [CREATION_ROUTE_NAME] as const;
