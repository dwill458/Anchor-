import type { Anchor } from '@/types';

/** Remove recovery evidence before retaining a copy, preventing recursive vault growth. */
export function localRecoveryCopy(anchor: Anchor): Omit<Anchor, 'localReconciliation'> {
  const { localReconciliation, ...copy } = anchor;
  return copy;
}

function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toJSON();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, canonical(entry)]));
  }
  return value;
}

/** Dates used only for ordering are not proof of an edit or of synchronization. */
export function localContentFingerprint(anchor: Anchor): string {
  const { updatedAt, ...content } = localRecoveryCopy(anchor);
  return JSON.stringify(canonical(content));
}

export function pendingLocalFields(anchor: Anchor, updates: Partial<Anchor>): (keyof Anchor)[] {
  return Array.from(new Set([
    ...(anchor.localReconciliation?.pendingFields ?? []),
    ...Object.keys(updates).filter((key) => key !== 'updatedAt' && key !== 'localReconciliation'),
  ])) as (keyof Anchor)[];
}

/** A response acknowledges an edit only when it contains the edited values. */
export function acknowledgesLocalEdits(local: Anchor, incoming: Anchor): boolean {
  const fields = local.localReconciliation?.pendingFields;
  if (!fields) return localContentFingerprint(local) === localContentFingerprint(incoming);
  return fields.every((field) => JSON.stringify(canonical(local[field] ?? null)) === JSON.stringify(canonical(incoming[field] ?? null)));
}
