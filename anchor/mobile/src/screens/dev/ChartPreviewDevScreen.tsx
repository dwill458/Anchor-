import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChartPreview, type ChartPreviewProps } from '@/components/chart/ChartPreview';
import { chartPreviewCourses } from '@/components/chart/__fixtures__/chartPreviewStates';
import { ChartPreviewFixtureContext, selectChartPreview } from '@/hooks/useChartPreview';
import { colors, spacing, typography } from '@/theme/v2';

const variants: ChartPreviewProps['variant'][] = ['hero', 'card', 'row'];
const fixtures = Object.fromEntries(Object.entries(chartPreviewCourses).map(([state, course]) =>
  [state, selectChartPreview(course, 'desire')]));
const noop = () => undefined;

/** Dev-only and intentionally unregistered: import into a dev host to review all
 * 15 combinations. No route, existing screen, network or persistence changes. */
export function ChartPreviewDevScreen() {
  if (!__DEV__) return null;
  return (
    <ChartPreviewFixtureContext.Provider value={fixtures}>
      <ScrollView testID="chart-preview-dev" contentContainerStyle={styles.page}>
        {variants.flatMap(variant => Object.keys(fixtures).map(state => (
          <View key={`${variant}-${state}`} style={styles.example}>
            <Text style={styles.label}>{variant} · {state}</Text>
            <ChartPreview variant={variant} anchorId={state} onPress={noop} />
          </View>
        )))}
      </ScrollView>
    </ChartPreviewFixtureContext.Provider>
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing[4], gap: spacing[6], backgroundColor: colors.canvas },
  example: { gap: spacing[2] },
  label: { ...typography.labelMD, color: colors.text.primary },
});
