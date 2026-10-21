import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { VisionLineageLine } from '../VisionLineageLine';
import { VisionResumeCard } from '../VisionResumeCard';
import { VisionVersionStrip } from '../VisionVersionStrip';
import type { VisionConversationRound, VisionConversationSession } from '@/types/visionConversation';

const round = (id: string, roundNumber: number, parentCandidateId: string | null, candidates: Array<{
  id: string; imageUrl?: string | null; assetId?: string | null; status?: 'PENDING' | 'SUCCEEDED' | 'FAILED'; sortOrder?: number;
}>): VisionConversationRound => ({
  id, roundNumber, parentCandidateId, sessionId: 'session', operation: roundNumber === 0 ? 'CREATE' : 'VARIATE',
  description: `Prompt ${id}`, references: [], visionId: 'vision', anchorId: 'anchor', setNumber: roundNumber,
  retryCount: 0, status: 'COMPLETE', stage: 'complete', error: null,
  candidates: candidates.map((candidate, index) => ({
    assetId: candidate.assetId === undefined ? candidate.id : candidate.assetId, role: 'vision', prompt: '', status: candidate.status ?? 'SUCCEEDED',
    imageUrl: candidate.imageUrl === undefined ? `https://vision.test/${candidate.id}.jpg` : candidate.imageUrl,
    sortOrder: candidate.sortOrder ?? index,
    id: candidate.id,
  })),
});

const branchRounds = [
  round('original', 0, null, [{ id: 'original-one' }, { id: 'original-two' }]),
  round('version-one-a', 1, 'original-one', [{ id: 'version-one-a-one' }, { id: 'version-one-a-two' }]),
  round('version-one-b', 1, 'original-two', [{ id: 'version-one-b-one' }, { id: 'version-one-b-two' }]),
  round('version-two', 2, 'version-one-b-one', [{ id: 'version-two-one' }, { id: 'version-two-two' }]),
];

const session = (overrides: Partial<VisionConversationSession> = {}): VisionConversationSession => ({
  id: 'session', anchorId: 'anchor', visionId: 'vision', status: 'ACTIVE', description: 'A home by the water',
  draftPrompt: '', selectedCandidateId: 'version-two-two', viewedRoundId: 'version-two', references: [],
  rounds: branchRounds, expiresAt: '2026-10-21T00:00:00.000Z', ...overrides,
});

describe('VisionVersionStrip', () => {
  it('selects the requested round and exposes a full-size accessible pill target', () => {
    const onSelect = jest.fn();
    const view = render(<VisionVersionStrip rounds={branchRounds} selectedRoundId="original" onSelect={onSelect} testID="history" />);

    const version = view.getByRole('button', { name: 'Version 2' });
    expect(version.props.accessibilityState.selected).toBe(false);
    fireEvent.press(version);
    expect(onSelect).toHaveBeenCalledWith('version-two');
    expect(view.getByRole('button', { name: 'Original' }).props.accessibilityState.selected).toBe(true);
  });
});

describe('VisionLineageLine', () => {
  it('follows the exact parent candidate branch and opens the source candidate', () => {
    const onViewCandidate = jest.fn();
    const view = render(<VisionLineageLine rounds={branchRounds} selectedRoundId="version-two"
      selectedCandidateId="version-two-two" onViewCandidate={onViewCandidate} testID="lineage" />);

    expect(view.getByText(/Original · Option 2/)).toBeTruthy();
    expect(view.getAllByText(/Version 1 · Option 1/).length).toBeGreaterThanOrEqual(1);
    expect(view.getByText(/Version 2 · Option 2/)).toBeTruthy();
    expect(view.getByText('Based on Version 1 · Option 1')).toBeTruthy();
    expect(view.getByTestId('lineage-source-thumbnail').props.source.uri)
      .toBe('https://vision.test/version-one-b-one.jpg');
    fireEvent.press(view.getByRole('button', { name: 'View Version 1 · Option 1' }));
    expect(onViewCandidate).toHaveBeenCalledWith('version-one-b-one');
    expect(onViewCandidate).not.toHaveBeenCalledWith('version-one-b-two');
  });

  it('keeps the later candidate path visible when Original is viewed and highlights Original', () => {
    const view = render(<VisionLineageLine rounds={branchRounds} selectedRoundId="original"
      selectedCandidateId="version-two-two" onViewCandidate={jest.fn()} testID="lineage-original" />);
    expect(view.getByLabelText('Your path: Original · Option 2 → Version 1 · Option 1 → Version 2 · Option 2')).toBeTruthy();
    const firstPathPart = view.getByText('Original · Option 2');
    expect(StyleSheet.flatten(firstPathPart.props.style)).toMatchObject({ color: '#F4EDE0' });
    const pathSegments = view.getByTestId('lineage-original-path').props.children;
    expect(pathSegments[2].props.style).toBeUndefined();
  });

  it('shows the refinement instruction on the exact source chip', () => {
    const view = render(<VisionLineageLine rounds={branchRounds} selectedRoundId="version-two"
      selectedCandidateId="version-two-two" onViewCandidate={jest.fn()} testID="lineage-instruction" />);
    expect(view.getByText('“Prompt version-two”')).toBeTruthy();
  });
});

describe('VisionResumeCard', () => {
  it('resumes the saved candidate and invokes the typed presentation callbacks', () => {
    const onContinue = jest.fn(), onKeep = jest.fn(), onStartDifferent = jest.fn();
    const view = render(<VisionResumeCard session={session()} onContinue={onContinue} onKeep={onKeep}
      onStartDifferent={onStartDifferent} testID="resume" />);

    expect(view.getByText('Original · Version 1 · Version 2 saved')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: /Continue refining your scene/ }));
    fireEvent.press(view.getByRole('button', { name: 'Keep this one' }));
    fireEvent.press(view.getByRole('button', { name: 'Start a different scene' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onKeep).toHaveBeenCalledWith('version-two-two');
    expect(onStartDifferent).toHaveBeenCalledTimes(1);
  });

  it('falls back from a stale saved selection to the latest available image and disables Keep when no asset exists', () => {
    const onKeep = jest.fn();
    const stale = session({ selectedCandidateId: 'expired-candidate', rounds: [
      round('original', 0, null, [
        { id: 'old', imageUrl: 'https://vision.test/old.jpg' },
        { id: 'legacy-no-asset-id', imageUrl: 'https://vision.test/no-asset-id.jpg', assetId: null },
        { id: 'failed', imageUrl: 'https://vision.test/failed.jpg', status: 'FAILED' },
        { id: 'pending', imageUrl: 'https://vision.test/pending.jpg', status: 'PENDING' },
      ]),
    ] });
    const view = render(<VisionResumeCard session={stale} onContinue={jest.fn()} onKeep={onKeep}
      onStartDifferent={jest.fn()} testID="resume" />);
    fireEvent.press(view.getByRole('button', { name: 'Keep this one' }));
    expect(onKeep).toHaveBeenCalledWith('old');

    const noImage = session({ selectedCandidateId: 'missing', rounds: [round('original', 0, null, [
      { id: 'missing', imageUrl: 'https://vision.test/no-asset.jpg', assetId: null },
    ])] });
    const empty = render(<VisionResumeCard session={noImage} onContinue={jest.fn()} onKeep={onKeep}
      onStartDifferent={jest.fn()} testID="resume-empty" />);
    const keep = empty.getByRole('button', { name: 'Keep this one' });
    expect(keep.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(keep);
    expect(onKeep).toHaveBeenCalledTimes(1);
  });
});
