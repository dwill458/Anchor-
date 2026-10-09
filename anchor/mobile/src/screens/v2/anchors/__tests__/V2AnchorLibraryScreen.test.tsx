import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { FlatList, ScrollView } from 'react-native';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, addListener: jest.fn(() => jest.fn()) }),
  useRoute: () => ({ params: {}, name: 'V2AnchorLibrary', key: 'k' }),
}));

import { useAnchorStore } from '@/stores/anchorStore';
import { V2AnchorLibraryScreen } from '../V2AnchorLibraryScreen';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';

beforeEach(() => {
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  useAnchorStore.setState({ anchors: [], currentAnchorId: undefined });
});

describe('V2AnchorLibraryScreen', () => {
  it('renders active Anchors as a standalone gallery', () => {
    useAnchorStore.setState({
      anchors: [
        makeAnchor({ id: 'a', intentionText: 'I own the morning', category: 'health' }),
        makeAnchor({ id: 'b', intentionText: 'I am wealthy', category: 'abundance' }),
      ],
      currentAnchorId: 'a',
    });
    render(<V2AnchorLibraryScreen />);
    expect(screen.getByText('I own the morning')).toBeTruthy();
    expect(screen.getByText('I am wealthy')).toBeTruthy();
    expect(screen.getByText('Health · Current')).toBeTruthy();
  });

  it('keeps a 60-Anchor collection available without mounting all its artwork at once', () => {
    useAnchorStore.setState({
      anchors: Array.from({ length: 60 }, (_, i) => makeAnchor({ id: `x${i}`, intentionText: `Intention ${i}` })),
    });
    const view = render(<V2AnchorLibraryScreen />);
    expect(screen.getByText('Intention 0')).toBeTruthy();
    expect(screen.queryByText('Intention 59')).toBeNull();
    const list = view.UNSAFE_getByType(FlatList);
    expect(list.props.data).toHaveLength(60);
    expect(view.UNSAFE_getAllByType(ScrollView)).toHaveLength(1);
  });

  it('opens Anchor Details on gallery selection', () => {
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a', intentionText: 'Focus deeply' })] });
    render(<V2AnchorLibraryScreen />);
    fireEvent.press(screen.getByLabelText(/Focus deeply/));
    expect(mockNavigate).toHaveBeenCalledWith('V2AnchorDetails', { anchorId: 'a' });
  });

  it('only shows the Released filter when released Anchors actually exist', () => {
    useAnchorStore.setState({ anchors: [makeAnchor({ id: 'a' })] });
    const first = render(<V2AnchorLibraryScreen />);
    expect(first.queryByText('Released')).toBeNull();
    first.unmount();

    useAnchorStore.setState({
      anchors: [makeAnchor({ id: 'a' }), makeAnchor({ id: 'r', isReleased: true, releasedAt: new Date() })],
    });
    render(<V2AnchorLibraryScreen />);
    expect(screen.getByText('Released')).toBeTruthy();
  });
});
