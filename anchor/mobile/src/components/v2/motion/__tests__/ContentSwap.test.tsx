import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { ContentSwap } from '../ContentSwap';

jest.mock('@/hooks/v2/useV2ReduceMotion', () => ({ useV2ReduceMotion: () => false }));

const withEntering = () => screen.UNSAFE_root.findAll((node) => node.props.entering !== undefined);

describe('ContentSwap', () => {
  it('shows the first content without animating it in', () => {
    render(<ContentSwap contentKey="a"><Text>first</Text></ContentSwap>);
    expect(screen.getByText('first')).toBeTruthy();
    expect(withEntering()).toHaveLength(0);
  });

  it('shows the new content, fading in, when the key changes', () => {
    const view = render(<ContentSwap contentKey="a"><Text>first</Text></ContentSwap>);
    view.rerender(<ContentSwap contentKey="b"><Text>second</Text></ContentSwap>);
    expect(screen.getByText('second')).toBeTruthy();
    expect(screen.queryByText('first')).toBeNull();
    expect(withEntering().length).toBeGreaterThan(0);
  });

  it('keeps showing the current content when re-rendered with the same key', () => {
    const view = render(<ContentSwap contentKey="a"><Text>first</Text></ContentSwap>);
    view.rerender(<ContentSwap contentKey="a"><Text>first again</Text></ContentSwap>);
    expect(screen.getByText('first again')).toBeTruthy();
  });
});
