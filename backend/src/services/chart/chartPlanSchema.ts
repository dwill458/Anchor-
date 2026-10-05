import { z } from 'zod';

/**
 * Strict contract for everything a model may contribute to a Chart.
 *
 * Model output is untrusted until it passes `normalizeGenerationResult`. The
 * model never chooses layout, colour, navigation, feature types or anything
 * that touches entitlements — it only proposes words and numbers that the
 * user then reviews.
 */

export const CHART_COMPLEXITIES = ['SIMPLE', 'MODERATE', 'COMPLEX'] as const;
export type ChartComplexity = (typeof CHART_COMPLEXITIES)[number];

export const CHART_WAYPOINT_KINDS = ['MILESTONE', 'METRIC', 'CAPABILITY'] as const;
export type ChartWaypointKind = (typeof CHART_WAYPOINT_KINDS)[number];

/**
 * How a waypoint shows progress. numeric: a real number with a unit and target. moves: the checklist of its
 * moves. none: no progress UI, just the waypoint and its moves.
 */
export const CHART_PROGRESS_MODES = ['numeric', 'moves', 'none'] as const;
export type ChartProgressMode = (typeof CHART_PROGRESS_MODES)[number];

/** Planner never proposes more than this; users may add more afterwards. */
export const MAX_GENERATED_WAYPOINTS = 8;
export const MIN_GENERATED_WAYPOINTS = 2;

/**
 * Waypoint-count band for each complexity. Bands overlap at their edges on
 * purpose: a 4-step route can honestly be SIMPLE or MODERATE.
 */
export const COMPLEXITY_WAYPOINT_BANDS: Record<ChartComplexity, { min: number; max: number }> = {
  SIMPLE: { min: 2, max: 4 },
  MODERATE: { min: 4, max: 6 },
  COMPLEX: { min: 6, max: 8 },
};

export const TITLE_MAX = 60;
export const RATIONALE_MAX = 280;
export const DESTINATION_MAX = 140;
export const MOVE_TITLE_MAX = 120;
export const GUIDANCE_MAX = 200;
export const QUESTION_MAX = 160;
export const METRIC_LABEL_MAX = 40;

// Raw shape. Every field is present (nullable) so the same schema can be sent
// to providers that require fully-specified strict JSON schemas.
const RawWaypointSchema = z.object({
  title: z.string(),
  rationale: z.string().nullable(),
  type: z.string(),
  // Optional in zod so older provider output still parses; the JSON schema below requires it.
  metricType: z.string().nullish(),
  targetMetric: z.string().nullable(),
  targetValue: z.number().nullable(),
  baselineValue: z.number().nullable(),
});

const RawMoveSchema = z.object({
  title: z.string(),
  rationale: z.string().nullable(),
});

export const RawGenerationSchema = z.object({
  needsMoreContext: z.boolean(),
  followUpQuestion: z.string().nullable(),
  destination: z.string(),
  complexity: z.string(),
  waypoints: z.array(RawWaypointSchema).max(12),
  suggestedOneMove: RawMoveSchema.nullable(),
  personalizedGuidance: z.string().nullable(),
});
export type RawGeneration = z.infer<typeof RawGenerationSchema>;

export const RawMoveSuggestionsSchema = z.object({
  moves: z.array(RawMoveSchema).max(6),
});

/** JSON Schema mirror of RawGenerationSchema, for structured-output providers. */
export const GENERATION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'needsMoreContext',
    'followUpQuestion',
    'destination',
    'complexity',
    'waypoints',
    'suggestedOneMove',
    'personalizedGuidance',
  ],
  properties: {
    needsMoreContext: { type: 'boolean' },
    followUpQuestion: { type: ['string', 'null'] },
    destination: { type: 'string' },
    complexity: { type: 'string', enum: [...CHART_COMPLEXITIES] },
    waypoints: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'rationale', 'type', 'metricType', 'targetMetric', 'targetValue', 'baselineValue'],
        properties: {
          title: { type: 'string' },
          rationale: { type: ['string', 'null'] },
          type: { type: 'string', enum: [...CHART_WAYPOINT_KINDS] },
          metricType: { type: 'string', enum: [...CHART_PROGRESS_MODES] },
          targetMetric: { type: ['string', 'null'] },
          targetValue: { type: ['number', 'null'] },
          baselineValue: { type: ['number', 'null'] },
        },
      },
    },
    suggestedOneMove: {
      type: ['object', 'null'],
      additionalProperties: false,
      required: ['title', 'rationale'],
      properties: {
        title: { type: 'string' },
        rationale: { type: ['string', 'null'] },
      },
    },
    personalizedGuidance: { type: ['string', 'null'] },
  },
} as const;

