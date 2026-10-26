export type VisionMutationFeedback = {
  pending: number;
  message: string | null;
  undo: (() => Promise<boolean>) | null;
};
type Queue = {
  tail: Promise<unknown>;
  feedback: VisionMutationFeedback;
  token?: object;
  listeners: Set<() => void>;
  timer?: ReturnType<typeof setTimeout>;
};
const queues = new Map<string, Queue>();
function queueFor(key: string) {
  let queue = queues.get(key);
  if (!queue) {
    queue = {
      tail: Promise.resolve(),
      feedback: { pending: 0, message: null, undo: null },
      listeners: new Set(),
    };
    queues.set(key, queue);
  }
  return queue;
}
const publish = (q: Queue, patch: Partial<VisionMutationFeedback>) => {
  q.feedback = { ...q.feedback, ...patch };
  q.listeners.forEach((listener) => listener());
};
export const getVisionMutationFeedback = (key: string) =>
  queueFor(key).feedback;
export const subscribeVisionMutations = (key: string, listener: () => void) => {
  const q = queueFor(key);
  q.listeners.add(listener);
  return () => {
    q.listeners.delete(listener);
  };
};

/** One serial lane per account/Anchor. Inverses run behind pending writes and never undo a failed edit. */
export function enqueueVisionMutation<T>(
  key: string,
  label: string,
  forward: () => Promise<T | null>,
  inverse?: (result: T) => Promise<T | null>,
): Promise<T | null> {
  const q = queueFor(key),
    token = {};
  q.token = token;
  if (q.timer) clearTimeout(q.timer);
  let applied: T | null = null;
  const undo = async () => {
    if (q.feedback.undo !== undo) return false;
    publish(q, { undo: null });
    const reversed = await enqueueVisionMutation(
      key,
      'Change undone',
      async () => (applied && inverse ? inverse(applied) : null),
    );
    return reversed !== null;
  };
  publish(q, {
    pending: q.feedback.pending + 1,
    message: label,
    undo: inverse ? undo : null,
  });
  const task = q.tail
    .catch(() => undefined)
    .then(async () => {
      try {
        applied = await forward();
        if (q.token === token) {
          publish(q, {
            message: applied
              ? label
              : "Couldn't save that change. It's back as it was.",
            undo: applied && inverse ? undo : null,
          });
          q.timer = setTimeout(
            () => {
              if (q.token === token) publish(q, { message: null, undo: null });
            },
            applied ? 5000 : 4200,
          );
        }
        return applied;
      } catch {
        if (q.token === token) {
          publish(q, {
            message: "Couldn't save that change. It's back as it was.",
            undo: null,
          });
          q.timer = setTimeout(() => {
            if (q.token === token) publish(q, { message: null, undo: null });
          }, 4200);
        }
        return null;
      } finally {
        publish(q, { pending: Math.max(0, q.feedback.pending - 1) });
      }
    });
  q.tail = task;
  return task;
}

export function resetVisionMutationQueues() {
  for (const q of queues.values()) if (q.timer) clearTimeout(q.timer);
  queues.clear();
}
