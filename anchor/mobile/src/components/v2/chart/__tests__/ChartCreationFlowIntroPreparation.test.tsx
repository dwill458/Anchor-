import React from 'react';
import { act, configure, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ChartCreationFlow } from '../ChartCreationFlow';
import { getChartIntroSeen } from '../chartIntroSeen';
import { prepareChartMapIntroArt, warmChartMapResources } from '../map/ChartMapLand';

configure({ defaultIncludeHiddenElements: true });

jest.mock('../chartIntroSeen', () => ({
  getChartIntroSeen: jest.fn(),
  setChartIntroSeen: jest.fn(),
}));
jest.mock('../map/ChartMapLand', () => ({
  prepareChartMapIntroArt: jest.fn(),
  warmChartMapResources: jest.fn(),
}));
jest.mock('../ChartIntroOpening', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    ChartIntroOpening: ({ introWidth, initialSeen, preparing, skipRequest, onIntroSurfaceReady, artReadyAtMount, artPreparationSettledAtMount }: { introWidth: number; initialSeen?: boolean; preparing: boolean; skipRequest: number; onIntroSurfaceReady: () => void; artReadyAtMount: boolean; artPreparationSettledAtMount: boolean }) => React.createElement(View, {
      testID: 'prepared-intro-opening',
      accessibilityLabel: `width=${introWidth};seen=${initialSeen};preparing=${preparing};skip=${skipRequest};art=${artReadyAtMount};settled=${artPreparationSettledAtMount}`,
      onIntroSurfaceReady,
    }),
  };
});
jest.mock('../ChartChrome', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    ChartInkScreen: ({ children, testID, onLayout }: { children: React.ReactNode; testID: string; onLayout: (event: unknown) => void }) => React.createElement(View, { testID, onLayout }, children),
    ChartCreamPanel: () => null,
    ChartEyebrow: () => null,
    ChartInkButton: () => null,
    ChartTextArea: () => null,
  };
});
jest.mock('../panel/ChartMapHeader', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { ChartMapHeader: () => React.createElement(View, { testID: 'prepared-intro-header' }) };
});
jest.mock('../panel/ChartStaticMap', () => ({ ChartStaticMap: () => null }));

describe('ChartCreationFlow intro preparation gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the paper cover over a persistent measured-width map until seen state and decoded art resolve', async () => {
    let resolveSeen!: (value: boolean) => void;
    let resolveArt!: (value: boolean) => void;
    (getChartIntroSeen as jest.Mock).mockReturnValue(new Promise<boolean>(resolve => { resolveSeen = resolve; }));
    (prepareChartMapIntroArt as jest.Mock).mockReturnValue(new Promise<boolean>(resolve => { resolveArt = resolve; }));

    const screen = render(<ChartCreationFlow
      anchorId="anchor-test"
      identity={{ intention: 'A meaningful goal', category: 'career' }}
      anchorArt={null}
      vision={null}
      reducedMotion={false}
      onBack={jest.fn()}
      onOpenVision={jest.fn()}
      onCreated={jest.fn()}
      onExplore={jest.fn()}
      onPremiumRequired={jest.fn()}
    />);

    expect(screen.getByTestId('chart-intro-preparing')).toBeTruthy();
    expect(screen.queryByTestId('prepared-intro-opening')).toBeNull();
    fireEvent(screen.getByTestId('chart-creation'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 393, height: 844 } },
    });
    await waitFor(() => expect(prepareChartMapIntroArt).toHaveBeenCalledTimes(1));
    expect(prepareChartMapIntroArt).toHaveBeenCalledWith(expect.anything(), 393, expect.any(Number));
    expect(warmChartMapResources).not.toHaveBeenCalled();
    expect(screen.getByTestId('chart-intro-preparing')).toBeTruthy();
    expect(screen.getByTestId('prepared-intro-opening').props.accessibilityLabel).toBe('width=393;seen=undefined;preparing=true;skip=0;art=false;settled=false');
    fireEvent.press(screen.getByTestId('chart-intro-preparing'));
    await waitFor(() => expect(screen.getByTestId('prepared-intro-opening').props.accessibilityLabel).toContain('skip=1'));

    await act(async () => {
      resolveSeen(false);
      resolveArt(true);
    });
    const heldOpening = await screen.findByTestId('prepared-intro-opening');
    expect(heldOpening.props.accessibilityLabel).toContain('preparing=true');
    await act(async () => { heldOpening.props.onIntroSurfaceReady(); });
    const opening = screen.getByTestId('prepared-intro-opening');
    expect(opening.props.accessibilityLabel).toBe('width=393;seen=false;preparing=false;skip=1;art=true;settled=true');
    expect(screen.queryByTestId('chart-intro-preparing')).toBeNull();
  });

  it('keeps waiting for art after storage fails, then starts with the safe first-run default', async () => {
    let resolveArt!: (value: boolean) => void;
    (getChartIntroSeen as jest.Mock).mockRejectedValue(new Error('storage unavailable'));
    (prepareChartMapIntroArt as jest.Mock).mockReturnValue(new Promise<boolean>(resolve => { resolveArt = resolve; }));
    const screen = render(<ChartCreationFlow
      anchorId="anchor-test"
      identity={{ intention: 'A meaningful goal', category: 'career' }}
      anchorArt={null}
      vision={null}
      reducedMotion={false}
      onBack={jest.fn()}
      onOpenVision={jest.fn()}
      onCreated={jest.fn()}
      onExplore={jest.fn()}
      onPremiumRequired={jest.fn()}
    />);
    fireEvent(screen.getByTestId('chart-creation'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 393, height: 844 } },
    });
    await waitFor(() => expect(prepareChartMapIntroArt).toHaveBeenCalledTimes(1));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId('chart-intro-preparing')).toBeTruthy();
    expect(screen.getByTestId('prepared-intro-opening').props.accessibilityLabel).toContain('preparing=true');

    await act(async () => { resolveArt(false); });
    const heldOpening = await screen.findByTestId('prepared-intro-opening');
    expect(heldOpening.props.accessibilityLabel).toContain('preparing=true');
    await act(async () => { heldOpening.props.onIntroSurfaceReady(); });
    const opening = screen.getByTestId('prepared-intro-opening');
    expect(opening.props.accessibilityLabel).toBe('width=393;seen=false;preparing=false;skip=0;art=false;settled=true');
  });
});
