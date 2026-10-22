/** Protect the impact/provenance beat from hardware Back without changing persisted state. */
const committed = new Set<string>();
export const sealIsCommitted = (draftId?: string): boolean => committed.has(draftId ?? '');
export const lockSeal = (draftId: string): void => { committed.add(draftId); };
export const unlockSeal = (draftId: string): void => { committed.delete(draftId); };
