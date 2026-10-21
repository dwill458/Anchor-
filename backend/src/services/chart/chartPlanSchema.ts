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
export const CHART_PROGRESS_MODES = ['numeric', 'checklist', 'completion', 'moves', 'none'] as const;
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
  completionCriteria: z.string().nullish(),
  requirements: z.array(z.string()).max(12).nullish(),
  moves: z.array(z.object({ title: z.string(), rationale: z.string().nullable() })).max(4).nullish(),
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
  routeScope: z.enum(['DESTINATION', 'NEXT_STRETCH']).optional(),
  analysis: z.object({
    startingPointSummary: z.string(), assumptions: z.array(z.string()).max(8),
    firstMilestoneEvidence: z.string(), difficultyReduction: z.string().nullable(),
    prerequisites: z.array(z.object({ waypointIndex: z.number().int(), requires: z.array(z.number().int()).max(8) })).max(8),
  }).optional(),
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
    'personalizedGuidance', 'routeScope', 'analysis',
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
        required: ['title', 'rationale', 'type', 'metricType', 'targetMetric', 'targetValue', 'baselineValue', 'completionCriteria', 'requirements', 'moves'],
        properties: {
          title: { type: 'string' },
          rationale: { type: ['string', 'null'] },
          type: { type: 'string', enum: [...CHART_WAYPOINT_KINDS] },
          metricType: { type: 'string', enum: [...CHART_PROGRESS_MODES] },
          targetMetric: { type: ['string', 'null'] },
          targetValue: { type: ['number', 'null'] },
          baselineValue: { type: ['number', 'null'] },
          completionCriteria: { type: 'string' },
          requirements: { type: 'array', items: { type: 'string' } },
          moves: {
            type: 'array', minItems: 3, maxItems: 4,
            items: {
              type: 'object', additionalProperties: false, required: ['title', 'rationale'],
              properties: { title: { type: 'string' }, rationale: { type: ['string', 'null'] } },
            },
          },
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
    routeScope: { type: 'string', enum: ['DESTINATION', 'NEXT_STRETCH'] },
    analysis: { type: 'object', additionalProperties: false,
      required: ['startingPointSummary', 'assumptions', 'firstMilestoneEvidence', 'difficultyReduction', 'prerequisites'],
      properties: {
        startingPointSummary: { type: 'string' }, assumptions: { type: 'array', items: { type: 'string' } },
        firstMilestoneEvidence: { type: 'string' }, difficultyReduction: { type: ['string', 'null'] },
        prerequisites: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['waypointIndex', 'requires'], properties: {
          waypointIndex: { type: 'integer' }, requires: { type: 'array', items: { type: 'integer' } },
        } } },
      },
    },
  },
} as const;

export const MOVE_SUGGESTIONS_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['moves'],
  properties: {
    moves: {
      minItems: 3,
      maxItems: 4,
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
  completionCriteria?: string | null;
  requirements?: Array<{ id: string; title: string; completed: boolean }>;
  title: string;
  rationale: string | null;
  kind: ChartWaypointKind;
  progressMode: ChartProgressMode;
  metricLabel: string | null;
  metricTarget: number | null;
  metricBaseline: number | null;
  moves?: PlannedMove[];
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
      routeScope?: 'DESTINATION' | 'NEXT_STRETCH';
      analysis?: z.infer<typeof RawGenerationSchema>['analysis'];
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
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e12 ? value : null;
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
    typeof raw.baselineValue === 'number' && Number.isFinite(raw.baselineValue) && Math.abs(raw.baselineValue) <= 1e12
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
  if (metricTarget !== null && metricBaseline === metricTarget) throw new ChartPlanValidationError('empty_metric_span');
  const seenMoves = new Set<string>();
  const moves: PlannedMove[] = [];
  if (Array.isArray(raw.moves)) {
    for (const candidate of raw.moves) {
      const move = normalizeMove(candidate);
      if (!move || seenMoves.has(move.title.toLowerCase())) continue;
      seenMoves.add(move.title.toLowerCase());
      moves.push(move);
      if (moves.length === 4) break;
    }
    // If moves were provided by the model but fewer than 3 unique valid moves survived,
    // supplement with deterministic action steps rather than crashing the entire route.
    if (moves.length > 0 && moves.length < 3) {
      const supplements = [
        { title: `Clarify next milestone requirements for ${title.slice(0, 40)}`, rationale: 'Breaks down the immediate requirements.' },
        { title: `Complete first action toward ${title.slice(0, 40)}`, rationale: 'Moves the milestone forward.' },
        { title: `Verify progress toward ${title.slice(0, 40)}`, rationale: 'Confirms completion criteria are met.' },
      ];
      for (const sup of supplements) {
        if (!seenMoves.has(sup.title.toLowerCase())) {
          seenMoves.add(sup.title.toLowerCase());
          moves.push(sup);
          if (moves.length === 3) break;
        }
      }
    }
  }
  return {
    title,
    completionCriteria: cleanOptional(raw.completionCriteria, 400),
    requirements: (raw.requirements ?? []).map((text, i) => ({ id: `requirement-${i + 1}`, title: clean(text).slice(0, 140), completed: false })),
    rationale: cleanOptional(raw.rationale, RATIONALE_MAX),
    kind,
    progressMode,
    metricLabel,
    metricTarget,
    metricBaseline,
    moves,
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
    // Legacy setup cleanup predates prerequisite evidence. Keep explicitly evidenced foundation states intact so their prerequisite indices remain valid.
    if (!raw.analysis && isSetupWaypointTitle(waypoint.title) && raw.waypoints.length - 1 >= MIN_GENERATED_WAYPOINTS) continue;
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

  let analysis = raw.analysis;
  if (analysis) {
    const existing = new Map<number, number[]>(
      analysis.prerequisites.map(p => [p.waypointIndex, p.requires])
    );
    const normalizedPrereqs: Array<{ waypointIndex: number; requires: number[] }> = [];
    for (let i = 0; i < waypoints.length; i++) {
      const reqs = existing.get(i) ?? (i > 0 ? [i - 1] : []);
      normalizedPrereqs.push({
        waypointIndex: i,
        requires: reqs.filter(r => r >= 0 && r < i),
      });
    }
    analysis = {
      ...analysis,
      prerequisites: normalizedPrereqs,
    };
  }

  return {
    needsMoreContext: false,
    routeScope: raw.routeScope ?? 'DESTINATION',
    analysis,
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
    if (moves.length === 4) break;
  }
  if (moves.length === 0) throw new ChartPlanValidationError('no_moves');
  return moves;
}
