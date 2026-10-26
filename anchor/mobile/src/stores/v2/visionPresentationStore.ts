import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { parseVisionFocal, type VisionFocal } from '@/components/v2/vision/visionPhotoFocus';
import { VISION_SLOT_COUNT } from '@/components/v2/vision/board/visionBoardSlots';

/**
 * How each Vision's photographs are presented on this device: which of the board's eight slots a photograph sits in,
 * and where it is positioned inside its print. Both belong to the person's arrangement, so they are kept by scene
 * id and survive navigation, reordering, restarts and removals of other photographs. The server holds the same
 * values (when it supports them); this store is what the board reads first, so a change shows at once and an older
 * server loses nothing. Plain AsyncStorage: layout preferences only, nothing sensitive.
 */
export const VISION_PRESENTATION_STORAGE_KEY = '@anchor/v2/vision-presentation';
/** Visions remembered at once. The least recently written is dropped beyond this. */
const MAX_VISIONS = 24;

export type VisionPresentation = {
  slots: Record<string, number>;
  focals: Record<string, VisionFocal>;
  /** True while this device's slot arrangement has not been confirmed by the server; the local arrangement then wins. */
  unsynced?: boolean;
};

type State = {
  byVision: Record<string, VisionPresentation>;
  /** False until the stored record has been read. Never persisted. */
  hydrated: boolean;
  /** Records where the given photographs sit. Others already on record keep their slot unless a given one took it. */
  setSlots: (visionId: string, placed: Record<string, number>) => void;
  /** A new photograph goes to a chosen slot, if that slot is free. Returns whether it was placed. */
  placeScene: (visionId: string, sceneId: string, slot: number) => boolean;
  /** A replacement takes the exact slot of the photograph it replaces. */
  inheritSlot: (visionId: string, fromSceneId: string, toSceneId: string) => void;
  /** Sets one photograph's position in its print; `null` returns it to the automatic position. */
  setFocal: (visionId: string, sceneId: string, focal: VisionFocal | null) => void;
  /** Marks whether the local slot arrangement still awaits server confirmation. */
  setUnsynced: (visionId: string, unsynced: boolean) => void;
  clear: (visionId: string) => void;
};

const empty = (): VisionPresentation => ({ slots: {}, focals: {} });

/** A slot map is valid when every entry is a distinct, in-range integer. Invalid entries are dropped, never repaired. */
export function sanitizeSlots(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!value || typeof value !== 'object') return out;
  const taken = new Set<number>();
  for (const [id, slot] of Object.entries(value as Record<string, unknown>)) {
    if (typeof slot === 'number' && Number.isInteger(slot) && slot >= 0 && slot < VISION_SLOT_COUNT && !taken.has(slot)) {
      out[id] = slot;
      taken.add(slot);
    }
  }
  return out;
}

/**
 * Applies a new placement over a stored record. Everything in `placed` wins; a stored photograph that is not in `placed`
 * (a removal still in flight, or one not on screen) keeps its slot only when no placed photograph has taken it, so a
 * stale record can never block, or be mistaken for, a live one.
 */
export function mergeSlotAssignments(current: Record<string, number>, placed: Record<string, number>): Record<string, number> {
  const merged: Record<string, number> = { ...placed };
  const taken = new Set(Object.values(placed));
  for (const [id, slot] of Object.entries(current)) {
    if (id in merged || taken.has(slot)) continue;
    merged[id] = slot;
    taken.add(slot);
  }
  return merged;
}

function sanitize(value: unknown): Record<string, VisionPresentation> {
  const out: Record<string, VisionPresentation> = {};
  if (!value || typeof value !== 'object') return out;
  for (const [visionId, entry] of Object.entries(value as Record<string, any>)) {
    const focals: Record<string, VisionFocal> = {};
    for (const [sceneId, raw] of Object.entries(entry?.focals ?? {})) {
      const focal = parseVisionFocal(raw);
      if (focal) focals[sceneId] = focal;
    }
    out[visionId] = { slots: sanitizeSlots(entry?.slots), focals, ...(entry?.unsynced === true ? { unsynced: true } : {}) };
  }
  return out;
}

function touch(byVision: Record<string, VisionPresentation>, visionId: string, entry: VisionPresentation) {
  const next = { ...byVision };
  delete next[visionId];
  next[visionId] = entry; // most recently written last
  const keys = Object.keys(next);
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_VISIONS))) delete next[key];
  return next;
}

export const useVisionPresentationStore = create<State>()(
  persist(
    (set) => ({
      byVision: {},
      hydrated: false,
      setSlots: (visionId, placed) => set(state => {
        const current = state.byVision[visionId] ?? empty();
        return { byVision: touch(state.byVision, visionId, { ...current, slots: sanitizeSlots(mergeSlotAssignments(current.slots, sanitizeSlots(placed))) }) };
      }),
      placeScene: (visionId, sceneId, slot) => {
        const current = useVisionPresentationStore.getState().byVision[visionId] ?? empty();
        if (!Number.isInteger(slot) || slot < 0 || slot >= VISION_SLOT_COUNT) return false;
        if (Object.entries(current.slots).some(([id, taken]) => taken === slot && id !== sceneId)) return false;
        set(state => ({ byVision: touch(state.byVision, visionId, { ...(state.byVision[visionId] ?? empty()), slots: { ...current.slots, [sceneId]: slot } }) }));
        return true;
      },
      inheritSlot: (visionId, fromSceneId, toSceneId) => set(state => {
        const current = state.byVision[visionId] ?? empty();
        const slot = current.slots[fromSceneId];
        if (slot === undefined) return state;
        const slots = { ...current.slots };
        delete slots[fromSceneId];
        slots[toSceneId] = slot;
        const focals = { ...current.focals };
        delete focals[fromSceneId];
        return { byVision: touch(state.byVision, visionId, { ...current, slots, focals }) };
      }),
      setUnsynced: (visionId, unsynced) => set(state => {
        const current = state.byVision[visionId] ?? empty();
        if (Boolean(current.unsynced) === unsynced) return state;
        const next = { ...current };
        if (unsynced) next.unsynced = true; else delete next.unsynced;
        return { byVision: touch(state.byVision, visionId, next) };
      }),
      setFocal: (visionId, sceneId, focal) => set(state => {
        const current = state.byVision[visionId] ?? empty();
        const focals = { ...current.focals };
        if (focal) focals[sceneId] = { x: focal.x, y: focal.y };
        else delete focals[sceneId];
        return { byVision: touch(state.byVision, visionId, { ...current, focals }) };
      }),
      clear: visionId => set(state => {
        const next = { ...state.byVision };
        delete next[visionId];
        return { byVision: next };
      }),
    }),
    {
      name: VISION_PRESENTATION_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({ byVision: state.byVision }),
      // Anything written during this session is newer than what was stored.
      merge: (persisted, current) => ({
        ...current,
        byVision: { ...sanitize((persisted as { byVision?: unknown } | undefined)?.byVision), ...current.byVision },
      }),
      onRehydrateStorage: () => () => { useVisionPresentationStore.setState({ hydrated: true }); },
    },
  ),
);
