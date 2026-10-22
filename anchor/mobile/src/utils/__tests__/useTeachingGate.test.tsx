import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { act, cleanup, render, screen } from '@testing-library/react-native';
import { useTeachingStore } from '@/stores/teachingStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { useTeachingGate } from '../useTeachingGate';

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: { track: jest.fn() },
}));

function TeachingProbe({
  candidateIds = ['practice_thread_strength_v1'],
  screenId = 'practice_home',
  isReturning,
  onTeaching,
}: {
  candidateIds?: string[];
  screenId?: string;
  isReturning?: boolean;
  onTeaching?: (id: string | null) => void;
}) {
  const teaching = useTeachingGate({
    screenId,
    candidateIds,
    isReturning,
  });

  useEffect(() => {
    onTeaching?.(teaching?.teachingId ?? null);
  }, [onTeaching, teaching]);

  return <Text testID="teaching-id">{teaching?.teachingId ?? 'none'}</Text>;
}

describe('useTeachingGate', () => {
  beforeEach(() => {
    useTeachingStore.getState().reset();
    useSettingsStore.setState({ guideMode: true });
    useAnchorStore.setState({ anchors: [] });
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps the resolved teaching mounted after recording it as shown', () => {
    const seen: Array<string | null> = [];

    render(<TeachingProbe onTeaching={(id) => seen.push(id)} />);

    expect(screen.getByTestId('teaching-id').props.children).toBe(
      'practice_thread_strength_v1'
    );

    act(() => {
      useTeachingStore
        .getState()
        .recordShown('practice_thread_strength_v1', 'glass_card', 1);
    });

    expect(useTeachingStore.getState().isExhausted('practice_thread_strength_v1')).toBe(true);
    expect(screen.getByTestId('teaching-id').props.children).toBe(
      'practice_thread_strength_v1'
    );
    expect(seen[seen.length - 1]).toBe('practice_thread_strength_v1');
  });

  it('still suppresses exhausted teachings on a fresh screen visit', () => {
    const firstVisit = render(<TeachingProbe />);

    act(() => {
      useTeachingStore
        .getState()
        .recordShown('practice_thread_strength_v1', 'glass_card', 1);
    });

    firstVisit.unmount();
    render(<TeachingProbe />);

    expect(screen.getByTestId('teaching-id').props.children).toBe('none');
  });

  it('suppresses first_time teachings for returning users who created an anchor', () => {
    useTeachingStore.getState().setUserFlag('hasCreatedFirstAnchor', true);

    render(
      <TeachingProbe
        candidateIds={['intention_input_first_time_v1']}
        screenId="intention_input"
      />
    );

    expect(screen.getByTestId('teaching-id').props.children).toBe('none');
  });

  it('suppresses first_time teachings when existing anchors are in anchorStore', () => {
    useAnchorStore.setState({
      anchors: [{ id: 'existing-anchor', intention: 'Test', createdAt: new Date().toISOString() } as any],
    });

    render(
      <TeachingProbe
        candidateIds={['vault_intro_first_time_v1']}
        screenId="vault"
      />
    );

    expect(screen.getByTestId('teaching-id').props.children).toBe('none');
  });

  it('suppresses hesitation teachings for returning users', () => {
    render(
      <TeachingProbe
        candidateIds={['intention_input_hesitation_v1']}
        screenId="returning_intention"
        isReturning={true}
      />
    );

    expect(screen.getByTestId('teaching-id').props.children).toBe('none');
  });

  it('suppresses teachings already seen in the current app session', () => {
    render(
      <TeachingProbe
        candidateIds={['completion_seal_whisper_v1']}
        screenId="completion_modal"
      />
    );

    expect(screen.getByTestId('teaching-id').props.children).toBe(
      'completion_seal_whisper_v1'
    );

    act(() => {
      useTeachingStore
        .getState()
        .recordShown('completion_seal_whisper_v1', 'reflection_extension', 1);
    });

    cleanup();

    // Re-render in the same session
    render(
      <TeachingProbe
        candidateIds={['completion_seal_whisper_v1']}
        screenId="completion_modal"
      />
    );

    expect(screen.getByTestId('teaching-id').props.children).toBe('none');
  });
});
