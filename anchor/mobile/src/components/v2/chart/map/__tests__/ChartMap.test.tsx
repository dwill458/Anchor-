import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ChartMap } from '../ChartMap';
import { useChartMapAnimState } from '../useChartMapAnimState';
import { buildRouteTable, waypointPlacement } from '../chartMapGeometry';
import type { ChartMapMarker } from '../chartMapContracts';

const GOLD = '#E0A038';
const CAT = '#A64F68';

function makeMarkers(n: number, current: number): ChartMapMarker[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `w${i}`,
    index: i,
    number: i + 1,
    title: `Title ${i + 1}`,
    state: i < current ? 'done' : i === current ? 'current' : 'upcoming',
    selected: i === current,
    accessibilityLabel: `Waypoint ${i + 1}: Title ${i + 1}, ${i < current ? 'reached' : i === current ? 'current' : 'upcoming'}`,
  }));
}

function Harness({
  n, current = 1, onMarkerPress = () => {}, onMapPress = () => {}, arrived = false,
}: {
  n: number; current?: number; onMarkerPress?: (i: number) => void; onMapPress?: () => void; arrived?: boolean;
}) {
  const anim = useChartMapAnimState({ revealArc: 400, flagIndex: current });
  const table = React.useMemo(() => buildRouteTable(), []);
  const placement = React.useMemo(() => waypointPlacement(n), [n]);
  return (
    <ChartMap
      testID="map"
      width={390}
      table={table}
      placement={placement}
      anim={anim}
      markers={makeMarkers(n, current)}
      categoryColor={CAT}
      reducedMotion={false}
      arrived={arrived}
      onMarkerPress={onMarkerPress}
      onMapPress={onMapPress}
    />
  );
}

describe('ChartMap', () => {
  // Fog of war: only reached and current waypoints are real markers; one ghost hints at the next.
  it.each([5, 12])('with %i waypoints renders only the reached and current markers, in order, with role and label', n => {
    const { getAllByRole } = render(<Harness n={n} />);
    const buttons = getAllByRole('button');
    expect(buttons).toHaveLength(2);
    buttons.forEach((b, i) => {
      expect(b.props.accessibilityLabel).toMatch(new RegExp(`^Waypoint ${i + 1}: `));
      expect(b.props.accessibilityState).toEqual({ selected: i === 1 });
    });
  });

  it('keeps undiscovered waypoints in the fog: one untappable, unlabelled ghost, nothing else', () => {
    const { queryByTestId, getByTestId, queryAllByLabelText } = render(<Harness n={5} />);
    expect(getByTestId('chart-map-ghost', { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true);
    expect(queryByTestId('chart-map-marker-2')).toBeNull();
    expect(queryByTestId('chart-map-marker-3')).toBeNull();
    expect(queryAllByLabelText(/Title [345]/)).toHaveLength(0);
  });

  it('shows every waypoint once the destination is reached', () => {
    function Arrived() {
      const anim = useChartMapAnimState({ revealArc: 400 });
      const table = React.useMemo(() => buildRouteTable(), []);
      const placement = React.useMemo(() => waypointPlacement(4), []);
      const markers = makeMarkers(4, 4);
      return (
        <ChartMap width={390} table={table} placement={placement} anim={anim} markers={markers} categoryColor={CAT}
          reducedMotion arrived onMarkerPress={() => {}} onMapPress={() => {}} />
      );
    }
    expect(render(<Arrived />).getAllByRole('button')).toHaveLength(4);
  });

  it('marker press calls onMarkerPress(index)', () => {
    const onMarkerPress = jest.fn();
    const onMapPress = jest.fn();
    const { getByTestId } = render(<Harness n={5} onMarkerPress={onMarkerPress} onMapPress={onMapPress} />);
    fireEvent.press(getByTestId('chart-map-marker-1'));
    expect(onMarkerPress).toHaveBeenCalledWith(1);
    expect(onMapPress).not.toHaveBeenCalled();
  });

  it('map surface press calls onMapPress', () => {
    const onMapPress = jest.fn();
    const { getByTestId } = render(<Harness n={5} onMapPress={onMapPress} />);
    fireEvent.press(getByTestId('map-surface'));
    expect(onMapPress).toHaveBeenCalledTimes(1);
  });

  it('exposes a labelled summit only when arrived', () => {
    const a = render(<Harness n={5} />);
    expect(a.queryByTestId('chart-map-summit')).toBeNull();
    a.unmount();
    const b = render(<Harness n={5} arrived />);
    expect(b.getByTestId('chart-map-summit').props.accessibilityLabel).toBe('Destination reached');
  });

  it('uses gold only on the flag pennant and the summit centre dot', () => {
    const { toJSON } = render(<Harness n={5} />);
    const hits: Array<{ type: string; props: Record<string, unknown> }> = [];
    const walk = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      const { type, props, children } = node;
      if (props && Object.values(props).some(v => v === GOLD)) hits.push({ type, props });
      if (Array.isArray(children)) children.forEach(walk);
    };
    walk(toJSON());
    expect(hits).toHaveLength(2);
    expect(hits.find(h => h.props.path === 'M2,-54 L34,-44 L2,-33 Z')).toBeTruthy();
    expect(hits.find(h => h.type === 'Circle' && h.props.r === 4)).toBeTruthy();
  });
});
