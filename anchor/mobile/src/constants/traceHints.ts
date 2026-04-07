export type TraceHintTone = 'reassurance' | 'instruction' | 'reframe' | 'ritual';

export type TraceHintTrigger =
  | 'base'
  | 'first_time'
  | 'hesitation'
  | 'undo_spam'
  | 'returning';

export interface TraceHintVariant {
  id: string;
  tone: TraceHintTone;
  copy: string;
}

export const TRACE_HINT_FIRST_TIME_EXHAUSTION_ID = 'trace_hint_first_time';

export const TRACE_HINT_VARIANTS = {
  reassurance: {
    id: 'trace_hint_reassurance_slow_contact_v1',
    tone: 'reassurance',
    copy: "Accuracy isn't the point. Slow contact is.",
  },
  instruction: {
    id: 'trace_hint_instruction_overlap_allowed_v1',
    tone: 'instruction',
    copy: 'Follow the gold lines. Overlap is allowed.',
  },
  reframeFocusDrill: {
    id: 'trace_hint_reframe_focus_drill_v1',
    tone: 'reframe',
    copy: 'This is a focus drill, not an art test today.',
  },
  reframeFamiliarShape: {
    id: 'trace_hint_reframe_familiar_shape_v1',
    tone: 'reframe',
    copy: 'Tracing teaches your brain the shape, so it feels familiar.',
  },
  ritualSealing: {
    id: 'trace_hint_ritual_sealing_v1',
    tone: 'ritual',
    copy: "Trace like you're sealing it, not sketching it.",
  },
} as const satisfies Record<string, TraceHintVariant>;

export const TRACE_HINT_FIRST_TIME: readonly TraceHintVariant[] = [TRACE_HINT_VARIANTS.reassurance];

export const TRACE_HINT_HESITATION: readonly TraceHintVariant[] = [TRACE_HINT_VARIANTS.instruction];

export const TRACE_HINT_UNDO_SPAM: readonly TraceHintVariant[] = [
  TRACE_HINT_VARIANTS.reframeFocusDrill,
  TRACE_HINT_VARIANTS.reframeFamiliarShape,
];

export const TRACE_HINT_RETURNING_BASE: readonly TraceHintVariant[] = [
  TRACE_HINT_VARIANTS.ritualSealing,
  TRACE_HINT_VARIANTS.reframeFocusDrill,
  TRACE_HINT_VARIANTS.reframeFamiliarShape,
];
