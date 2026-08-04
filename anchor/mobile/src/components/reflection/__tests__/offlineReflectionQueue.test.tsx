/**
 * Regression suite for H-001 — explicit offline Reflection save must stay queued.
 *
 * The composer used to memoize its draft on the whole `props` object, which is
 * a new reference every render. Any rerender (including the one caused by the
 * "Saved on this device" message itself) recomputed the draft with a default
 * `saveState: 'draft'` and re-ran the autosave effect, and `upsert` replaced the
 * stored record wholesale. `flushQueuedCreates` only sends drafts whose state is
 * exactly `'queued'`, so the reflection was never sent while the UI claimed it
 * had been saved.
 *
 * These tests assert on persisted draft metadata and call counts, never on the
 * private writing itself.
 */

import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

jest.mock('@/stores/authStore', () => {
  const state = { user: { id: 'acct-a' } };
  return {
    useAuthStore: Object.assign((selector: (s: typeof state) => unknown) => selector(state), {
      getState: () => state,
      setState: (next: Partial<typeof state>) => Object.assign(state, next),
    }),
  };
});

jest.mock('@/stores/courseStore', () => {
  const state = {
    flags: {
      chart_enabled: true,
      chart_write_enabled: true,
      chart_reflections_enabled: true,
      chart_ai_planner_enabled: false,
      chart_notifications_enabled: false,
      chart_existing_user_intro_enabled: false,
    },
    offline: true,
  };
  return {
    useCourseStore: Object.assign((selector: (s: typeof state) => unknown) => selector(state), {
      getState: () => state,
    }),
  };
});

import { ReflectionComposer } from '@/components/reflection/ReflectionComposer';
import { reflectionDraftStorageKey, useReflectionDraftStore } from '@/stores/reflectionDraftStore';
import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';
import { apiClient } from '@/services/ApiClient';
import { reflectionService } from '@/services/ReflectionService';

const DRAFT_KEY = 'course:course-h:manual';
const BODY = 'H canary reflection body';
const QUEUED_COPY = /Saved on this device/i;

function renderComposer(onRender?: () => void) {
  const composer = (
    <ReflectionComposer
      source="MANUAL_COURSE"
      promptType="COURSE_STATUS"
      promptVersion={1}
      courseId="course-h"
      draftKey={DRAFT_KEY}
      onSaved={jest.fn()}
      onSkipped={jest.fn()}
    />
  );
  if (!onRender) return render(composer);
  return render(
    <React.Profiler id="composer" onRender={onRender}>
      {composer}
    </React.Profiler>,
  );
}

const storedDraft = () => useReflectionDraftStore.getState().drafts[DRAFT_KEY];

async function saveOffline(utils: ReturnType<typeof render>) {
  fireEvent.changeText(utils.getByLabelText('Reflection'), BODY);
  fireEvent.press(utils.getByText('Save reflection'));
  await waitFor(() => expect(utils.getByText(QUEUED_COPY)).toBeTruthy());
  await waitFor(() => expect(storedDraft()?.saveState).toBe('queued'));
}

