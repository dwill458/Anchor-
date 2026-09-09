import React from 'react';
import { render } from '@testing-library/react-native';
import { V2ThreadEventDetailSheet } from '../V2ThreadEventDetailSheet';
import type { V2PersistedThreadEvent } from '@/adapters/v2/threadEvents';

const persistedEvent: V2PersistedThreadEvent = { eventId: 'te-10', ledgerSequence: '10', anchorId: 'anchor-1', eventType: 'EVOLUTION_STAGE_REACHED', significance: 'HIGH', occurredAt: '2026-09-08T12:00:00.000Z', sourceKind: 'THREAD_ENGINE', correlationId: 'practice-10', correlationSequence: 2, eventVersion: 1, detectorVersion: 'v1', metadata: { anchorName: 'Career', stageName: 'Grounded', thresholdValue: 10, threadValue: 10 }, createdAt: '2026-09-08T12:00:00.000Z' };

describe('V2ThreadEventDetailSheet', () => {
  it('renders only stored event facts and never a client-calculated Thread gain', () => {
    const { getByText, queryByText } = render(<V2ThreadEventDetailSheet event={persistedEvent} visible onClose={jest.fn()} />);
    expect(getByText('Thread Strength')).toBeTruthy();
    expect(getByText('10')).toBeTruthy();
    expect(queryByText(/\+/)).toBeNull();
    expect(queryByText(/delta/i)).toBeNull();
  });
});
