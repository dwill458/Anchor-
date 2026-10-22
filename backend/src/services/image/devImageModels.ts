/** Fixed allowlist for developer comparisons; never accept arbitrary provider model IDs. */
export const DEV_IMAGE_MODEL_IDS = [
  'gemini-3.1-flash-image',
  'gemini-nano-banana-2.1',
  'gemini-3-pro-image',
  'gpt-image-2.5-flare',
  'gpt-image-2.5-sunburst',
] as const;
export type DevImageModel = (typeof DEV_IMAGE_MODEL_IDS)[number];

export function devImageModelProvider(model: DevImageModel): 'gemini' | 'openai' {
  return model.startsWith('gemini-') ? 'gemini' : 'openai';
}

/** Dev jobs use a plan envelope so the choice survives retries without a schema migration. */
export function storeDevImagePlan(scenes: unknown, devImageModel?: DevImageModel): unknown {
  return devImageModel ? { devImageModel, scenes } : scenes;
}

export function readDevImagePlan(value: unknown): {
  scenes: unknown;
  devImageModel?: DevImageModel;
} {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'scenes' in value) {
    const model = 'devImageModel' in value ? value.devImageModel : undefined;
    if (DEV_IMAGE_MODEL_IDS.some(id => id === model)) {
      return { scenes: value.scenes, devImageModel: model as DevImageModel };
    }
    return { scenes: value.scenes };
  }
  return { scenes: value };
}
