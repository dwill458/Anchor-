import React from 'react';
import { render } from '@testing-library/react-native';
import { V2CinematicSessionScreen } from '../V2CinematicSessionScreen';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';

const mockUseCinematicAssets = jest.fn();
const mockEngineHook = jest.fn();

jest.mock('../cinematicAssets', () => ({
  freezeCinematicTiles: (tiles: unknown[]) => tiles,
  useCinematicAssets: (...args: unknown[]) => mockUseCinematicAssets(...args),
}));
jest.mock('@/screens/visualize/useVisualizeSessionEngine', () => ({
  useVisualizeSessionEngine: (...args: unknown[]) => mockEngineHook(...args),
}));
jest.mock('@shopify/react-native-skia', () => ({
  Skia: { SVG: { MakeFromString: () => ({ width: () => 10, height: () => 10 }) } },
}));
jest.mock('@/components/v2/anchors/anchorPresentation', () => ({ anchorArtworkSvg: () => '<svg><path d="M0 0"/></svg>' }));

const anchor = makeAnchor({ id: 'anchor-1', userId: 'user-1', intentionText: 'A real intention' });
const tiles = [{ id: 'image-1', sceneId: 'image-1', imageUrl: 'https://cdn.example.com/image.jpg',
  prompt: null, sortOrder: 0, isHero: true }];

describe('V2 cinematic session asset readiness gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCinematicAssets.mockReturnValue({
      resources: null, ready: false, partial: false, unavailable: false, available: [],
      select: jest.fn(), retry: jest.fn(), timedOut: false, failedCount: 0,
    });
  });

  it('does not mount or start the practice clock before board and Vision assets are ready', () => {
    const view = render(<V2CinematicSessionScreen anchor={anchor} accountId="user-1" tiles={tiles}
      statement="A saved Vision statement." durationSeconds={60} voice="none" ambient={false} haptics={false}
      source="practice_hub" onExit={jest.fn()} onContinue={jest.fn()} />);

    expect(view.getByTestId('v2-visualize-preparing')).toBeTruthy();
    expect(view.getByText('Preparing your Vision')).toBeTruthy();
    expect(mockEngineHook).not.toHaveBeenCalled();
  });
});
