import { act, fireEvent, render } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import type { VisionGenerationCandidate } from '@/hooks/v2/vision';
import type { VisionConversationRound, VisionConversationSession } from '@/types/visionConversation';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';
import { useAuthStore } from '@/stores/authStore';
import { VisionCeremony, type VisionCeremonyProps } from '../VisionCeremony';
import { VisionCeremonyBeat } from '../VisionCeremony';
import { visionCeremonyCopy as copy } from '../visionCeremonyCopy';

let mockSession: VisionConversationSession | null = null;
let mockDraft: any = null;
let mockJob: any = null;
let mockError: string | null = null;
let mockErrorCode: string | null = null;
let mockReduced = true;
let mockPhotoSize: { width: number; height: number } | null = null;
const mockGenerationStart = jest.fn(async (..._args: unknown[]) => true);
const mockGenerationRetry = jest.fn(async () => true);
const mockGenerationRefresh = jest.fn(async () => undefined);
const mockRestoreJob = jest.fn((job: unknown) => { mockJob = job; });
const mockUpdate = jest.fn(async (patch: Record<string, unknown>) => {
  if (mockSession) mockSession = { ...mockSession, ...patch };
});
const mockStartDifferent = jest.fn(async () => { mockSession = null; mockDraft = null; });
const mockSaveDraft = jest.fn((change: Record<string, unknown>) => { mockDraft = { ...(mockDraft ?? {}), ...change }; });
const mockConversationRefresh = jest.fn(async () => mockSession);
const mockPicker = jest.fn();
const mockSinglePick = jest.fn();
const mockUploadPhoto = jest.fn();
const mockCropPhoto = jest.fn();
const mockExpandPhoto = jest.fn();
const mockDiscardPhoto = jest.fn();

const mockConversation = () => ({
  session: mockSession,
  loaded: true,
  draft: { current: mockDraft },
  saveDraft: mockSaveDraft,
  update: mockUpdate,
  startDifferent: mockStartDifferent,
  refresh: () => mockConversationRefresh(),
});

jest.mock('@/services/AnalyticsService', () => ({ AnalyticsService: { track: jest.fn() } }));
jest.mock('@/hooks/v2/vision', () => ({
  useV2VisionSceneGeneration: () => ({
    job: mockJob,
    error: mockError,
    errorCode: mockErrorCode,
    lastErrorCode: () => mockErrorCode,
    start: (...args: unknown[]) => mockGenerationStart(...args),
    retry: () => mockGenerationRetry(),
    refresh: () => mockGenerationRefresh(),
    restoreJob: (job: unknown) => mockRestoreJob(job),
    conversation: mockConversation(),
  }),
  pickVisionPhoto: (...args: unknown[]) => mockSinglePick(...args),
  uploadVisionPhoto: (...args: unknown[]) => mockUploadPhoto(...args),
  useVisionAppearanceReference: () => ({ profilePhoto: null, enabledByPreference: false, reference: null, loading: false, saving: false, upload: jest.fn(), remove: jest.fn(), setProfilePreference: jest.fn() }),
}));
jest.mock('@/hooks/v2/vision/visionPhotoFitProcessing', () => ({
  ...jest.requireActual('@/hooks/v2/vision/visionPhotoFitProcessing'),
  readPhotoSize: jest.fn(async () => mockPhotoSize),
  cropPhoto: (...args: unknown[]) => mockCropPhoto(...args),
  requestPhotoExpansion: (...args: unknown[]) => mockExpandPhoto(...args),
  discardTemporaryPhoto: (...args: unknown[]) => mockDiscardPhoto(...args),
}));
jest.mock('@/hooks/v2', () => ({ useV2ReduceMotion: () => mockReduced, v2Haptics: { selection: jest.fn(), warning: jest.fn() } }));
jest.mock('@/hooks/useCelebrationReduceMotion', () => ({ useCelebrationReduceMotion: () => mockReduced }));
jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images' },
  requestMediaLibraryPermissionsAsync: async () => ({ status: 'granted' }),
  launchImageLibraryAsync: (...args: unknown[]) => mockPicker(...args),
}));
jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(async () => ({ exists: true })),
  readAsStringAsync: jest.fn(async () => 'aW1hZ2U='),
  EncodingType: { Base64: 'base64' },
}));
jest.mock('@/services/CreationSounds', () => ({ playCreationSound: jest.fn(() => ({ stop: jest.fn() })) }));
jest.mock('@/services/audio/SoundPool', () => ({ SoundPool: { prewarm: jest.fn(), releaseIdle: jest.fn() } }));
jest.mock('@/utils/haptics', () => ({ safeHaptics: { impact: jest.fn() } }));
const refs = [
  { assetId: 'reference-place', role: 'place' as const, label: 'the coastal home', imageUrl: 'https://vision.test/ref-place.jpg' },
  { assetId: 'reference-object', role: 'object' as const, label: 'the key', imageUrl: 'https://vision.test/ref-object.jpg' },
];

