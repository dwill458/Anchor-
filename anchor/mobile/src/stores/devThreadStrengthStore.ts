import { create } from 'zustand';

/**
 * In-memory display preview only. Never write this value to Anchor/session stores or API payloads.
 * `null` restores real data; restarting the app also clears the preview.
 */
type DevThreadStrengthState = {
  value: number | null;
  nonce: number;
  simulate: (value: number | null) => void;
};

export const useDevThreadStrengthStore = create<DevThreadStrengthState>((set) => ({
  value: null,
  nonce: 0,
  simulate: (value) => set((state) => {
    const next = value !== null && Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : null;
    return {
      value: next,
      // Remount on entering/leaving preview, then let the aura animate as the slider moves.
      nonce: state.nonce + (state.value === null || next === null ? 1 : 0),
    };
  }),
}));

export function useThreadStrengthPreview(real: number | null | undefined): number | null {
  const value = useDevThreadStrengthStore((state) => state.value);
  return __DEV__ && value !== null ? value : (typeof real === 'number' ? real : null);
}

/**
 * Resolves the strength the glow should show: the dev simulator value when set (in `__DEV__`),
 * otherwise the real one, plus a key suffix that remounts the glow so the bloom replays.
 */
export function useAuraStrength(real: number | null | undefined): { strength: number | null; keySuffix: string } {
  const value = useDevThreadStrengthStore((state) => state.value);
  const nonce = useDevThreadStrengthStore((state) => state.nonce);
  const simulated = __DEV__ && value !== null;
  return { strength: simulated ? value : (typeof real === 'number' ? real : null), keySuffix: nonce ? `#dev${nonce}` : '' };
}
