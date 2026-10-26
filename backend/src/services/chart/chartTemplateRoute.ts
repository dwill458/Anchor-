import type { PlannedWaypoint } from './chartPlanSchema';
import { complexityForCount, DESTINATION_MAX, TITLE_MAX } from './chartPlanSchema';

/**
 * Deterministic last resort when no model is available or every provider
 * failed. It must never pretend to be insight: it produces either measured
 * steps derived from a number the person actually wrote, or a plain outline
 * the review screen presents as something to rename.
 */

export type TemplateRoute = {
  destination: string;
  complexity: ReturnType<typeof complexityForCount>;
  waypoints: PlannedWaypoint[];
  /** True when the outline is generic and the UI must invite renaming. */
  needsNaming: boolean;
};

type ParsedTarget = { value: number; unit: string; prefix: string };

const MULTIPLIERS: Record<string, number> = { k: 1_000, m: 1_000_000, b: 1_000_000_000 };

/** Finds "10,000 users", "$50k in savings", "5 clients" — the first number that has a unit. */
export function parseNumericTarget(text: string): ParsedTarget | null {
  const match = text.match(
    /(\$|£|€)?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*([kmb])?\b\s*([a-z][a-z'’-]*(?:\s+[a-z][a-z'’-]*){0,2})?/i
  );
  if (!match) return null;
  const base = Number(match[2].replace(/,/g, ''));
  if (!Number.isFinite(base) || base <= 0) return null;
  const multiplier = match[3] ? MULTIPLIERS[match[3].toLowerCase()] : 1;
  const value = base * multiplier;
  const prefix = match[1] ?? '';
  const unit = (match[4] ?? '').trim().toLowerCase();
  // A bare number without currency or unit ("in 2027") is not a target.
  if (!prefix && !unit) return null;
  if (/^(years?|months?|weeks?|days?|am|pm)$/.test(unit)) return null;
  return { value, unit, prefix };
}

export function formatMetricValue(value: number, prefix = ''): string {
  const rounded = Number.isInteger(value) ? value : Math.round(value * 10) / 10;
  return `${prefix}${rounded.toLocaleString('en-US')}`;
}

function clip(value: string, max: number): string {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : text.slice(0, max).trim();
}

export function buildTemplateRoute(input: {
  intention: string;
  startingContext: string | null;
}): TemplateRoute {
  const destination = clip(input.intention.replace(/[.!]+$/, ''), DESTINATION_MAX);
  const waypoints: PlannedWaypoint[] = [
    {
      title: 'First clear sign of progress',
      rationale: 'Name the first change that would show this is starting to happen.',
      kind: 'MILESTONE',
      progressMode: 'completion',
      metricLabel: null,
      metricTarget: null,
      metricBaseline: null,
      moves: [],
    },
    {
      title: 'Progress holds steady',
      rationale: 'Name what it looks like when the change is no longer a one-off.',
      kind: 'MILESTONE',
      progressMode: 'completion',
      metricLabel: null,
      metricTarget: null,
      metricBaseline: null,
      moves: [],
    },
    {
      title: clip(destination, TITLE_MAX),
      rationale: null,
      kind: 'MILESTONE',
      progressMode: 'completion',
      metricLabel: null,
      metricTarget: null,
      metricBaseline: null,
      moves: [],
    },
  ];
  return { destination, complexity: 'SIMPLE', waypoints, needsNaming: true };
}
