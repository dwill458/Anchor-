/**
 * Conservative, coaching-only reading of an intention against Short · Present · Felt.
 *
 * This never blocks or scolds. A principle is either `met` (we are fairly sure) or
 * `neutral` (we are not, or it cannot be measured). There is deliberately no failing
 * state: FELT is personal meaning and is always neutral.
 */
export type PrincipleState = 'met' | 'neutral';

export interface IntentionGuidance {
  short: PrincipleState;
  present: PrincipleState;
  felt: PrincipleState;
}

const MAX_SHORT_WORDS = 14;
const MIN_WORDS_FOR_GUIDANCE = 3;

/** Obvious desire / future / escape framing. Anything matching stays neutral. */
const NOT_PRESENT =
  /\b(want|wanna|wish|hope|hoping|need|needs|cannot|can not|should|would|could|might|going to|gonna|will|shall|try|trying|someday|eventually|stop|quit|avoid|escape|no longer|don't|dont|do not|won't|never|not|no more|less|without)\b|n['’]t\b|['’](ll|d)\b/i;

/** First-person or possessive statements that read as already true. */
const STATES_AS_TRUE = /^\s*(i|i['’]m|im|my|we|we['’]re)\b/i;

const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

export function assessIntention(text: string): IntentionGuidance {
  const trimmed = text.trim();
  const words = wordCount(trimmed);
  if (words < MIN_WORDS_FOR_GUIDANCE) return { short: 'neutral', present: 'neutral', felt: 'neutral' };

  // One direction: a single sentence of modest length, not a list or a run-on.
  const sentences = trimmed.split(/[.!?;]+\s+\S/).length;
  const isSingleDirection = sentences === 1 && !/[;\n]/.test(trimmed) && !/\band\b.*\band\b/i.test(trimmed);
  const short: PrincipleState = words <= MAX_SHORT_WORDS && isSingleDirection ? 'met' : 'neutral';

  const present: PrincipleState = STATES_AS_TRUE.test(trimmed) && !NOT_PRESENT.test(trimmed) ? 'met' : 'neutral';

  return { short, present, felt: 'neutral' };
}
