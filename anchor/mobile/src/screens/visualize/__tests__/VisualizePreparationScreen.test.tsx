import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { VisualizePreparationScreen } from '../VisualizePreparationScreen';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTeachingStore } from '@/stores/teachingStore';
import { useTrialStatus } from '@/hooks/useTrialStatus';

jest.mock('@/stores/anchorStore');
jest.mock('@/stores/authStore');
jest.mock('@/stores/settingsStore');
jest.mock('@/hooks/useTrialStatus');
jest.mock('@/services/VisualizationSceneService', () => ({
  load: jest.fn().mockResolvedValue({
    selectedScene: 'Picture yourself standing tall and confident.',
    scenes: ['Picture yourself standing tall and confident.'],
  }),
  ensureBatch: jest.fn().mockResolvedValue({
    scene: {
      sceneText: 'Picture yourself standing tall and confident.',
      generationVersion: 'v1',
    },
    fallbackUsed: false,
    diagnostics: {},
  }),
  normalizeVisualizationSceneText: (t: string) => t,
  validateVisualizationSceneText: () => ({ valid: true, error: null }),
  visualizationLatencyBucket: () => 'fast',
  getSuggestions: jest.fn(() => ['Picture yourself standing tall and confident.']),
  getSelectedIndex: jest.fn(() => 0),
}));

describe('VisualizePreparationScreen teaching tip behavior', () => {
  const mockNavigation: any = {
    replace: jest.fn(),
    navigate: jest.fn(),
    goBack: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  };

  const mockRoute: any = {
    params: {
      anchorId: 'anchor-123',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useTeachingStore.getState().reset();
    (useTrialStatus as jest.Mock).mockReturnValue({
      hasActiveEntitlement: true,
      subscriptionStatus: 'trialing',
    });
    (useAnchorStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        getAnchorById: () => ({
          id: 'anchor-123',
          intentionText: 'Lead with quiet conviction',
          baseSigilSvg: '<svg />',
        }),
      }),
    );
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        user: { id: 'user-123' },
      }),
    );
    const settingsState = {
      debugLoggingEnabled: false,
      sessionAudioDefaults: {
        visualize: {
          guidanceVoice: 'female',
          backgroundAudio: 'ambient',
        },
      },
    };
    (useSettingsStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      typeof selector === 'function' ? selector(settingsState) : settingsState,
    );
    (useSettingsStore as any).getState = jest.fn(() => settingsState);
  });

  it('shows the "Why a scene?" card on first visit and records it in teaching store', async () => {
    const { getByText, getByLabelText } = render(
      <VisualizePreparationScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(getByText('Why a scene?')).toBeTruthy();
    expect(
      getByText(
        'Specific moments are easier to rehearse than abstract goals. We suggested one for this Anchor. Make it yours.',
      ),
    ).toBeTruthy();
    expect(getByLabelText('Dismiss explanation')).toBeTruthy();

    expect(useTeachingStore.getState().isExhausted('visualize_scene_explainer')).toBe(true);
  });

  it('dismisses the card when tapping the close button and shows the why link', async () => {
    const { getByLabelText, queryByLabelText, getByText } = render(
      <VisualizePreparationScreen navigation={mockNavigation} route={mockRoute} />,
    );

    const closeBtn = getByLabelText('Dismiss explanation');
    act(() => {
      fireEvent.press(closeBtn);
    });

    expect(queryByLabelText('Dismiss explanation')).toBeNull();
    expect(getByText('Why a scene?')).toBeTruthy();
  });

  it('does not auto-open the card on subsequent visits after being exhausted', async () => {
    // First visit exhausts it
    const { unmount } = render(
      <VisualizePreparationScreen navigation={mockNavigation} route={mockRoute} />,
    );
    unmount();

    expect(useTeachingStore.getState().isExhausted('visualize_scene_explainer')).toBe(true);

    // Second visit does not show the card, only the link
    const { queryByLabelText, getByText } = render(
      <VisualizePreparationScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(queryByLabelText('Dismiss explanation')).toBeNull();
    expect(getByText('Why a scene?')).toBeTruthy();
  });

  it('re-opens the card if user resets teaching tips in settings', async () => {
    // Exhaust it
    const firstVisit = render(
      <VisualizePreparationScreen navigation={mockNavigation} route={mockRoute} />,
    );
    firstVisit.unmount();

    expect(useTeachingStore.getState().isExhausted('visualize_scene_explainer')).toBe(true);

    // Reset teaching tips (simulating Settings "Reset Teaching Tips")
    act(() => {
      useTeachingStore.getState().reset();
    });

    expect(useTeachingStore.getState().isExhausted('visualize_scene_explainer')).toBe(false);

    // Re-visiting shows the explanation card again
    const secondVisit = render(
      <VisualizePreparationScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(secondVisit.getByLabelText('Dismiss explanation')).toBeTruthy();
    expect(
      secondVisit.getByText(
        'Specific moments are easier to rehearse than abstract goals. We suggested one for this Anchor. Make it yours.',
      ),
    ).toBeTruthy();
  });
});
