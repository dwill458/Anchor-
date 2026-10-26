import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { colors } from '@/theme/v2';
import { courseStripLayout } from '@/screens/v2/chart/courseLogModel';

const GOLD = '#D8A94A';
const PAPER = '#EAE1CE';

type Props = { total: number; reachedCount: number; title?: string | null };

/** The Course log's header: the route as an etched pencil line, one node per waypoint, then where the person is now. */
export function CourseLogRouteStrip({ total, reachedCount, title }: Props) {
  const { nodes, endX, complete } = courseStripLayout(total, reachedCount);
  const ink = colors.ink.base;
  const path = nodes.length ? `M${nodes.map(node => `${node.x} ${node.y}`).join(' L')} L${endX - 8} ${nodes[nodes.length - 1].y}` : '';
  const current = nodes.find(node => node.state === 'current');
  const caption = complete ? CHART_COPY.log.complete : current ? CHART_COPY.log.nowOn.replace('{n}', String(current.index + 1)).replace('{title}', title ?? '') : null;
  return (
    <View style={styles.panel} testID="course-log-strip">
      <Svg viewBox="0 0 360 48" width="100%" height={48} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {path ? <Path d={path} fill="none" stroke={ink} strokeWidth={1.4} strokeDasharray="2 5" strokeLinecap="round" opacity={0.5} /> : null}
        {nodes.map(node => node.state === 'upcoming'
          ? <Circle key={node.index} cx={node.x} cy={node.y} r={5.5} fill="none" stroke={ink} strokeWidth={1.2} strokeDasharray="2 2.2" opacity={0.7} />
          : <Circle key={node.index} cx={node.x} cy={node.y} r={5.5} fill={ink} />)}
        {current ? <>
          <Line x1={current.x} y1={current.y} x2={current.x} y2={current.y - 22} stroke={ink} strokeWidth={1.4} />
          <Path d={`M${current.x} ${current.y - 22} l12 3.8 -12 3.8z`} fill={GOLD} stroke={ink} strokeWidth={0.7} />
        </> : null}
        <Path d={`M${endX - 6} 18 l12 12 M${endX + 6} 18 l-12 12`} stroke={ink} strokeWidth={1.8} strokeLinecap="round" opacity={0.5} />
      </Svg>
      {caption ? <Text style={styles.caption} numberOfLines={2} testID="course-log-strip-caption">{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: PAPER, borderRadius: 16, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12 },
  caption: { marginTop: 6, fontSize: 13, lineHeight: 18, color: colors.text.secondary },
});
