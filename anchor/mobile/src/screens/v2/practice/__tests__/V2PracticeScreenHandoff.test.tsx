import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

/**
 * The route may take over leaving a completed session (Complete to Home). This pins what
 * V2PracticeScreen does with the answer, with the session screen stood in for.
 */
jest.mock('../V2PracticeSessionScreen', () => {
  const { Pressable: RNPressable, Text: RNText, View: RNView } = require('react-native');
  return {
    V2PracticeSessionScreen: (props: { onCompleted: (result?: unknown) => void }) => (
      <RNView testID="mock-session">
        <RNPressable
          testID="mock-session-done"
          onPress={() => props.onCompleted({ mode: 'focus', durationSeconds: 30, saved: true, source: 'recommended_today' })}
        >
          <RNText>done</RNText>
        </RNPressable>
      </RNView>
    ),
  };
});

jest.mock('@/services/ApiClient', () => ({
  apiClient: { get: jest.fn(() => Promise.reject({ status: 404 })), post: jest.fn() },
  ApiClientError: class ApiClientError extends Error {},
}));

import { V2PracticeScreen } from '../V2PracticeScreen';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';

const fullAccess = { focus: true, deep_prime: true, visualize: true, release: true };

const renderInSession = (onSessionCompleted: (result?: unknown) => boolean | void) => {
  const anchor = makeAnchor({ id: 'a', userId: 'u1' });
  useAuthStore.setState({ user: { id: 'u1' } as never });
  useAnchorStore.setState({ anchors: [anchor] });
  return render(
    <V2PracticeScreen
      anchor={anchor}
      capabilities={fullAccess}
      resumeMode="focus"
      resumeDuration={30}
      resumeSource="recommended_today"
      onSessionCompleted={onSessionCompleted}
    />,
  );
};

describe('V2PracticeScreen completion hand-off', () => {
  it('leaves the session as it always did when the route does not take over', () => {
    const onSessionCompleted = jest.fn();
    renderInSession(onSessionCompleted);
    expect(screen.getByTestId('mock-session')).toBeTruthy();
    fireEvent.press(screen.getByTestId('mock-session-done'));
    expect(onSessionCompleted).toHaveBeenCalledWith({ mode: 'focus', durationSeconds: 30, saved: true, source: 'recommended_today' });
    expect(screen.queryByTestId('mock-session')).toBeNull();
  });

  it('keeps the complete screen up when the route says it is carrying the Anchor home itself', () => {
    const onSessionCompleted = jest.fn(() => true);
    renderInSession(onSessionCompleted);
    fireEvent.press(screen.getByTestId('mock-session-done'));
    expect(onSessionCompleted).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('mock-session')).toBeTruthy();
  });

  it('treats any answer other than true as not taking over', () => {
    renderInSession(jest.fn(() => false));
    fireEvent.press(screen.getByTestId('mock-session-done'));
    expect(screen.queryByTestId('mock-session')).toBeNull();
  });
});
