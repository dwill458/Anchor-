import { create } from 'zustand';

/** Transient native modal ownership; independent of teaching and celebration stores. */
export const useGuidanceSurfaceLocks = create<{ keys: string[]; set: (key: string, locked: boolean) => void }>((set) => ({
  keys: [],
  set: (key, locked) => set(state => ({ keys: locked ? [...new Set([...state.keys, key])] : state.keys.filter(item => item !== key) })),
}));
