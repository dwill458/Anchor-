import type { AskMessage, AskTurnResult } from '@/services/v2/askChartApi';
import { affordances, askReducer, draftPlanInput, initialAskState, latestAssistant, type AskState, type AskUiMessage } from '../askChartState';

const server = (over: Partial<AskMessage> = {}): AskMessage => ({
  id: 'srv-1', role: 'ASSISTANT', text: 'Hello', createdAt: '2026-10-21T00:00:00Z', attachments: [], suggestions: [], requestPhoto: null,
  readyToPlan: false, planInput: null, action: null, actionUnavailable: false, skill: null, ...over,
});
const local = (key: string, text: string, status: AskUiMessage['status'] = 'queued'): AskUiMessage => ({ ...server({ id: key, role: 'USER', text }), key, status, animate: true, sendKey: `send-${key}` });
const result = (over: Partial<AskTurnResult> = {}): AskTurnResult => ({
  conversationId: 'conv-1', mode: 'CREATE', userMessage: null, assistantMessage: server({ id: 'srv-reply' }), remembered: null,
  generation: { source: 'ai', fallbackUsed: false }, replayed: false, ...over,
});
const ready = (state: Partial<AskState> = {}): AskState => ({ ...initialAskState, status: 'ready', ...state });

describe('askReducer', () => {
  it('restores history at rest (no entrance animation) with stable keys', () => {
    const next = askReducer(initialAskState, { type: 'loaded', conversationId: 'c', mode: 'ONGOING', messages: [server({ id: 'a' }), server({ id: 'b', role: 'USER' })] });
    expect(next.status).toBe('ready');
    expect(next.messages.map(m => [m.key, m.animate, m.status])).toEqual([['a', false, 'sent'], ['b', false, 'sent']]);
  });

  it('shows a queued message immediately and marks it sending when its turn starts', () => {
    let state = askReducer(ready(), { type: 'queued', message: local('l1', 'hi') });
    expect(state.messages[0].status).toBe('queued');
    state = askReducer(state, { type: 'turn_started', messageKey: 'l1', draftKey: 'd1' });
    expect(state.messages[0].status).toBe('sending');
    expect(state.turn).toBe('thinking');
    expect(state.draft).toEqual({ key: 'd1', text: '' });
  });

  it('streams into the draft only, leaving every message object untouched', () => {
    let state = askReducer(ready({ messages: [local('l1', 'hi', 'sending')] }), { type: 'turn_started', messageKey: 'l1', draftKey: 'd1' });
    const before = state.messages;
    state = askReducer(state, { type: 'delta', text: 'Start' });
    state = askReducer(state, { type: 'delta', text: 'Start with the rust' });
    expect(state.messages).toBe(before);
    expect(state.draft?.text).toBe('Start with the rust');
    expect(state.turn).toBe('streaming');
  });

  it('turns the draft into the final message under the same key, so nothing remounts', () => {
    let state = askReducer(ready({ messages: [local('l1', 'hi', 'sending')] }), { type: 'turn_started', messageKey: 'l1', draftKey: 'd1' });
    state = askReducer(state, { type: 'turn_done', messageKey: 'l1', draftKey: 'd1', animate: false, result: result({ userMessage: server({ id: 'srv-user', role: 'USER', text: 'hi' }) }) });
    expect(state.messages.map(m => [m.key, m.id, m.status])).toEqual([['l1', 'srv-user', 'sent'], ['d1', 'srv-reply', 'sent']]);
    expect(state.draft).toBeNull();
    expect(state.turn).toBe('idle');
    expect(state.conversationId).toBe('conv-1');
  });

  it('never shows a replayed answer twice', () => {
    const existing: AskUiMessage = { ...server({ id: 'srv-reply' }), key: 'srv-reply', status: 'sent', animate: false };
    const state = askReducer(ready({ messages: [existing, local('l1', 'again', 'sending')] }), { type: 'turn_done', messageKey: 'l1', draftKey: 'd2', animate: false, result: result({ replayed: true }) });
    expect(state.messages.filter(m => m.id === 'srv-reply')).toHaveLength(1);
  });

  it('marks only the failed message failed, keeps it, and records the reason', () => {
    let state = askReducer(ready({ messages: [local('l1', 'one', 'sent'), local('l2', 'two', 'sending')] }), { type: 'turn_started', messageKey: 'l2', draftKey: 'd' });
    state = askReducer(state, { type: 'turn_failed', messageKey: 'l2', kind: 'offline' });
    expect(state.messages.map(m => m.status)).toEqual(['sent', 'failed']);
    expect(state.error).toEqual({ kind: 'offline', messageKey: 'l2' });
    expect(state.draft).toBeNull();
    expect(state.turn).toBe('idle');
  });

  it('remembers that the greeting (no user message) failed, so retry re-runs it', () => {
    const state = askReducer(ready(), { type: 'turn_failed', messageKey: null, kind: 'unavailable' });
    expect(state.openingFailed).toBe(true);
    expect(state.messages).toEqual([]);
  });

  it('clears the error when the next turn starts', () => {
    const failed = askReducer(ready({ messages: [local('l1', 'x', 'failed')] }), { type: 'turn_failed', messageKey: 'l1', kind: 'offline' });
    const next = askReducer(failed, { type: 'turn_started', messageKey: 'l1', draftKey: 'd' });
    expect(next.error).toBeNull();
    expect(next.messages[0].status).toBe('sending');
  });

  it('reset returns to the initial loading state', () => {
    expect(askReducer(ready({ messages: [local('l', 'x')] }), { type: 'reset' })).toEqual(initialAskState);
  });
});