const makeRound = (
  id: string,
  roundNumber: number,
  parentCandidateId: string | null,
  candidateIds: string[],
  roundReferences: typeof refs = [],
  urls: Record<string, string> = {},
): VisionConversationRound => ({
  id,
  sessionId: 'conversation-session',
  roundNumber,
  operation: roundNumber === 0 ? 'CREATE' : 'VARIATE',
  parentCandidateId,
  description: `Saved description for ${id}`,
  references: roundReferences,
  visionId: 'vision-record',
  anchorId: 'anchor-record',
  setNumber: roundNumber,
  retryCount: 0,
  status: 'COMPLETE',
  stage: 'complete',
  error: null,
  candidates: candidateIds.map((candidateId, sortOrder) => ({
    id: candidateId,
    assetId: `asset-${candidateId}`,
    role: 'vision',
    prompt: `Prompt for ${candidateId}`,
    sortOrder,
    imageUrl: urls[candidateId] ?? `https://vision.test/${candidateId}.jpg`,
    status: 'SUCCEEDED',
  })),
});

const original = makeRound('round-original', 0, null, ['original-option-1', 'original-option-2'], refs);
const versionOne = makeRound('round-version-1', 1, 'original-option-2', ['version-1-option-1', 'version-1-option-2']);
const versionTwo = makeRound('round-version-2', 2, 'version-1-option-1', ['version-2-option-1', 'version-2-option-2'], refs);
const fullRounds = [original, versionOne, versionTwo];

function makeSession(overrides: Partial<VisionConversationSession> = {}): VisionConversationSession {
  return {
    id: 'conversation-session',
    anchorId: 'anchor-record',
    visionId: 'vision-record',
    status: 'ACTIVE',
    description: 'Build a welcoming coastal home.',
    draftPrompt: '',
    selectedCandidateId: 'version-2-option-2',
    viewedRoundId: 'round-version-2',
    references: refs.map(({ assetId, role, label }) => ({ assetId, role, label })),
    rounds: fullRounds,
    expiresAt: '2026-10-21T00:00:00.000Z',
    ...overrides,
  };
}

const savedCandidate = (round: VisionConversationRound, id: string) => round.candidates.find(candidate => candidate.id === id) as VisionGenerationCandidate;

const baseProps = {
  anchorId: 'anchor-record',
  anchorIntention: 'I create a home where my family can gather.',
  mode: 'create' as const,
  onBack: jest.fn(),
  onUploadAsset: jest.fn(async () => ({ ok: true as const, asset: { id: 'uploaded', resolvedUrl: 'file:///uploaded.jpg', mimeType: 'image/jpeg', fileSizeBytes: 10, createdAt: 'now' } })),
};

