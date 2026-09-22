import type { CreationDraft } from '@/stores/v2/creationStore';

const mockPost = jest.fn();
const mockPut = jest.fn();
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

let mockAuth: { isAuthenticated: boolean; user: { id: string } | null } = { isAuthenticated: true, user: { id: 'user-1' } };
jest.mock('@/stores/authStore', () => ({ useAuthStore: { getState: () => mockAuth } }));

import { ApiClientError } from '@/services/ApiClient';
import {
  CreationSaveError,
  buildCreatePayload,
  classifySaveFailure,
  persistCreatedAnchor,
  persistDestination,
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
  saveState: 'saving',
  saveAttempted: true,
  anchorPersisted: false,
  destination: '',
  destinationState: 'idle',
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
  mockPut.mockReset();
  mockAddAnchor.mockClear();
  mockApplySynced.mockClear();
  mockAnchors.clear();
  mockAuth = { isAuthenticated: true, user: { id: 'user-1' } };
});

describe('buildCreatePayload', () => {
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
    expect(mockPut).toHaveBeenCalledWith('/api/anchors/4f1c2a9e-0000-4000-8000-000000000001', { expression: 'ink' });
    expect(result.anchor.classifierMeta?.v2Expression).toBe('ink');
  });

  it('requires an account and touches nothing without one', async () => {
    mockAuth = { isAuthenticated: false, user: null };
    await expect(persistCreatedAnchor({ draft: draft(), idempotencyKey: 'k' })).rejects.toMatchObject({ failure: 'auth' });
    expect(mockPost).not.toHaveBeenCalled();
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
    await persistDestination({ anchorId: 'a', description: 'I walk out proud of the work.' });
    const urls = [...mockPost.mock.calls, ...mockPut.mock.calls].map((call) => call[0] as string);
    expect(urls.some((url) => /billing|trial|subscription/i.test(url))).toBe(false);
  });
});

describe('persistDestination', () => {
  it('writes the destination as the Anchor’s Vision description', async () => {
    mockPost.mockResolvedValue({ data: { success: true } });
    await persistDestination({ anchorId: 'anchor 1', description: '  I walk out proud of the work.  ' });
    expect(mockPost).toHaveBeenCalledWith('/api/v2/anchors/anchor%201/vision', { description: 'I walk out proud of the work.' });
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
