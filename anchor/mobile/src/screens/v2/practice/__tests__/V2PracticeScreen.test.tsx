import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockAcknowledge = jest.fn();
jest.mock('@/adapters/v2/practice', () => ({
  ...jest.requireActual('@/adapters/v2/practice'),
  acknowledgeV2RecommendationSignal: (...args: unknown[]) => mockAcknowledge(...args),
}));

import { V2PracticeScreen } from '../V2PracticeScreen';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import type { V2RecommendationContext } from '@/adapters/v2/practice';

const context = (action: V2RecommendationContext['recommendation']['action']): V2RecommendationContext => ({
  anchorId: 'a',
  completionSignal: action === 'Release' ? { id: 'signal-1', type: 'intention_completed', occurredAt: '2026-09-08T12:00:00.000Z' } : null,
  vision: { exists: action === 'Visualize', seenToday: false },
  thread: { delta7d: action === 'Deep Prime' ? -3 : null, delta7dStatus: action === 'Deep Prime' ? 'AVAILABLE' : 'UNAVAILABLE', status: action === 'Deep Prime' ? 'AVAILABLE' : 'UNAVAILABLE' },
  recommendation: { action, reason: 'server_authoritative' },
});

const fullAccess = { focus: true, deep_prime: true, visualize: true, release: true };
const renderPractice = (recommendation = context('Focus'), props: Partial<React.ComponentProps<typeof V2PracticeScreen>> = {}) => render(<V2PracticeScreen anchor={makeAnchor({ id: 'a', threadStrength: 20 })} recommendation={recommendation} capabilities={fullAccess} {...props} />);

describe('V2PracticeScreen', () => {
  beforeEach(() => { mockAcknowledge.mockReset(); mockAcknowledge.mockResolvedValue(undefined); });

  it('renders exactly one server-provided recommendation', () => {
    renderPractice(context('Focus'));
    expect(screen.getAllByTestId('v2-recommended-today')).toHaveLength(1);
    expect(screen.getAllByText('Focus')).toHaveLength(2);
  });

  it.each([
    ['Release', 'Release', 'Reached a meaningful milestone'],
    ['Visualize', 'Visualize', 'Reconnect with your Vision today'],
    ['Deep Prime', 'Deep Prime', 'Thread has softened over the last 7 days'],
    ['Focus', 'Focus', 'Daily reinforcement for your Anchor'],
  ] as const)('presents the %s recommendation and locked why-copy', (action, title, why) => {
    renderPractice(context(action));
    expect(screen.getByLabelText(new RegExp(`Recommended today: ${title}`))).toBeTruthy();
    expect(screen.getByText(why)).toBeTruthy();
  });

  it('keeps the server Focus result when delta7d is unavailable, even at low strength', () => {
    renderPractice(context('Focus'));
    expect(screen.getByLabelText(/Recommended today: Focus/)).toBeTruthy();
    expect(screen.queryByLabelText(/Recommended today: Deep Prime/)).toBeNull();
  });

  it('does not acknowledge on mount and acknowledges a signal only after explicit recommendation engagement', () => {
    renderPractice(context('Release'));
    expect(mockAcknowledge).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('v2-recommended-today'));
    expect(mockAcknowledge).toHaveBeenCalledWith('a', 'signal-1', 'intention_completed');
  });

  it('keeps all four mode rows available beneath the recommendation', () => {
    renderPractice();
    expect(screen.getByTestId('v2-practice-row-focus')).toBeTruthy();
    expect(screen.getByTestId('v2-practice-row-deep_prime')).toBeTruthy();
    expect(screen.getByTestId('v2-practice-row-visualize')).toBeTruthy();
    expect(screen.getByTestId('v2-practice-row-release')).toBeTruthy();
  });

  it('retains the selected Anchor context and enters Prepare for an entitled mode', () => {
    const anchor = makeAnchor({ id: 'a', intentionText: 'Ship a trustworthy Practice hub' });
    render(<V2PracticeScreen anchor={anchor} recommendation={context('Focus')} capabilities={fullAccess} />);
    expect(screen.getByText('Ship a trustworthy Practice hub')).toBeTruthy();
    fireEvent.press(screen.getByTestId('v2-practice-row-focus'));
    expect(screen.getByTestId('v2-practice-prepare-focus')).toBeTruthy();
    expect(screen.getByText('Ship a trustworthy Practice hub')).toBeTruthy();
  });

  it('emits the typed premium capability intent instead of navigating a paywall', () => {
    const onPremiumCapabilityRequired = jest.fn();
    renderPractice(context('Deep Prime'), { capabilities: { ...fullAccess, deep_prime: false }, onPremiumCapabilityRequired });
    fireEvent.press(screen.getByTestId('v2-practice-row-deep_prime'));
    expect(onPremiumCapabilityRequired).toHaveBeenCalledWith({ capability: 'deep_prime', anchorId: 'a', source: 'practice_hub' });
    expect(screen.queryByTestId('v2-practice-prepare-deep_prime')).toBeNull();
  });

  it('offers the Vision creation handoff without fabricating a Vision', () => {
    const onCreateVision = jest.fn();
    renderPractice(context('Visualize'), { onCreateVision });
    fireEvent.press(screen.getByTestId('v2-practice-row-visualize'));
    expect(screen.getByText('Create a Vision first')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Create a Vision for this Anchor'));
    expect(onCreateVision).toHaveBeenCalledWith('a');
  });

  it('hands Release off without calling a destructive legacy endpoint', () => {
    const onReleaseRequested = jest.fn();
    renderPractice(context('Release'), { onReleaseRequested });
    fireEvent.press(screen.getByTestId('v2-practice-row-release'));
    fireEvent.press(screen.getByLabelText('Continue to Release'));
    expect(onReleaseRequested).toHaveBeenCalledWith('a', 'practice_prepare');
  });
});
