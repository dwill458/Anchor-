jest.mock('@/components/v2/anchor/ThreadAura', () => {
  const { View } = require('react-native');
  return { ThreadAura: jest.fn((props: { categoryColor: string }) => <View testID="actual-thread-aura" accessibilityLabel={props.categoryColor} />) };
});
jest.mock('@/components/common/SigilSvg', () => ({ SigilSvg: () => null }));
jest.mock('@/components/v2/anchor/AnchorMark', () => ({ AnchorMark: () => null }));

import React from 'react';
import { render } from '@testing-library/react-native';
import { getCategoryColor } from '@/theme/v2';
import { ThreadAura } from '@/components/v2/anchor/ThreadAura';
import { AskSpeakingAvatar } from '../AskAnchorAvatar';
import { askAccent } from '../askChartTheme';
import { askReveal, askRevealEnergy } from '../askReveal';

describe('Ask speaking aura category routing', () => {
  beforeEach(() => { jest.clearAllMocks(); askReveal.reset(); });

  it.each(['career', 'health'])('passes the %s Anchor colour through CircularAnchorRenderer to ThreadAura', category => {
    const screen = render(<AskSpeakingAvatar
      art={{ svg: '<svg/>', imageUrl: null, category, expression: null }}
      category={category}
      accent={askAccent(category)}
      active
      reducedMotion={false}
    />);
    expect(screen.getByTestId('actual-thread-aura').props.accessibilityLabel).toBe(getCategoryColor(category));
    expect(ThreadAura).toHaveBeenCalledWith(expect.objectContaining({ categoryColor: getCategoryColor(category) }), undefined);
  });

  it('keeps the legacy active prop in speaking mode and flares with the shared word pulse', () => {
    const props = { art: { svg: '<svg/>', imageUrl: null, category: 'career', expression: null }, category: 'career', accent: askAccent('career'), active: true, reducedMotion: false };
    const screen = render(<AskSpeakingAvatar {...props} />);
    expect(screen.getByLabelText('Your Anchor is speaking')).toBeTruthy();
    const resting = jest.mocked(ThreadAura).mock.calls.at(-1)![0];
    expect(resting.strengthProgress?.value).toBeCloseTo(0.7 * 0.7);
    expect(resting.strengthBloom?.value).toBe(1);
    askRevealEnergy.value = 1;
    screen.rerender(<AskSpeakingAvatar {...props} size={35} />);
    const pulsing = jest.mocked(ThreadAura).mock.calls.at(-1)![0];
    expect(pulsing.strengthProgress?.value).toBeCloseTo(0.7);
    expect(pulsing.strengthBloom?.value).toBeCloseTo(1.07);
    screen.rerender(<AskSpeakingAvatar {...props} reducedMotion />);
    const still = jest.mocked(ThreadAura).mock.calls.at(-1)![0];
    expect(still.strengthProgress?.value).toBeCloseTo(0.7);
    expect(still.strengthBloom?.value).toBe(1);
  });
});
