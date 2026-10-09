import { validatePlanSemantics } from '../chartPlanValidation';
import { ChartPlanValidationError, type ChartGenerationResult, type PlannedWaypoint } from '../chartPlanSchema';
import type { ChartPlanningContext } from '../chartPlanPrompt';

const destination = 'Reach $111,000 net worth';
const constrained: ChartPlanningContext = {
  intention: destination,
  category: 'abundance',
  startingContext: destination,
  destinationDescription: destination,
  actualStartingPoint: 'I have $20 in savings, no investments, and little spare income.',
  vision: null,
  followUp: null,
  adjustment: null,
};

function numeric(target: number): PlannedWaypoint {
  return { title: `Reach $${target.toLocaleString('en-US')} net worth`, rationale: 'Make measurable progress.', kind: 'METRIC', progressMode: 'numeric', metricLabel: 'USD net worth', metricTarget: target, metricBaseline: 20 };
}

function plan(waypoints: PlannedWaypoint[], extra: Record<string, unknown> = {}): Extract<ChartGenerationResult, { needsMoreContext: false }> {
  return {
    needsMoreContext: false,
    destination,
    complexity: 'MODERATE',
    waypoints,
    suggestedOneMove: { title: 'Write down this week’s essential costs and available income', rationale: 'Choose a feasible next step from real resources.' },
    personalizedGuidance: 'This route covers the next achievable stretch; the original destination remains.',
    ...extra,
  };
}

function completion(title: string): PlannedWaypoint {
  return { title, rationale: 'An observable prerequisite is in place.', kind: 'MILESTONE', progressMode: 'none', metricLabel: null, metricTarget: null, metricBaseline: null };
}

describe('Chart plan semantic validation', () => {
  it('rejects five arbitrary financial intervals from limited starting resources', () => {
    const generated = plan([22200, 44400, 66600, 88800, 111000].map(numeric));
    expect(() => validatePlanSemantics(generated, constrained)).toThrow(ChartPlanValidationError);
  });

  it('rejects smaller steps that only lower arbitrary net-worth targets', () => {
    const original = [22200, 44400, 66600, 88800, 111000].map(numeric);
    const context: ChartPlanningContext = {
      ...constrained,
      adjustment: {
        reason: 'SMALLER_STEPS', detail: 'The first step is far too big. I have very little money.', destination,
        route: original.map(item => ({ title: item.title, state: 'UPCOMING', metric: `${item.metricTarget} USD net worth`, metricTarget: item.metricTarget, metricBaseline: 20, metricCurrent: 20 })),
        completedMoveCount: 0,
      },
    };
    expect(() => validatePlanSemantics(plan([11100, 22200, 44400, 66600, 111000].map(numeric)), context)).toThrow(ChartPlanValidationError);
  });

  it('does not mistake fifteen minutes of available time for money capacity', () => {
    const context = { ...constrained, actualStartingPoint: 'Limited resources, little spare money; I can spend 15 minutes today.' };
    expect(() => validatePlanSemantics(plan([completion('Costs understood'), { ...numeric(1000), metricBaseline: 0 }]), context)).toThrow(/unsupported_financial_capacity/);
  });

  it('rejects invented reserve amounts even when surrounded by financial prerequisites', () => {
    expect(() => validatePlanSemantics(plan([completion('Account totals documented'), numeric(1000), completion('Investment account opened')]), constrained)).toThrow(/unsupported_financial_capacity/);
  });

  it('rejects an all-account task reworded as smaller steps', () => {
    const context: ChartPlanningContext = { ...constrained, adjustment: { reason: 'SMALLER_STEPS', detail: 'Too big', destination, route: [{ title: 'List all account balances', state: 'CURRENT' }], completedMoveCount: 0 } };
    const first = { ...completion('Account balances listed'), completionCriteria: 'All active account balances are in one place.' };
    expect(() => validatePlanSemantics(plan([first, completion('A feasible contribution identified')]), context)).toThrow(/unchanged_first_scope/);
  });

  it('accepts a prerequisite-based next stretch without pretending to reach the full destination', () => {
    const generated = plan([
      completion('A feasible surplus is identified from essential costs'),
      completion('One achievable saving commitment is in place'),
      completion('First chosen buffer contribution recorded'),
    ]);
    expect(validatePlanSemantics(generated, constrained)).toMatchObject({ destination });
  });

  it('preserves the original destination when changing the approach', () => {
    const context: ChartPlanningContext = { ...constrained, adjustment: { reason: 'CHANGE_APPROACH', detail: 'Use a different approach.', destination, route: [], completedMoveCount: 2 } };
    expect(() => validatePlanSemantics(plan([completion('A feasible saving commitment exists'), completion('First contribution recorded')], { destination: 'Save $500' }), context)).toThrow(ChartPlanValidationError);
  });

  it('requires an actionable One Move rather than accepting a route without one', () => {
    expect(() => validatePlanSemantics(plan([completion('Essential costs are understood'), completion('A feasible surplus is identified')], { suggestedOneMove: null }), constrained)).toThrow(ChartPlanValidationError);
  });

  it('does not let destination Vision resources establish a fabricated numeric baseline', () => {
    const context: ChartPlanningContext = { ...constrained, actualStartingPoint: null, vision: { title: 'My future investment account', description: 'A future account with $50,000 invested.' } };
    const generated = plan([numeric(55000), numeric(65000)].map(item => ({ ...item, metricBaseline: 50000 })));
    expect(() => validatePlanSemantics(generated, context)).toThrow(ChartPlanValidationError);
  });

  it('accepts one useful clarification when starting resources are unknown', () => {
    const clarification: ChartGenerationResult = { needsMoreContext: true, followUpQuestion: 'What income, savings, and essential costs are you starting with?' };
    expect(validatePlanSemantics(clarification, { ...constrained, actualStartingPoint: null })).toEqual(clarification);
  });
});

