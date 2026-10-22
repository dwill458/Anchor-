jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('@/services/AuthService', () => ({ AuthService: { getIdToken: jest.fn(async () => 'token') } }));
jest.mock('@/services/ApiClient', () => ({ apiClient: { defaults: {}, get: jest.fn(), post: jest.fn() }, ApiClientError: class extends Error {} }));
jest.mock('@/hooks/v2/chart/useAnchorChart', () => ({ trackChart: jest.fn() }));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ChartRequestError } from '@/services/v2/chartV2Api';
import type { AskChartApi, AskConversation, AskMessage, AskTurnBody, AskTurnResult } from '@/services/v2/askChartApi';
import { useAskChart } from '../useAskChart';

const message = (over: Partial<AskMessage> = {}): AskMessage => ({
  id: 'm', role: 'ASSISTANT', text: 'text', createdAt: '2026-10-21T00:00:00Z', attachments: [], suggestions: [], requestPhoto: null,
  readyToPlan: false, planInput: null, action: null, actionUnavailable: false, skill: null, ...over,
});

type Deferred = { resolve: (result: AskTurnResult) => void; reject: (error: unknown) => void; body: AskTurnBody };

/** A fake Ask Chart whose turns resolve only when the test says so, so ordering and in-flight states can be observed. */
function fakeApi(conversation: Partial<AskConversation> = {}) {
  const pending: Deferred[] = [];
  const bodies: AskTurnBody[] = [];
  const api: AskChartApi = {
    getConversation: jest.fn(async () => ({ conversationId: null, messages: [], mode: 'CREATE' as const, courseId: null, ...conversation })),
    turn: jest.fn((_anchorId: string, body: AskTurnBody, handlers = {}) => {
      bodies.push(body);
      return new Promise<AskTurnResult>((resolve, reject) => {
        pending.push({ resolve, reject, body });
        (handlers as { onReply?: (text: string) => void }).onReply?.('');
      });
    }),
  };
  const answer = (index: number, text: string, extra: Partial<AskMessage> = {}) =>
    pending[index].resolve({
      conversationId: 'conv-1', mode: 'CREATE',
      userMessage: pending[index].body.opening ? null : message({ id: `srv-user-${index}`, role: 'USER', text: pending[index].body.text ?? '' }),
      assistantMessage: message({ id: `srv-${index}`, text, ...extra }),
      remembered: null, generation: { source: 'ai', fallbackUsed: false }, replayed: false,
    });
  return { api, pending, bodies, answer };
}

const setup = async (conversation: Partial<AskConversation> = {}, greet = true) => {
  const fake = fakeApi(conversation);
  const hook = renderHook(() => useAskChart({ anchorId: 'anchor-1', api: fake.api, reducedMotion: true, greet }));
  await waitFor(() => expect(hook.result.current.state.status).toBe('ready'));
  return { ...fake, hook };
};