function setup(overrides: Partial<VisionCeremonyProps> = {}, session: VisionConversationSession | null = makeSession()) {
  mockSession = session;
  mockJob = null;
  mockError = null;
  mockErrorCode = null;
  const onAssemble = jest.fn(async (_result: Parameters<VisionCeremonyProps['onAssemble']>[0]) => true);
  const props: VisionCeremonyProps = { ...baseProps, onAssemble, ...overrides };
  return { ...render(<VisionCeremony {...props} />), props, onAssemble };
}

async function continueLatest(view: ReturnType<typeof setup>) {
  fireEvent.press(view.getByTestId('vision-resume-card-continue'));
  await act(async () => Promise.resolve());
  expect(view.getByTestId('vision-conversation-selection')).toBeTruthy();
}

async function seal(view: ReturnType<typeof setup>) {
  fireEvent.press(view.getByTestId('vision-ceremony-keep'));
  await act(async () => { jest.advanceTimersByTime(200); await Promise.resolve(); });
}

describe('VisionCeremony conversation integration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockSession = null;
    mockDraft = null;
    mockJob = null;
    mockError = null;
    mockErrorCode = null;
    mockReduced = true;
    mockPhotoSize = null;
    useAuthStore.setState({ user: { id: 'owner-a' } as never });
    mockGenerationStart.mockResolvedValue(true);
    mockGenerationRetry.mockResolvedValue(true);
    mockGenerationRefresh.mockResolvedValue(undefined);
    mockConversationRefresh.mockImplementation(async () => mockSession);
    useCelebrationStore.getState().reset();
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('aW1hZ2U=');
  });
  afterEach(() => {
    useCelebrationStore.getState().reset();
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('views Original beside existing Version 2, then seals exactly Original Option 2', async () => {
    const originalSnapshot = JSON.parse(JSON.stringify(fullRounds));
    const view = setup();
    await continueLatest(view);
    fireEvent.press(view.getByRole('button', { name: 'Original' }));
    expect(view.getByTestId('vision-conversation-selection-title').props.children).toBe('Your first options');
    expect(mockUpdate).toHaveBeenCalledWith({ viewedRoundId: 'round-original' });
    fireEvent.press(view.getByRole('button', { name: 'Use This One, Option 2' }));
    await seal(view);

    expect(view.onAssemble).toHaveBeenCalledWith(expect.objectContaining({
      selectedAssets: [expect.objectContaining({ assetId: 'asset-original-option-2', sourceType: 'AI_GENERATED' })],
    }));
    expect(view.onAssemble.mock.calls[0][0].selectedAssets[0].assetId).not.toBe('asset-version-2-option-2');
    expect(mockSession?.rounds).toEqual(originalSnapshot);
  });

  it('uses the inspected candidate directly from the full-screen viewer', async () => {
    const view = setup();
    await continueLatest(view);

    fireEvent.press(view.getByRole('button', { name: 'Inspect Option 2' }));
    expect(view.getByText('Take a closer look')).toBeTruthy();
    fireEvent.press(view.getAllByRole('button', { name: 'Use This One' }).at(-1)!);

    expect(view.queryByText('Take a closer look')).toBeNull();
    expect(view.queryByTestId('vision-conversation-selection')).toBeNull();
    expect(view.getByText(copy.keep)).toBeTruthy();
  });

  it('refines the exact selected source with EDIT, session, parent candidate and its structured refs', async () => {
    const view = setup();
    await continueLatest(view);
    fireEvent.press(view.getByRole('button', { name: 'Original' }));
    fireEvent.press(view.getByRole('button', { name: 'Refine Option 2' }));
    expect(view.getByText('Editing Option 2')).toBeTruthy();
    fireEvent.changeText(view.getByTestId('vision-refine-input'), 'Keep the coastal roofline.');
    await act(async () => { fireEvent.press(view.getByTestId('vision-refine-submit')); await Promise.resolve(); });

    expect(mockGenerationStart).toHaveBeenCalledWith('Keep the coastal roofline.', null, null, expect.objectContaining({
      operation: 'EDIT',
      sessionId: 'conversation-session',
      parentCandidateId: 'original-option-2',
      references: refs.map(({ assetId, role, label }) => ({ assetId, role, label })),
    }));
    expect(mockUploadPhoto).not.toHaveBeenCalled();
    expect(mockPhotoSize).toBeNull();
  });

  it('passes the saved reference attachments exactly and never sends them through Photo Fit', async () => {
    mockDraft = { id: 'draft', description: '', draftPrompt: '', references: refs.map(reference => ({
      id: reference.assetId,
      assetId: reference.assetId,
      uri: reference.imageUrl,
      mimeType: 'image/jpeg',
      role: reference.role,
      label: reference.label,
    })) };
    const view = setup({ startAt: 'describe', initialDescription: undefined }, null);
    await act(async () => Promise.resolve());
    fireEvent.changeText(view.getByTestId('vision-prompt-input'), 'A calm coastal home with room to gather.');
    fireEvent.press(view.getByTestId('vision-generate'));
    await act(async () => Promise.resolve());

    expect(mockGenerationStart).toHaveBeenCalledWith('A calm coastal home with room to gather.', null, null, expect.objectContaining({
      references: refs.map(({ assetId, role, label }) => ({ assetId, role, label })),
    }));
    expect(mockUploadPhoto).not.toHaveBeenCalled();
    expect(FileSystem.getInfoAsync).not.toHaveBeenCalled();
    expect(view.queryByTestId('vision-photo-fit')).toBeNull();
  });

  it('Start different clears saved refs and history and restores no active generation job', async () => {
    const view = setup();
    fireEvent.press(view.getByTestId('vision-resume-card-start-different'));
    await act(async () => Promise.resolve());

    expect(mockStartDifferent).toHaveBeenCalledTimes(1);
    expect(mockRestoreJob).toHaveBeenCalledWith(null);
    expect(view.queryByTestId('vision-resume-card')).toBeNull();
    expect(view.queryByTestId('vision-selection-lineage')).toBeNull();
    expect(view.getByTestId('v2-vision-creation-flow-prompt-references')).toBeTruthy();
    expect(view.getByText('Optional · Up to 5')).toBeTruthy();
    expect(view.queryAllByLabelText(/^Remove reference photo [1-5]$/)).toHaveLength(0);
  });

  it('clears prior candidates and reference photos when the owner or anchor scope changes', async () => {
    const view = setup();
    await continueLatest(view);
    expect(view.getByTestId('vision-conversation-selection-print-0-sharp').props.source.uri).toContain('version-2-option-1');

    mockSession = null;
    mockDraft = null;
    act(() => useAuthStore.setState({ user: { id: 'owner-b' } as never }));
    expect(view.queryByTestId('vision-conversation-selection')).toBeNull();
    fireEvent.press(view.getByLabelText(copy.createVision));
    expect(view.getByText('Optional · Up to 5')).toBeTruthy();
    expect(view.queryAllByLabelText(/^Remove reference photo [1-5]$/)).toHaveLength(0);
    expect(view.queryByTestId('vision-conversation-selection-print-0-sharp')).toBeNull();

    mockSession = null;
    mockDraft = null;
    view.rerender(<VisionCeremony {...view.props} anchorId="another-anchor" />);
    expect(view.queryByTestId('vision-conversation-selection')).toBeNull();
    expect(view.getByLabelText(copy.createVision)).toBeTruthy();
  });

  it('requires an explicit source choice before varying an unselected viewed round', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const view = setup();
    await continueLatest(view);
    fireEvent.press(view.getByRole('button', { name: 'Original' }));
    fireEvent.press(view.getByTestId('vision-conversation-selection-another'));

    expect(alertSpy).toHaveBeenCalledWith('Which image would you like to vary?', 'Choose the source for this new version.', expect.any(Array));
    expect(mockGenerationStart).not.toHaveBeenCalled();
    const buttons = alertSpy.mock.calls[0][2] ?? [];
    expect(buttons.map(button => button.text)).toEqual(['Option 1', 'Option 2', 'Cancel']);
    await act(async () => { buttons[1].onPress?.(); await Promise.resolve(); });
    expect(mockGenerationStart).toHaveBeenCalledWith(
      'Build a welcoming coastal home.', null, null,
      expect.objectContaining({ operation: 'VARIATE', sessionId: 'conversation-session', parentCandidateId: 'original-option-2' }),
    );
  });

  it('rerolls the initial two-up without a parent and keeps its explicit references', async () => {
    const initialSession = makeSession({
      selectedCandidateId: null,
      viewedRoundId: 'round-original',
      references: refs.map(({ assetId, role, label }) => ({ assetId, role, label })),
      rounds: [original],
    });
    const view = setup({}, initialSession);
    fireEvent.press(view.getByTestId('vision-resume-card-continue'));
    await act(async () => Promise.resolve());
    fireEvent.press(view.getByTestId('vision-conversation-selection-another'));
    await act(async () => Promise.resolve());

    expect(mockGenerationStart).toHaveBeenCalledTimes(1);
    const [description, appearanceReferenceId, startAssetId, options] = mockGenerationStart.mock.calls[0];
    expect(description).toBe('Build a welcoming coastal home.');
    expect(appearanceReferenceId).toBeNull();
    expect(startAssetId).toBeNull();
    expect(options).toEqual(expect.objectContaining({
      operation: 'COMPOSE',
      sessionId: 'conversation-session',
      references: refs.map(({ assetId, role, label }) => ({ assetId, role, label })),
    }));
    expect(options).not.toHaveProperty('parentCandidateId');
  });

  it('resume Keep restores and seals the exact saved candidate instead of the latest option', async () => {
    const view = setup();
    fireEvent.press(view.getByTestId('vision-resume-card-keep'));
    await act(async () => Promise.resolve());
    expect(mockRestoreJob).toHaveBeenCalledWith(versionTwo);
    await seal(view);

    expect(view.onAssemble).toHaveBeenCalledWith(expect.objectContaining({
      selectedAssets: [expect.objectContaining({ assetId: 'asset-version-2-option-2' })],
    }));
    expect(view.onAssemble.mock.calls[0][0].selectedAssets[0].assetId).not.toBe('asset-original-option-2');
  });

  it('refreshes an expired URL and stays on the exact viewed round', async () => {
    const expiredUrl = 'https://expired.test/version-two-option-1.jpg';
    mockSession = makeSession({ rounds: [original, versionOne, makeRound('round-version-2', 2, 'version-1-option-1', ['version-2-option-1', 'version-2-option-2'], [], { 'version-2-option-1': expiredUrl })] });
    const replacementUrl = 'https://vision.test/refreshed-version-two-option-1.jpg';
    mockConversationRefresh.mockImplementationOnce(async () => {
      if (mockSession) mockSession = { ...mockSession, rounds: mockSession.rounds.map(round => round.id === 'round-version-2'
        ? { ...round, candidates: round.candidates.map(item => item.id === 'version-2-option-1' ? { ...item, imageUrl: replacementUrl } : item) }
        : round) };
      return mockSession;
    });
    const view = setup({}, mockSession!);
    await continueLatest(view);
    fireEvent(view.getByTestId('vision-conversation-selection-print-0-sharp'), 'error');
    await act(async () => Promise.resolve());
    fireEvent.press(view.getByTestId('vision-conversation-selection-retry'));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(mockConversationRefresh).toHaveBeenCalledTimes(1);
    expect(mockSession?.viewedRoundId).toBe('round-version-2');
    expect(mockSession?.rounds.find(round => round.id === 'round-version-2')?.candidates[0].imageUrl).toBe(replacementUrl);
    expect(view.getByTestId('vision-conversation-selection-print-0-sharp').props.source.uri).toBe(replacementUrl);
  });
});
