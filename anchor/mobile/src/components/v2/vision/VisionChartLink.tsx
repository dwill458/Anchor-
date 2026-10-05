import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import type { ChartSummary } from '@/adapters/v2/chart/chartV2Model';
import { colors, spacing, typography } from '@/theme/v2';
import { VisionChartRoute } from './VisionChartRoute';

/** Text and artwork own their space, including when there is no Chart yet. */
export function VisionChartLink({ chart, width, onPress }: {
  chart?: ChartSummary | null; width: number; onPress: () => void;
}) {
  return <Pressable testID="vision-on-your-chart" accessibilityRole="button" onPress={onPress}
    accessibilityLabel={chart
      ? `On your Chart: ${chart.isFinished ? 'destination reached' : `waypoint ${chart.waypointNumber} of ${chart.total}, ${chart.waypointTitle}`}. View Chart.`
      : 'On your Chart: no route yet. Create a Chart.'}
    style={({ pressed }) => [styles.footer, { width }, pressed && styles.pressed]}>
    <View testID="vision-chart-content" style={styles.row}>
      {chart ? <View testID="vision-chart-mini-map" style={styles.route}><VisionChartRoute chart={chart} /></View> : null}
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>ON YOUR CHART</Text>
        {chart ? <>
          <Text style={styles.position}>{chart.isFinished ? 'Destination reached' : `Waypoint ${chart.waypointNumber} of ${chart.total}`}</Text>
          <Text numberOfLines={2} style={styles.title}>{chart.waypointTitle}</Text>
        </> : <>
          <Text style={styles.title}>Create a Chart</Text>
          <Text style={styles.description}>Map the route to this Vision.</Text>
        </>}
      </View>
      <ChevronRight testID="vision-chart-chevron" size={20} color={colors.text.primary} />
    </View>
    <View pointerEvents="none" style={styles.artwork}>
      <Image testID="vision-chart-illustration" accessible={false}
        source={require('../../../../assets/chart/vision-chart-footer-illustration.png')}
        resizeMode="contain" style={{ width, height: width / 3 }} />
      <LinearGradient colors={[colors.canvas, 'transparent']} style={styles.fade} />
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  footer: { marginHorizontal: -spacing[5], marginTop: spacing[3] },
  row: { marginHorizontal: spacing[5], paddingTop: 14, minHeight: 100,
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border.default,
    flexDirection: 'row', alignItems: 'center', gap: 12, zIndex: 1 },
  route: { width: 92, height: 80, flexShrink: 0 },
  copy: { flex: 1, minWidth: 0, gap: 4, paddingVertical: 8 },
  eyebrow: { ...typography.labelSM, fontSize: 10, letterSpacing: 1.1, color: colors.text.secondary },
  position: { ...typography.labelMD, color: colors.text.primary },
  title: { fontFamily: 'EBGaramond-Medium', fontSize: 18, lineHeight: 21, color: colors.text.primary },
  description: { ...typography.bodySM, color: colors.text.secondary },
  artwork: { marginTop: -64 },
  fade: { position: 'absolute', top: 0, left: 0, right: 0, height: 36 },
  pressed: { opacity: 0.72 },
});
