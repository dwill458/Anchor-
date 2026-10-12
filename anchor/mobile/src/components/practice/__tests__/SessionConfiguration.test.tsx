import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { SessionConfigurationPill } from '../SessionConfiguration';

describe('SessionConfigurationPill', () => {
  it.each([
    [180, 'female', 'ambient', '3 min · Serene · Ambient'],
    [300, 'male', 'off', '5 min · Grounded · Silence'],
    [60, 'none', 'ambient', '1 min · No guidance · Ambient'],
    [180, 'none', 'off', '3 min · No guidance · Silence'],
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

