import {
  COMPLEXITY_WAYPOINT_BANDS,
  ChartPlanValidationError,
  complexityForCount,
  isCountWithinBand,
  normalizeGenerationResult,
  normalizeMoveSuggestions,
} from '../chartPlanSchema';
import { buildTemplateRoute, parseNumericTarget } from '../chartTemplateRoute';
import { toOpenAiStrictSchema } from '../chartModelProviders';
import { GENERATION_JSON_SCHEMA } from '../chartPlanSchema';

function waypoint(title: string, extra: Partial<Record<string, unknown>> = {}) {
  return {
    title,
    rationale: 'Why this matters.',
    type: 'MILESTONE',
    targetMetric: null,
    targetValue: null,
    baselineValue: null,
    ...extra,
  };
}

function route(titles: string[], overrides: Record<string, unknown> = {}) {
  return {
    needsMoreContext: false,
    followUpQuestion: null,
    destination: 'Reach 10,000 active users',
    complexity: 'MODERATE',
    waypoints: titles.map(title => waypoint(title)),
    suggestedOneMove: { title: 'Finish onboarding redesign', rationale: null },
    personalizedGuidance: 'Retention is the lever here, so the early waypoints focus on it.',
    ...overrides,
  };
}

describe('complexity → waypoint count rules', () => {
  it('uses overlapping bands: SIMPLE 2–4, MODERATE 4–6, COMPLEX 6–8', () => {
    expect(COMPLEXITY_WAYPOINT_BANDS).toEqual({
      SIMPLE: { min: 2, max: 4 },
      MODERATE: { min: 4, max: 6 },
      COMPLEX: { min: 6, max: 8 },
    });
    expect(isCountWithinBand('SIMPLE', 4)).toBe(true);
    expect(isCountWithinBand('MODERATE', 4)).toBe(true);
    expect(isCountWithinBand('SIMPLE', 5)).toBe(false);
    expect(isCountWithinBand('COMPLEX', 5)).toBe(false);
  });

  it('derives a complexity from count when the model label disagrees', () => {
    expect(complexityForCount(2)).toBe('SIMPLE');
    expect(complexityForCount(5)).toBe('MODERATE');
    expect(complexityForCount(7)).toBe('COMPLEX');
    const result = normalizeGenerationResult(route(['One', 'Two', 'Three'], { complexity: 'COMPLEX' }), {
      allowFollowUp: true,
    });
    expect(result.needsMoreContext).toBe(false);
    if (!result.needsMoreContext) expect(result.complexity).toBe('SIMPLE');
  });

  it('keeps a label that fits its count', () => {
    const result = normalizeGenerationResult(route(['A one', 'A two', 'A three', 'A four'], { complexity: 'SIMPLE' }), {
      allowFollowUp: true,
    });
    if (!result.needsMoreContext) expect(result.complexity).toBe('SIMPLE');
  });

  it('rejects more than 8 waypoints instead of truncating into a different plan', () => {
    const titles = Array.from({ length: 9 }, (_, index) => `Waypoint ${index + 1}`);
    expect(() => normalizeGenerationResult(route(titles), { allowFollowUp: true })).toThrow(
      ChartPlanValidationError
    );
  });

  it('rejects fewer than 2 waypoints for a new route but allows 1 when revising what is ahead', () => {
    expect(() => normalizeGenerationResult(route(['Only one']), { allowFollowUp: true })).toThrow(/too_few/);
    const revised = normalizeGenerationResult(route(['Only one']), { allowFollowUp: false, minWaypoints: 1 });
    if (!revised.needsMoreContext) expect(revised.waypoints).toHaveLength(1);
  });
});

