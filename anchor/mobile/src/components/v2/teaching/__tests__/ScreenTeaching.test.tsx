import React from 'react';
import { render } from '@testing-library/react-native';
import { ScreenTeaching } from '../ScreenTeaching';
import { SpotlightCoach } from '../SpotlightCoach';
jest.mock('../SpotlightCoach', () => ({ SpotlightCoach: jest.fn(() => null) }));
jest.mock('@/utils/v2/teachingAnalytics', () => ({ trackTeaching: jest.fn() }));
it.each(['scrim', 'back', 'complete', 'unmeasurable'])('commits only shown steps on %s', reason => {
  const dismiss = jest.fn();
  render(<ScreenTeaching screen="home" reducedMotion queue={{ steps: ['home.today', 'home.progress'], ready: true, markShown: jest.fn(), dismiss }} targets={{}} />);
  const props = jest.mocked(SpotlightCoach).mock.calls.at(-1)![0];
  props.onReady('home.today');
  props.onDismiss(reason);
  expect(dismiss).toHaveBeenCalledWith(['home.today']);
});
it('passes resolved copy and spoken duration to the coach', () => {
  render(<ScreenTeaching screen="home" reducedMotion queue={{ steps: ['home.today'], ready: true, markShown: jest.fn(), dismiss: jest.fn() }} targets={{ 'home.today': { body: 'Today: Focus, 30 sec.', accessibilityLabel: 'Today: Focus, 30 seconds.' } }} />);
  expect(jest.mocked(SpotlightCoach).mock.calls.at(-1)![0].steps[0]).toMatchObject({ body: 'Today: Focus, 30 sec.', accessibilityLabel: 'Today: Focus, 30 seconds.' });
});
