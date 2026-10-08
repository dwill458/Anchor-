import React from 'react';
import { render } from '@testing-library/react-native';
import { V2ThreadEventTimeline } from '../V2ThreadEventTimeline';
import type { V2ThreadEventItem } from '@/adapters/v2/progress/types';

const now = new Date('2026-08-20T12:00:00.000Z');

const stageItem = (overrides: Partial<V2ThreadEventItem>): V2ThreadEventItem => ({
  id: 'evt-stage-anchor-1-Established',
  type: 'EVOLUTION_STAGE_REACHED',
  title: 'Established reached',
  copy: 'Your Anchor reached its permanent structural stage: Established.',
  why: 'Meaningful reinforcement held across time.',
  significance: 'HIGH',
  occurredAt: '',
  formattedDate: '',
  authoritativeDelta: null,
  authoritativeThreadRange: null,
  sourceDomain: 'THREAD_ENGINE',
  ...overrides,
});

describe('V2ThreadEventTimeline dates', () => {
  it('gives an event with no known date no date at all, and files it under Earlier', () => {
    const { getByTestId, getByText } = render(
      <V2ThreadEventTimeline events={[stageItem({})]} onSelectEvent={jest.fn()} now={now} />,
    );
    expect(getByTestId('thread-event-item-evt-stage-anchor-1-Established').props.accessibilityLabel).toBe('Established reached');
    expect(getByText('Earlier')).toBeTruthy();
  });

  it('labels a dated event with its real date', () => {
    const dated = stageItem({
      id: 'evt-full-strength-anchor-1',
      type: 'FULL_STRENGTH_REACHED',
      title: 'Full Strength reached',
      significance: 'MAJOR',
      occurredAt: '2026-08-07T08:00:00.000Z',
      formattedDate: 'Aug 7',
    });
    const { getByTestId } = render(<V2ThreadEventTimeline events={[dated]} onSelectEvent={jest.fn()} now={now} />);
    expect(getByTestId('thread-event-item-evt-full-strength-anchor-1').props.accessibilityLabel).toBe('Full Strength reached, on Aug 7');
  });
});