export const MOVE_SUGGESTIONS_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['moves'],
  properties: {
    moves: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'rationale'],
        properties: {
          title: { type: 'string' },
          rationale: { type: ['string', 'null'] },
        },
      },
    },
  },
} as const;

export type PlannedWaypoint = {
  title: string;
  rationale: string | null;
  kind: ChartWaypointKind;
  progressMode: ChartProgressMode;
  metricLabel: string | null;
  metricTarget: number | null;
  metricBaseline: number | null;
};

export type PlannedMove = { title: string; rationale: string | null };

export type ChartGenerationResult =
  | { needsMoreContext: true; followUpQuestion: string }
  | {
      needsMoreContext: false;
      destination: string;
      complexity: ChartComplexity;
      waypoints: PlannedWaypoint[];
      suggestedOneMove: PlannedMove | null;
      personalizedGuidance: string | null;
    };

export class ChartPlanValidationError extends Error {
  constructor(readonly reason: string) {
    super(`chart_plan_invalid:${reason}`);
    this.name = 'ChartPlanValidationError';
  }
}

function clean(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function cleanTitle(value: string | null | undefined, max: number): string {
  // Titles read as labels, not sentences.
  return clean(value).replace(/[.;:,]+$/, '').slice(0, max).trim();
}

function cleanOptional(value: string | null | undefined, max: number): string | null {
  const text = clean(value);
  if (!text) return null;
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Hype is never earned by a plan the user has not started. Guidance that
 * shouts or cheerleads is dropped rather than shown.
 */
const HYPE_PATTERN =
  /!|\b(you['’]ve got this|you got this|crush(ing)?|unstoppable|dream big|let['’]s go|amazing|awesome|incredible|limitless|manifest)\b/i;

export function isHype(text: string): boolean {
  return HYPE_PATTERN.test(text);
}

/** Complexity implied by a route length (used when a model's label and count disagree). */
export function complexityForCount(count: number): ChartComplexity {
  if (count <= 3) return 'SIMPLE';
  if (count <= 5) return 'MODERATE';
  return 'COMPLEX';
}

export function isCountWithinBand(complexity: ChartComplexity, count: number): boolean {
  const band = COMPLEXITY_WAYPOINT_BANDS[complexity];
  return count >= band.min && count <= band.max;
}

function normalizeKind(value: string): ChartWaypointKind {
  const upper = clean(value).toUpperCase();
  return (CHART_WAYPOINT_KINDS as readonly string[]).includes(upper)
    ? (upper as ChartWaypointKind)
    : 'MILESTONE';
}

function normalizeProgressMode(value: string | null | undefined): ChartProgressMode | null {
  const lower = clean(value).toLowerCase();
  return (CHART_PROGRESS_MODES as readonly string[]).includes(lower) ? (lower as ChartProgressMode) : null;
}

/**
 * Chart setup is not a waypoint. "Establish your current baseline" belongs to the reading phase, so a
 * title that only gathers or confirms a starting point is dropped from the route.
 */
const SETUP_WAYPOINT_PATTERN =
  /^(establish|determine|document|record|measure|define|identify|assess|confirm|verify|set up|track|log|calculate|find out)\b.*\b(baseline|starting point|current (state|level|position|income|weight|status))\b/i;

export function isSetupWaypointTitle(title: string): boolean {
  return SETUP_WAYPOINT_PATTERN.test(title.trim());
}

function finitePositive(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function normalizeWaypoint(raw: z.infer<typeof RawWaypointSchema>): PlannedWaypoint | null {
  const title = cleanTitle(raw.title, TITLE_MAX);
  if (title.length < 3) return null;
  let kind = normalizeKind(raw.type);
  const declared = normalizeProgressMode(raw.metricType);
  // The declared metric type is the contract; legacy output without one falls back to the kind.
  if (declared === 'numeric') kind = 'METRIC';
  else if (declared && kind === 'METRIC') kind = 'MILESTONE';
  let metricTarget = finitePositive(raw.targetValue);
  let metricLabel = cleanOptional(raw.targetMetric, METRIC_LABEL_MAX);
  let metricBaseline =
    typeof raw.baselineValue === 'number' && Number.isFinite(raw.baselineValue) && raw.baselineValue >= 0
      ? raw.baselineValue
      : null;
  // A metric needs a real target. Anything else is a milestone in disguise.
  if (kind === 'METRIC' && metricTarget === null) kind = 'MILESTONE';
  const progressMode: ChartProgressMode =
    kind === 'METRIC' ? 'numeric' : declared && declared !== 'numeric' ? declared : 'moves';
  if (kind !== 'METRIC') {
    metricTarget = null;
    metricLabel = null;
    metricBaseline = null;
  }
  if (metricTarget !== null && metricBaseline !== null && metricBaseline >= metricTarget) {
    metricBaseline = null;
  }
  return {
    title,
    rationale: cleanOptional(raw.rationale, RATIONALE_MAX),
    kind,
    progressMode,
    metricLabel,
    metricTarget,
    metricBaseline,
  };
}

export function normalizeMove(raw: { title: string; rationale: string | null } | null): PlannedMove | null {
  if (!raw) return null;
  const title = cleanTitle(raw.title, MOVE_TITLE_MAX);
  if (title.length < 3) return null;
  return { title, rationale: cleanOptional(raw.rationale, RATIONALE_MAX) };
}

/**
 * Validates and normalizes raw model output.
 *
 * Throws ChartPlanValidationError when the output cannot be trusted — the
 * caller then moves to the next provider rather than showing a bad route.
 */
export function normalizeGenerationResult(
  input: unknown,
  options: { allowFollowUp: boolean; minWaypoints?: number }
): ChartGenerationResult {
  const parsed = RawGenerationSchema.safeParse(input);
  if (!parsed.success) throw new ChartPlanValidationError('schema');
  const raw = parsed.data;

  if (raw.needsMoreContext) {
    const question = cleanOptional(raw.followUpQuestion, QUESTION_MAX);
    if (options.allowFollowUp && question && question.endsWith('?') && !isHype(question)) {
      return { needsMoreContext: true, followUpQuestion: question };
    }
    // The model asked when it may not (or asked badly). A route is only usable
    // if it also supplied one; otherwise this output is rejected.
    if (raw.waypoints.length === 0) throw new ChartPlanValidationError('unwanted_follow_up');
  }

  const destination = cleanTitle(raw.destination, DESTINATION_MAX);
  if (destination.length < 3) throw new ChartPlanValidationError('destination');

  const seen = new Set<string>();
  const waypoints: PlannedWaypoint[] = [];
  for (const candidate of raw.waypoints) {
    const waypoint = normalizeWaypoint(candidate);
    if (!waypoint) continue;
    // Never drop below the minimum route length: setup titles only go while enough real waypoints remain.
    if (isSetupWaypointTitle(waypoint.title) && raw.waypoints.length - 1 >= MIN_GENERATED_WAYPOINTS) continue;
    const key = waypoint.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    waypoints.push(waypoint);
  }
  if (waypoints.length < (options.minWaypoints ?? MIN_GENERATED_WAYPOINTS)) {
    throw new ChartPlanValidationError('too_few');
  }
  // Maximum decomposition is not the goal. An over-long route is a malformed
  // route, not something to silently truncate into a different plan.
  if (waypoints.length > MAX_GENERATED_WAYPOINTS) throw new ChartPlanValidationError('too_many');

  const claimed = (CHART_COMPLEXITIES as readonly string[]).includes(clean(raw.complexity).toUpperCase())
    ? (clean(raw.complexity).toUpperCase() as ChartComplexity)
    : null;
  const complexity =
    claimed && isCountWithinBand(claimed, waypoints.length) ? claimed : complexityForCount(waypoints.length);

  const guidance = cleanOptional(raw.personalizedGuidance, GUIDANCE_MAX);

  return {
    needsMoreContext: false,
    destination,
    complexity,
    waypoints,
    suggestedOneMove: normalizeMove(raw.suggestedOneMove),
    personalizedGuidance: guidance && !isHype(guidance) ? guidance : null,
  };
}

export function normalizeMoveSuggestions(input: unknown, existingTitles: string[] = []): PlannedMove[] {
  const parsed = RawMoveSuggestionsSchema.safeParse(input);
  if (!parsed.success) throw new ChartPlanValidationError('schema');
  const seen = new Set(existingTitles.map(title => title.toLowerCase()));
  const moves: PlannedMove[] = [];
  for (const candidate of parsed.data.moves) {
    const move = normalizeMove(candidate);
    if (!move || seen.has(move.title.toLowerCase())) continue;
    seen.add(move.title.toLowerCase());
    moves.push(move);
    if (moves.length === 3) break;
  }
  if (moves.length === 0) throw new ChartPlanValidationError('no_moves');
  return moves;
}
