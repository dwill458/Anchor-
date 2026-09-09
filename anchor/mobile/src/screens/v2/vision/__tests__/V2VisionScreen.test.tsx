import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { V2VisionScreen } from '../V2VisionScreen';
import { apiClient } from '@/services/ApiClient';
import { useAnchorStore } from '@/stores/anchorStore';
import { toV2VisionCompactState } from '@/adapters/v2/vision';

// Mock navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
  }),
  useRoute: () => ({
    params: { anchorId: 'anchor-1', initialMode: 'view' },
  }),
}));

// Mock apiClient
jest.mock('@/services/ApiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  ApiClientError: class ApiClientError extends Error {
    status?: number;
    code?: string;
    constructor(message: string, code?: string, status?: number) {
      super(message);
      this.name = 'ApiClientError';
      this.status = status;
      this.code = code;
    }
  },
}));

describe('V2VisionScreen', () => {
  const mockAnchor = {
    id: 'anchor-1',
    intention: 'I build what matters.',
    category: 'Career',
    threadStrength: 75,
    status: 'ACTIVE',
    createdAt: '2026-09-01T00:00:00Z',
  };

  const mockVisionData = {
    id: 'vision-101',
    anchorId: 'anchor-1',
    title: 'Future Studio',
    description: 'A quiet, sunlit workspace with completed projects.',
    status: 'ACTIVE',
    seenToday: false,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
    scenes: [
      {
        id: 'sc-1',
        visionId: 'vision-101',
        sourceType: 'USER_UPLOAD',
        assetId: 'ast-1',
        resolvedImageUrl: 'https://example.com/art1.jpg',
        prompt: 'Studio room',
        sortOrder: 0,
        isArchived: false,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
      {
        id: 'sc-2',
        visionId: 'vision-101',
        sourceType: 'AI_GENERATED',
        assetId: 'ast-2',
        resolvedImageUrl: 'https://example.com/art2.jpg',
        prompt: 'Work table',
        sortOrder: 1,
        isArchived: false,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
      {
        id: 'sc-3',
        visionId: 'vision-101',
        sourceType: 'AI_GENERATED',
        assetId: 'ast-3',
        resolvedImageUrl: 'https://example.com/art3.jpg',
        prompt: 'Bookshelf',
        sortOrder: 2,
        isArchived: false,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useAnchorStore.setState({
      anchors: [mockAnchor as any],
    });
  });

  it('renders GhostVisionComposition / Creation flow when no vision exists', async () => {
    const { ApiClientError } = jest.requireActual('@/services/ApiClient');
    (apiClient.get as jest.Mock).mockRejectedValueOnce(
      new ApiClientError('Not found', 'NOT_FOUND', 404),
    );

    const { getByTestId, findByTestId } = render(
      <V2VisionScreen anchorId="anchor-1" />,
    );

    const emptyFlow = await findByTestId('v2-vision-creation-flow-empty');
    expect(emptyFlow).toBeTruthy();
    expect(getByTestId('ghost-vision-composition')).toBeTruthy();
  });

  it('renders RealVisionComposition when real data exists', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      data: mockVisionData,
    });
    (apiClient.post as jest.Mock).mockResolvedValue({
      data: { seenToday: true },
    });

    const { findByTestId, getByText } = render(
      <V2VisionScreen anchorId="anchor-1" />,
    );

    const screen = await findByTestId('v2-vision-screen');
    expect(screen).toBeTruthy();
    expect(findByTestId('real-vision-composition')).toBeTruthy();
    expect(getByText('A quiet, sunlit workspace with completed projects.')).toBeTruthy();
  });

  it('viewing Vision triggers seen-today server call', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      data: { ...mockVisionData, seenToday: false },
    });
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: { seenToday: true },
    });

    render(<V2VisionScreen anchorId="anchor-1" />);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/v2/visions/vision-101/view'),
        expect.objectContaining({ timeZone: expect.any(String) }),
      );
    });
  });

  it('Home thumbnail prefetch / compact adapter does NOT trigger seen-today call', () => {
    // Calling toV2VisionCompactState must be pure and perform no side-effects
    const postMock = apiClient.post as jest.Mock;
    postMock.mockClear();

    const compact = toV2VisionCompactState(mockVisionData as any);
    expect(compact.state).toBe('ready');
    expect(postMock).not.toHaveBeenCalled();
  });

  it('error state degrades gracefully with an empty state', async () => {
    (apiClient.get as jest.Mock).mockRejectedValueOnce(new Error('Network offline'));

    const { findByTestId, getByText } = render(
      <V2VisionScreen anchorId="anchor-1" />,
    );

    const errorScreen = await findByTestId('v2-vision-screen-error');
    expect(errorScreen).toBeTruthy();
    expect(getByText('Unable to load Vision')).toBeTruthy();
  });
});
