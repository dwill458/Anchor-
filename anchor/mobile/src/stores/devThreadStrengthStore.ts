import { create } from 'zustand';

/**
 * Dev-only Thread Strength simulator for the Home hero glow. `value === null` means "use real data".
 * Each `simulate` bumps `nonce` so Home remounts the aura and replays the activation bloom.
 */
type DevThreadStrengthState = {
  value: number | null;
  nonce: number;
  simulate: (value: number | null) => void;
};

export const useDevThreadStrengthStore = create<DevThreadStrengthState>((set) => ({
  value: null,
  nonce: 0,
  simulate: (value) => set((state) => ({ value, nonce: state.nonce + 1 })),
}));

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
