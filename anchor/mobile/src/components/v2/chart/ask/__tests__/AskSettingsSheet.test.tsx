jest.mock('react-native-reanimated', () => {
  const actual = require('@/__tests__/mocks/reactNativeReanimated').default;
  return { __esModule: true, ...actual };
});

import React from 'react';
import { Alert, BackHandler } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AskSettingsButton, AskSettingsSheet } from '../AskSettingsSheet';
import { askAccent } from '../askChartTheme';

const accent = askAccent('health');

function makeProfile(over: Record<string, unknown> = {}) {
  return {
    profile: {
      style: 'DRIVEN',
      memories: [
        { key: 'availability', value: 'Weekends only', source: 'CONVERSATION', updatedAt: '' },
        { key: 'resources', value: 'A garage', source: 'CONVERSATION', updatedAt: '' },
      ],
    },
    loading: false, error: null, reload: jest.fn(),
    setStyle: jest.fn(async () => undefined), editMemory: jest.fn(async () => true), forgetMemory: jest.fn(async () => undefined),
    forgetAll: jest.fn(async () => undefined), clearConversation: jest.fn(async () => true),
    ...over,
  };
}

function sheet(profile = makeProfile(), props: Record<string, unknown> = {}) {
  const onClose = jest.fn();
  const onCleared = jest.fn();
  const screen = render(<AskSettingsSheet visible accent={accent} profile={profile as never} onClose={onClose} onCleared={onCleared} {...props} />);
  return { screen, profile, onClose, onCleared };
}

describe('AskSettingsSheet', () => {
  it('is hidden until opened, and the header button opens it', () => {
    const onPress = jest.fn();
    fireEvent.press(render(<AskSettingsButton onPress={onPress} />).getByTestId('ask-settings-button'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(render(<AskSettingsSheet visible={false} accent={accent} profile={makeProfile() as never} onClose={jest.fn()} onCleared={jest.fn()} />).queryByTestId('ask-settings-sheet')).toBeNull();
  });

  it('shows the three coaching styles with the current one selected, and changes it on tap', () => {
    const { screen, profile } = sheet();
    expect(screen.getByTestId('ask-style-DRIVEN').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('ask-style-DIRECT').props.accessibilityState).toMatchObject({ selected: false });
    fireEvent.press(screen.getByTestId('ask-style-DIRECT'));
    expect(profile.setStyle).toHaveBeenCalledWith('DIRECT');
    expect(screen.getByText('Changes how Ask Chart talks, never what it tells you.')).toBeTruthy();
  });

  it('lists what is remembered with plain labels, and edits one', async () => {
    const { screen, profile } = sheet();
    expect(screen.getByText('When you can work')).toBeTruthy();
    expect(screen.getByText('Weekends only')).toBeTruthy();
    fireEvent.press(screen.getByTestId('ask-memory-edit-availability'));
    fireEvent.changeText(screen.getByTestId('ask-memory-input'), 'Evenings');
    await act(async () => { fireEvent.press(screen.getByTestId('ask-memory-save')); });
    expect(profile.editMemory).toHaveBeenCalledWith('availability', 'Evenings');
    await waitFor(() => expect(screen.queryByTestId('ask-memory-input')).toBeNull());
  });

  it('keeps the editor open when the save fails', async () => {
    const profile = makeProfile({ editMemory: jest.fn(async () => false) });
    const { screen } = sheet(profile);
    fireEvent.press(screen.getByTestId('ask-memory-edit-availability'));
    fireEvent.press(screen.getByTestId('ask-memory-save'));
    await waitFor(() => expect(profile.editMemory).toHaveBeenCalled());
    expect(screen.getByTestId('ask-memory-input')).toBeTruthy();
  });

  it('forgets one memory on tap, and everything only after a confirmation', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { screen, profile } = sheet();
    fireEvent.press(screen.getByTestId('ask-memory-forget-resources'));
    expect(profile.forgetMemory).toHaveBeenCalledWith('resources');
    fireEvent.press(screen.getByTestId('ask-memory-forget-all'));
    expect(profile.forgetAll).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2] ?? [];
    buttons.find(button => button.text === 'Forget')?.onPress?.();
    expect(profile.forgetAll).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });

  it('explains an empty memory honestly', () => {
    const { screen } = sheet(makeProfile({ profile: { style: 'DRIVEN', memories: [] } }));
    expect(screen.getByTestId('ask-memory-empty')).toBeTruthy();
    expect(screen.queryByTestId('ask-memory-forget-all')).toBeNull();
  });

  it('clears the conversation only after confirming, then refreshes the conversation and closes', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { screen, profile, onCleared, onClose } = sheet();
    fireEvent.press(screen.getByTestId('ask-clear-conversation'));
    expect(profile.clearConversation).not.toHaveBeenCalled();
    expect(alert.mock.calls[0][1]).toMatch(/Your Chart is not affected/);
    alert.mock.calls[0][2]?.find(button => button.text === 'Clear')?.onPress?.();
    await waitFor(() => expect(onCleared).toHaveBeenCalledTimes(1));
    expect(profile.clearConversation).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });

  it('shows errors, and closes on a tap outside and on hardware back', () => {
    let back: (() => boolean) | undefined;
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_n: string, handler: () => boolean) => { back = handler; return { remove: jest.fn() }; }) as never);
    const { screen, onClose } = sheet(makeProfile({ error: 'That didn’t save. Nothing was changed.' }));
    expect(screen.getByTestId('ask-settings-error')).toBeTruthy();
    fireEvent.press(screen.getByTestId('ask-settings-scrim'));
    expect(back?.()).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});
