jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('@/services/AuthService', () => ({ AuthService: { getIdToken: jest.fn(async () => 'token') } }));
jest.mock('@/services/ApiClient', () => ({ apiClient: { defaults: {}, get: jest.fn(), post: jest.fn() }, ApiClientError: class extends Error {} }));

import type { AskChartApi, AskConversation, AskMessage, AskTurnBody, AskTurnHandlers, AskTurnResult } from '@/services/v2/askChartApi';
import { openingKeyFor, startAskOpening, takeAskOpening } from '../askOpeningPrefetch';

const greeting: AskMessage = {
  id: 'opening', role: 'ASSISTANT', text: 'What would change for you?', createdAt: '2026-10-26T12:00:00Z',
  attachments: [], suggestions: [], requestPhoto: null, readyToPlan: false, planInput: null, action: null, actionUnavailable: false, skill: null,
};
const conversation: AskConversation = { conversationId: null, courseId: null, mode: 'CREATE', messages: [] };
const result: AskTurnResult = { conversationId: 'conversation-1', mode: 'CREATE', userMessage: null, assistantMessage: greeting, remembered: null, generation: { source: 'ai', fallbackUsed: false }, replayed: false };

function fakeApi(overrides: Partial<AskChartApi> = {}): AskChartApi {
  return {
    getConversation: jest.fn(async () => conversation),
    turn: jest.fn(async (_id: string, _body: AskTurnBody, handlers: AskTurnHandlers = {}) => {
      handlers.onReply?.('What would');
      handlers.onReply?.(greeting.text);
      return result;
    }),
    ...overrides,
  };
}

describe('Ask opening prefetch', () => {
  afterEach(() => jest.restoreAllMocks());

  it('shares one promise and one opening generation for the same Anchor and API', async () => {
    const api = fakeApi();
    const first = startAskOpening('same-anchor', api);
    const second = startAskOpening('same-anchor', api);
    expect(second).toBe(first);
    const prefetched = await first;
    expect(api.getConversation).toHaveBeenCalledTimes(1);
    expect(api.turn).toHaveBeenCalledTimes(1);
    expect(jest.mocked(api.turn).mock.calls[0][1]).toMatchObject({ opening: true, idempotencyKey: openingKeyFor('same-anchor') });
    expect(prefetched?.result?.assistantMessage.text).toBe(greeting.text);
    expect(prefetched?.bufferedText).toBe(greeting.text);
  });

  it('isolates Anchor ids and injected API identities', async () => {
    const firstApi = fakeApi();
    const secondApi = fakeApi();
    await Promise.all([startAskOpening('a', firstApi), startAskOpening('b', firstApi), startAskOpening('a', secondApi)]);
    expect(firstApi.turn).toHaveBeenCalledTimes(2);
    expect(secondApi.turn).toHaveBeenCalledTimes(1);
    expect(openingKeyFor('a')).toBe('ask-open:a');
    expect(openingKeyFor('b')).not.toBe(openingKeyFor('a'));
  });

  it('restores history without generating another greeting', async () => {
    const api = fakeApi({ getConversation: jest.fn(async () => ({ ...conversation, conversationId: 'old', messages: [greeting] })) });
    const prefetched = await startAskOpening('history', api);
    expect(prefetched?.conversation.messages).toEqual([greeting]);
    expect(prefetched?.result).toBeNull();
    expect(api.turn).not.toHaveBeenCalled();
  });

  it('lets one consumer join an in-flight promise and removes the consumed entry', async () => {
    let complete!: (value: AskTurnResult) => void;
    const api = fakeApi({ turn: jest.fn(() => new Promise<AskTurnResult>(resolve => { complete = resolve; })) });
    const started = startAskOpening('join', api);
    await Promise.resolve();
    const joined = takeAskOpening('join', api);
    expect(joined).toBe(started);
    expect(takeAskOpening('join', api)).toBeNull();
    complete(result);
    expect((await joined)?.result?.assistantMessage.text).toBe(greeting.text);
  });

  it('expires an unused entry after three minutes and allows a fresh prefetch', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const api = fakeApi();
    const old = startAskOpening('expiry', api);
    await old;
    now.mockReturnValue(1_180_001);
    expect(takeAskOpening('expiry', api)).toBeNull();
    const fresh = startAskOpening('expiry', api);
    expect(fresh).not.toBe(old);
    await fresh;
    expect(api.turn).toHaveBeenCalledTimes(2);
  });

  it.each(['conversation', 'turn'])('resolves a failed %s request to null', async stage => {
    const api = fakeApi(stage === 'conversation'
      ? { getConversation: jest.fn(async () => { throw new Error('offline'); }) }
      : { turn: jest.fn(async () => { throw new Error('offline'); }) });
    await expect(startAskOpening('failure', api)).resolves.toBeNull();
    expect(await takeAskOpening('failure', api)).toBeNull();
  });
});
