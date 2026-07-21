import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { SessionConfigurationPill } from '../SessionConfiguration';

describe('SessionConfigurationPill', () => {
  it.each([
    [180, 'female', 'ambient', '3 min · Female Voice · Ambient'],
    [300, 'male', 'off', '5 min · Male Voice · Silence'],
    [60, 'none', 'ambient', '1 min · No Voice · Ambient'],
    [180, 'none', 'off', '3 min · No Voice · Silence'],
  ] as const)('shows the effective duration, voice, and background', (durationSeconds, guidanceVoice, backgroundAudio, label) => {
    render(
      <SessionConfigurationPill
        value={{ guidanceVoice, backgroundAudio }}
        durationSeconds={durationSeconds}
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByText(label)).toBeTruthy();
  });
});

