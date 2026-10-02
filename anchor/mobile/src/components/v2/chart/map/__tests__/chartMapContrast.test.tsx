import React from 'react';
import { render } from '@testing-library/react-native';
import { categories, getCategoryColor } from '@/theme/v2/categories';
import { CHART_MAP_TOKENS } from '../chartMapTokens';
import { contrastRatio, markerNumeralColor } from '../ChartMapMarkers';
import { ChartMap } from '../ChartMap';
import { useChartMapAnimState } from '../useChartMapAnimState';
import { buildRouteTable, waypointPlacement } from '../chartMapGeometry';

const PAPER = CHART_MAP_TOKENS.paper;

describe('marker numeral contrast', () => {
  it.each(Object.keys(categories))('%s: current numeral >= 4.5 on paper, done numeral >= 3 on fill', name => {
    const color = getCategoryColor(name);
    for (const cat of [name, undefined]) {
      const current = markerNumeralColor('current', color, cat);
      expect(contrastRatio(current, PAPER)).toBeGreaterThanOrEqual(4.5);
    }
    const done = markerNumeralColor('done', color, name);
    expect(contrastRatio(done, color)).toBeGreaterThanOrEqual(3);
  });
});

describe('ChartMap interactive=false', () => {
  it('renders markers as labelled images, not buttons', () => {
    function H() {
      const anim = useChartMapAnimState();
      const table = React.useMemo(() => buildRouteTable(), []);
      const placement = React.useMemo(() => waypointPlacement(3), []);
      const markers = [0, 1, 2].map(i => ({
        id: `w${i}`, index: i, number: i + 1, title: 'T', state: (i === 0 ? 'current' : 'upcoming') as 'current' | 'upcoming', selected: false,
        accessibilityLabel: `Waypoint ${i + 1}: T, upcoming`,
      }));
      return (
        <ChartMap width={390} table={table} placement={placement} anim={anim} markers={markers}
          categoryColor="#A64F68" reducedMotion arrived={false} interactive={false}
          onMarkerPress={() => {}} onMapPress={() => {}} />
      );
    }
    const { queryAllByRole, getAllByRole } = render(<H />);
    expect(queryAllByRole('button').filter(b => /Waypoint/.test(String(b.props.accessibilityLabel)))).toHaveLength(0);
    // Fog of war: the current waypoint is the only real marker (the next is an unlabelled ghost).
    expect(getAllByRole('image')).toHaveLength(1);
  });
});
