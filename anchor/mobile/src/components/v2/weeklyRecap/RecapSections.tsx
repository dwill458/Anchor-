import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, typography } from '@/theme/v2';
import { CHART_MAP_GOLD } from '@/components/v2/chart/map/chartMapTokens';
import type { RecapViewModel } from '@/adapters/v2/weeklyRecap/recapViewModel';

export function RecapStatusBanner({ status, offline, testID }: { status: RecapViewModel['status']; offline: boolean; testID?: string }) {
  if (status.kind === 'FINAL' && !offline) return null;
  return (
    <View style={styles.banner} testID={testID} accessibilityRole="text">
      {status.label ? <Text style={styles.bannerText}>{status.label}</Text> : null}
      {offline ? <Text style={styles.bannerText}>Offline. Showing your last saved copy.</Text> : null}
    </View>
  );
}

/** One prominent achievement; gold marks only this eyebrow. */
export function RecapHero({ hero, weekLabel, testID }: { hero: RecapViewModel['hero']; weekLabel: string; testID?: string }) {
  return (
    <View style={styles.hero} testID={testID}>
      <Text style={styles.week}>{weekLabel.toUpperCase()}</Text>
      <View style={styles.eyebrowRow}>
        <View style={styles.goldDot} />
        <Text style={styles.eyebrow}>{hero.eyebrow}</Text>
      </View>
      <Text style={styles.headline} accessibilityRole="header">{hero.headline}</Text>
      <Text style={styles.support}>{hero.support}</Text>
    </View>
  );
}

export function RecapStats({ stats, testID }: { stats: RecapViewModel['stats']; testID?: string }) {
  return (
    <View style={styles.statsRow} testID={testID}>
      {stats.map((s) => (
        <View key={s.key} style={styles.stat} accessible accessibilityLabel={`${s.label}: ${s.value}`}>
          <Text style={styles.statValue}>{s.value}</Text>
          <Text style={styles.statLabel}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function RecapWeekStrip({ days, testID }: { days: RecapViewModel['days']; testID?: string }) {
  return (
    <View style={styles.strip} testID={testID} accessible accessibilityLabel={`Practiced on ${days.filter((d) => d.practiced).length} of 7 days`}>
      {days.map((d) => (
        <View key={d.dateKey} style={styles.day}>
          <View style={[styles.dayDot, d.practiced && styles.dayDotOn]} />
          <Text style={styles.dayLetter}>{d.letter}</Text>
          {d.achievements > 0 ? <Text style={styles.dayCount}>{d.achievements}</Text> : <Text style={styles.dayCount}> </Text>}
        </View>
      ))}
    </View>
  );
}

export function RecapHighlights({ items, moreCount, testID }: { items: RecapViewModel['highlights']; moreCount: number; testID?: string }) {
  if (!items.length) return null;
  return (
    <View style={styles.section} testID={testID}>
      <Text style={styles.sectionTitle}>Highlights</Text>
      {items.map((h) => (
        <View key={h.key} style={styles.highlight}>
          <Text style={styles.highlightLabel}>{h.label}</Text>
          {h.detail ? <Text style={styles.highlightDetail}>{h.detail}</Text> : null}
        </View>
      ))}
      {moreCount > 0 ? <Text style={styles.more}>and {moreCount} more this week</Text> : null}
    </View>
  );
}

export function RecapNextAction({ action, onPress, testID }: { action: RecapViewModel['nextAction']; onPress: () => void; testID?: string }) {
  return (
    <View style={styles.section}>
      <Pressable style={styles.cta} onPress={onPress} accessibilityRole="button" accessibilityLabel={action.label} testID={testID}>
        <Text style={styles.ctaText}>{action.label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { marginHorizontal: 20, marginTop: 14, paddingVertical: 10, paddingHorizontal: 14, borderRadius: radii.md, backgroundColor: colors.grouped },
  bannerText: { fontFamily: typography.body, fontSize: 12.5, lineHeight: 18, color: colors.text.secondary },
  hero: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 18 },
  week: { fontFamily: typography.bodyMedium, fontSize: 11, letterSpacing: 0.88, color: colors.text.disabled },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  goldDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: CHART_MAP_GOLD, marginRight: 8 },
  eyebrow: { fontFamily: typography.bodyMedium, fontSize: 11, letterSpacing: 0.9, color: colors.text.secondary },
  headline: { fontFamily: typography.displaySemiBold, fontSize: 35, lineHeight: 37, letterSpacing: -1.2, color: colors.text.primary, marginTop: 10, maxWidth: 340 },
  support: { fontFamily: typography.body, fontSize: 15, lineHeight: 22, color: colors.text.secondary, marginTop: 12, letterSpacing: -0.1 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 20, marginTop: 20, borderTopWidth: 1, borderTopColor: colors.border.subtle },
  stat: { width: '33.33%', paddingVertical: 16, paddingRight: 8 },
  statValue: { fontFamily: typography.displaySemiBold, fontSize: 28, letterSpacing: -0.8, color: colors.text.primary },
  statLabel: { fontFamily: typography.body, fontSize: 12, color: colors.text.secondary, marginTop: 2 },
  strip: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 20, marginTop: 12, paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border.subtle },
  day: { alignItems: 'center', flex: 1 },
  dayDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border.strong },
  dayDotOn: { backgroundColor: colors.text.primary, borderColor: colors.text.primary },
  dayLetter: { fontFamily: typography.body, fontSize: 11, color: colors.text.disabled, marginTop: 6 },
  dayCount: { fontFamily: typography.bodyMedium, fontSize: 11, color: colors.text.secondary, marginTop: 2 },
  section: { marginHorizontal: 20, marginTop: 24 },
  sectionTitle: { fontFamily: typography.bodyMedium, fontSize: 11, letterSpacing: 0.88, color: colors.text.disabled, marginBottom: 6, textTransform: 'uppercase' },
  highlight: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  highlightLabel: { fontFamily: typography.bodyMedium, fontSize: 14, color: colors.text.primary },
  highlightDetail: { fontFamily: typography.body, fontSize: 13, color: colors.text.secondary, marginTop: 2 },
  more: { fontFamily: typography.body, fontSize: 12.5, color: colors.text.secondary, marginTop: 10 },
  cta: { minHeight: 52, borderRadius: radii.pill, backgroundColor: colors.text.primary, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: typography.bodyMedium, fontSize: 15, color: colors.canvas },
});
