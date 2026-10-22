import { create } from 'zustand';

/** Keep in sync with the backend's fixed developer comparison allowlist. */
export const DEV_IMAGE_MODELS = [
  { id: 'gemini-3.1-flash-image', label: 'Nano Banana 2' },
  { id: 'gemini-nano-banana-2.1', label: 'Nano Banana 2.1' },
  { id: 'gemini-3-pro-image', label: 'Nano Banana Pro' },
  { id: 'gpt-image-2.5-flare', label: 'OpenAI Flare' },
  { id: 'gpt-image-2.5-sunburst', label: 'OpenAI Sunburst' },
] as const;
export type DevImageModel = (typeof DEV_IMAGE_MODELS)[number]['id'];
export type DevImagePurpose = 'anchor' | 'vision';

/** Session-only: comparisons never become a saved production preference. */
export const useDevImageModelStore = create<{
  anchor: DevImageModel | null;
  vision: DevImageModel | null;
  select: (purpose: DevImagePurpose, model: DevImageModel | null) => void;
}>((set) => ({ anchor: null, vision: null, select: (purpose, model) => set({ [purpose]: model }) }));

export function selectedDevImageModel(purpose: DevImagePurpose): DevImageModel | undefined {
  return __DEV__ ? useDevImageModelStore.getState()[purpose] ?? undefined : undefined;
}
