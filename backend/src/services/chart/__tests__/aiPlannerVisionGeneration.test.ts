import { resolveChartPlannerConfig } from '../chartModelProviders';
import { GENERATION_JSON_SCHEMA, normalizeGenerationResult } from '../chartPlanSchema';
import { CHART_PLANNER_SYSTEM, buildPlanningUserMessage } from '../chartPlanPrompt';
import { validatePlanSemantics } from '../chartPlanValidation';

const hasApiKey = Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY);
const describeWithAi = hasApiKey ? describe : describe.skip;

describeWithAi('AI Planner Vision-Aware & Text Generation (Live Provider)', () => {
  const config = resolveChartPlannerConfig();
  const provider = config.providers[0];

  it('generates personalized, actionable waypoints and One Move for SaaS goal with Vision and starting metrics', async () => {
    const context = {
      intention: 'Anchor reaches 1,000 paying users',
      category: 'career',
      startingContext: 'Early stage SaaS dashboard with 50 paying users',
      actualStartingPoint: 'We currently have 50 paying users and $500 MRR.',
      destinationDescription: '1,000 active paying subscribers generating predictable revenue',
      vision: {
        title: 'SaaS Analytics Dashboard',
        description: 'Showing 1000 active subscriptions and MRR chart',
        notes: ['Focus on subscription retention', 'Target $10k MRR'],
        captions: ['RevenueCat analytics graph', 'Stripe customer list'],
      },
      progress: {
        practiceCount: 5,
        lastPracticedAt: new Date().toISOString(),
      },
      visionImageCount: 0,
      followUp: null,
      adjustment: null,
    };

    const userMessage = buildPlanningUserMessage(context, { allowFollowUp: false });
    const raw = await provider.generateJson({
      schemaName: 'chart_route',
      jsonSchema: GENERATION_JSON_SCHEMA as unknown as Record<string, unknown>,
      system: CHART_PLANNER_SYSTEM,
      user: userMessage,
      timeoutMs: 35000,
      temperature: 0.4,
    });

    const normalized = normalizeGenerationResult(raw, { allowFollowUp: false });
    expect(normalized.needsMoreContext).toBe(false);

    const validated = validatePlanSemantics(normalized, context, { requireAnalysis: true });
    expect(validated.needsMoreContext).toBe(false);

    if (validated.needsMoreContext) return;

    // Absolute supported range, not a complexity quota.
    expect(validated.waypoints.length).toBeGreaterThanOrEqual(2);
    expect(validated.waypoints.length).toBeLessThanOrEqual(8);

    // Milestones must not be generic fallback strings
    for (const waypoint of validated.waypoints) {
      expect(waypoint.title).not.toMatch(/first clear sign of progress/i);
      expect(waypoint.title).not.toMatch(/progress holds steady/i);
      expect(waypoint.title.length).toBeGreaterThan(5);
    }

    // Concrete first One Move
    expect(validated.suggestedOneMove).toBeDefined();
    expect(validated.suggestedOneMove?.title).toBeDefined();
    expect(validated.suggestedOneMove!.title.length).toBeGreaterThan(5);
  }, 45000);

  it('generates a valid route for a text-only goal without Vision', async () => {
    const context = {
      intention: 'Run a 10k race under 50 minutes',
      category: 'health',
      startingContext: 'Currently running 5k in 28 minutes twice a week',
      actualStartingPoint: 'Current 5k baseline is 28 minutes',
      destinationDescription: 'Complete an official 10k race in under 50 minutes',
      vision: null,
      visionImageCount: 0,
      followUp: null,
      adjustment: null,
    };

    const userMessage = buildPlanningUserMessage(context, { allowFollowUp: false });
    const raw = await provider.generateJson({
      schemaName: 'chart_route',
      jsonSchema: GENERATION_JSON_SCHEMA as unknown as Record<string, unknown>,
      system: CHART_PLANNER_SYSTEM,
      user: userMessage,
      timeoutMs: 35000,
      temperature: 0.4,
    });

    const normalized = normalizeGenerationResult(raw, { allowFollowUp: false });
    expect(normalized.needsMoreContext).toBe(false);

    const validated = validatePlanSemantics(normalized, context, { requireAnalysis: true });
    expect(validated.needsMoreContext).toBe(false);

    if (validated.needsMoreContext) return;

    expect(validated.waypoints.length).toBeGreaterThanOrEqual(2);
    expect(validated.suggestedOneMove?.title).toBeDefined();
  }, 45000);
});
