import { GoogleGenAI } from '@google/genai';
import { GeminiImageProviderAdapter } from '../adapters/GeminiImageProviderAdapter';
import type { DevImageModel } from '../devImageModels';

jest.mock('@google/genai');
jest.mock('../../../utils/logger');

describe('Google comparison model requests', () => {
  const originalEnv = process.env;
  afterEach(() => { process.env = originalEnv; });

  it.each(['gemini-3.1-flash-image', 'gemini-nano-banana-2.1', 'gemini-3-pro-image'] as DevImageModel[])('pins %s despite automatic tier configuration', async model => {
    process.env = { ...originalEnv, GOOGLE_API_KEY: 'test-key', GEMINI_ANCHOR_PREMIUM_MODEL: 'auto-pro-model' };
    const generateContent = jest.fn().mockResolvedValue({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: Buffer.from('image').toString('base64') } }] } }] });
    (GoogleGenAI as jest.Mock).mockImplementation(() => ({ models: { generateContent } }));
    for (const type of ['anchor', 'vision'] as const) {
      const result = await new GeminiImageProviderAdapter().generate({ type, prompt: 'same prompt', quality: 'pro_upgrade', devImageModel: model }, 1);
      expect(generateContent).toHaveBeenLastCalledWith(expect.objectContaining({ model }));
      expect(result.model).toBe(model);
    }
  });
});
