import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { V2ThreadEventTimeline } from '../V2ThreadEventTimeline';
import type { V2ThreadEventItem } from '@/adapters/v2/progress/types';

const now = new Date('2026-08-20T12:00:00.000Z');

const stageItem = (overrides: Partial<V2ThreadEventItem>): V2ThreadEventItem => ({
  id: 'evt-stage-anchor-1-Established',
  type: 'EVOLUTION_STAGE_REACHED',
  title: 'Established reached',
  copy: 'Your Anchor reached the Established stage. Stages follow your current Thread Strength.',
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

describe('V2ThreadEventTimeline routine toggle', () => {
  const at = (day: number) => `2026-08-${String(day).padStart(2, '0')}T10:00:00.000Z`;
  const waypoint = stageItem({ id: 'wp', type: 'WAYPOINT_REACHED', title: 'Prototype validated', occurredAt: at(15), formattedDate: 'Aug 15' });
  const milestone = stageItem({ id: 'ms', type: 'MILESTONE_EARNED', title: 'First Practice', occurredAt: at(14), formattedDate: 'Aug 14' });
  const practices = Array.from({ length: 4 }, (_, i) =>
    stageItem({ id: `p${i}`, type: 'PRACTICE_COMPLETED', title: 'Practice completed', occurredAt: at(10 + i), formattedDate: `Aug ${10 + i}` }),
  );

  it('leads with meaningful events and keeps repeated practice behind a toggle', () => {
    const { getByTestId, queryByTestId, getByText } = render(
      <V2ThreadEventTimeline events={[waypoint, milestone, ...practices]} onSelectEvent={jest.fn()} now={now} />,
    );
    expect(getByTestId('thread-event-item-wp')).toBeTruthy();
    expect(getByTestId('thread-event-item-ms')).toBeTruthy();
    expect(queryByTestId('thread-event-item-p0')).toBeNull();
    expect(getByText('Show all activity (4 routine)')).toBeTruthy();
  });

  it('shows every routine entry on request and hides them again, losing nothing', () => {
    const { getByTestId, queryByTestId, getByText } = render(
      <V2ThreadEventTimeline events={[waypoint, milestone, ...practices]} onSelectEvent={jest.fn()} now={now} />,
    );
    fireEvent.press(getByTestId('v2-thread-event-timeline-routine-toggle'));
    expect(getByTestId('thread-event-item-p0')).toBeTruthy();
    expect(getByTestId('thread-event-item-p3')).toBeTruthy();
    expect(getByText('Hide routine activity')).toBeTruthy();
    fireEvent.press(getByTestId('v2-thread-event-timeline-routine-toggle'));
    expect(queryByTestId('thread-event-item-p0')).toBeNull();
  });

  it('has no toggle when there is no routine activity', () => {
    const { queryByTestId } = render(<V2ThreadEventTimeline events={[waypoint]} onSelectEvent={jest.fn()} now={now} />);
    expect(queryByTestId('v2-thread-event-timeline-routine-toggle')).toBeNull();
  });

  it('says where the practices are when only routine entries exist', () => {
    const { getByTestId, queryByTestId } = render(<V2ThreadEventTimeline events={practices} onSelectEvent={jest.fn()} now={now} />);
    expect(getByTestId('v2-thread-event-timeline-quiet')).toBeTruthy();
    expect(queryByTestId('thread-event-item-p0')).toBeNull();
    fireEvent.press(getByTestId('v2-thread-event-timeline-routine-toggle'));
    expect(getByTestId('thread-event-item-p0')).toBeTruthy();
  });

  it('selects an event on press', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(<V2ThreadEventTimeline events={[milestone]} onSelectEvent={onSelect} now={now} />);
    fireEvent.press(getByTestId('thread-event-item-ms'));
    expect(onSelect).toHaveBeenCalledWith(milestone);
  });
});
