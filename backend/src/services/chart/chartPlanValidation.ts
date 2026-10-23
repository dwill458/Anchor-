import type { ChartPlanningContext } from './chartPlanPrompt';
import { ChartPlanValidationError, type ChartGenerationResult } from './chartPlanSchema';

/** Deterministic critical checks complement the model's bounded planning evidence.
 * They reject unsupported plans; they never synthesize personal facts or numbers. */
export function validatePlanSemantics(plan: ChartGenerationResult, context: ChartPlanningContext, options: { requireAnalysis?: boolean; requireRouteDesign?: boolean } = {}): ChartGenerationResult {
  if (plan.needsMoreContext) return plan;
  const fail = (reason: string): never => { throw new ChartPlanValidationError(reason); };
  if (options.requireAnalysis && !plan.analysis) fail('missing_analysis');
  if (options.requireRouteDesign && !plan.analysis?.routeDesign) fail('missing_route_design');
  const design = plan.analysis?.routeDesign;
  if (design && (design.selectedWaypointCount !== plan.waypoints.length || !design.complexityReason.trim() || !design.countReason.trim())) fail('route_design');
  const adjustment = context.adjustment;
  if (adjustment && adjustment.reason !== 'CHANGE_DESTINATION' && plan.destination !== adjustment.destination) fail('destination_changed');
  if (!plan.suggestedOneMove || !/\S+\s+\S+/.test(plan.suggestedOneMove.title) || /^(make progress|work on|keep going|try harder|believe)\b/i.test(plan.suggestedOneMove.title)) fail('one_move_not_actionable');
  const numeric = plan.waypoints.filter(w => w.progressMode === 'numeric');
  const start = context.actualStartingPoint ?? context.followUp?.answer ?? '';
  const hasStartPhoto = context.references?.photos.some(photo => photo.role === 'start') ?? false;
  if (!start && !hasStartPhoto && !adjustment && numeric.some(w => w.metricBaseline !== null)) fail('unsupported_baseline');
  const extractNumbers = (text: string): number[] => (text.match(/-?\d[\d,]*(?:\.\d+)?/g) ?? []).map(n => Number(n.replace(/,/g, '')));
  const statedNumbers = extractNumbers(start);
  // A start-role photo is present-day evidence. The planner must transcribe its relevant values
  // into startingPointSummary; destination Vision imagery is deliberately excluded here.
  const photoNumbers = hasStartPhoto ? extractNumbers(plan.analysis?.startingPointSummary ?? '') : [];
  const knownNumbers = [...statedNumbers, ...photoNumbers, ...(adjustment?.route.flatMap(w => [w.metricBaseline, w.metricCurrent, w.metricTarget].filter((n): n is number => typeof n === 'number')) ?? [])];
  // A later baseline may be an earlier achieved target. Initial money/ability
  // must come from written facts or recorded progress, never a future Vision.
  numeric.forEach((w, index) => {
    if (w.metricBaseline !== null && w.metricBaseline !== 0 && !knownNumbers.includes(w.metricBaseline) && !numeric.slice(0, index).some(previous => previous.metricTarget === w.metricBaseline)) fail('unsupported_baseline');
  });
  const constrained = /\b(beginner|starting from zero|no (experience|savings|income|investments|equipment)|limited|little spare|unemployed|cannot afford)\b/i.test(start) || adjustment?.reason === 'STARTING_FROM_ZERO';
  // An all-number ladder contains no prerequisite milestones. A smaller number
  // alone does not establish a smaller demand on a person's resources.
  if (numeric.length === plan.waypoints.length && numeric.length > 1 &&
      (constrained || adjustment?.reason === 'SMALLER_STEPS')) fail('numeric_subdivision');
  const financialGoal = /net worth|savings|saving|debt|wealth|financial/i.test(plan.destination);
  const statedCapacity = /(?:can save|can afford|surplus|spare|available)(?:\s+(?:of|is|about|around|up to))?\s+(?:\$\d[\d,.]*|\d[\d,.]*\s*(?:dollars|USD|per week|per month|monthly|weekly))/i.test(start);
  if (constrained && financialGoal && !statedCapacity && numeric.some(w => w.metricTarget !== null && !statedNumbers.includes(w.metricTarget))) fail('unsupported_financial_capacity');
  for (const w of plan.waypoints) {
    if (w.progressMode === 'numeric' && (!w.metricLabel || w.metricTarget === null || (w.metricBaseline !== null && w.metricTarget === w.metricBaseline))) fail('numeric_criteria');
    if (w.progressMode === 'checklist' && (!w.requirements?.length || w.requirements.some(r => !r.title.trim()) || new Set(w.requirements.map(r => r.title.toLowerCase())).size !== w.requirements.length)) fail('checklist_criteria');
    if (plan.analysis && !w.completionCriteria?.trim()) fail('completion_criteria');
  }
  if (plan.analysis) {
    if (!plan.analysis.firstMilestoneEvidence.trim() || !plan.analysis.startingPointSummary.trim()) fail('starting_alignment');
    const count = plan.waypoints.length;
    if (plan.analysis.prerequisites.length !== count || new Set(plan.analysis.prerequisites.map(p => p.waypointIndex)).size !== count) fail('prerequisite_completeness');
    for (const p of plan.analysis.prerequisites) {
      if (p.waypointIndex < 0 || p.waypointIndex >= count || p.requires.some(i => i < 0 || i >= p.waypointIndex)) fail('prerequisite_order');
    }
    if (adjustment?.reason === 'SMALLER_STEPS' && !plan.analysis.difficultyReduction?.trim()) fail('difficulty_reduction');
  }
  if (adjustment?.reason === 'SMALLER_STEPS') {
    const old = adjustment.route.filter(w => w.state !== 'REACHED');
    if (plan.waypoints.every((w, i) => w.title.toLowerCase() === old[i]?.title.toLowerCase())) fail('unchanged_difficulty');
    const first = plan.waypoints[0];
    const previous = old[0];
    const allAccounts = (text: string) => /\b(all|every|each)\b/i.test(text) && /accounts?|balances?/i.test(text);
    if (previous && allAccounts(`${previous.title} ${previous.completionCriteria ?? ''}`) && allAccounts(`${first.title} ${first.completionCriteria ?? ''}`)) fail('unchanged_first_scope');
    if (first.progressMode === 'numeric' && previous?.metricTarget != null && first.metricTarget != null) {
      const baseline = previous.metricCurrent ?? previous.metricBaseline ?? first.metricBaseline;
      if (baseline === null || baseline === undefined || Math.abs(first.metricTarget - baseline) >= Math.abs(previous.metricTarget - baseline)) fail('difficulty_not_reduced');
    }
  }
  return plan;
}
