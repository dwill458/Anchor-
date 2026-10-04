import Svg, { Circle, Path } from 'react-native-svg';
import type { ChartSummary } from '@/adapters/v2/chart/chartV2Model';

/** A small ink route on paper; marker state comes from the live Chart summary. */
export function VisionChartRoute({ chart }: { chart: ChartSummary }) {
  const total = Math.max(1, chart.total);
  const current = Math.max(1, Math.min(total, chart.waypointNumber));
  const visible = Math.min(7, total);
  const first = Math.max(1, Math.min(total - visible + 1, current - Math.floor(visible / 2)));
  const points = Array.from({ length: visible }, (_, i) => ({
    number: first + i, x: visible === 1 ? 46 : 8 + i * 78 / (visible - 1),
    y: visible === 1 ? 40 : 64 - i * 46 / (visible - 1) + Math.sin(i * 1.9) * 5,
  }));
  return <Svg testID="vision-chart-route" width={92} height={80} viewBox="0 0 92 80" accessible={false}>
    {points.slice(1).map((point, i) => {
      const previous = points[i];
      const middle = (previous.x + point.x) / 2;
      const reached = chart.isFinished || point.number <= current;
      return <Path key={`segment-${point.number}`}
        d={`M ${previous.x} ${previous.y} C ${middle} ${previous.y}, ${middle} ${point.y}, ${point.x} ${point.y}`}
        fill="none" stroke="#3C433E" strokeWidth={1.5} strokeLinecap="round"
        opacity={reached ? 0.85 : 0.25} strokeDasharray={reached ? undefined : '3 4'} />;
    })}
    {points.map(point => <Circle key={point.number} testID={`vision-chart-waypoint-${point.number}`}
      cx={point.x} cy={point.y} r={!chart.isFinished && point.number === current ? 4.4 : 3.3}
      fill="#F4EBDD" stroke="#3C433E" strokeWidth={!chart.isFinished && point.number === current ? 1.9 : 1.2}
      opacity={chart.isFinished || point.number <= current ? 1 : 0.3} />)}
  </Svg>;
}
