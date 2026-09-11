/** A host-neutral, one-shot notification emitted only after canonical sync succeeds. */
export type PracticeCompletionReturn = {
  sessionId: string; anchorId: string | null; mode: string; completedAt: string;
  source: string; returnTarget: 'v2_practice' | null;
  beforeStrength: number | null; afterStrength: number | null; delta: number | null;
};
let handler: ((completion: PracticeCompletionReturn) => void) | null = null;
const delivered = new Set<string>();

export function registerPracticeCompletionReturn(next: ((completion: PracticeCompletionReturn) => void) | null): () => void {
  handler = next;
  return () => { if (handler === next) handler = null; };
}

export function notifyPracticeCompletionReturned(completion: PracticeCompletionReturn): void {
  if (!handler || delivered.has(completion.sessionId)) return;
  delivered.add(completion.sessionId);
  handler(completion);
}