describe('structured output validation', () => {
  it('rejects output that does not match the schema', () => {
    expect(() => normalizeGenerationResult({ waypoints: 'nope' }, { allowFollowUp: true })).toThrow(/schema/);
    expect(() => normalizeGenerationResult('A route with some steps', { allowFollowUp: true })).toThrow(/schema/);
    expect(() => normalizeGenerationResult(null, { allowFollowUp: true })).toThrow(/schema/);
  });

  it('drops duplicate and empty titles, and strips trailing punctuation', () => {
    const result = normalizeGenerationResult(
      route(['Reach 500 active users.', 'reach 500 active users', '', 'Reach 1,000 active users']),
      { allowFollowUp: true }
    );
    if (result.needsMoreContext) throw new Error('unexpected');
    expect(result.waypoints.map(item => item.title)).toEqual(['Reach 500 active users', 'Reach 1,000 active users']);
  });

  it('downgrades a METRIC waypoint with no usable target to a milestone', () => {
    const result = normalizeGenerationResult(
      {
        ...route([]),
        waypoints: [
          waypoint('Reach 1,000 active users', { type: 'METRIC', targetMetric: 'active users', targetValue: 1000, baselineValue: 100 }),
          waypoint('Retention holds', { type: 'METRIC', targetMetric: 'retention', targetValue: -4 }),
        ],
      },
      { allowFollowUp: true }
    );
    if (result.needsMoreContext) throw new Error('unexpected');
    expect(result.waypoints[0]).toMatchObject({ kind: 'METRIC', metricTarget: 1000, metricBaseline: 100, metricLabel: 'active users' });
    expect(result.waypoints[1]).toMatchObject({ kind: 'MILESTONE', metricTarget: null, metricLabel: null });
  });

  it('drops hype guidance rather than showing it', () => {
    const result = normalizeGenerationResult(
      route(['One step', 'Two step'], { personalizedGuidance: "You've got this! Dream big." }),
      { allowFollowUp: true }
    );
    if (!result.needsMoreContext) expect(result.personalizedGuidance).toBeNull();
  });

  it('returns exactly one follow-up question when context is missing', () => {
    const result = normalizeGenerationResult(
      route([], { needsMoreContext: true, followUpQuestion: 'Where are you starting from now?' }),
      { allowFollowUp: true }
    );
    expect(result).toEqual({ needsMoreContext: true, followUpQuestion: 'Where are you starting from now?' });
  });

  it('refuses a second follow-up after the user already answered one', () => {
    expect(() =>
      normalizeGenerationResult(
        route([], { needsMoreContext: true, followUpQuestion: 'What else can you share?' }),
        { allowFollowUp: false }
      )
    ).toThrow(/unwanted_follow_up/);
  });

  it('uses the route when a model asks a question it may not but still supplied one', () => {
    const result = normalizeGenerationResult(
      route(['First real users', 'Steady growth'], { needsMoreContext: true, followUpQuestion: 'Anything else?' }),
      { allowFollowUp: false }
    );
    expect(result.needsMoreContext).toBe(false);
  });

  it('validates move suggestions and removes ones the user already has', () => {
    expect(
      normalizeMoveSuggestions(
        {
          moves: [
            { title: 'Improve onboarding flow', rationale: null },
            { title: 'Launch creator campaign', rationale: 'Reach new users.' },
            { title: 'Optimize conversion funnel', rationale: null },
            { title: 'A fourth idea', rationale: null },
          ],
        },
        ['improve onboarding flow']
      ).map(move => move.title)
    ).toEqual(['Launch creator campaign', 'Optimize conversion funnel', 'A fourth idea']);
    expect(() => normalizeMoveSuggestions({ moves: [] })).toThrow(/no_moves/);
  });
});

describe('deterministic template route', () => {
  it('parses numeric targets with units and currency, ignoring bare years', () => {
    expect(parseNumericTarget('Anchor has ten thousand users')).toBeNull();
    expect(parseNumericTarget('Anchor has 10,000 active users')).toMatchObject({ value: 10000, unit: 'active users' });
    expect(parseNumericTarget('Save $50k by summer')).toMatchObject({ value: 50000, prefix: '$' });
    expect(parseNumericTarget('Move abroad in 2027')).toBeNull();
  });

  it('builds measured milestones from a number the person wrote', () => {
    const result = buildTemplateRoute({ intention: 'Anchor has 10,000 active users', startingContext: 'We have 100 active users today' });
    expect(result.needsNaming).toBe(false);
    expect(result.waypoints.map(item => item.title)).toEqual([
      'Reach 1,000 active users',
      'Reach 2,500 active users',
      'Reach 5,000 active users',
      'Reach 10,000 active users',
    ]);
    expect(result.waypoints.every(item => item.kind === 'METRIC' && item.metricBaseline === 100)).toBe(true);
  });

  it('falls back to a plain outline the user is invited to rename', () => {
    const result = buildTemplateRoute({ intention: 'I trust my own decisions', startingContext: null });
    expect(result.needsNaming).toBe(true);
    expect(result.waypoints).toHaveLength(3);
    expect(result.waypoints[2].title).toBe('I trust my own decisions');
  });
});

describe('provider schema adaptation', () => {
  it('rewrites nullable objects to anyOf for strict structured outputs', () => {
    const adapted = toOpenAiStrictSchema(GENERATION_JSON_SCHEMA) as {
      properties: { suggestedOneMove: { anyOf: Array<{ type: string }> } };
    };
    expect(adapted.properties.suggestedOneMove.anyOf.map(item => item.type)).toEqual(['object', 'null']);
  });
});
