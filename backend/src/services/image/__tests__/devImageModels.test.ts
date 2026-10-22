import { ImageGenerationService } from '../ImageGenerationService';
import { DEV_IMAGE_MODEL_IDS, devImageModelProvider, readDevImagePlan, storeDevImagePlan } from '../devImageModels';
import type { ImageProviderAdapter } from '../types';

jest.mock('../../../utils/logger');

describe('developer model comparisons', () => {
  it.each(DEV_IMAGE_MODEL_IDS)('routes %s to its provider with the exact model attached', async model => {
    const generate = jest.fn().mockResolvedValue({ images: [], model, estimatedCost: 0 });
    const other = jest.fn();
    const selected = devImageModelProvider(model);
    const adapter = (name: string, handler: jest.Mock): ImageProviderAdapter => ({ name, isAvailable: () => true, generate: handler });
    const service = new ImageGenerationService({
      geminiAdapter: adapter('gemini', selected === 'gemini' ? generate : other),
      openAiAdapter: adapter('openai', selected === 'openai' ? generate : other),
    });
    const result = await service.generate({ type: 'vision', prompt: 'same scene', devImageModel: model });
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ devImageModel: model }), 1);
    expect(other).not.toHaveBeenCalled();
    expect(result.model).toBe(model);
    expect(result.fallbackUsed).toBe(false);
  });

  it('fails a pinned model without substituting another provider', async () => {
    const failure = new Error('selected model unavailable');
    const other = jest.fn();
    const service = new ImageGenerationService({
      geminiAdapter: { name: 'gemini', isAvailable: () => true, generate: jest.fn().mockRejectedValue(failure) },
      openAiAdapter: { name: 'openai', isAvailable: () => true, generate: other },
    });
    await expect(service.generate({ type: 'anchor', prompt: 'sigil', devImageModel: 'gemini-nano-banana-2.1' })).rejects.toThrow('selected model unavailable');
    expect(other).not.toHaveBeenCalled();
  });

  it('keeps a comparison model with its Vision plan across retries and reads legacy arrays', () => {
    const scenes = [{ scene: 'morning' }];
    expect(readDevImagePlan(storeDevImagePlan(scenes, 'gemini-nano-banana-2.1'))).toEqual({ scenes, devImageModel: 'gemini-nano-banana-2.1' });
    expect(readDevImagePlan(scenes)).toEqual({ scenes });
  });
});
