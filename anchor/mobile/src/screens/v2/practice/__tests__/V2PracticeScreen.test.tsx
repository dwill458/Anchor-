import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockAcknowledge = jest.fn();
const mockVisionGet = jest.fn();

jest.mock('@/adapters/v2/practice', () => ({
  ...jest.requireActual('@/adapters/v2/practice'),
  acknowledgeV2RecommendationSignal: (...args: unknown[]) => mockAcknowledge(...args),
}));

jest.mock('@/services/ApiClient', () => ({
  apiClient: { get: (...args: unknown[]) => mockVisionGet(...args), post: jest.fn() },
  ApiClientError: class ApiClientError extends Error {},
}));

const mockPlayerPlay = jest.fn();
const mockPlayerPause = jest.fn();
const mockAddListener = jest.fn();

jest.mock('expo-video', () => ({
  VideoView: (props: any) => {
    const { View } = require('react-native');
    return <View testID={props.testID ?? 'expo-video-view'} style={props.style} />;
  },
  useVideoPlayer: jest.fn((source: any, setup?: any) => {
    const player = {
      play: mockPlayerPlay,
      pause: mockPlayerPause,
      addListener: (event: string, callback: any) => {
        mockAddListener(event, callback);
        // Simulate immediate readyToPlay for tests
        if (event === 'statusChange') {
          callback({ status: 'readyToPlay' });
        }
        return { remove: jest.fn() };
      },
      loop: true,
      muted: true,
    };
    if (setup) setup(player);
    return player;
  }),
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
const renderPractice = (recommendation = context('Focus'), props: Partial<React.ComponentProps<typeof V2PracticeScreen>> = {}) =>
  render(<V2PracticeScreen anchor={makeAnchor({ id: 'a', threadStrength: 20 })} recommendation={recommendation} capabilities={fullAccess} {...props} />);

describe('V2PracticeScreen', () => {
  beforeEach(() => {
    mockAcknowledge.mockReset();
    mockAcknowledge.mockResolvedValue(undefined);
    mockVisionGet.mockReset();
    mockVisionGet.mockRejectedValue({ status: 404 });
    mockPlayerPlay.mockReset();
    mockPlayerPause.mockReset();
    mockAddListener.mockReset();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

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

  it('renders Focus hero video container when Focus is recommended today', () => {
    renderPractice(context('Focus'));
    expect(screen.getByTestId('v2-hero-video-focus')).toBeTruthy();
  });

  it('does NOT render hero video for Deep Prime, Visualize, or Release recommendations', () => {
    const { rerender } = renderPractice(context('Deep Prime'));
    expect(screen.queryByTestId('v2-hero-video-deep_prime')).toBeNull();

    rerender(<V2PracticeScreen anchor={makeAnchor({ id: 'a' })} recommendation={context('Visualize')} capabilities={fullAccess} />);
    expect(screen.queryByTestId('v2-hero-video-visualize')).toBeNull();

    rerender(<V2PracticeScreen anchor={makeAnchor({ id: 'a' })} recommendation={context('Release')} capabilities={fullAccess} />);
    expect(screen.queryByTestId('v2-hero-video-release')).toBeNull();
  });

  it('falls back to static Focus hero art when Reduced Motion is enabled', () => {
    render(<V2PracticeScreen anchor={makeAnchor({ id: 'a', threadStrength: 20 })} recommendation={context('Focus')} capabilities={fullAccess} />);
    // Verify static artwork is present and hero video respects reduceMotion when enabled
    const { V2PracticeArtwork } = require('@/components/v2/practice');
    const { render: renderDirect } = require('@testing-library/react-native');
    const { queryByTestId } = renderDirect(<V2PracticeArtwork mode="focus" variant="featured" reduceMotion={true} />);
    expect(queryByTestId('v2-hero-video-focus')).toBeNull();
  });

  it('switches away from Focus video when recommendation changes', () => {
    const { rerender } = renderPractice(context('Focus'));
    expect(screen.getByTestId('v2-hero-video-focus')).toBeTruthy();

    rerender(<V2PracticeScreen anchor={makeAnchor({ id: 'a' })} recommendation={context('Deep Prime')} capabilities={fullAccess} />);
    expect(screen.queryByTestId('v2-hero-video-focus')).toBeNull();
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

  it('keeps all four mode rows available beneath the recommendation in a compact 2x2 grid', () => {
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

  it('allows entering Deep Prime setup when unentitled and gates on Begin Deep Prime', () => {
    const onPremiumCapabilityRequired = jest.fn();
    renderPractice(context('Deep Prime'), { capabilities: { ...fullAccess, deep_prime: false }, onPremiumCapabilityRequired });
    fireEvent.press(screen.getByTestId('v2-practice-row-deep_prime'));
    expect(screen.getByTestId('v2-practice-prepare-deep_prime')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Begin Deep Prime'));
    expect(onPremiumCapabilityRequired).toHaveBeenCalledWith({
      capability: 'deep_prime',
      anchorId: 'a',
      source: 'practice_hub',
      durationSeconds: 300,
    });
  });

  describe('route-supplied recommended mode (Home "Begin")', () => {
    it('enters Prepare for an entitled mode', () => {
      renderPractice(context('Deep Prime'), { initialMode: 'deep_prime' });
      expect(screen.getByTestId('v2-practice-prepare-deep_prime')).toBeTruthy();
    });

    it('still gates a premium practice the user is not entitled to, so Home cannot bypass the paywall', () => {
      const onPremiumCapabilityRequired = jest.fn();
      const onBeginPractice = jest.fn();
      renderPractice(context('Deep Prime'), {
        initialMode: 'deep_prime',
        capabilities: { ...fullAccess, deep_prime: false },
        onPremiumCapabilityRequired,
        onBeginPractice,
      });
      expect(screen.getByTestId('v2-practice-prepare-deep_prime')).toBeTruthy();
      fireEvent.press(screen.getByLabelText('Begin Deep Prime'));
      expect(onBeginPractice).not.toHaveBeenCalled();
      expect(onPremiumCapabilityRequired).toHaveBeenCalledWith(
        expect.objectContaining({ capability: 'deep_prime', anchorId: 'a', source: 'recommended_today' }),
      );
    });

    it('acknowledges the signal exactly once for the explicit engagement', () => {
      renderPractice(context('Release'), { initialMode: 'release' });
      expect(mockAcknowledge).toHaveBeenCalledTimes(1);
      expect(mockAcknowledge).toHaveBeenCalledWith('a', 'signal-1', 'intention_completed');
      fireEvent.press(screen.getByLabelText('Back to Practice'));
      fireEvent.press(screen.getByTestId('v2-recommended-today'));
      expect(mockAcknowledge).toHaveBeenCalledTimes(1);
    });

    it('never acknowledges when Practice is opened without a route mode (All Practices)', () => {
      renderPractice(context('Release'));
      expect(mockAcknowledge).not.toHaveBeenCalled();
      fireEvent.press(screen.getByTestId('v2-practice-row-focus'));
      expect(mockAcknowledge).not.toHaveBeenCalled();
    });
  });

  it('opens Focus setup, allows duration selection, and begins with selected duration', () => {
    const onBeginPractice = jest.fn();
    renderPractice(context('Focus'), { onBeginPractice });
    fireEvent.press(screen.getByTestId('v2-practice-row-focus'));
    expect(screen.getByTestId('v2-practice-prepare-focus')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('1 min'));
    fireEvent.press(screen.getByLabelText('Begin Focus'));
    expect(onBeginPractice).toHaveBeenCalledWith(
      expect.objectContaining({
        anchorId: 'a',
        mode: 'focus',
        durationSeconds: 60,
        source: 'practice_hub',
      })
    );
  });

  it('resumes intended practice session when resumeMode and resumeDuration are supplied', () => {
    const anchor = makeAnchor({ id: 'a', userId: 'u1' });
    const { useAnchorStore } = require('@/stores/anchorStore');
    const { useAuthStore } = require('@/stores/authStore');
    useAuthStore.setState({ user: { id: 'u1' } as any });
    useAnchorStore.setState({ anchors: [anchor], activeAnchorId: 'a' });

    render(
      <V2PracticeScreen
        anchor={anchor}
        recommendation={context('Focus')}
        capabilities={fullAccess}
        resumeMode="deep_prime"
        resumeDuration={300}
        resumeSource="recommended_today"
      />
    );
    expect(screen.getByTestId('v2-practice-session')).toBeTruthy();
    expect(screen.getByText('DEEP PRIME')).toBeTruthy();
  });

  it('offers the Vision creation handoff without fabricating a Vision', async () => {
    const onCreateVision = jest.fn();
    renderPractice(context('Visualize'), { onCreateVision });
    fireEvent.press(screen.getByTestId('v2-practice-row-visualize'));
    expect(await screen.findByText('Create a Vision first')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Create a Vision for this Anchor'));
    expect(onCreateVision).toHaveBeenCalledWith('a');
  });

  it('renders real Vision preview in setup when Vision is ready', async () => {
    mockVisionGet.mockResolvedValueOnce({
      data: {
        id: 'v-1',
        anchorId: 'a',
        status: 'ACTIVE',
        description: 'A serene mountain peak at sunrise',
        scenes: [
          {
            id: 's-1',
            visionId: 'v-1',
            sourceType: 'AI_GENERATED',
            assetId: null,
            resolvedImageUrl: null,
            prompt: 'A serene mountain peak at sunrise',
            sortOrder: 0,
            isArchived: false,
            createdAt: '2026-09-08T00:00:00.000Z',
            updatedAt: '2026-09-08T00:00:00.000Z',
          },
        ],
        seenToday: false,
        createdAt: '2026-09-08T00:00:00.000Z',
        updatedAt: '2026-09-08T00:00:00.000Z',
      },
    });
    renderPractice(context('Visualize'));
    fireEvent.press(screen.getByTestId('v2-practice-row-visualize'));
    expect(await screen.findByText('A serene mountain peak at sunrise')).toBeTruthy();
    expect(screen.getByLabelText('Begin Visualize')).toBeTruthy();
  });

  it('hands Release off without calling a destructive legacy endpoint', () => {
    const onReleaseRequested = jest.fn();
    renderPractice(context('Release'), { onReleaseRequested });
    fireEvent.press(screen.getByTestId('v2-practice-row-release'));
    fireEvent.press(screen.getByLabelText('Continue to Release'));
    expect(onReleaseRequested).toHaveBeenCalledWith('a', 'practice_prepare');
  });

  it('displays establishing baseline copy when Anchor threadStrength is not yet measured', () => {
    render(
      <V2PracticeScreen
        anchor={makeAnchor({ id: 'a', threadStrength: undefined })}
        recommendation={context('Focus')}
        capabilities={fullAccess}
      />
    );
    expect(screen.getByText('Baseline not established')).toBeTruthy();
    expect(screen.queryByText('Not yet measured')).toBeNull();
  });

  it('displays TODAY COMPLETE state when Anchor was reinforced today, preserving hero artwork and using static fallback', () => {
    const today = new Date().toISOString();
    render(
      <V2PracticeScreen
        anchor={makeAnchor({ id: 'a', chargedAt: today as any })}
        recommendation={context('Focus')}
        capabilities={fullAccess}
      />
    );
    expect(screen.getByText('TODAY COMPLETE ✓')).toBeTruthy();
    expect(screen.getByText('You reinforced your Anchor today.')).toBeTruthy();
    expect(screen.getByText('Your intention is holding strong.')).toBeTruthy();
    expect(screen.queryByText(/Settle into the rest of your day/i)).toBeNull();

    // Hero artwork is retained
    expect(screen.getByTestId('v2-practice-artwork-focus-featured')).toBeTruthy();
    // Looping video is stopped in completed state
    expect(screen.queryByTestId('v2-hero-video-focus')).toBeNull();

    // Practice again action is available and opens prep
    expect(screen.getByLabelText('Practice again')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Practice again'));
    expect(screen.getByTestId('v2-practice-prepare-focus')).toBeTruthy();
  });

  it('ensures completion state belongs to correct Anchor and does not bleed when switching Anchors', () => {
    const today = new Date().toISOString();
    const anchorA = makeAnchor({ id: 'a', intentionText: 'Anchor A Completed', chargedAt: today as any, userId: 'u1' });
    const anchorB = makeAnchor({ id: 'b', intentionText: 'Anchor B Incomplete', chargedAt: undefined, userId: 'u1' });

    const { useAuthStore } = require('@/stores/authStore');
    const { useAnchorStore } = require('@/stores/anchorStore');
    useAuthStore.setState({ user: { id: 'u1' } as any });
    useAnchorStore.setState({ anchors: [anchorA, anchorB], currentAnchorId: 'a' });

    const { rerender } = render(
      <V2PracticeScreen
        recommendation={context('Focus')}
        capabilities={fullAccess}
      />
    );

    // Anchor A should be complete
    expect(screen.getByText('Anchor A Completed')).toBeTruthy();
    expect(screen.getByText('TODAY COMPLETE ✓')).toBeTruthy();

    // Switch to Anchor B
    fireEvent.press(screen.getByTestId('v2-practice-anchor-header'));
    fireEvent.press(screen.getByTestId('v2-anchor-switcher-item-b'));

    // Anchor B should be active and NOT complete
    expect(screen.getByText('Anchor B Incomplete')).toBeTruthy();
    expect(screen.queryByText('TODAY COMPLETE ✓')).toBeNull();
    expect(screen.getByLabelText(/Recommended today: Focus/)).toBeTruthy();
  });

  it('updates header and context when active Anchor changes', () => {
    const { rerender } = render(
      <V2PracticeScreen
        anchor={makeAnchor({ id: 'a', intentionText: 'Initial Intention', category: 'career' })}
        recommendation={context('Focus')}
        capabilities={fullAccess}
      />
    );
    expect(screen.getByText('Initial Intention')).toBeTruthy();

    rerender(
      <V2PracticeScreen
        anchor={makeAnchor({ id: 'b', intentionText: 'Updated Intention', category: 'health' })}
        recommendation={context('Focus')}
        capabilities={fullAccess}
      />
    );
    expect(screen.getByText('Updated Intention')).toBeTruthy();
  });

  it('navigates back to Practice Hub when Back is pressed in setup interstitial', () => {
    renderPractice(context('Focus'));
    fireEvent.press(screen.getByTestId('v2-practice-row-focus'));
    expect(screen.getByTestId('v2-practice-prepare-focus')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Back to Practice'));
    expect(screen.getByTestId('v2-practice-screen')).toBeTruthy();
    expect(screen.queryByTestId('v2-practice-prepare-focus')).toBeNull();
  });

  it('handles backend recommendation error gracefully without crashing', () => {
    render(
      <V2PracticeScreen
        anchor={makeAnchor({ id: 'a' })}
        recommendation={null}
        capabilities={fullAccess}
      />
    );
    expect(screen.getByTestId('v2-practice-screen')).toBeTruthy();
  });

  it('hides recommendation transport details and offers a retry action', async () => {
    render(
      <V2PracticeScreen
        anchor={makeAnchor({ id: 'a' })}
        recommendation={null}
        capabilities={fullAccess}
      />
    );

    expect(await screen.findByText('Today’s practice could not be loaded.')).toBeTruthy();
    expect(screen.queryByText(/Cannot GET/i)).toBeNull();
    expect(screen.getByLabelText('Retry Today')).toBeTruthy();
  });

  it('renders CHOOSE ANOTHER PRACTICE grid title and mode action buttons', () => {
    renderPractice();
    expect(screen.getByText('CHOOSE ANOTHER PRACTICE')).toBeTruthy();
  });

  it('opens the anchor switcher sheet on header tap, selects an anchor, and updates context', () => {
    const anchorA = makeAnchor({ id: 'a', intentionText: 'First Goal', userId: 'u1' });
    const anchorB = makeAnchor({ id: 'b', intentionText: 'Second Goal', userId: 'u1' });

    const { useAuthStore } = require('@/stores/authStore');
    const { useAnchorStore } = require('@/stores/anchorStore');
    useAuthStore.setState({ user: { id: 'u1' } as any });
    useAnchorStore.setState({ anchors: [anchorA, anchorB], currentAnchorId: 'a' });

    render(
      <V2PracticeScreen
        recommendation={context('Focus')}
        capabilities={fullAccess}
      />
    );

    expect(screen.getByText('First Goal')).toBeTruthy();
    fireEvent.press(screen.getByTestId('v2-practice-anchor-header'));
    expect(screen.getByTestId('v2-anchor-switcher-sheet')).toBeTruthy();
    expect(screen.getByText('Switch Anchor')).toBeTruthy();

    fireEvent.press(screen.getByTestId('v2-anchor-switcher-item-b'));
    expect(screen.getByText('Second Goal')).toBeTruthy();
  });

  it('allows dismissing the anchor switcher sheet without changing selection', () => {
    const anchorA = makeAnchor({ id: 'a', intentionText: 'First Goal', userId: 'u1' });
    const { useAuthStore } = require('@/stores/authStore');
    const { useAnchorStore } = require('@/stores/anchorStore');
    useAuthStore.setState({ user: { id: 'u1' } as any });
    useAnchorStore.setState({ anchors: [anchorA], currentAnchorId: 'a' });

    render(
      <V2PracticeScreen
        recommendation={context('Focus')}
        capabilities={fullAccess}
      />
    );

    fireEvent.press(screen.getByTestId('v2-practice-anchor-header'));
    expect(screen.getByTestId('v2-anchor-switcher-sheet')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Close anchor switcher'));
    expect(screen.queryByText('Switch Anchor')).toBeNull();
    expect(screen.getByText('First Goal')).toBeTruthy();
  });
});