function evidencedPlan(destinationText: string, start: string, titles: string[], oneMove: string) {
  return plan(titles.map(title => ({ ...completion(title), progressMode: 'completion', completionCriteria: title, requirements: [] })), {
    destination: destinationText,
    routeScope: 'NEXT_STRETCH',
    suggestedOneMove: { title: oneMove, rationale: 'A small action based on the supplied starting point.' },
    analysis: { startingPointSummary: start, assumptions: [], firstMilestoneEvidence: 'The first state uses only resources and abilities explicitly supplied.', difficultyReduction: null, prerequisites: titles.map((_title, waypointIndex) => ({ waypointIndex, requires: waypointIndex === 0 ? [] : [waypointIndex - 1] })) },
  });
}

describe('Representative planning domains with structured validation evidence', () => {
  it('accepts a beginner fitness next stretch without claiming a marathon in five leaps', () => {
    const start = 'I am a beginner and currently walk for ten minutes comfortably.';
    const context = { ...constrained, intention: 'Complete a marathon', category: 'health', destinationDescription: 'Complete a marathon', actualStartingPoint: start };
    const generated = evidencedPlan('Complete a marathon', start, ['A comfortable short walk is repeatable', 'A manageable walking routine is established', 'Readiness for a gentle running progression is assessed'], 'Choose one ten-minute walking slot this week');
    expect(validatePlanSemantics(generated, context, { requireAnalysis: true })).toMatchObject({ routeScope: 'NEXT_STRETCH', destination: 'Complete a marathon' });
  });

  it('rejects career plans that depend on prerequisites appearing after the hiring milestone', () => {
    const start = 'I have no software experience and want to move from retail into development.';
    const context = { ...constrained, intention: 'Get a software role', category: 'career', actualStartingPoint: start };
    const generated = evidencedPlan('Get a software role', start, ['A relevant portfolio example exists', 'Interview readiness is demonstrated', 'A suitable software role is secured'], 'Compare two entry-level job postings for required skills');
    generated.analysis!.prerequisites = [{ waypointIndex: 0, requires: [2] }, { waypointIndex: 1, requires: [0] }, { waypointIndex: 2, requires: [1] }];
    expect(() => validatePlanSemantics(generated, context, { requireAnalysis: true })).toThrow(/prerequisite_order/);
  });

  it('rejects omitted prerequisites rather than treating valid JSON as a complete career plan', () => {
    const generated = evidencedPlan('Get a software role', 'No software experience.', ['A portfolio example exists', 'Interview readiness demonstrated'], 'Identify one beginner portfolio project');
    generated.analysis!.prerequisites = [{ waypointIndex: 1, requires: [0] }];
    expect(() => validatePlanSemantics(generated, { ...constrained, actualStartingPoint: 'No software experience.' }, { requireAnalysis: true })).toThrow(/prerequisite_completeness/);
  });

  it('accepts an observable creative route without fabricated numerical targets', () => {
    const start = 'I have a rough story outline and want to finish a short film.';
    const generated = evidencedPlan('Finish and share a short film', start, ['A shootable script is complete', 'A feasible production plan is ready', 'A first scene has been filmed'], 'Write one scene from the existing outline');
    const result = validatePlanSemantics(generated, { ...constrained, category: 'creativity', actualStartingPoint: start, vision: null }, { requireAnalysis: true });
    if (result.needsMoreContext) throw new Error('Unexpected clarification');
    expect(result.waypoints.every(item => item.metricTarget === null && item.progressMode === 'completion')).toBe(true);
  });

  it('uses supplied business traction as the baseline without asking for Vision or a photo', () => {
    const start = 'The app is live with 100 active users and no ad budget.';
    const generated = evidencedPlan('Reach 1,000 active users', start, ['The leading onboarding obstacle is understood', 'Reach 150 active users'], 'Ask one existing user where onboarding became confusing');
    generated.waypoints[1] = { ...numeric(150), title: 'Reach 150 active users', metricLabel: 'active users', metricBaseline: 100, completionCriteria: '150 active users are visible in the existing analytics', requirements: [] };
    expect(validatePlanSemantics(generated, { ...constrained, category: 'career', actualStartingPoint: start, vision: null, references: null }, { requireAnalysis: true })).toMatchObject({ destination: 'Reach 1,000 active users' });
  });

  it('rejects production output without planning evidence', () => {
    expect(() => validatePlanSemantics(plan([completion('A script is ready'), completion('A scene is filmed')]), constrained, { requireAnalysis: true })).toThrow(/missing_analysis/);
  });
});
