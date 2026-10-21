import {
  GeminiChartProvider,
  OpenAiChartProvider,
  readSseData,
  resolveAskChartConfig,
  toGeminiContents,
  toOpenAiMessages,
  type ChartModelRequest,
} from '../../chartModelProviders';

jest.mock('../../../../config/env', () => ({ env: { GOOGLE_API_KEY: process.env.TEST_GOOGLE_KEY } }));

const request: ChartModelRequest = {
  schemaName: 's',
  jsonSchema: { type: 'object', properties: {}, additionalProperties: false },
  system: 'sys',
  user: 'newest',
  history: [
    { role: 'user', text: 'first' },
    { role: 'assistant', text: 'reply' },
  ],
  timeoutMs: 1000,
};

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

describe('multi-turn requests', () => {
  it('orders OpenAI messages system, history, newest, and keeps single-turn requests unchanged', () => {
    const messages = toOpenAiMessages(request);
    expect(messages.map(message => message.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(messages[3].content).toBe('newest');
    expect(toOpenAiMessages({ ...request, history: undefined }).map(message => message.role)).toEqual(['system', 'user']);
  });

  it('puts images on the newest OpenAI turn only', () => {
    const messages = toOpenAiMessages({ ...request, images: [{ mimeType: 'image/png', base64: 'AA' }] });
    expect(messages[1].content).toBe('first');
    expect((messages[3].content as unknown[]).length).toBe(2);
  });

  it('maps assistant to model for Gemini and attaches images to the newest turn', () => {
    const contents = toGeminiContents({ ...request, images: [{ mimeType: 'image/png', base64: 'AA' }] });
    expect(contents.map(content => content.role)).toEqual(['user', 'model', 'user']);
    expect(contents[2].parts).toHaveLength(2);
    expect(contents[0].parts).toHaveLength(1);
  });
});

describe('readSseData', () => {
  it('reassembles data lines split across chunks and ignores other lines', async () => {
    const seen: string[] = [];
    await readSseData(streamOf(['event: x\nda', 'ta: {"a":1}\n\ndata: {"b"', ':2}\r\n\n', 'data: [DONE]\n']), data => seen.push(data));
    expect(seen).toEqual(['{"a":1}', '{"b":2}', '[DONE]']);
  });
});

describe('OpenAI streaming', () => {
  const original = global.fetch;
  afterEach(() => {
    global.fetch = original;
  });

  const sse = (...pieces: string[]) =>
    pieces.map(piece => `data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`).concat('data: [DONE]\n\n');

  it('reports accumulated text as it arrives and resolves the parsed object', async () => {
    let body: any;
    global.fetch = jest.fn(async (_url: any, init: any) => {
      body = JSON.parse(init.body);
      return { ok: true, status: 200, body: streamOf(sse('{"reply":"Hel', 'lo","n":', '1}')) } as any;
    }) as any;
    const seen: string[] = [];
    const result = await new OpenAiChartProvider('k', 'm').streamJson(request, text => seen.push(text));
    expect(body.stream).toBe(true);
    expect(body.messages).toHaveLength(4);
    expect(seen).toEqual(['{"reply":"Hel', '{"reply":"Hello","n":', '{"reply":"Hello","n":1}']);
    expect(result).toEqual({ reply: 'Hello', n: 1 });
  });

  it('maps failures to provider errors', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 429 })) as any;
    await expect(new OpenAiChartProvider('k', 'm').streamJson(request, () => {})).rejects.toMatchObject({ failure: 'rate_limited' });
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, body: streamOf(sse('not json')) })) as any;
    await expect(new OpenAiChartProvider('k', 'm').streamJson(request, () => {})).rejects.toMatchObject({ failure: 'malformed_json' });
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, body: streamOf([]) })) as any;
    await expect(new OpenAiChartProvider('k', 'm').streamJson(request, () => {})).rejects.toMatchObject({ failure: 'empty' });
  });

  it('treats a refusal as a safety block', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      body: streamOf([`data: ${JSON.stringify({ choices: [{ delta: { refusal: 'no' } }] })}\n\n`]),
    })) as any;
    await expect(new OpenAiChartProvider('k', 'm').streamJson(request, () => {})).rejects.toMatchObject({ failure: 'safety_blocked' });
  });
});

describe('Gemini streaming', () => {
  it('streams chunks through the SDK and parses the final JSON', async () => {
    const provider = new GeminiChartProvider('key', 'gemini-x');
    async function* chunks() {
      yield { text: '{"reply":"Hi' };
      yield { text: '"}' };
    }
    const spy = jest.fn().mockResolvedValue(chunks());
    (provider as any).client = { models: { generateContentStream: spy } };
    const seen: string[] = [];
    const result = await provider.streamJson(request, text => seen.push(text));
    expect(result).toEqual({ reply: 'Hi' });
    expect(seen).toEqual(['{"reply":"Hi', '{"reply":"Hi"}']);
    expect(spy.mock.calls[0][0].contents).toHaveLength(3);
  });
});

describe('resolveAskChartConfig', () => {
  it('uses the evaluated defaults, independent of the planner models, and its own when set', () => {
    const base = { OPENAI_API_KEY: 'o', CHART_OPENAI_MODEL: 'planner-model' } as NodeJS.ProcessEnv;
    expect(resolveAskChartConfig(base).providers.map(provider => provider.model)).toEqual(['gpt-5.4-mini']);
    const tuned = resolveAskChartConfig({ ...base, CHART_ASK_OPENAI_MODEL: 'ask-model' });
    expect(tuned.providers[0].model).toBe('ask-model');
    expect(tuned.primaryTimeoutMs).toBe(25_000);
    expect(resolveAskChartConfig({ ...base, CHART_ASK_PRIMARY_TIMEOUT_MS: '9000' }).primaryTimeoutMs).toBe(9000);
  });

  it('has no providers without keys, so the service can say so instead of faking an answer', () => {
    expect(resolveAskChartConfig({} as NodeJS.ProcessEnv).providers).toEqual([]);
  });
});

describe('openAiTemperature', () => {
  it('sends a temperature to models that accept one and omits it for gpt-5 and o-series', () => {
    const { openAiTemperature } = jest.requireActual('../../chartModelProviders');
    expect(openAiTemperature('gpt-4.1-mini', 0.6)).toEqual({ temperature: 0.6 });
    expect(openAiTemperature('gpt-5.5', 0.6)).toEqual({});
    expect(openAiTemperature('o3', 0.6)).toEqual({});
    expect(openAiTemperature('gpt-4.1', undefined)).toEqual({});
  });
});
