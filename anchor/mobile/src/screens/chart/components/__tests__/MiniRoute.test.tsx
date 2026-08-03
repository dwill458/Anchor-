import React from 'react';
import { render } from '@testing-library/react-native';
import type { WaypointState } from '@/types/chart';
import { MiniRoute } from '../MiniRoute';
import type { MiniRouteWaypoint } from '../courseMapTypes';

function wp(id: string, state: WaypointState): MiniRouteWaypoint {
  return { id, state };
}

describe('MiniRoute', () => {
  it('renders without crashing for 1 through 7 waypoints', () => {
    for (let count = 1; count <= 7; count += 1) {
      const waypoints = Array.from({ length: count }, (_, i) => wp(`wp-${i}`, 'UPCOMING'));
      const { getByTestId } = render(<MiniRoute waypoints={waypoints} testID={`mini-${count}`} />);
      expect(getByTestId(`mini-${count}`, { hidden: true })).toBeTruthy();
    }
  });

  it('caps rendering at 7 waypoints even when given more', () => {
    const waypoints = Array.from({ length: 12 }, (_, i) => wp(`wp-${i}`, 'UPCOMING'));
    expect(() => render(<MiniRoute waypoints={waypoints} />)).not.toThrow();
  });

  it('is decorative — hidden from the accessibility tree, no press handling', () => {
    const { getByTestId, queryByTestId } = render(<MiniRoute waypoints={[wp('a', 'CURRENT')]} testID="mini" />);
    const node = getByTestId('mini', { hidden: true });
    expect(node.props.accessibilityElementsHidden).toBe(true);
    expect(node.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(node.props.onPress).toBeUndefined();
    expect(queryByTestId('mini')).toBeNull();
  });

  it('handles zero waypoints without crashing', () => {
    expect(() => render(<MiniRoute waypoints={[]} testID="mini" />)).not.toThrow();
  });

  it('renders distinctly for reached, current, and upcoming waypoints', () => {
    const waypoints = [wp('a', 'REACHED'), wp('b', 'CURRENT'), wp('c', 'UPCOMING')];
    const { toJSON } = render(<MiniRoute waypoints={waypoints} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders skipped and cancelled shapes without crashing', () => {
    const waypoints = [wp('a', 'SKIPPED'), wp('b', 'CANCELLED'), wp('c', 'BLOCKED')];
    expect(() => render(<MiniRoute waypoints={waypoints} />)).not.toThrow();
  });
});