describe('explicit offline reflection save (H-001)', () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    useReflectionDraftStore.setState({
      accountId: null,
      hydrated: false,
      drafts: {},
      handledOfferKeys: [],
    });
    // The SecureStore mock and the storage layer's write cache both outlive a
    // single test, so clear the encrypted record too or drafts leak forward.
    await encryptedPersistStorage.removeItem(reflectionDraftStorageKey('acct-a'));
    await encryptedPersistStorage.removeItem(reflectionDraftStorageKey('acct-b'));
    await useReflectionDraftStore.getState().bindAccount('acct-a');
  });

  it('creates a queued draft with one stable idempotency key', async () => {
    const utils = renderComposer();
    await saveOffline(utils);

    const draft = storedDraft();
    expect(draft.saveState).toBe('queued');
    expect(typeof draft.idempotencyKey).toBe('string');
    expect(draft.idempotencyKey.length).toBeGreaterThan(0);
  });

  it('does not revert to draft across a rerender', async () => {
    const utils = renderComposer();
    await saveOffline(utils);
    const key = storedDraft().idempotencyKey;

    utils.rerender(
      <ReflectionComposer
        source="MANUAL_COURSE"
        promptType="COURSE_STATUS"
        promptVersion={1}
        courseId="course-h"
        draftKey={DRAFT_KEY}
        onSaved={jest.fn()}
        onSkipped={jest.fn()}
      />,
    );

    await waitFor(() => expect(storedDraft().saveState).toBe('queued'));
    expect(storedDraft().idempotencyKey).toBe(key);
  });

  it('survives the error-state rerender that the success message itself causes', async () => {
    // The queued-success copy is rendered through the same error live region,
    // so showing it re-renders the composer. That render must not undo the queue.
    const utils = renderComposer();
    await saveOffline(utils);
    const key = storedDraft().idempotencyKey;

    // A validation failure afterwards must not destroy the queued record either.
    fireEvent.changeText(utils.getByLabelText('Reflection'), '   ');
    fireEvent.press(utils.getByText('Save reflection'));
    await waitFor(() => expect(utils.getByText(/Add a few words before saving/i)).toBeTruthy());

    expect(storedDraft().saveState).toBe('queued');
    expect(storedDraft().idempotencyKey).toBe(key);
  });

  it('preserves the queued key when further content is typed', async () => {
    const utils = renderComposer();
    await saveOffline(utils);
    const key = storedDraft().idempotencyKey;

    fireEvent.changeText(utils.getByLabelText('Reflection'), `${BODY} continued`);

    await waitFor(() => expect(storedDraft().body).toContain('continued'));
    expect(storedDraft().saveState).toBe('queued');
    expect(storedDraft().idempotencyKey).toBe(key);
  });

  it('does not create a second queued operation on repeated Save taps', async () => {
    const utils = renderComposer();

    fireEvent.changeText(utils.getByLabelText('Reflection'), BODY);
    fireEvent.press(utils.getByText('Save reflection'));
    // The control disables itself for the duration of the save, so a second tap
    // cannot start a concurrent queue operation.
    expect(utils.getByLabelText('Saving…').props.accessibilityState.disabled).toBe(true);

    await waitFor(() => expect(utils.getByText(QUEUED_COPY)).toBeTruthy());
    const key = storedDraft().idempotencyKey;

    // Tapping again once the first save settled re-queues the same record.
    fireEvent.press(utils.getByText('Save reflection'));
    await waitFor(() => expect(storedDraft().saveState).toBe('queued'));

    const queued = Object.values(useReflectionDraftStore.getState().drafts).filter(
      (draft) => draft.saveState === 'queued',
    );
    expect(queued).toHaveLength(1);
    expect(queued[0].idempotencyKey).toBe(key);
  });

  it('keeps unsaved typing as a draft and never auto-queues it', async () => {
    const utils = renderComposer();
    fireEvent.changeText(utils.getByLabelText('Reflection'), BODY);

    await waitFor(() => expect(storedDraft()).toBeDefined());
    expect(storedDraft().saveState).toBe('draft');
  });

  it('survives an app restart', async () => {
    const utils = renderComposer();
    await saveOffline(utils);
    const key = storedDraft().idempotencyKey;
    utils.unmount();

    // Cold start: in-memory state is gone; only encrypted storage remains.
    useReflectionDraftStore.setState({
      accountId: null,
      hydrated: false,
      drafts: {},
      handledOfferKeys: [],
    });
    await useReflectionDraftStore.getState().bindAccount('acct-a');

    expect(storedDraft().saveState).toBe('queued');
    expect(storedDraft().idempotencyKey).toBe(key);

    // Re-opening the composer must resume the queued draft, not fork a new key.
    const reopened = renderComposer();
    await waitFor(() => expect(reopened.getByLabelText('Reflection').props.value).toBe(BODY));
    await waitFor(() => expect(storedDraft().saveState).toBe('queued'));
    expect(storedDraft().idempotencyKey).toBe(key);
  });

  it('sends exactly once on reconnect and finalizes the correct draft', async () => {
    const utils = renderComposer();
    await saveOffline(utils);
    const key = storedDraft().idempotencyKey;

    const post = jest
      .spyOn(apiClient, 'post')
      .mockResolvedValue({ data: { success: true, data: { id: 'reflection-1' } } } as never);

    await reflectionService.flushQueuedCreates('acct-a');
    await reflectionService.flushQueuedCreates('acct-a');

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      '/api/reflections',
      expect.objectContaining({ idempotencyKey: key }),
    );
    expect(storedDraft()).toBeUndefined();
  });

  it('retries under the same idempotency key after a network failure', async () => {
    const utils = renderComposer();
    await saveOffline(utils);
    const key = storedDraft().idempotencyKey;

    const post = jest.spyOn(apiClient, 'post').mockRejectedValueOnce(new Error('Network error'));
    await reflectionService.flushQueuedCreates('acct-a');
    expect(storedDraft()).toMatchObject({ saveState: 'queued', idempotencyKey: key, retryCount: 1 });

    post.mockResolvedValueOnce({ data: { success: true, data: { id: 'reflection-1' } } } as never);
    await reflectionService.flushQueuedCreates('acct-a');

    expect(post).toHaveBeenLastCalledWith(
      '/api/reflections',
      expect.objectContaining({ idempotencyKey: key }),
    );
    expect(storedDraft()).toBeUndefined();
  });

  it('cannot be loaded or flushed by another account', async () => {
    const utils = renderComposer();
    await saveOffline(utils);

    await useReflectionDraftStore.getState().bindAccount('acct-b');
    expect(useReflectionDraftStore.getState().drafts).toEqual({});

    const post = jest.spyOn(apiClient, 'post');
    await reflectionService.flushQueuedCreates('acct-b');
    expect(post).not.toHaveBeenCalled();
  });

  it('cannot resurrect a deleted reflection through the queue', async () => {
    const utils = renderComposer();
    await saveOffline(utils);
    const key = storedDraft().idempotencyKey;

    await useReflectionDraftStore.getState().tombstoneByIdempotencyKey(key);
    expect(storedDraft()).toBeUndefined();

    // A late autosave from the still-mounted composer must not re-create it as
    // a sendable record.
    fireEvent.changeText(utils.getByLabelText('Reflection'), `${BODY} zombie`);
    await waitFor(() => expect(storedDraft()?.saveState ?? 'draft').toBe('draft'));

    const post = jest.spyOn(apiClient, 'post');
    await reflectionService.flushQueuedCreates('acct-a');
    expect(post).not.toHaveBeenCalled();
  });

  it('keeps edit and delete online-only', async () => {
    const utils = renderComposer();
    await saveOffline(utils);

    // The composer is offline; nothing may reach the network from this screen.
    const patch = jest.spyOn(apiClient, 'patch');
    const del = jest.spyOn(apiClient, 'delete');
    fireEvent.press(utils.getByText('Save reflection'));
    await waitFor(() => expect(storedDraft().saveState).toBe('queued'));

    expect(patch).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

  it('does not write reflection content to the encrypted store on unrelated rerenders', async () => {
    // H-001's memo recomputed on every render, so each unrelated rerender
    // re-serialized and re-encrypted the whole draft blob.
    const utils = renderComposer();
    await saveOffline(utils);

    const setItem = jest.spyOn(encryptedPersistStorage, 'setItem');
    const secureWrites = (SecureStore.setItemAsync as jest.Mock).mock.calls.length;

    for (let i = 0; i < 5; i += 1) {
      utils.rerender(
        <ReflectionComposer
          source="MANUAL_COURSE"
          promptType="COURSE_STATUS"
          promptVersion={1}
          courseId="course-h"
          draftKey={DRAFT_KEY}
          onSaved={jest.fn()}
          onSkipped={jest.fn()}
        />,
      );
    }

    expect(setItem).not.toHaveBeenCalled();
    expect((SecureStore.setItemAsync as jest.Mock).mock.calls.length).toBe(secureWrites);
    expect(storedDraft().saveState).toBe('queued');
  });

  it('never emits reflection content anywhere but the create request', async () => {
    // `reflectionPrivacy.test.ts` proves these modules have no logger, analytics,
    // Sentry, or notification call sites at all. This is the runtime companion:
    // across a full offline save and flush, the body reaches only the API body.
    const spies = (['log', 'warn', 'error', 'info', 'debug'] as const).map((level) =>
      jest.spyOn(console, level).mockImplementation(() => undefined),
    );
    const utils = renderComposer();
    await saveOffline(utils);

    jest
      .spyOn(apiClient, 'post')
      .mockResolvedValue({ data: { success: true, data: { id: 'reflection-1' } } } as never);
    await reflectionService.flushQueuedCreates('acct-a');

    for (const spy of spies) {
      const emitted = spy.mock.calls.flat().map((arg) => JSON.stringify(arg) ?? '');
      expect(emitted.some((entry) => entry.includes(BODY))).toBe(false);
    }
  });

  it('commits a bounded number of renders and one draft write per keystroke', async () => {
    let renders = 0;
    const utils = renderComposer(() => {
      renders += 1;
    });
    const setItem = jest.spyOn(encryptedPersistStorage, 'setItem');

    fireEvent.changeText(utils.getByLabelText('Reflection'), 'one');
    await waitFor(() => expect(storedDraft()?.body).toBe('one'));
    const afterFirst = renders;
    const writesAfterFirst = setItem.mock.calls.length;

    fireEvent.changeText(utils.getByLabelText('Reflection'), 'one two');
    await waitFor(() => expect(storedDraft()?.body).toBe('one two'));

    // One keystroke commits one render and schedules one store write.
    expect(renders - afterFirst).toBeLessThanOrEqual(2);
    expect(setItem.mock.calls.length - writesAfterFirst).toBeLessThanOrEqual(1);
  });
});
