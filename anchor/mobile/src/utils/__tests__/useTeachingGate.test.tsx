import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { act, cleanup, render, screen } from '@testing-library/react-native';
import { useTeachingStore } from '@/stores/teachingStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTeachingGate } from '../useTeachingGate';

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: { track: jest.fn() },
}));

function TeachingProbe({ onTeaching }: { onTeaching?: (id: string | null) => void }) {
  const teaching = useTeachingGate({
    screenId: 'practice_home',
    candidateIds: ['practice_thread_strength_v1'],
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
});
