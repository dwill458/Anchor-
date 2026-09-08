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
