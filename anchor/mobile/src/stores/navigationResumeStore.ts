import { create } from 'zustand';

export type NavigationResumeTarget = { kind: 'visualize_prepare'; anchorId: string };

interface NavigationResumeState {
  target: NavigationResumeTarget | null;
  setTarget: (target: NavigationResumeTarget | null) => void;
  consumeTarget: () => NavigationResumeTarget | null;
}

export const useNavigationResumeStore = create<NavigationResumeState>((set, get) => ({
  target: null,
  setTarget: (target) => set({ target }),
  consumeTarget: () => {
    const target = get().target;
    set({ target: null });
    return target;
  },
}));