describe('affordances', () => {
  const assistant = (over: Partial<AskMessage>): AskUiMessage => ({ ...server({ id: 'a', ...over }), key: 'a', status: 'sent', animate: false });

  it('offers suggestions, photo requests and the plan only from the newest assistant message while idle', () => {
    const planInput = { actualStartingPoint: 'x', startingContext: null, photoAssetIds: [] };
    const state = ready({ messages: [assistant({ suggestions: ['A', 'B'], requestPhoto: { reason: 'why' }, readyToPlan: true, planInput })] });
    expect(affordances(state)).toEqual({ suggestions: ['A', 'B'], requestPhoto: { reason: 'why' }, planInput });
  });

  it('withdraws them as soon as the person replies or a turn is running', () => {
    const base = assistant({ suggestions: ['A'] });
    expect(affordances(ready({ messages: [base, local('l', 'reply')] })).suggestions).toEqual([]);
    expect(affordances(ready({ messages: [base], turn: 'thinking' })).suggestions).toEqual([]);
    expect(latestAssistant(ready({ messages: [base, local('l', 'reply')] }))).toBeNull();
  });

  it('only offers a plan when the assistant says it is ready', () => {
    const planInput = { actualStartingPoint: 'x', startingContext: null, photoAssetIds: [] };
    expect(affordances(ready({ messages: [assistant({ readyToPlan: false, planInput })] })).planInput).toBeNull();
  });
});

describe('draftPlanInput', () => {
  it('uses only what the person wrote, in order, within the server limit', () => {
    const input = draftPlanInput([local('a', 'First thing.', 'sent'), local('b', 'x'.repeat(600), 'sent')], 'My intention');
    expect(input.actualStartingPoint.startsWith('First thing. xxx')).toBe(true);
    expect(input.actualStartingPoint).toHaveLength(500);
    expect(input.startingContext).toBeNull();
  });

  it('falls back to the intention alone when nothing was written, and ignores failed messages', () => {
    expect(draftPlanInput([], 'Restore my Regal').actualStartingPoint).toBe('Restore my Regal');
    expect(draftPlanInput([local('a', 'never sent', 'failed')], 'Restore my Regal').actualStartingPoint).toBe('Restore my Regal');
  });

  it('carries only real uploaded photo ids', () => {
    const withPhotos: AskUiMessage = { ...local('a', 'see', 'sent'), attachments: [{ assetId: 'asset-1' }, { assetId: 'local-9' }, { assetId: 'asset-2' }] };
    expect(draftPlanInput([withPhotos], 'x').photoAssetIds).toEqual(['asset-1', 'asset-2']);
  });
});
