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
  expect(dismiss).toHaveBeenCalledWith(['home.today'], reason);
});
it('passes the approved static Today copy to the coach without a mode or duration override', () => {
  render(<ScreenTeaching screen="home" reducedMotion queue={{ steps: ['home.today'], ready: true, markShown: jest.fn(), dismiss: jest.fn() }} targets={{}} />);
  expect(jest.mocked(SpotlightCoach).mock.calls.at(-1)![0].steps[0]).toMatchObject({
    title: 'Start here each day.',
    body: 'Today suggests one meaningful action to help you move forward with your Anchor.',
  });
});
it('waits for whisper entry before starting display dwell and cancels entry on unmount', () => {
  jest.useFakeTimers();
  const markShown = jest.fn();
  const tree = render(<ScreenTeaching screen="vision" reducedMotion={false} queue={{ steps: ['vision.first'], ready: true, markShown, dismiss: jest.fn() }} targets={{}} />);
  jest.advanceTimersByTime(179); expect(markShown).not.toHaveBeenCalled();
  tree.unmount(); jest.advanceTimersByTime(1); expect(markShown).not.toHaveBeenCalled();
  const next = render(<ScreenTeaching screen="vision" reducedMotion={false} queue={{ steps: ['vision.first'], ready: true, markShown, dismiss: jest.fn() }} targets={{}} />);
  jest.advanceTimersByTime(180); expect(markShown).toHaveBeenCalledWith('vision.first'); next.unmount(); jest.useRealTimers();
});
