import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { BackHandler, StyleSheet } from 'react-native';
import { withTiming } from 'react-native-reanimated';
import { ChartCreationFlow, type ChartCreationApi } from '../ChartCreationFlow';
import { trackChart } from '@/hooks/v2/chart/useAnchorChart';
import type { ChartProposal } from '@/services/v2/chartV2Api';

jest.mock('@/hooks/v2/chart/useAnchorChart', () => ({ trackChart: jest.fn() }));
jest.mock('../map/ChartMapLand', () => ({ warmChartMapResources: jest.fn(), prepareChartMapIntroArt: jest.fn() }));
jest.mock('../ChartIntroOpening', () => {
  const { View } = require('react-native');
  return { ChartIntroOpening: (props: object) => <View {...props} testID="motion-intro" /> };
});
jest.mock('../ask/ChartCreationAsk', () => {
  const { View } = require('react-native');
  return { ChartCreationAsk: (props: object) => <View {...props} testID="motion-ask" /> };
});
jest.mock('../ChartGenerationStage', () => {
  const { View } = require('react-native');
  return { ChartGenerationStage: (props: object) => <View {...props} /> };
});
jest.mock('../ChartCourseReviewScreen', () => {
  const { View } = require('react-native');
  return { ChartCourseReviewScreen: (props: object) => <View {...props} testID="motion-review" /> };
});
jest.mock('../ChartAdjustPanel', () => {
  const { View } = require('react-native');
  return { ChartAdjustPanel: (props: object) => <View {...props} /> };
});

const proposal: ChartProposal = {
  proposalId: 'proposal-a', anchorId: 'anchor-a', kind: 'CREATE', courseId: null, baseCourseVersion: null,
  destination: 'A meaningful destination', complexity: 'SIMPLE',
  waypoints: [{ clientKey: 'a', title: 'A first achievement', rationale: null, kind: 'MILESTONE', metricLabel: null, metricTarget: null, metricBaseline: null }],
  suggestedOneMove: { title: 'Begin today', rationale: null }, guidance: null,
  generation: { source: 'ai', fallbackUsed: false, needsNaming: false }, createdAt: '', expiresAt: '',
};
const common = { anchorId: 'anchor-a', identity: { intention: 'A meaningful goal', category: 'career' }, anchorArt: null, vision: null, reducedMotion: false, onBack: jest.fn(), onOpenVision: jest.fn(), onCreated: jest.fn(), onExplore: jest.fn() };

describe('Chart creation Ask hand-off and review proposals', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); });

  it('starts the plan immediately, crossfades Ask for 450ms and blocks back while generating', () => {
    const plan = jest.fn(() => new Promise(() => undefined));
    const api = { plan, adjust: jest.fn(), create: jest.fn() } as ChartCreationApi;
    const back = jest.spyOn(BackHandler, 'addEventListener');
    const screen = render(<ChartCreationFlow {...common} api={api} />);
    act(() => screen.getByTestId('motion-intro').props.onContinue());
    act(() => jest.advanceTimersByTime(190));
    const ask = screen.getByTestId('motion-ask');
    act(() => ask.props.onPlan({ photoAssetIds: [], actualStartingPoint: 'Where I am', startingContext: 'Context' }, 'draft_now'));
    expect(plan).toHaveBeenCalledTimes(1);
    expect(jest.mocked(withTiming).mock.calls.some(call => call[0] === 0 && (call[1] as {duration?:number})?.duration === 450)).toBe(true);
    let askSurface = ask.parent;
    while (askSurface && askSurface.props.pointerEvents === undefined) askSurface = askSurface.parent;
    expect(askSurface?.props.pointerEvents).toBe('none');
    expect(screen.getByTestId('chart-generation')).toBeTruthy();
    const handler = back.mock.calls.at(-1)?.[1];
    act(() => { expect(handler?.({ type: 'hardwareBackPress', timeStamp: Date.now() })).toBe(true); });
    expect(common.onBack).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(449));
    expect(StyleSheet.flatten(askSurface?.props.style).display).not.toBe('none');
    act(() => jest.advanceTimersByTime(1));
    expect(StyleSheet.flatten(askSurface?.props.style).display).toBe('none');
  });

  it('tracks each proposal once and tracks only the first changed next move', async () => {
    const api = { plan: jest.fn(), create: jest.fn(), adjust: jest.fn(async () => ({ status: 'proposal', proposal: { ...proposal, proposalId: 'proposal-b' } })) } as ChartCreationApi;
    const screen = render(<ChartCreationFlow {...common} api={api} initialPhase="review" initialProposal={proposal} />);
    const entered = () => jest.mocked(trackChart).mock.calls.filter(call => call[0] === 'chart_review_entered');
    expect(entered()).toHaveLength(1);
    expect(entered()[0][1]).toEqual({ waypoints: 1, source: 'ai' });
    act(() => screen.getByTestId('motion-review').props.onOneMoveChange('Begin today'));
    act(() => screen.getByTestId('motion-review').props.onOneMoveChange('Begin tomorrow'));
    act(() => screen.getByTestId('motion-review').props.onOneMoveChange('Begin now'));
    expect(jest.mocked(trackChart).mock.calls.filter(call => call[0] === 'chart_review_next_move_edited')).toHaveLength(1);
    expect(entered()).toHaveLength(1);
    act(() => screen.getByTestId('motion-review').props.onAdjust());
    await act(async () => screen.getByTestId('chart-adjust-panel').props.onSubmit({ reason: 'OTHER', detail: 'A revised route' }));
    expect(entered()).toHaveLength(2);
    expect(screen.getByTestId('motion-review').props.proposalKey).toBe('0:1');
  });
});
