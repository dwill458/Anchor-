
import { useAuthStore } from '@/stores/authStore';
import { Alert, View } from 'react-native';
import { act, render, waitFor, fireEvent } from '@testing-library/react-native';
import { V2VisionScreen } from '../V2VisionScreen';
import { apiClient } from '@/services/ApiClient';
import { resetV2VisionReadCache } from '@/hooks/v2/vision/useV2Vision';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { toV2VisionCompactState } from '@/adapters/v2/vision';


let mockPreparationProps: any;
let mockPracticeProps: any;
let mockShareProps: any;
jest.mock('@/components/share/AnchorShareStudio', () => ({
  AnchorShareStudio: (props: any) => {
    mockShareProps = props;
    return require('react').createElement(require('react-native').Pressable, { testID: 'vision-share-studio-close', onPress: props.onClose });
  },
}));
jest.mock('@/screens/v2/practice/visualize/V2CinematicSessionScreen', () => ({
  V2CinematicSessionScreen: (props: any) => { mockPreparationProps = props; return null; },
}));
jest.mock('@/screens/v2/practice/V2PracticeSessionScreen', () => ({
  V2PracticeSessionScreen: (props: any) => { mockPracticeProps = props; return require('react').createElement(require('react-native').Text, { testID: 'canonical-visualize' }, 'Visualize'); },
}));

