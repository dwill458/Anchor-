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

  it('does not send response_format for anchor requests', async () => {
    const fetchMock = mockFetchOk();
    const adapter = new OpenAIImageProviderAdapter();

    await adapter.generate({ type: 'anchor', prompt: 'a sigil' }, 1);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).not.toHaveProperty('response_format');
  });
});
