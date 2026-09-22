import type { SigilVariant } from '@/types';

/** Time-of-day greeting. Presentation only; never a data authority. */
export function resolveGreeting(now: Date = new Date(), name?: string | null): string {
  const hour = now.getHours();
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const trimmed = name?.trim();
  return trimmed ? `${part}, ${trimmed}` : part;
}

/**
 * Editorial names for the deterministic structure variants. The mockup exposes
 * "Focused"; legacy geometry only distinguishes three variants, so this maps
 * them to grounded language without occult framing. A future 4-structure
 * creation contract (Focused / Contained / Raw / Drawn) can replace this.
 */
export const STRUCTURE_SYSTEM_COPY: Record<
  SigilVariant,
  { name: string; qualities: string; description: string; rationale: string }
> = {
  balanced: {
    name: 'Focused',
    qualities: 'Balanced · Directed · Precise',
    description: 'A structured form built around a clear center.',
    rationale: 'Balanced geometry · Defined center.',
  },
  dense: {
    name: 'Contained',
    qualities: 'Layered · Dense · Enclosed',
    description: 'A tightly woven form that holds many lines together.',
    rationale: 'High line count · Strong perimeter.',
  },
  minimal: {
    name: 'Raw',
    qualities: 'Sparse · Open · Direct',
    description: 'A pared-back form with only the essential strokes.',
    rationale: 'Minimal geometry · Open field.',
  },
};

export const LETTER_REDUCTION_EXPLAINER =
  'Vowels removed. Repeated letters reduced, first occurrence kept.';

/**
 * Server recommendation `reason` codes are machine identifiers
 * (`daily_focus`, `unseen_vision`, …). They are the authority for *why* a
 * practice is recommended, but they must never reach the screen. This maps
 * each code to product language; unknown codes fall back to the mode copy in
 * `V2_RECOMMENDATION_WHY` so an unmapped code can never render raw.
 */
export const V2_RECOMMENDATION_REASON_COPY: Readonly<Record<string, string>> = {
  destination_reached: 'You reached your destination. Close the loop.',
  waypoint_reached: 'A waypoint is behind you. Mark it before moving on.',
  intention_completed: 'This intention is complete. Release it.',
  unseen_vision: 'You have not seen your Vision today.',
  vision_scene: 'Step back into your Vision.',
  // `thread_decay` is the server's code for a negative 7-day Consistency delta.
  thread_decay: 'Consistency dipped this week. Go deeper.',
  deep_reinforcement: 'A longer session to go deeper.',
  daily_focus: 'Build consistency today.',
};

/** `01 / 03` — the authoritative position indicator for the hero carousel. */
export function anchorPositionLabel(index: number, total: number): string {
  const pad = (value: number) => String(Math.max(0, value)).padStart(2, '0');
  return `${pad(index + 1)} / ${pad(total)}`;
}

/**
 * Weekday for recent evidence, short date beyond a week. Always formatted from
 * the real event timestamp in the device's local timezone — never a fixed
 * label and never a UTC day.
 */
export function evidenceDayLabel(occurredAt: string | Date, now: Date = new Date()): string {
  const date = occurredAt instanceof Date ? occurredAt : new Date(occurredAt);
  if (Number.isNaN(date.getTime())) return '';
  const startOfLocalDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const dayDifference = Math.round((startOfLocalDay(now) - startOfLocalDay(date)) / 86_400_000);
  if (dayDifference === 0) return 'Today';
  if (dayDifference === 1) return 'Yesterday';
  if (dayDifference > 1 && dayDifference < 7) return date.toLocaleDateString(undefined, { weekday: 'long' });
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
