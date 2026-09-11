/** A host-neutral, one-shot notification emitted only after canonical sync succeeds. */
type Completion = { sessionId: string; anchorId: string | null; mode: string; completedAt: string };
let handler: ((completion: Completion) => void) | null = null;
const delivered = new Set<string>();

export function registerPracticeCompletionReturn(next: ((completion: Completion) => void) | null): () => void {
  handler = next;
  return () => { if (handler === next) handler = null; };
}

export function notifyPracticeCompletionReturned(completion: Completion): void {
  if (!handler || delivered.has(completion.sessionId)) return;
  delivered.add(completion.sessionId);
  handler(completion);
}