// Mock navigation
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  UNSTABLE_usePreventRemove: jest.fn(),
  useNavigation: () => ({
    navigate: mockNavigate,
    replace: mockReplace,
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
    jest.spyOn(View.prototype, 'measureInWindow').mockImplementation(callback => callback(10, 20, 300, 500));
    mockPreparationProps = undefined; mockPracticeProps = undefined;
    useAuthStore.setState({ user: null });
    useSubscriptionStore.setState({ entitlementReady: true, hasActiveEntitlement: true, isSubscribed: true, isInTrial: false, devOverrideEnabled: false });
    // Vision reads are cached per Anchor for the app session; each case starts cold.
    resetV2VisionReadCache();
    useAnchorStore.setState({
      anchors: [mockAnchor as any],
    });
  });

  it('opens Vision sharing from the options menu with saved content and enhanced Anchor art, then returns to the board', async () => {
    useAnchorStore.setState({ anchors: [{ ...mockAnchor, intentionText: 'I build what matters.',
      baseSigilSvg: '<svg viewBox="0 0 20 20"/>', enhancedImageUrl: 'https://example.com/my-enhanced-anchor.png' } as any] });
    const refreshedVisionData = { ...mockVisionData, scenes: mockVisionData.scenes.map(scene => ({
      ...scene, resolvedImageUrl: `${scene.resolvedImageUrl}?fresh=1`,
    })) };
    (apiClient.get as jest.Mock).mockImplementation(() => Promise.resolve({
      data: (apiClient.get as jest.Mock).mock.calls.length >= 3 ? refreshedVisionData : mockVisionData,
    }));
    const view = render(<V2VisionScreen anchorId="anchor-1" />);
    await view.findByTestId('vision-board');
    fireEvent.press(view.getByLabelText('Vision options'));
    fireEvent.press(view.getByLabelText('Share Vision'));
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(mockShareProps.data.visionTiles[0].imageUrl).toContain('?fresh=1'));
    expect(view.queryByLabelText('Share Vision')).toBeNull();
    expect(mockShareProps.initialLayout).toBe('vision');
    expect(mockShareProps.data).toEqual(expect.objectContaining({ intention: 'I build what matters.',
      imageUrl: 'https://example.com/my-enhanced-anchor.png', visionAnnotation: 'Future Studio', visionNotes: [] }));
    expect(mockShareProps.data.visionTiles.map((tile: any) => tile.imageUrl)).toEqual(refreshedVisionData.scenes.map(scene => scene.resolvedImageUrl));
    fireEvent.press(view.getByTestId('vision-share-studio-close'));
    expect(view.queryByTestId('vision-share-studio-close')).toBeNull();
    expect(view.getByTestId('vision-board')).toBeTruthy();
  });

  it('warms every board image while the Vision is on screen, so Visualize does not fetch them as they appear', async () => {
    const { Image } = require('react-native');
    const prefetch = jest.spyOn(Image, 'prefetch').mockResolvedValue(true);
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: mockVisionData });
    render(<V2VisionScreen anchorId="anchor-1" />);
    await waitFor(() => expect(prefetch).toHaveBeenCalledWith('https://example.com/art1.jpg'));
    expect(prefetch).toHaveBeenCalledWith('https://example.com/art2.jpg');
    expect(prefetch).toHaveBeenCalledWith('https://example.com/art3.jpg');
    prefetch.mockRestore();
  });

  it('routes a free account directly to the premium paywall when no Vision is owned', async () => {
    useSubscriptionStore.setState({ entitlementReady: true, hasActiveEntitlement: false, isSubscribed: false, isInTrial: false });
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: null });

    render(<V2VisionScreen anchorId="anchor-1" />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('V2Paywall', {
      context: 'VISION_PREMIUM_ACTION',
      resumeIntent: { type: 'vision_premium_action', anchorId: 'anchor-1', action: 'create' },
    }));
  });

  it('keeps an already-owned Vision accessible after entitlement expiry', async () => {
    useSubscriptionStore.setState({ entitlementReady: true, hasActiveEntitlement: false, isSubscribed: false, isInTrial: false });
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: mockVisionData });

    const view = render(<V2VisionScreen anchorId="anchor-1" />);

    expect(await view.findByTestId('v2-vision-screen')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('saves a user supplied board caption through the existing Vision API', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: mockVisionData });
    const caption = 'Time with my family';
    (apiClient.patch as jest.Mock).mockResolvedValue({ data: { ...mockVisionData, title: caption } });
    const view = render(<V2VisionScreen anchorId="anchor-1" />);
    fireEvent.press(await view.findByLabelText('Vision options'));
    fireEvent.press(view.getByLabelText('Edit Vision'));
    fireEvent.changeText(view.getByLabelText('Board caption'), caption);
    fireEvent.press(view.getByText('Save Vision'));
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith(expect.stringContaining('/vision'), { title: caption }));
    await waitFor(() => expect(view.getByTestId('vision-board-annotation').props.children).toBe(caption));
  });

  it('renders a real Create Vision entry when no vision exists', async () => {
    const { ApiClientError } = jest.requireActual('@/services/ApiClient');
    (apiClient.get as jest.Mock).mockRejectedValueOnce(
      new ApiClientError('Not found', 'NOT_FOUND', 404),
    );

    const { getByTestId, findByTestId } = render(
      <V2VisionScreen anchorId="anchor-1" />,
    );

    const emptyFlow = await findByTestId('vision-ceremony');
    expect(emptyFlow).toBeTruthy();
    expect(getByTestId('vision-ceremony')).toBeTruthy();
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

  it('opens the existing editor directly from Anchor Details Edit', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: mockVisionData });
    const view = render(<V2VisionScreen anchorId="anchor-1" edit />);
    const input = await view.findByTestId('vision-edit-description');
    expect(input.props.value).toBe(mockVisionData.description);
    expect(view.queryByTestId('vision-board')).toBeNull();
  });

  it('shows the Vision as a board: every photo, and the Anchor with its intention at the centre', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: mockVisionData });
    const view = render(<V2VisionScreen anchorId="anchor-1" />);
    await view.findByTestId('vision-board');
    for (const id of ['sc-1', 'sc-2', 'sc-3']) expect(view.getByTestId(`vision-board-photo-${id}`)).toBeTruthy();
    // The intention is written on the card as well as in the identity row.
    expect(view.getAllByText('I build what matters.')).toHaveLength(1);
    expect(view.getByLabelText('Your Anchor, Career. I build what matters.')).toBeTruthy();
  });

  it('no longer offers the separate Edit / Manage / Chart buttons; the Chart stays one tap away', async () => {
    (apiClient.get as jest.Mock).mockImplementation((url: string) => (url.includes('/vision')
      ? Promise.resolve({ data: mockVisionData })
      : Promise.reject(Object.assign(new Error('not found'), { status: 404 }))));
    const view = render(<V2VisionScreen anchorId="anchor-1" />);
    await view.findByTestId('vision-board');
    expect(view.queryByLabelText('Edit Vision')).toBeNull();
    expect(view.queryByText('Manage images (3)')).toBeNull();
    fireEvent.press(view.getByLabelText('Vision options'));
    expect(view.getByLabelText('Edit Vision')).toBeTruthy();
    expect(view.getByLabelText('Manage images (3)')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Manage images (3)'));
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

  it('a sealed photo offers Regenerate and Remove; Remove confirms and archives it', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: mockVisionData });
    (apiClient.delete as jest.Mock).mockResolvedValue({ data: { success: true } });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const view = render(<V2VisionScreen anchorId="anchor-1" />);
    const second = await view.findByLabelText('Vision image 2 of 3');
    const focus = () => act(() => { fireEvent(second, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } }); });
    focus();
    expect(view.queryByLabelText('Replace')).toBeNull();
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
    fireEvent.press(view.getAllByLabelText('Edit Vision')[0]);
    expect(view.getByTestId('vision-edit-description').props.value).toBe('A quiet, sunlit workspace with completed projects.');
  });

  it('hands Begin Visualize to the host without recording a view or starting a session of its own', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { ...mockVisionData, seenToday: false } });
    const onVisualize = jest.fn();
    const { findByLabelText, queryByTestId } = render(<V2VisionScreen anchorId="anchor-1" onVisualize={onVisualize} />);
    fireEvent.press(await findByLabelText('Begin Visualize'));
    expect(onVisualize).toHaveBeenCalledWith(expect.objectContaining({ visionId: 'vision-101', hasVision: true }));
    expect(queryByTestId('canonical-visualize')).toBeNull();
    expect(apiClient.post).not.toHaveBeenCalledWith(expect.stringContaining('/view'), expect.anything());
  });

  it('opens the one canonical Visualize setup, where the duration is chosen, instead of starting a session', async () => {
    mockNavigate.mockClear();
    (apiClient.get as jest.Mock).mockResolvedValue({ data: mockVisionData });
    const view = render(<V2VisionScreen anchorId="anchor-1" />);
    await view.findByTestId('v2-vision-screen');
    const begin = view.getByLabelText('Begin Visualize');
    expect(begin.props.accessibilityState?.disabled).toBeFalsy();
    fireEvent.press(begin);
    expect(mockNavigate).toHaveBeenCalledWith('V2Practice', {
      anchorId: 'anchor-1', resumeMode: 'visualize', resumeSource: 'practice_hub', returnRoute: 'V2Vision',
      visionEntry: expect.objectContaining({ anchorId: 'anchor-1', visionId: 'vision-101', tiles: expect.any(Array), notes: [] }),
    });
    expect(view.queryByTestId('canonical-visualize')).toBeNull();
    expect(mockPracticeProps).toBeUndefined();
  });

  it('clamps long statements and lets the person expand and collapse the real text', async () => {
    const description = 'A real future with room for my family. '.repeat(10);
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { ...mockVisionData, description } });
    const view = render(<V2VisionScreen anchorId="anchor-1" />);
    const statement = await view.findByTestId('vision-statement');
    expect(statement.props.children.length).toBeLessThan(description.length);
    expect(statement.props.children).toMatch(/family\.\.\.$/);
    fireEvent.press(view.getByText('Read more'));
    expect(view.getByTestId('vision-statement').props.numberOfLines).toBeUndefined();
    expect(view.getByTestId('vision-statement').props.children).toBe(description.trim());
    fireEvent.press(view.getByText('Read less'));
    expect(view.getByTestId('vision-statement').props.children).toBe(statement.props.children);
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
