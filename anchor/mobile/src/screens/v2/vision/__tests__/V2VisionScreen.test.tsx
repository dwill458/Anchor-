import React from 'react';
import { Alert } from 'react-native';
import { act, render, waitFor, fireEvent } from '@testing-library/react-native';
import { V2VisionScreen } from '../V2VisionScreen';
import { apiClient } from '@/services/ApiClient';
import { resetV2VisionReadCache } from '@/hooks/v2/vision/useV2Vision';
import { useAnchorStore } from '@/stores/anchorStore';
import { toV2VisionCompactState } from '@/adapters/v2/vision';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    setParams: jest.fn(),
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
    // Vision reads are cached per Anchor for the app session; each case starts cold.
    resetV2VisionReadCache();
    useAnchorStore.setState({
      anchors: [mockAnchor as any],
    });
  });

  it('renders a real Create Vision entry when no vision exists', async () => {
    const { ApiClientError } = jest.requireActual('@/services/ApiClient');
    (apiClient.get as jest.Mock).mockRejectedValueOnce(
      new ApiClientError('Not found', 'NOT_FOUND', 404),
    );

    const { getByTestId, findByTestId } = render(
      <V2VisionScreen anchorId="anchor-1" />,
    );

    const emptyFlow = await findByTestId('v2-vision-creation-flow-empty');
    expect(emptyFlow).toBeTruthy();
    expect(getByTestId('v2-vision-creation-flow-empty')).toBeTruthy();
  });

  it('renders the saved hero and description when real data exists', async () => {
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
    expect(getByText('Begin Visualize')).toBeTruthy();
    expect(getByText('A quiet, sunlit workspace with completed projects.')).toBeTruthy();
  });

  it('shows the Vision as a board: every photo, and the Anchor with its intention at the centre', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: mockVisionData });
    const view = render(<V2VisionScreen anchorId="anchor-1" />);
    await view.findByTestId('vision-board');
    for (const id of ['sc-1', 'sc-2', 'sc-3']) expect(view.getByTestId(`vision-board-photo-${id}`)).toBeTruthy();
    // The intention is written on the card as well as in the identity row.
    expect(view.getAllByText('I build what matters.').length).toBeGreaterThanOrEqual(2);
    expect(view.getByLabelText('Your Anchor, Career. I build what matters.')).toBeTruthy();
  });

  it('no longer offers the separate Edit / Manage / Chart buttons; the Chart stays one tap away', async () => {
    (apiClient.get as jest.Mock).mockImplementation((url: string) => (url.includes('/vision')
      ? Promise.resolve({ data: mockVisionData })
      : Promise.reject(Object.assign(new Error('not found'), { status: 404 }))));
    const view = render(<V2VisionScreen anchorId="anchor-1" />);
    await view.findByTestId('vision-board');
    expect(view.queryByLabelText('Edit Vision')).toBeNull();
    expect(view.queryByLabelText('Manage Images')).toBeNull();
    expect(view.queryByLabelText('View on Chart')).toBeNull();
    fireEvent.press(view.getByTestId('vision-on-your-chart'));
    expect(mockNavigate).toHaveBeenCalledWith('V2Chart', { anchorId: 'anchor-1', source: 'vision' });
  });

  it('reorders photos through accessibility actions and persists the order', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: mockVisionData });
    (apiClient.put as jest.Mock).mockResolvedValue({ data: [] });
    const view = render(<V2VisionScreen anchorId="anchor-1" />);
    const first = await view.findByLabelText('Vision image 1 of 3');
    await act(async () => { fireEvent(first, 'accessibilityAction', { nativeEvent: { actionName: 'moveLater' } }); });
    expect(apiClient.put).toHaveBeenCalledWith('/api/v2/visions/vision-101/scenes/reorder', {
      sceneOrders: [{ id: 'sc-2', sortOrder: 0 }, { id: 'sc-1', sortOrder: 1 }, { id: 'sc-3', sortOrder: 2 }],
    });
  });

  it('focusing a photo offers Replace, Regenerate and Remove; Remove confirms and archives it', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: mockVisionData });
    (apiClient.delete as jest.Mock).mockResolvedValue({ data: { success: true } });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const view = render(<V2VisionScreen anchorId="anchor-1" />);
    const second = await view.findByLabelText('Vision image 2 of 3');
    const focus = () => act(() => { fireEvent(second, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } }); });
    focus();
    expect(view.getByLabelText('Replace')).toBeTruthy();
    expect(view.getByLabelText('Regenerate')).toBeTruthy();
    // Back returns the camera to the whole board.
    fireEvent.press(view.getByLabelText('Back to the whole board'));
    expect(view.queryByLabelText('Replace')).toBeNull();
    focus();
    fireEvent.press(view.getByLabelText('Remove'));
    const buttons = alert.mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>;
    await act(async () => { buttons.find(button => button.text === 'Remove')?.onPress?.(); });
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v2/visions/vision-101/scenes/sc-2');
    // The photo leaves at once, and with it the focus.
    expect(view.queryByLabelText('Replace')).toBeNull();
    alert.mockRestore();
  });

  it('tapping the Anchor card focuses it and opens Vision editing in place', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: mockVisionData });
    const view = render(<V2VisionScreen anchorId="anchor-1" />);
    fireEvent.press(await view.findByLabelText('Your Anchor, Career. I build what matters.'));
    fireEvent.press(view.getByLabelText('Edit Vision'));
    expect(view.getByTestId('vision-edit-description').props.value).toBe('A quiet, sunlit workspace with completed projects.');
  });

  it('records seen-today only after Begin Visualize is pressed', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      data: { ...mockVisionData, seenToday: false },
    });
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: { seenToday: true },
    });

    const { findByLabelText } = render(<V2VisionScreen anchorId="anchor-1" />);

    const begin = await findByLabelText('Begin Visualize');
    expect(apiClient.post).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/v2/visions/vision-101/view'),
      expect.anything(),
    );
    fireEvent.press(begin);

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
