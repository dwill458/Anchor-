import React from 'react';
import { render } from '@testing-library/react-native';
import { PremiumAnchorGlow } from '../PremiumAnchorGlow';

describe('PremiumAnchorGlow', () => {
  it('renders dormant glow state', () => {
    const { toJSON } = render(
      <PremiumAnchorGlow
        size={180}
        state="dormant"
        variant="detail"
        reduceMotionEnabled
      />
    );

    expect(toJSON()).toBeTruthy();
  });

  it('renders charged glow state with rings', () => {
    const { toJSON } = render(
      <PremiumAnchorGlow
        size={180}
        state="charged"
        variant="ritual"
        reduceMotionEnabled
      />
    );

    expect(toJSON()).toBeTruthy();
  });
});
