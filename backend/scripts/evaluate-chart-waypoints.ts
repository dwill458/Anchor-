/** Read-only live-provider evaluation. Requires --run; never creates or changes a user Chart. */
import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { resolveChartPlannerConfig } from '../src/services/chart/chartModelProviders';
import { CHART_PLANNER_SYSTEM, buildPlanningUserMessage, type ChartPlanningContext } from '../src/services/chart/chartPlanPrompt';
import { GENERATION_JSON_SCHEMA, normalizeGenerationResult } from '../src/services/chart/chartPlanSchema';
import { validatePlanSemantics } from '../src/services/chart/chartPlanValidation';

const scenarios = [
  { name: 'simple', intention: 'I maintain a consistent workout routine.', category: 'health', start: 'I exercise sporadically. I can use three 30-minute slots each week for bodyweight exercise at home.' },
  { name: 'moderate', intention: 'I successfully complete my first half marathon.', category: 'health', start: 'I run 5 km comfortably twice a week. I can train three days each week. I have never completed a half marathon.' },
  { name: 'complex', intention: 'Anchor has 10,000 paying users.', category: 'career', start: 'Anchor is launched with 20 paying users. I am the solo developer, with 10 hours a week for growth and no paid advertising budget. I can contact current users and have subscription analytics.' },
];

async function main() {
  if (!process.argv.includes('--run')) throw new Error('Use --run to authorize the three live model requests. No database writes occur.');
  const labelIndex = process.argv.indexOf('--label');
  const label = labelIndex >= 0 ? process.argv[labelIndex + 1] : 'evaluation';
  if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Invalid evaluation label');
  const config = resolveChartPlannerConfig();
  if (process.argv.includes('--fallback-only')) config.providers = config.providers.filter(p => p.name === 'gemini');
  if (!config.providers.length) throw new Error('No configured Chart provider');
  const results = await Promise.all(scenarios.map(async scenario => {
    const context: ChartPlanningContext = {
      intention: scenario.intention, category: scenario.category, actualStartingPoint: scenario.start,
      startingContext: null, destinationDescription: scenario.intention,
      vision: scenario.name === 'complex' ? { title: 'A sustainable Anchor business', description: '10,000 paying users who continue using Anchor', notes: ['Prioritize retention and repeatable acquisition'] } : null,
      followUp: null, adjustment: null,
    };
    const attempts: Array<{ provider: string; model: string; latencyMs: number; raw: unknown; rawCount: number | null; normalizedCount: number | null; validatedCount?: number; error?: string }> = [];
    for (const [index, provider] of config.providers.slice(0, 2).entries()) {
      let raw: unknown;
      let normalizedCount: number | null = null;
      const started = Date.now();
      try {
        raw = await provider.generateJson({ schemaName: 'chart_route', jsonSchema: GENERATION_JSON_SCHEMA as unknown as Record<string, unknown>, system: CHART_PLANNER_SYSTEM, user: buildPlanningUserMessage(context, { allowFollowUp: false }), timeoutMs: index === 0 ? config.primaryTimeoutMs : config.fallbackTimeoutMs, temperature: 0.4 });
        const normalized = normalizeGenerationResult(raw, { allowFollowUp: false });
        normalizedCount = normalized.needsMoreContext ? 0 : normalized.waypoints.length;
        const validated = validatePlanSemantics(normalized, context, { requireAnalysis: true, requireRouteDesign: true });
        attempts.push({ provider: provider.name, model: provider.model, latencyMs: Date.now() - started, raw, rawCount: (raw as { waypoints: unknown[] }).waypoints.length, normalizedCount, validatedCount: validated.needsMoreContext ? 0 : validated.waypoints.length });
        return { scenario: scenario.name, context, provider: provider.name, attempts, validated };
      } catch (error) {
        attempts.push({ provider: provider.name, model: provider.model, latencyMs: Date.now() - started, raw, rawCount: Array.isArray((raw as { waypoints?: unknown[] })?.waypoints) ? (raw as { waypoints: unknown[] }).waypoints.length : null, normalizedCount, error: error instanceof Error ? error.message : 'unknown' });
      }
    }
    return { scenario: scenario.name, context, attempts, error: 'All providers failed validation or generation' };
  }));
  const evidence = { label, generatedAt: new Date().toISOString(), providers: config.providers.map(p => ({ name: p.name, model: p.model })), promptHash: createHash('sha256').update(CHART_PLANNER_SYSTEM).digest('hex'), note: 'Illustrative stated starting points; live provider calls, no user Chart writes.', results };
  const directory = resolve(__dirname, '../../tasks/chart-review-refinement');
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, `${label}.json`), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ label, results: results.map(result => ({ scenario: result.scenario, attempts: result.attempts.map(({ raw: _raw, ...counts }) => counts), plan: result.validated && !result.validated.needsMoreContext ? { complexity: result.validated.complexity, waypoints: result.validated.waypoints.map(w => ({ title: w.title, done: w.completionCriteria })), oneMove: result.validated.suggestedOneMove } : null, error: result.error })) }, null, 2));
  if (results.some(result => !result.validated)) process.exitCode = 1;
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Evaluation failed'); process.exitCode = 1; });
