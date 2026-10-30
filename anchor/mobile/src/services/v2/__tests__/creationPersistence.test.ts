import type { CreationDraft } from '@/stores/v2/creationStore';

const mockPost = jest.fn();
const mockPut = jest.fn();
const mockFlushDraft = jest.fn(async () => {});
jest.mock('@/stores/v2/creationStore', () => ({ flushCreationDraft: () => mockFlushDraft() }));
const mockGuestSession = jest.fn(async () => ({ user: { id: mockAuth.user?.id ?? 'guest-server-user' }, token: 'verified-guest' }));
jest.mock('@/services/AuthService', () => ({ AuthService: { ensureGuestSession: () => mockGuestSession() } }));
jest.mock('@/services/AnchorCreationSession', () => ({ generateAuthorizedAnchor: async (input: unknown) =>
  (await mockPost('/api/ai/enhance', input, { timeout: 180000 })).data }));
jest.mock('@/services/ApiClient', () => {
  const actual = jest.requireActual('@/services/ApiClient');
  return { ...actual, apiClient: { post: (...args: unknown[]) => mockPost(...args), put: (...args: unknown[]) => mockPut(...args) } };
});

const mockAnchors = new Map<string, any>();
const mockAddAnchor = jest.fn((anchor: any) => mockAnchors.set(anchor.id, anchor));
const mockApplySynced = jest.fn((ref: string, anchor: any) => {
  mockAnchors.delete(ref);
  mockAnchors.set(anchor.id, anchor);
});
jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: {
    getState: () => ({
      getAnchorById: (id: string) => mockAnchors.get(id) ?? [...mockAnchors.values()].find((anchor) => anchor.localId === id),
      addAnchor: mockAddAnchor,
      applySyncedAnchor: mockApplySynced,
    }),
  },
}));

let mockAuth: { isAuthenticated: boolean; user: { id: string } | null; accountRevision?: number; token?: string } = { isAuthenticated: true, user: { id: 'user-1' } };
jest.mock('@/stores/authStore', () => ({ useAuthStore: { getState: () => mockAuth } }));

import { ApiClientError } from '@/services/ApiClient';
import {
  CreationSaveError,
  buildCreatePayload,
  classifySaveFailure,
  generateExpressionCandidates,
  persistCreatedAnchor,
} from '../creationPersistence';

const SVG = '<svg viewBox="0 0 100 100"><path d="M 20,20 L 80,80" stroke="currentColor" stroke-width="2" fill="none"/></svg>';

