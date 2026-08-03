import { create } from 'zustand';
import type { NavigationResumeTarget } from '@/types';
import type { ChartDeepLinkTarget } from '@/navigation/chartDeepLinks';

export type { NavigationResumeTarget } from '@/types';

interface NavigationResumeState {
  target: NavigationResumeTarget | null;
  chartDeepLink: ChartDeepLinkTarget | null;
  setTarget: (target: NavigationResumeTarget | null) => void;
  consumeTarget: () => NavigationResumeTarget | null;
  setChartDeepLink: (target: ChartDeepLinkTarget | null) => void;
  consumeChartDeepLink: () => ChartDeepLinkTarget | null;
}

export const useNavigationResumeStore = create<NavigationResumeState>((set, get) => ({
  target: null,
  chartDeepLink: null,
  setTarget: (target) => set({ target }),
  consumeTarget: () => {
    const target = get().target;
    set({ target: null });
    return target;
  },
  setChartDeepLink: (chartDeepLink) => set({ chartDeepLink }),
  consumeChartDeepLink: () => {
    const chartDeepLink = get().chartDeepLink;
    set({ chartDeepLink: null });
    return chartDeepLink;
  },
}));
