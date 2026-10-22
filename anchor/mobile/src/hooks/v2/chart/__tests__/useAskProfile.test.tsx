jest.mock('@/hooks/v2/chart/useAnchorChart', () => ({ trackChart: jest.fn() }));
jest.mock('@/services/ApiClient', () => ({ apiClient: { defaults: {}, get: jest.fn(), post: jest.fn() }, ApiClientError: class extends Error {} }));
jest.mock('@/services/AuthService', () => ({ AuthService: { getIdToken: jest.fn() } }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { AskProfile } from '@/services/v2/askChartApi';
import { askReducer, initialAskState, type AskState, type AskUiMessage } from '../askChartState';
import { useAskProfile } from '../useAskProfile';

const profile = (): AskProfile => ({
  style: 'DRIVEN',
  memories: [
    { key: 'availability', value: 'Weekends only', source: 'CONVERSATION', updatedAt: '2026-10-21T00:00:00Z' },
    { key: 'resources', value: 'A garage', source: 'CONVERSATION', updatedAt: '2026-10-21T00:00:00Z' },
  ],
});

function setup(open = true) {
  const api = {
    getProfile: jest.fn(async () => profile()),
    setStyle: jest.fn(async (style: string) => ({ style })),
    setMemory: jest.fn(async (_a: string, key: string, value: string) => ({ key, value })),
    deleteMemory: jest.fn(async () => ({ deleted: true })),
    deleteAllMemories: jest.fn(async () => ({ deleted: 2 })),
    clearConversation: jest.fn(async () => ({ cleared: 1 })),
  };
  const hook = renderHook(({ isOpen }) => useAskProfile({ anchorId: 'anchor-1', open: isOpen, api: api as never }), { initialProps: { isOpen: open } });
  return { api, hook };
}

describe('useAskProfile', () => {
  it('loads when opened, and not before', async () => {
    const closed = setup(false);
    expect(closed.api.getProfile).not.toHaveBeenCalled();
    closed.hook.rerender({ isOpen: true });
    await waitFor(() => expect(closed.hook.result.current.profile?.style).toBe('DRIVEN'));
    expect(closed.api.getProfile).toHaveBeenCalledWith('anchor-1');
  });

  it('shows a plain error when it cannot load, and can retry', async () => {
    const { api, hook } = setup();
    api.getProfile.mockRejectedValueOnce(new Error('offline'));
    hook.rerender({ isOpen: false });
    hook.rerender({ isOpen: true });
    await waitFor(() => expect(hook.result.current.error).toMatch(/Couldn’t load/));
    await act(async () => { await hook.result.current.reload(); });
    expect(hook.result.current.profile).not.toBeNull();
    expect(hook.result.current.error).toBeNull();
  });

  it('changes the style at once, saves it, and puts the old one back if the save fails', async () => {
    const { api, hook } = setup();
    await waitFor(() => expect(hook.result.current.profile).not.toBeNull());
    await act(async () => { await hook.result.current.setStyle('DIRECT'); });
    expect(api.setStyle).toHaveBeenCalledWith('DIRECT');
    expect(hook.result.current.profile?.style).toBe('DIRECT');
    api.setStyle.mockRejectedValueOnce(new Error('nope'));
    await act(async () => { await hook.result.current.setStyle('SUPPORTIVE'); });
    expect(hook.result.current.profile?.style).toBe('DIRECT');
    expect(hook.result.current.error).toMatch(/unchanged/);
    await act(async () => { await hook.result.current.setStyle('DIRECT'); });
    expect(api.setStyle).toHaveBeenCalledTimes(2);
  });

  it('corrects a memory only once the server has saved it', async () => {
    const { api, hook } = setup();
    await waitFor(() => expect(hook.result.current.profile).not.toBeNull());
    let ok = false;
    await act(async () => { ok = await hook.result.current.editMemory('availability', '  Evenings   after 7 '); });
    expect(ok).toBe(true);
    expect(api.setMemory).toHaveBeenCalledWith('anchor-1', 'availability', 'Evenings after 7');
    expect(hook.result.current.profile?.memories[0]).toMatchObject({ value: 'Evenings after 7', source: 'USER_EDITED' });
    api.setMemory.mockRejectedValueOnce(new Error('nope'));
    await act(async () => { ok = await hook.result.current.editMemory('resources', 'A lift'); });
    expect(ok).toBe(false);
    expect(hook.result.current.profile?.memories[1].value).toBe('A garage');
    await act(async () => { ok = await hook.result.current.editMemory('resources', '   '); });
    expect(ok).toBe(false);
  });

  it('forgets one memory, or all of them, after the server has deleted them', async () => {
    const { api, hook } = setup();
    await waitFor(() => expect(hook.result.current.profile).not.toBeNull());
    await act(async () => { await hook.result.current.forgetMemory('availability'); });
    expect(api.deleteMemory).toHaveBeenCalledWith('anchor-1', 'availability');
    expect(hook.result.current.profile?.memories.map(memory => memory.key)).toEqual(['resources']);
    api.deleteMemory.mockRejectedValueOnce(new Error('nope'));
    await act(async () => { await hook.result.current.forgetMemory('resources'); });
    expect(hook.result.current.profile?.memories).toHaveLength(1);
    await act(async () => { await hook.result.current.forgetAll(); });
    expect(hook.result.current.profile?.memories).toEqual([]);
  });

  it('reports whether the conversation was cleared', async () => {
    const { api, hook } = setup();
    let ok = false;
    await act(async () => { ok = await hook.result.current.clearConversation(); });
    expect(ok).toBe(true);
    api.clearConversation.mockRejectedValueOnce(new Error('nope'));
    await act(async () => { ok = await hook.result.current.clearConversation(); });
    expect(ok).toBe(false);
    expect(hook.result.current.error).toMatch(/didn’t clear/);
  });
});

describe('proposal status in the conversation', () => {
  const withAction = (id: string, status: 'PENDING' | 'APPLIED' | 'DISMISSED'): AskUiMessage => ({
    id, key: id, role: 'ASSISTANT', text: 't', createdAt: '', attachments: [], suggestions: [], requestPhoto: null, readyToPlan: false, planInput: null, actionUnavailable: false, skill: null, status: 'sent', animate: false,
    action: { type: 'ADD_MOVES', status, summary: 's', waypointId: 'w', waypointTitle: 'W', moves: [], reason: null, detail: null, routeProposalId: null, routeTitles: null, baseCourseVersion: 1 },
  });
  const ready = (messages: AskUiMessage[]): AskState => ({ ...initialAskState, status: 'ready', messages });

  it('marks one proposal applied or dismissed without touching the others', () => {
    const state = ready([withAction('a', 'PENDING'), withAction('b', 'PENDING')]);
    const next = askReducer(state, { type: 'action_status', messageId: 'a', status: 'APPLIED' });
    expect(next.messages.map(message => message.action?.status)).toEqual(['APPLIED', 'PENDING']);
  });

  it('syncs statuses from the server, and returns the same state when nothing changed', () => {
    const state = ready([withAction('a', 'PENDING')]);
    const server = [{ ...withAction('a', 'APPLIED') }];
    const synced = askReducer(state, { type: 'sync_actions', messages: server });
    expect(synced.messages[0].action?.status).toBe('APPLIED');
    expect(askReducer(synced, { type: 'sync_actions', messages: server })).toBe(synced);
    expect(askReducer(state, { type: 'sync_actions', messages: [] })).toBe(state);
  });
});
