import { fireEvent, render } from '@testing-library/react-native';
import { View } from 'react-native';
import type { VisionGenerationCandidate } from '@/hooks/v2/vision';
import type { VisionConversationRound } from '@/types/visionConversation';
import { VisionConversationSelection } from '../VisionConversationSelection';

jest.mock('../ceremony/VisionPrint', () => ({
  VisionPrint: (props: { testID: string }) => {
    const React = require('react');
    const { View: MockView } = require('react-native');
    return React.createElement(MockView, { testID: props.testID });
  },
}));

jest.mock('@/components/v2/anchor', () => ({
  CircularAnchorRenderer: (props: { testID: string; svg: string }) => {
    const React = require('react');
    const { View: MockView } = require('react-native');
    return React.createElement(MockView, { testID: props.testID, accessibilityLabel: props.svg });
  },
}));

const makeRound = (
  id: string,
  roundNumber: number,
  parentCandidateId: string | null,
  candidates: Array<{ id: string; sortOrder: number }>,
): VisionConversationRound => ({
  id,
  roundNumber,
  parentCandidateId,
  sessionId: 'session',
  operation: roundNumber === 0 ? 'CREATE' : 'VARIATE',
  description: `Prompt for ${id}`,
  references: [],
  visionId: 'vision',
  anchorId: 'anchor',
  setNumber: roundNumber,
  retryCount: 0,
  status: 'COMPLETE',
  stage: 'complete',
  error: null,
  candidates: candidates.map(({ id: candidateId, sortOrder }) => ({
    id: candidateId,
    assetId: candidateId,
    imageUrl: `https://vision.test/${candidateId}.jpg`,
    prompt: '',
    role: 'vision',
    sortOrder,
    status: 'SUCCEEDED',
  })),
});

const original = makeRound('original', 0, null, [
  { id: 'original-two', sortOrder: 1 },
  { id: 'original-one', sortOrder: 0 },
]);
const versionOne = makeRound('version-one', 1, 'original-two', [
  { id: 'version-one-two', sortOrder: 1 },
  { id: 'version-one-one', sortOrder: 0 },
]);
const latest = makeRound('version-two', 2, 'version-one-one', [
  { id: 'version-two-one', sortOrder: 0 },
  { id: 'version-two-two', sortOrder: 1 },
]);
const rounds = [original, versionOne, latest];
const candidate = (round: VisionConversationRound, id: string) => round.candidates.find(item => item.id === id) as VisionGenerationCandidate;

const props = (overrides: Partial<React.ComponentProps<typeof VisionConversationSelection>> = {}) => ({
  round: original,
  rounds: [original],
  selectedCandidateId: null,
  onSelect: jest.fn(),
  onRefine: jest.fn(),
  onSelectRound: jest.fn(),
  onViewCandidate: jest.fn(),
  onAnother: jest.fn(),
  onBack: jest.fn(),
  ...overrides,
});

describe('VisionConversationSelection', () => {
  it('uses sorted option indexes for refine and use actions', () => {
    const onSelect = jest.fn();
    const onRefine = jest.fn();
    const view = render(<VisionConversationSelection {...props({ onSelect, onRefine })} />);

    expect(view.getByText('Which one feels right?')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Refine Option 2' }));
    fireEvent.press(view.getByRole('button', { name: 'Use This One, Option 2' }));

    expect(onRefine).toHaveBeenCalledWith(candidate(original, 'original-two'), 1);
    expect(onSelect).toHaveBeenCalledWith(candidate(original, 'original-two'), 1);
  });

  it('opens inspect for a print and sends the inspected candidate to its exact action', () => {
    const onSelect = jest.fn();
    const onRefine = jest.fn();
    const view = render(<VisionConversationSelection {...props({ onSelect, onRefine })} />);

    fireEvent.press(view.getByRole('button', { name: 'Inspect Option 2' }));
    expect(view.getByText('Take a closer look')).toBeTruthy();
    expect(view.getByText('Candidate 2 of 2')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Refine This Image' }));
    expect(onRefine).toHaveBeenCalledWith(candidate(original, 'original-two'), 1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('selects a saved round and renders actual source lineage and pick badges', () => {
    const onSelectRound = jest.fn();
    const onViewCandidate = jest.fn();
    const view = render(<VisionConversationSelection
      {...props({ round: latest, rounds, selectedCandidateId: 'version-two-two', onSelectRound, onViewCandidate })}
    />);

    expect(view.getByText('Your latest options')).toBeTruthy();
    expect(view.getByText('Based on Version 1 · Option 1')).toBeTruthy();
    expect(view.getByText('Your pick')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Version 1' }));
    fireEvent.press(view.getByRole('button', { name: 'View Version 1 · Option 1' }));
    expect(onSelectRound).toHaveBeenCalledWith('version-one');
    expect(onViewCandidate).toHaveBeenCalledWith('version-one-one');
  });

  it('marks the real candidate refined by a later round and renders a measured print frame', () => {
    const onPrintLayout = jest.fn();
    const measure = jest.spyOn(View.prototype, 'measureInWindow').mockImplementation(callback => {
      (callback as (x: number, y: number, width: number, height: number) => void)(12, 34, 150, 240);
    });
    const view = render(<VisionConversationSelection {...props({ rounds, onPrintLayout })} />);
    fireEvent(view.getByTestId('vision-conversation-selection-print-frame-1'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 150, height: 240 } },
    });

    expect(view.getByText('Refined')).toBeTruthy();
    expect(onPrintLayout).toHaveBeenCalledWith(1, { x: 12, y: 34, width: 150, height: 240 });
    measure.mockRestore();
  });

  it('opens an externally requested candidate and reports when the inspect modal closes', () => {
    const onInspectClosed = jest.fn();
    const view = render(<VisionConversationSelection
      {...props({ inspectCandidateId: 'original-two', onInspectClosed })}
    />);
    expect(view.getByText('Candidate 2 of 2')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'See both candidates again' }));
    expect(onInspectClosed).toHaveBeenCalledTimes(1);
  });

  it('uses the version-appropriate bottom action and returns to the parent on Back', () => {
    const onAnother = jest.fn();
    const onBack = jest.fn();
    const view = render(<VisionConversationSelection {...props({ round: latest, onAnother, onBack })} />);
    fireEvent.press(view.getByRole('button', { name: 'Generate another variation' }));
    fireEvent.press(view.getByRole('button', { name: 'Go back' }));
    expect(onAnother).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(view.queryByRole('button', { name: 'Neither feels right · Generate new options' })).toBeNull();
  });

  it('exposes a retry action for an expired candidate image', () => {
    const onRetry = jest.fn();
    const view = render(<VisionConversationSelection {...props({ onRetry, error: 'This image expired. Try again.' })} />);
    fireEvent.press(view.getByRole('button', { name: 'Retry image' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders the saved Anchor artwork supplied by the ceremony', () => {
    const view = render(<VisionConversationSelection {...props({ anchorArt: { svg: '<svg id="saved-anchor" />', category: 'career' } })} />);
    expect(view.getByLabelText('<svg id="saved-anchor" />')).toBeTruthy();
  });
});
