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

describe('V2ThreadEventTimeline recent activity', () => {
  const events = Array.from({ length: 14 }, (_, i) => stageItem({
    id: `p${i}`, type: i % 2 ? 'PRACTICE_COMPLETED' : 'WAYPOINT_REACHED',
    title: `Activity ${i}`, occurredAt: `2026-08-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`,
    formattedDate: `Aug ${i + 1}`,
  }));

  it('shows exactly the latest three events across all categories, newest first', () => {
    const { getAllByTestId, queryByTestId } = render(<V2ThreadEventTimeline events={events} onSelectEvent={jest.fn()} now={now} />);
    expect(getAllByTestId(/^thread-event-item-/).map(row => row.props.testID)).toEqual([
      'thread-event-item-p13', 'thread-event-item-p12', 'thread-event-item-p11',
    ]);
    expect(queryByTestId('thread-event-item-p10')).toBeNull();
  });

  it('opens the complete history and can return to the compact view', () => {
    const { getByText, getAllByTestId } = render(<V2ThreadEventTimeline events={events} onSelectEvent={jest.fn()} now={now} />);
    fireEvent.press(getByText('View all activity'));
    expect(getAllByTestId(/^thread-event-item-/)).toHaveLength(13);
    fireEvent.press(getByText('Show earlier'));
    expect(getAllByTestId(/^thread-event-item-/)).toHaveLength(14);
    fireEvent.press(getByText('Show recent'));
    expect(getAllByTestId(/^thread-event-item-/)).toHaveLength(3);
  });

  it('keeps detail navigation for practices and meaningful events', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(<V2ThreadEventTimeline events={events} onSelectEvent={onSelect} now={now} />);
    fireEvent.press(getByTestId('thread-event-item-p13'));
    expect(onSelect).toHaveBeenCalledWith(events[13]);
  });

  it('does not offer expansion for three or fewer events', () => {
    const { queryByText } = render(<V2ThreadEventTimeline events={events.slice(0, 3)} onSelectEvent={jest.fn()} now={now} />);
    expect(queryByText('View all activity')).toBeNull();
  });
});
