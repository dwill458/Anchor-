import { useCallback, useEffect, useMemo } from 'react';
import type { V2VisionTile } from '@/adapters/v2/vision';
import { assignmentsFromMap, resolveSlotMap, type VisionSlotAssignments } from '@/components/v2/vision/board/visionBoardSlots';
import { parseVisionFocal, visionFocalChanged, type VisionFocal } from '@/components/v2/vision/visionPhotoFocus';
import { mergeSlotAssignments, useVisionPresentationStore } from '@/stores/v2/visionPresentationStore';

const sameAssignments = (a: VisionSlotAssignments, b: VisionSlotAssignments) => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => a[key] === b[key]);
};

/**
 * The saved arrangement of a Vision's photographs: the slot each one sits in and where it is positioned in its print.
 *
 * The device's own record wins, since it is what the person last did; a photograph with none falls back to what the
 * server sent, then to the automatic rule (lowest free slot, upper-biased crop). Every photograph the rule places is
 * written back, so a position the person has been looking at is never recomputed when something else changes.
 */
export function useVisionPresentation(visionId: string | null | undefined, tiles: readonly V2VisionTile[]) {
  const entry = useVisionPresentationStore(state => (visionId ? state.byVision[visionId] : undefined));
  const hydrated = useVisionPresentationStore(state => state.hydrated);
  const setSlots = useVisionPresentationStore(state => state.setSlots);
  const setFocalInStore = useVisionPresentationStore(state => state.setFocal);

  const stored = useMemo<VisionSlotAssignments>(() => {
    const merged: Record<string, number> = {};
    // Server values first, then this device's record over them.
    for (const tile of tiles) if (typeof tile.slotIndex === 'number') merged[tile.sceneId] = tile.slotIndex;
    return { ...merged, ...(entry?.slots ?? {}) };
  }, [entry?.slots, tiles]);
  const ids = useMemo(() => tiles.map(tile => tile.sceneId), [tiles]);
  const slotMap = useMemo(() => resolveSlotMap(ids, stored), [ids, stored]);
  const assignments = useMemo(() => assignmentsFromMap(slotMap), [slotMap]);

  // Pin whatever the rule placed. Waits for the stored record, or it would pin over a record not yet read.
  useEffect(() => {
    if (!visionId || !hydrated || !ids.length) return;
    const current = entry?.slots ?? {};
    if (!sameAssignments(mergeSlotAssignments(current, assignments), current)) setSlots(visionId, assignments);
  }, [visionId, hydrated, ids, assignments, entry?.slots, setSlots]);

  const focals = useMemo(() => {
    const merged: Record<string, VisionFocal> = {};
    for (const tile of tiles) {
      const server = parseVisionFocal(tile.focal);
      if (server) merged[tile.sceneId] = server;
    }
    return { ...merged, ...(entry?.focals ?? {}) };
  }, [entry?.focals, tiles]);

  const commitSlotMap = useCallback((next: readonly (string | null)[]) => {
    if (!visionId) return;
    setSlots(visionId, assignmentsFromMap(next));
  }, [visionId, setSlots]);

  const setFocal = useCallback((sceneId: string, focal: VisionFocal | null) => {
    if (!visionId) return;
    if (!visionFocalChanged(entry?.focals?.[sceneId], focal)) return;
    setFocalInStore(visionId, sceneId, focal);
  }, [visionId, entry?.focals, setFocalInStore]);

  return { slotMap, assignments, focals, commitSlotMap, setFocal, hydrated };
}
