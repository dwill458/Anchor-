import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';

type PendingWrite = {
  id: string;
  method: 'patch' | 'put';
  path: string;
  body: Record<string, unknown>;
};
type Snapshot = {
  version: 1;
  accountId: string;
  anchorId: string;
  writes: PendingWrite[];
};
const storageKey = (accountId: string, anchorId: string) =>
  `anchor:v2:vision-pending:${encodeURIComponent(accountId)}:${encodeURIComponent(anchorId)}`;
const lanes = new Map<string, Promise<unknown>>();
const claimed = new Set<string>();
const editedFields = (body: Record<string, unknown>) =>
  Object.keys(body)
    .filter((key) => key !== 'expectedUpdatedAt')
    .sort();
const idFor = (method: string, path: string, body: Record<string, unknown>) =>
  JSON.stringify([method, path, editedFields(body)]);
const contentOf = (body: Record<string, unknown>) =>
  JSON.stringify(editedFields(body).map((key) => [key, body[key]]));

async function read(accountId: string, anchorId: string): Promise<Snapshot> {
  const empty: Snapshot = { version: 1, accountId, anchorId, writes: [] };
  // A vault read failure must propagate: replacing an unread snapshot would destroy retained work.
  const raw = await encryptedPersistStorage.getItem(
    storageKey(accountId, anchorId),
  );
  if (!raw) return empty;
  let saved: Snapshot;
  try {
    saved = JSON.parse(raw) as Snapshot;
  } catch {
    return empty;
  }
  if (
    saved.version !== 1 ||
    saved.accountId !== accountId ||
    saved.anchorId !== anchorId ||
    !Array.isArray(saved.writes)
  )
    return empty;
  return {
    ...saved,
    writes: saved.writes
      .filter(
        (write) =>
          (write.method === 'patch' || write.method === 'put') &&
          typeof write.path === 'string' &&
          write.path.startsWith('/api/v2/visions/') &&
          write.body &&
          typeof write.body === 'object',
      ),
  };
}

function edit(
  accountId: string,
  anchorId: string,
  change: (saved: Snapshot) => Snapshot,
) {
  const key = storageKey(accountId, anchorId);
  const task = (lanes.get(key) ?? Promise.resolve())
    .catch(() => undefined)
    .then(async () => {
      const saved = change(await read(accountId, anchorId));
      await encryptedPersistStorage.setItem(key, JSON.stringify(saved));
    });
  lanes.set(key, task);
  return task;
}

/** Retain idempotent edits until acknowledgement, encrypted and scoped to the account. */
export function retainPendingVisionWrite(
  accountId: string,
  anchorId: string,
  method: 'patch' | 'put',
  path: string,
  body: Record<string, unknown>,
) {
  const id = idFor(method, path, body);
  return edit(accountId, anchorId, (saved) => ({
    ...saved,
    writes: [
      ...saved.writes.filter((write) => write.id !== id),
      { id, method, path, body },
    ],
  }));
}

export function clearPendingVisionWrite(
  accountId: string,
  anchorId: string,
  method: string,
  path: string,
  body: Record<string, unknown>,
) {
  const id = idFor(method, path, body),
    content = contentOf(body);
  return edit(accountId, anchorId, (saved) => ({
    ...saved,
    // An acknowledgement of an older request must never clear a newer retained edit.
    writes: saved.writes.filter(
      (write) => write.id !== id || contentOf(write.body) !== content,
    ),
  }));
}

/** Claim one retry batch without deleting it. A crash before acknowledgement leaves it durable. */
export async function takePendingVisionWrites(
  accountId: string,
  anchorId: string,
) {
  const key = storageKey(accountId, anchorId);
  if (claimed.has(key)) return [];
  claimed.add(key);
  try {
    await (lanes.get(key) ?? Promise.resolve()).catch(() => undefined);
    return (await read(accountId, anchorId)).writes;
  } catch (error) {
    claimed.delete(key);
    throw error;
  }
}

export function releasePendingVisionWrites(
  accountId: string,
  anchorId: string,
) {
  claimed.delete(storageKey(accountId, anchorId));
}
