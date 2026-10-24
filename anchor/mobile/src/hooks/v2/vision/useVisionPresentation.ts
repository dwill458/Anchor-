import { useCallback, useEffect, useMemo, useState } from 'react';
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
 * Confirmed server positions win; pre-slot records fall back to this device's legacy record,
 * then to the automatic rule (lowest free slot, upper-biased crop). Every photograph the rule places is
 * written back, so a position the person has been looking at is never recomputed when something else changes.
 */
export function useVisionPresentation(visionId: string | null | undefined, tiles: readonly V2VisionTile[]) {
  const entry = useVisionPresentationStore(state => (visionId ? state.byVision[visionId] : undefined));
  const hydrated = useVisionPresentationStore(state => state.hydrated);
  const setSlots = useVisionPresentationStore(state => state.setSlots);
  const setFocalInStore = useVisionPresentationStore(state => state.setFocal);
  const [focalDrafts,setFocalDrafts]=useState<Record<string,{visionId:string;value:VisionFocal|null;basedOn:string}>>({});

  const stored = useMemo<VisionSlotAssignments>(() => {
    const merged: Record<string, number> = {};
    // Server values supersede stale device records after a change on another device,
    // unless this device's arrangement has not reached the server yet: then it wins.
    for (const tile of tiles) if (typeof tile.slotIndex === 'number') merged[tile.sceneId] = tile.slotIndex;
    return entry?.unsynced ? { ...merged, ...(entry.slots ?? {}) } : { ...(entry?.slots ?? {}), ...merged };
  }, [entry?.slots, entry?.unsynced, tiles]);
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
    const merged:Record<string,VisionFocal>={...entry?.focals};
    for(const tile of tiles) {
      if(tile.focal===undefined)continue;
      const server=parseVisionFocal(tile.focal);
      if(server)merged[tile.sceneId]=server;else delete merged[tile.sceneId];
    }
    for(const [id,draft] of Object.entries(focalDrafts)) {
      const tile=tiles.find(t=>t.sceneId===id);
      if(draft.visionId!==visionId||draft.basedOn!==JSON.stringify(tile?.focal))continue;
      if(draft.value)merged[id]=draft.value;else delete merged[id];
    }
    return merged;
  },[entry?.focals,tiles,focalDrafts,visionId]);

  const commitSlotMap = useCallback((next: readonly (string | null)[]) => {
    if (!visionId) return;
    setSlots(visionId, assignmentsFromMap(next));
  }, [visionId, setSlots]);

  const setFocal = useCallback((sceneId: string, focal: VisionFocal | null) => {
    if (!visionId) return;
    setFocalDrafts(previous=>({...previous,[sceneId]:{visionId,value:focal,basedOn:JSON.stringify(tiles.find(t=>t.sceneId===sceneId)?.focal)}}));
    if (!visionFocalChanged(entry?.focals?.[sceneId], focal)) return;
    setFocalInStore(visionId, sceneId, focal);
  }, [visionId, tiles, entry?.focals, setFocalInStore]);

  const setUnsyncedInStore = useVisionPresentationStore(state => state.setUnsynced);
  const setUnsynced = useCallback((value: boolean) => { if (visionId) setUnsyncedInStore(visionId, value); }, [visionId, setUnsyncedInStore]);

  return { slotMap, assignments, focals, commitSlotMap, setFocal, hydrated, unsynced: Boolean(entry?.unsynced), setUnsynced };
}