describe('useAskChart', () => {
  it('greets an empty conversation with an opening turn, once, and shows the greeting', async () => {
    const { hook, bodies, answer } = await setup();
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ opening: true, conversationId: null });
    expect(bodies[0].text).toBeUndefined();
    expect(hook.result.current.state.turn).not.toBe('idle');
    await act(async () => answer(0, 'You are working toward…', { suggestions: ['Just started'] }));
    expect(hook.result.current.state.messages.map(m => m.text)).toEqual(['You are working toward…']);
    expect(hook.result.current.suggestions).toEqual(['Just started']);
    expect(bodies).toHaveLength(1);
  });

  it('restores an existing conversation without greeting again', async () => {
    const { hook, bodies } = await setup({ conversationId: 'c', mode: 'ONGOING', messages: [message({ id: 'old', text: 'Earlier answer' })] });
    expect(hook.result.current.state.messages.map(m => [m.text, m.animate])).toEqual([['Earlier answer', false]]);
    expect(bodies).toHaveLength(0);
  });

  it('does not greet when greeting is turned off', async () => {
    const { bodies } = await setup({}, false);
    expect(bodies).toHaveLength(0);
  });

  it('shows a sent message immediately and sends turns one at a time, in order', async () => {
    const { hook, bodies, answer } = await setup({ messages: [message({ id: 'old' })] });
    act(() => { hook.result.current.send('first'); hook.result.current.send('second'); });
    expect(hook.result.current.state.messages.map(m => m.text)).toEqual(['text', 'first', 'second']);
    expect(bodies.map(b => b.text)).toEqual(['first']);
    expect(hook.result.current.busy).toBe(true);
    await act(async () => answer(0, 'reply one'));
    await waitFor(() => expect(bodies.map(b => b.text)).toEqual(['first', 'second']));
    await act(async () => answer(1, 'reply two'));
    expect(hook.result.current.state.messages.map(m => m.text)).toEqual(['text', 'first', 'reply one', 'second', 'reply two']);
    expect(hook.result.current.busy).toBe(false);
  });

  it('ignores an empty send and trims the rest', async () => {
    const { hook, bodies } = await setup({ messages: [message()] });
    let accepted = true;
    act(() => { accepted = hook.result.current.send('   '); });
    expect(accepted).toBe(false);
    act(() => { hook.result.current.send('  hello  '); });
    expect(bodies[0].text).toBe('hello');
  });

  it('keeps a failed message, and retrying reuses its idempotency key so it cannot be sent twice', async () => {
    const { hook, bodies, pending, answer } = await setup({ messages: [message()] });
    act(() => { hook.result.current.send('will fail'); });
    await act(async () => pending[0].reject(new ChartRequestError('offline', undefined)));
    const failed = hook.result.current.state.messages[1];
    expect(failed.status).toBe('failed');
    expect(hook.result.current.state.error?.kind).toBe('offline');
    act(() => hook.result.current.retry());
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1].idempotencyKey).toBe(bodies[0].idempotencyKey);
    await act(async () => answer(1, 'recovered'));
    expect(hook.result.current.state.messages.map(m => [m.text, m.status])).toEqual([['text', 'sent'], ['will fail', 'sent'], ['recovered', 'sent']]);
    expect(hook.result.current.state.error).toBeNull();
  });

  it('holds later messages behind a failed one and sends them in order after the retry', async () => {
    const { hook, bodies, pending, answer } = await setup({ messages: [message()] });
    act(() => { hook.result.current.send('one'); });
    act(() => { hook.result.current.send('two'); });
    await act(async () => pending[0].reject(new ChartRequestError('unavailable', 'ASK_UNAVAILABLE')));
    expect(bodies.map(b => b.text)).toEqual(['one']);
    expect(hook.result.current.state.messages.map(m => m.status)).toEqual(['sent', 'failed', 'queued']);
    act(() => hook.result.current.retry());
    await waitFor(() => expect(bodies.map(b => b.text)).toEqual(['one', 'one']));
    await act(async () => answer(1, 'a'));
    await waitFor(() => expect(bodies.map(b => b.text)).toEqual(['one', 'one', 'two']));
    await act(async () => answer(2, 'b'));
    expect(hook.result.current.state.messages.map(m => m.text)).toEqual(['text', 'one', 'a', 'two', 'b']);
  });

  it('retries a failed greeting with the same key, and drops it if the person starts talking instead', async () => {
    const first = await setup();
    await waitFor(() => expect(first.bodies).toHaveLength(1));
    await act(async () => first.pending[0].reject(new ChartRequestError('unavailable', undefined)));
    expect(first.hook.result.current.state.openingFailed).toBe(true);
    act(() => first.hook.result.current.retry());
    await waitFor(() => expect(first.bodies).toHaveLength(2));
    expect(first.bodies[1].idempotencyKey).toBe(first.bodies[0].idempotencyKey);
    expect(first.bodies[1].opening).toBe(true);

    const second = await setup();
    await waitFor(() => expect(second.bodies).toHaveLength(1));
    await act(async () => second.pending[0].reject(new ChartRequestError('unavailable', undefined)));
    act(() => { second.hook.result.current.send('I will just type'); });
    await waitFor(() => expect(second.bodies).toHaveLength(2));
    expect(second.bodies[1]).toMatchObject({ text: 'I will just type' });
    expect(second.bodies[1].opening).toBeUndefined();
  });

  it('cancels the running turn and lets the person get the answer afterwards', async () => {
    const { hook, bodies, pending, api } = await setup({ messages: [message()] });
    (api.turn as jest.Mock).mockImplementationOnce((_id: string, body: AskTurnBody, _h: unknown, signal?: AbortSignal) => {
      bodies.push(body);
      return new Promise<AskTurnResult>((_resolve, reject) => signal?.addEventListener('abort', () => reject(new Error('aborted'))));
    });
    act(() => { hook.result.current.send('slow one'); });
    await waitFor(() => expect(hook.result.current.state.turn).not.toBe('idle'));
    act(() => hook.result.current.cancel());
    await waitFor(() => expect(hook.result.current.state.error?.kind).toBe('cancelled'));
    expect(hook.result.current.state.messages[1].status).toBe('failed');
    expect(pending).toHaveLength(0);
  });

  it('sends the conversation id once it is known', async () => {
    const { hook, bodies, answer } = await setup();
    await waitFor(() => expect(bodies).toHaveLength(1));
    await act(async () => answer(0, 'hello'));
    act(() => { hook.result.current.send('next'); });
    expect(bodies[1].conversationId).toBe('conv-1');
  });
});
