/**
 * OpenAI adapter request-shape tests.
 *
 * GPT-Image models reject `response_format` ("Unknown parameter") and always
 * return base64, so the adapter must not send it. A 400 is non-retryable and
 * skips provider fallback, so a bad request shape fails every Vision scene.
 */

import { OpenAIImageProviderAdapter } from '../adapters/OpenAIImageProviderAdapter';

describe('OpenAIImageProviderAdapter request shape', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv, OPENAI_API_KEY: 'sk-test' };
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  function mockFetchOk() {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ b64_json: Buffer.from('img').toString('base64') }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  it('does not send response_format for vision requests', async () => {
    const fetchMock = mockFetchOk();
    const adapter = new OpenAIImageProviderAdapter();

    const result = await adapter.generate({ type: 'vision', prompt: 'a quiet morning' }, 1);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).not.toHaveProperty('response_format');
    expect(result.images).toHaveLength(1);
  });

  it('sends the Vision photographs and the appearance reference as images, world first', async () => {
    const fetchMock = mockFetchOk();
    const adapter = new OpenAIImageProviderAdapter();

    await adapter.generate({
      type: 'vision',
      prompt: 'driving it at golden hour',
      referenceImages: [
        { buffer: Buffer.from('who'), mimeType: 'image/jpeg', role: 'appearance' },
        { buffer: Buffer.from('car'), mimeType: 'image/jpeg', role: 'world' },
      ],
    }, 1);

    expect(fetchMock.mock.calls[0][0]).toMatch(/\/images\/edits$/);
    const form = fetchMock.mock.calls[0][1].body as FormData;
    expect(form.getAll('image[]')).toHaveLength(2);
    expect((form.getAll('image[]')[0] as File).name).toBe('reference-1.jpeg');
    expect(String(form.get('prompt'))).toMatch(/Image 1 is a photograph the person added to their Vision themselves/);
    expect(String(form.get('prompt'))).toMatch(/Image 2 is the person's approved appearance reference/);
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Content-Type');
  });

  it('stays plain text-to-image when there are no references', async () => {
    const fetchMock = mockFetchOk();
    await new OpenAIImageProviderAdapter().generate({ type: 'vision', prompt: 'a quiet morning' }, 1);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/images\/generations$/);
  });

  it.each(['gpt-image-2.5-flare', 'gpt-image-2.5-sunburst'] as const)('pins %s for Anchor and Vision despite automatic tier configuration', async model => {
    process.env.OPENAI_ANCHOR_MODEL = 'auto-model';
    process.env.OPENAI_VISION_MODEL = 'auto-model';
    const fetchMock = mockFetchOk();
    for (const type of ['anchor', 'vision'] as const) {
      const result = await new OpenAIImageProviderAdapter().generate({ type, prompt: 'same prompt', quality: 'pro_upgrade', devImageModel: model }, 1);
      const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
      expect(JSON.parse(lastCall[1].body).model).toBe(model);
      expect(result.model).toBe(model);
    }
  });

  it('does not send response_format for anchor requests', async () => {
    const fetchMock = mockFetchOk();
    const adapter = new OpenAIImageProviderAdapter();

    await adapter.generate({ type: 'anchor', prompt: 'a sigil' }, 1);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).not.toHaveProperty('response_format');
  });

  it('uploads the original Anchor geometry for every variation instead of inventing a text-only symbol', async () => {
    const fetchMock = mockFetchOk();
    const geometry = Buffer.from('original-sigil-png');

    await new OpenAIImageProviderAdapter().generate({
      type: 'anchor',
      prompt: 'Deep Cosmos material field',
      referenceImages: [{ buffer: geometry, mimeType: 'image/png', role: 'structure' }],
      numberOfVariations: 2,
    }, 1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [url, options] of fetchMock.mock.calls) {
      expect(url).toMatch(/\/images\/edits$/);
      expect(options.headers).not.toHaveProperty('Content-Type');
      const form = options.body as FormData;
      expect(form.getAll('image[]')).toHaveLength(1);
      const uploaded = form.getAll('image[]')[0] as File;
      expect(uploaded.type).toBe('image/png');
      expect(Buffer.from(await uploaded.arrayBuffer())).toEqual(geometry);
      expect(String(form.get('prompt'))).toContain('Deep Cosmos material field');
      expect(String(form.get('prompt'))).toContain('Image 1 is the exact Anchor geometry');
      expect(form.has('response_format')).toBe(false);
    }
  });
});
