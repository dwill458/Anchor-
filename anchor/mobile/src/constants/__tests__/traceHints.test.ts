import {
  TRACE_HINT_FIRST_TIME,
  TRACE_HINT_HESITATION,
  TRACE_HINT_RETURNING_BASE,
  TRACE_HINT_UNDO_SPAM,
  TRACE_HINT_VARIANTS,
  type TraceHintTone,
  type TraceHintTrigger,
} from '@/constants/traceHints';

const VALID_TONES: TraceHintTone[] = ['instruction', 'reassurance', 'reframe', 'ritual'];
const VALID_TRIGGERS: TraceHintTrigger[] = [
  'base',
  'first_time',
  'hesitation',
  'undo_spam',
  'returning',
];

describe('traceHints', () => {
  it('keeps copy at or below 90 characters', () => {
    Object.values(TRACE_HINT_VARIANTS).forEach((variant) => {
      expect(variant.copy.length).toBeLessThanOrEqual(90);
    });
  });

  it('uses only valid tone values', () => {
    Object.values(TRACE_HINT_VARIANTS).forEach((variant) => {
      expect(VALID_TONES).toContain(variant.tone);
    });
  });

  it('defines valid trigger values for all supported pools', () => {
    const poolToTrigger: Array<{ trigger: TraceHintTrigger; size: number }> = [
      { trigger: 'first_time', size: TRACE_HINT_FIRST_TIME.length },
      { trigger: 'hesitation', size: TRACE_HINT_HESITATION.length },
      { trigger: 'undo_spam', size: TRACE_HINT_UNDO_SPAM.length },
      { trigger: 'returning', size: TRACE_HINT_RETURNING_BASE.length },
    ];

    poolToTrigger.forEach((entry) => {
      expect(VALID_TRIGGERS).toContain(entry.trigger);
      expect(entry.size).toBeGreaterThan(0);
    });
  });
});
