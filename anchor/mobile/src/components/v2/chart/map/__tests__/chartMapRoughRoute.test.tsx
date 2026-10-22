import React from 'react';
import { render } from '@testing-library/react-native';
import { Skia } from '@shopify/react-native-skia';
import { buildRoughRoute, routeCoordAt } from '../chartMapShaders';
import { buildRouteTable, waypointPlacement } from '../chartMapGeometry';
import { ChartMap } from '../ChartMap';
import { useChartMapAnimState } from '../useChartMapAnimState';
import { cameraSteps, focusTarget, overviewTarget } from '../useChartMapCamera';

describe('rough brush route', () => {
  const table = buildRouteTable();

  it('is deterministic and stays within about 1.6 units of the centreline', () => {
    const a = buildRoughRoute(table);
    const b = buildRoughRoute(table);
    expect(a.svgPath).toBe(b.svgPath);
    let worst = 0;
    for (let i = 0; i < table.count; i++) worst = Math.max(worst, Math.hypot(a.xs[i] - table.xs[i], a.ys[i] - table.ys[i]));
    expect(worst).toBeLessThanOrEqual(1.61);
    expect(worst).toBeGreaterThan(0.3);
    expect(a.xs[0]).toBeCloseTo(table.xs[0], 3);
    expect(a.ys[table.count - 1]).toBeCloseTo(table.ys[table.count - 1], 3);
  });

  it('tip sits on the trimmed polyline end (within 0.5 units)', () => {
    const r = buildRoughRoute(table);
    for (const arc of [0, 40, 333, 800, table.total * 0.99, table.total]) {
      const f = routeCoordAt(r.cum, table.arcs, table.count, arc) / r.total;
      const target = f * r.total;
      let i = 1;
      while (i < table.count - 1 && r.cum[i] < target) i++;
      const span = r.cum[i] - r.cum[i - 1] || 1;
      const t = (target - r.cum[i - 1]) / span;
      const ex = r.xs[i - 1] + (r.xs[i] - r.xs[i - 1]) * t;
      const ey = r.ys[i - 1] + (r.ys[i] - r.ys[i - 1]) * t;
      expect(Math.hypot(ex - routeCoordAt(r.xs, table.arcs, table.count, arc), ey - routeCoordAt(r.ys, table.arcs, table.count, arc))).toBeLessThan(0.5);
    }
  });

  it('builds the rough path once, not per revealArc change', () => {
    const make = Skia.Path.MakeFromSVGString as jest.Mock;
    let animRef: ReturnType<typeof useChartMapAnimState> | null = null;
    function H() {
      const anim = useChartMapAnimState();
      animRef = anim;
      const placement = React.useMemo(() => waypointPlacement(5), []);
      return (
        <ChartMap width={390} table={table} placement={placement} anim={anim} markers={[]}
          categoryColor="#A64F68" reducedMotion arrived={false} onMarkerPress={() => {}} onMapPress={() => {}} />
      );
    }
    const { rerender } = render(<H />);
    const before = make.mock.calls.length;
    animRef!.revealArc.value = 300;
    rerender(<H />);
    animRef!.revealArc.value = 600;
    rerender(<H />);
    expect(make.mock.calls.length).toBe(before);
  });
});

describe('camera helpers', () => {
  it('cameraSteps returns three tween steps', () => {
    function H() {
      const anim = useChartMapAnimState();
      const steps = cameraSteps(anim, focusTarget(waypointPlacement(5), 1), 100, 350, 'out');
      expect(steps).toHaveLength(3);
      expect(steps.every(s => s.kind === 'tween' && s.at === 100 && s.duration === 350)).toBe(true);
      expect(overviewTarget()).toEqual({ cx: 426, cy: 590, s: 1 });
      return null;
    }
    render(<H />);
  });
});
