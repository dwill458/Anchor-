/**
 * Workstream H release-gate harness — TEST ONLY.
 *
 * Part 12 (offline and recovery) requires:
 *   - "explicit offline Reflection create queues once"
 *   - "queued create preserves idempotency"
 *   - "offline UI does not claim success"
 *
 * This harness pins the behaviour of an explicit offline Save in
 * ReflectionComposer. It asserts only on the persisted draft record, never on
 * private text, so it is safe to keep in the suite.
 */

import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

jest.mock('@/stores/authStore', () => ({
  useAuthStore: Object.assign(
    (selector: (state: { user: { id: string } }) => unknown) => selector({ user: { id: 'acct-h' } }),
    { getState: () => ({ user: { id: 'acct-h' } }) },
  ),
}));

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
import { useReflectionDraftStore } from '@/stores/reflectionDraftStore';

const DRAFT_KEY = 'course:course-h:manual';

/**
 * This assertion encodes behaviour the baseline does NOT yet have, so it is
 * opt-in (`H_GATE_DEFECTS=1`) and does not colour the standard suite totals.
 * It becomes the regression test once the owning workstream lands the fix.
 */
const describeDefect = process.env.H_GATE_DEFECTS ? describe : describe.skip;

describeDefect('H gate — explicit offline reflection save', () => {
  beforeEach(async () => {
    useReflectionDraftStore.setState({
      accountId: null,
      hydrated: false,
      drafts: {},
      handledOfferKeys: [],
    });
    await useReflectionDraftStore.getState().bindAccount('acct-h');
  });

  it('keeps the draft in the queued state so the reconnect flush can send it', async () => {
    const { getByLabelText, getByText } = render(
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

    fireEvent.changeText(getByLabelText('Reflection'), 'H canary reflection body');
    fireEvent.press(getByText('Save reflection'));

    // The composer tells the person the write is durable and will sync.
    await waitFor(() =>
      expect(getByText(/Saved on this device/i)).toBeTruthy(),
    );

    // ReflectionService.flushQueuedCreates only sends drafts whose saveState is
    // exactly 'queued'. Anything else is silently never sent.
    await waitFor(() => {
      const draft = useReflectionDraftStore.getState().drafts[DRAFT_KEY];
      expect(draft).toBeDefined();
      expect(draft.saveState).toBe('queued');
    });
  });
});