const draft = (overrides: Partial<CreationDraft> = {}): CreationDraft => ({
  draftId: 'creation-1',
  clientRequestId: 'create-request-1',
  intention: 'I finish the project ',
  normalizedIntention: 'I finish the project',
  category: 'career',
  distilledLetters: ['F', 'N', 'S', 'H', 'T', 'P', 'R', 'J', 'C'],
  structureType: 'focused',
  structureSvg: SVG,
  expression: 'foil',
  generatedCandidates: [],
  selectedCandidateIndex: 0,
  generationState: 'idle',
  saveState: 'saving',
  saveAttempted: true,
  anchorPersisted: false,
  currentStep: 'expression',
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const serverAnchor = (overrides: Record<string, unknown> = {}) => ({
  id: '4f1c2a9e-0000-4000-8000-000000000001',
  userId: 'user-1',
  intentionText: 'I finish the project',
  category: 'career',
  distilledLetters: ['F', 'N', 'S', 'H', 'T', 'P', 'R', 'J', 'C'],
  baseSigilSvg: SVG,
  structureVariant: 'balanced',
  classifierMeta: { v2Expression: 'foil' },
  isCharged: false,
  activationCount: 0,
  createdAt: '2026-09-21T10:00:00.000Z',
  updatedAt: '2026-09-21T10:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  mockPost.mockReset();
  mockFlushDraft.mockReset().mockResolvedValue(undefined);
  mockPut.mockReset();
  mockAddAnchor.mockClear();
  mockApplySynced.mockClear();
  mockAnchors.clear();
  mockAuth = { isAuthenticated: true, user: { id: 'user-1' } };
});

describe('buildCreatePayload', () => {
  it('keeps the original SVG within its already charged generation session', () => {
    const payload = buildCreatePayload(draft({ expression: 'original', generatedCandidates: [],
      enhancementMetadata: { creationSessionId: 'charged-session' } }), 'keep-original-save');
    expect(payload).toMatchObject({ creationSessionId: 'charged-session', keepOriginal: true, baseSigilSvg: SVG });
    expect(payload).not.toHaveProperty('selectedOptionId');
    expect(payload).not.toHaveProperty('enhancedImageUrl');
  });
  it('sends the real structure, its grid and the kept expression under the draft key', () => {
    const payload = buildCreatePayload(draft(), 'create-request-1');
    expect(payload).toEqual({
      intentionText: 'I finish the project',
      category: 'career',
      distilledLetters: ['F', 'N', 'S', 'H', 'T', 'P', 'R', 'J', 'C'],
      baseSigilSvg: SVG,
      structureVariant: 'balanced',
      planetaryTier: 'jupiter',
      classifierVersion: 2,
      classifierMeta: { v2Expression: 'foil', v2Structure: 'focused', source: 'v2_creation' },
      idempotencyKey: 'create-request-1',
    });
  });

  it('refuses to save a draft without a structure', () => {
    expect(() => buildCreatePayload(draft({ structureSvg: undefined }), 'k')).toThrow(CreationSaveError);
  });
});

describe('persistCreatedAnchor', () => {
  it('does not send a save or create locally when its key receipt fails', async () => {
    mockFlushDraft.mockRejectedValueOnce(new Error('Private storage write failed'));
    await expect(persistCreatedAnchor({ draft: draft(), idempotencyKey: 'durable-save' })).rejects.toThrow('Private storage write failed');
    expect(mockPost).not.toHaveBeenCalled();
    expect(mockAddAnchor).not.toHaveBeenCalled();
  });
  it('creates once on the server, then records the confirmed Anchor locally', async () => {
    mockPost.mockResolvedValue({ data: { success: true, data: serverAnchor() } });
    const result = await persistCreatedAnchor({ draft: draft(), idempotencyKey: 'create-request-1' });

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost.mock.calls[0][0]).toBe('/api/anchors');
    expect(mockPost.mock.calls[0][1].idempotencyKey).toBe('create-request-1');
    expect(result.anchorId).toBe('4f1c2a9e-0000-4000-8000-000000000001');
    expect(mockAddAnchor).toHaveBeenCalledTimes(1);
    const stored = mockAddAnchor.mock.calls[0][0];
    expect(stored.localId).toBe('creation-1');
    expect(stored.baseSigilSvg).toBe(SVG);
    expect(stored.classifierMeta.v2Expression).toBe('foil');
    expect(stored.createdAt).toBeInstanceOf(Date);
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('never makes a second local Anchor when a retry replays the same key', async () => {
    mockPost.mockResolvedValue({ data: { success: true, data: serverAnchor() } });
    await persistCreatedAnchor({ draft: draft(), idempotencyKey: 'create-request-1' });
    await persistCreatedAnchor({ draft: draft(), idempotencyKey: 'create-request-1' });
    expect(mockAddAnchor).toHaveBeenCalledTimes(1);
    expect(mockApplySynced).toHaveBeenCalledTimes(1);
    expect(mockAnchors.size).toBe(1);
  });

  it('records the kept expression when a replay returns the first attempt’s', async () => {
    mockPost.mockResolvedValue({ data: { success: true, data: serverAnchor({ classifierMeta: { v2Expression: 'original' } }) } });
    mockPut.mockResolvedValue({ data: { success: true } });
    const result = await persistCreatedAnchor({ draft: draft({ expression: 'ink' }), idempotencyKey: 'k' });
    expect(mockPut).toHaveBeenCalledWith('/api/anchors/4f1c2a9e-0000-4000-8000-000000000001', { expression: 'ink' }, expect.objectContaining({ anchorAuthGuard: expect.any(Function) }));
    expect(result.anchor.classifierMeta?.v2Expression).toBe('ink');
  });

  it('saves a verified guest without requiring registration', async () => {
    mockAuth = { isAuthenticated: false, user: null };
    mockPost.mockResolvedValue({ data: { success: true, data: serverAnchor({ userId: 'guest-server-user' }) } });
    const saved = await persistCreatedAnchor({ draft: draft(), idempotencyKey: 'k' });
    expect(mockGuestSession).toHaveBeenCalled();
    expect(saved.anchor.userId).toBe('guest');
  });
  it('keeps the canonical saved option on an idempotent replay', async () => {
    mockPost.mockResolvedValue({ data: { success: true, data: serverAnchor({ enhancedImageUrl: 'https://cdn.test/canonical-first-option.png' }) } });
    const saved = await persistCreatedAnchor({ draft: draft({ enhancedImageUrl: 'https://cdn.test/later-selected-option.png' }), idempotencyKey: 'replay' });
    expect(saved.anchor.enhancedImageUrl).toBe('https://cdn.test/canonical-first-option.png');
  });
  it('does not add a late saved record after an A to B to A switch', async () => {
    mockAuth.accountRevision = 1;
    mockPost.mockImplementation(async () => {
      mockAuth.accountRevision = 3;
      return { data: { success: true, data: serverAnchor() } };
    });
    await expect(persistCreatedAnchor({ draft: draft(), idempotencyKey: 'late-save' })).rejects.toThrow('Authentication context changed');
    expect(mockAddAnchor).not.toHaveBeenCalled();
  });

  it('routes the free second-Anchor refusal to the paywall and leaves no local record', async () => {
    mockPost.mockRejectedValue(new ApiClientError('Create more anchors with Pro', 'CREATE_ANCHOR_FREE_LOCKED', 403));
    await expect(persistCreatedAnchor({ draft: draft(), idempotencyKey: 'k' })).rejects.toMatchObject({ failure: 'second_anchor' });
    expect(mockAddAnchor).not.toHaveBeenCalled();
  });

  it('treats a lost connection as retryable and leaves no local record', async () => {
    mockPost.mockRejectedValue(new Error('Network error. Please check your connection.'));
    await expect(persistCreatedAnchor({ draft: draft(), idempotencyKey: 'k' })).rejects.toMatchObject({ failure: 'network' });
    expect(mockAddAnchor).not.toHaveBeenCalled();
  });

  it('never calls a billing or trial endpoint', async () => {
    mockPost.mockResolvedValue({ data: { success: true, data: serverAnchor() } });
    await persistCreatedAnchor({ draft: draft(), idempotencyKey: 'k' });
    const urls = [...mockPost.mock.calls, ...mockPut.mock.calls].map((call) => call[0] as string);
    expect(urls.some((url) => /billing|trial|subscription/i.test(url))).toBe(false);
  });
});

describe('generateExpressionCandidates', () => {
  it('does not reserve or generate if the private draft cannot be persisted', async () => {
    mockFlushDraft.mockRejectedValueOnce(new Error('Private storage write failed'));
    await expect(generateExpressionCandidates({ draft: draft({ expression: 'ink' }) })).rejects.toThrow('Private storage write failed');
    expect(mockPost).not.toHaveBeenCalled();
  });
  it('preserves server session/option IDs into the selected save request', async () => {
    mockPost.mockResolvedValue({ data: { creationSessionId: 'server-session', variations: [
      { imageUrl: 'https://cdn.test/a.png', optionId: 'server-option', structurePreserved: true },
    ] } });
    const result = await generateExpressionCandidates({ draft: draft({ expression: 'ink' }) });
    const payload = buildCreatePayload(draft({ generatedCandidates: result.candidates }), 'save-key');
    expect(payload).toMatchObject({ creationSessionId: 'server-session', selectedOptionId: 'server-option' });
  });
  it('uses the existing enhancement endpoint with the canonical SVG and selected expression', async () => {
    mockPost.mockResolvedValue({ data: {
      variations: [
        { imageUrl: 'https://cdn.test/a.png', variationId: 'a', structurePreserved: true },
        { imageUrl: 'https://cdn.test/b.png', variationId: 'b', structurePreserved: true },
      ],
      provider: 'gemini',
      model: 'test-model',
    } });
    const result = await generateExpressionCandidates({ draft: draft({ expression: 'architectural' }), generationAttempt: 2 });
    expect(mockPost).toHaveBeenCalledWith('/api/ai/enhance', expect.objectContaining({
      sigilSvg: SVG,
      styleChoice: 'architectural_trace',
      generationAttempt: 2,
      validateStructure: true,
      variationCount: 2,
    }), { timeout: 180000 });
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0].imageUrl).toBe('https://cdn.test/a.png');
  });

  it('does not offer an interpretation that failed structure preservation, but keeps the one that passed', async () => {
    mockPost.mockResolvedValue({ data: {
      variations: [
        { imageUrl: 'https://cdn.test/a.png', structurePreserved: true },
        { imageUrl: 'https://cdn.test/not-the-anchor.png', structurePreserved: false },
      ],
    } });
    const result = await generateExpressionCandidates({ draft: draft({ expression: 'ink' }) });
    expect(result.candidates.map((candidate) => candidate.imageUrl)).toEqual(['https://cdn.test/a.png']);
  });

  it('rejects only when nothing finished', async () => {
    mockPost.mockResolvedValue({ data: { variations: [{ imageUrl: 'https://cdn.test/x.png', structurePreserved: false }] } });
    await expect(generateExpressionCandidates({ draft: draft({ expression: 'ink' }) })).rejects.toMatchObject({ failure: 'server' });
  });

  it('asks only for the missing interpretation and uses the chosen library style', async () => {
    mockPost.mockResolvedValue({ data: { variations: [{ imageUrl: 'https://cdn.test/c.png', structurePreserved: true }] } });
    await generateExpressionCandidates({ draft: draft({ expression: 'etched', styleChoice: 'cosmic' }), count: 1 });
    expect(mockPost).toHaveBeenCalledWith('/api/ai/enhance', expect.objectContaining({ styleChoice: 'cosmic', variationCount: 1 }), { timeout: 180000 });
  });

  it('records the chosen library style with the Anchor', () => {
    const payload = buildCreatePayload(draft({ expression: 'etched', styleChoice: 'cosmic' }), 'key');
    expect(payload.classifierMeta).toMatchObject({ v2Expression: 'etched', v2StyleChoice: 'cosmic' });
    expect(buildCreatePayload(draft({ expression: 'original' }), 'key').classifierMeta).not.toHaveProperty('v2StyleChoice');
  });

  it('classifies an exhausted daily allowance as a limit, not a failure', () => {
    expect(classifySaveFailure(new ApiClientError('x', 'Daily generation limit reached', 429))).toBe('limit');
  });
});

describe('classifySaveFailure', () => {
  it('maps server answers onto what the user can do', () => {
    expect(classifySaveFailure(new ApiClientError('x', 'PRO_DAILY_ANCHOR_CAP_REACHED', 429))).toBe('limit');
    expect(classifySaveFailure(new ApiClientError('x', 'CREATE_ERROR', 500))).toBe('server');
    expect(classifySaveFailure(new Error('Session expired. Please sign in again.'))).toBe('auth');
    expect(classifySaveFailure(new Error('timeout of 120000ms exceeded'))).toBe('network');
  });
});
