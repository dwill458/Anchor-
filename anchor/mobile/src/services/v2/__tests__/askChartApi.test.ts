const mockRefreshChart = jest.fn();
jest.mock('@/hooks/v2/chart/useAnchorChart', () => ({ refreshChartAfterProposal: (...args: unknown[]) => mockRefreshChart(...args) }));
const mockFetch = jest.fn();
jest.mock('expo/fetch', () => ({ fetch: (...args: unknown[]) => mockFetch(...args) }));
jest.mock('@/services/AuthService', () => ({ AuthService: { getIdToken: jest.fn(async () => 'token-1') } }));
jest.mock('@/services/ApiClient', () => {
  class ApiClientError extends Error {
    code: string | undefined;
    status: number | undefined;
    details: Record<string, unknown> | undefined;
    constructor(message: string, code?: string, status?: number, details?: Record<string, unknown>) {
      super(message);
      this.name = 'ApiClientError';
      this.code = code;
      this.status = status;
      this.details = details;
    }
  }
  return { apiClient: { defaults: { baseURL: 'https://api.test' }, get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() }, ApiClientError };
});

import { apiClient } from '@/services/ApiClient';
import { askChartApi, createSseParser, type AskTurnResult } from '../askChartApi';

const post = apiClient.post as jest.Mock;

const encoder = new TextEncoder();
function streamBody(chunks: string[]) {
  let index = 0;
  return {
    getReader: () => ({
      read: async () => (index < chunks.length ? { done: false, value: encoder.encode(chunks[index++]) } : { done: true, value: undefined }),
    }),
  };
}
const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
const turnResult = { conversationId: 'c1', mode: 'CREATE', userMessage: null, assistantMessage: { id: 'm1', text: 'Hi' }, remembered: null, generation: { source: 'ai', fallbackUsed: false }, replayed: false } as unknown as AskTurnResult;

beforeEach(() => {
  mockFetch.mockReset();
  post.mockReset();
});

describe('createSseParser', () => {
  it('emits each complete event once, however the text is chunked', () => {
    const events: unknown[] = [];
    const parser = createSseParser(event => events.push(event));
    const text = sse('delta', { text: 'Hel' }) + sse('delta', { text: 'Hello' }) + sse('done', { ok: true });
    for (let i = 0; i < text.length; i += 7) parser.push(text.slice(i, i + 7));
    expect(events).toEqual([
      { event: 'delta', data: { text: 'Hel' } },
      { event: 'delta', data: { text: 'Hello' } },
      { event: 'done', data: { ok: true } },
    ]);
  });

  it('handles CRLF, ignores malformed events and keeps going', () => {
    const events: unknown[] = [];
    const parser = createSseParser(event => events.push(event));
    parser.push('event: delta\r\ndata: {not json}\r\n\r\nevent: delta\r\ndata: {"text":"ok"}\r\n\r\n');
    expect(events).toEqual([{ event: 'delta', data: { text: 'ok' } }]);
  });

  it('does not emit an event that was cut off mid-way', () => {
    const events: unknown[] = [];
    createSseParser(event => events.push(event)).push('event: done\ndata: {"a":');
    expect(events).toEqual([]);
  });
});

describe('askChartApi.turn', () => {
  it('streams: sends auth and the SSE accept header, reports replies in order and resolves with the result', async () => {
    mockFetch.mockResolvedValue({ ok: true, body: streamBody([sse('delta', { text: 'Hi' }), sse('stage', { stage: 'preparing_change' }), sse('done', turnResult)]) });
    const replies: string[] = [];
    const stages: string[] = [];
    const result = await askChartApi.turn('anchor 1', { idempotencyKey: 'key-12345678', text: 'hello' }, { onReply: text => replies.push(text), onStage: stage => stages.push(stage) });
    expect(result).toEqual(turnResult);
    expect(replies).toEqual(['Hi']);
    expect(stages).toEqual(['preparing_change']);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/v2/anchors/anchor%201/chart/ask');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token-1', Accept: 'text/event-stream', 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({ idempotencyKey: 'key-12345678', text: 'hello' });
    expect(post).not.toHaveBeenCalled();
  });

  it('turns a server error event into a classified error, without retrying as JSON', async () => {
    mockFetch.mockResolvedValue({ ok: true, body: streamBody([sse('error', { code: 'ASK_UNAVAILABLE', message: 'down', status: 503, retryable: true })]) });
    await expect(askChartApi.turn('a', { idempotencyKey: 'key-12345678', text: 'x' })).rejects.toMatchObject({ kind: 'unavailable' });
    expect(post).not.toHaveBeenCalled();
  });

  it('turns an HTTP rejection before streaming into a classified error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429, json: async () => ({ error: { code: 'AI_RATE_LIMITED', message: 'slow down' } }) });
    await expect(askChartApi.turn('a', { idempotencyKey: 'key-12345678', text: 'x' })).rejects.toMatchObject({ kind: 'rate_limited' });
    expect(post).not.toHaveBeenCalled();
  });

  it('falls back to a plain request with the same idempotency key when streaming cannot start', async () => {
    mockFetch.mockRejectedValue(new Error('no streaming'));
    post.mockResolvedValue({ data: { success: true, data: turnResult } });
    const body = { idempotencyKey: 'key-12345678', text: 'x' };
    expect(await askChartApi.turn('a', body)).toEqual(turnResult);
    expect(post).toHaveBeenCalledWith('/api/v2/anchors/a/chart/ask', body, expect.objectContaining({ timeout: expect.any(Number) }));
  });

  it('treats a stream that dies after data as a retryable connection failure, never a made-up answer', async () => {
    mockFetch.mockResolvedValue({ ok: true, body: streamBody([sse('delta', { text: 'Half an ans' })]) });
    await expect(askChartApi.turn('a', { idempotencyKey: 'key-12345678', text: 'x' })).rejects.toMatchObject({ kind: 'offline' });
    expect(post).not.toHaveBeenCalled();
  });

  it('does not fall back after the caller cancelled', async () => {
    const controller = new AbortController();
    mockFetch.mockImplementation(async () => {
      controller.abort();
      throw new Error('aborted');
    });
    await expect(askChartApi.turn('a', { idempotencyKey: 'key-12345678', text: 'x' }, {}, controller.signal)).rejects.toThrow('aborted');
    expect(post).not.toHaveBeenCalled();
  });
});

describe('askChartApi proposals', () => {
  it('sends only an approval: the server applies what it stored', async () => {
    post.mockResolvedValue({ data: { success: true, data: { chart: {}, added: 2 } } });
    await askChartApi.approve('course 1', 'msg-1');
    expect(post).toHaveBeenCalledWith('/api/v2/charts/course%201/ask/msg-1/approve');
  });
});


describe('proposal mutations', () => {
  it.each(['approve', 'undoProposal'] as const)('%s refreshes the authoritative Chart before resolving', async method => {
    mockRefreshChart.mockReset();
    const result = { chart: { id: 'course-1', anchorId: 'anchor-1' }, added: 2, batchId: 'batch-1' };
    post.mockResolvedValue({ data: { success: true, data: result } });
    await expect(askChartApi[method]('course-1', 'batch-1')).resolves.toEqual(result);
    expect(mockRefreshChart).toHaveBeenCalledWith('course-1', 'anchor-1');
    expect(post.mock.invocationCallOrder[0]).toBeLessThan(mockRefreshChart.mock.invocationCallOrder[0]);
  });
});
