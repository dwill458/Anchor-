import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CircularAnchorRenderer } from '@/components/v2/anchor/CircularAnchorRenderer';
import { colors, radii, spacing, typography } from '@/theme/v2';
import type { Anchor } from '@/types';
import type { RecapItem, WeeklyRecap } from '@/adapters/v2/weeklyRecap/types';
import { HERO_EYEBROW, accentFor, itemLabel, motionForDisplay, statsForDisplay } from '@/adapters/v2/weeklyRecap/weeklyRecapViewModel';
import { anchorRenderProps } from '@/components/v2/anchors/anchorPresentation';

type AnchorLookup = (id: string | null) => Anchor | undefined;

export function RecapOpening({ recap, notice }: { recap: WeeklyRecap; notice: string | null }) {
  return (
    <View style={s.opening} testID="recap-opening">
      <Text style={s.eyebrow}>{recap.range.label.toUpperCase()}</Text>
      <Text style={s.headline} accessibilityRole="header">{recap.opening.headline}</Text>
      <Text style={s.summary}>{recap.opening.summary}</Text>
      {notice ? <Text style={s.notice} testID="recap-provisional" accessibilityLiveRegion="polite">{notice}</Text> : null}
    </View>
  );
}

/** The one prominent achievement. Artwork is the person's own Anchor when it can be shown; otherwise none. */
export function RecapHero({ recap, anchorOf, onOpenAnchor }: { recap: WeeklyRecap; anchorOf: AnchorLookup; onOpenAnchor?: (id: string) => void }) {
  const { hero } = recap;
  const anchor = anchorOf(hero.anchorId);
  const accent = accentFor(recap, hero.anchorId);
  const detail = hero.kind === 'WAYPOINT_REACHED' && hero.movesCompleted ? `${hero.movesCompleted} ${hero.movesCompleted === 1 ? 'move' : 'moves'} finished on the way` : null;
  const art = anchor ? <CircularAnchorRenderer {...anchorRenderProps(anchor)} size="medium" accessibilityLabel="Your Anchor" /> : null;
  return (
    <View style={[s.hero, { borderColor: accent }]} testID="recap-hero">
      {art ? (onOpenAnchor && hero.anchorId ? (
        <Pressable onPress={() => onOpenAnchor(hero.anchorId!)} accessibilityRole="button" accessibilityLabel="Open this Anchor" style={s.heroArt} testID="recap-hero-anchor">{art}</Pressable>
      ) : <View style={s.heroArt}>{art}</View>) : null}
      <View style={s.heroCopy}>
        <Text style={[s.heroEyebrow, { color: accent }]}>{HERO_EYEBROW[hero.kind].toUpperCase()}</Text>
        {hero.title ? <Text style={s.heroTitle} numberOfLines={3}>{itemLabel(hero)}</Text> : null}
        {detail ? <Text style={s.heroDetail}>{detail}</Text> : null}
        {hero.labels.length ? <Text style={s.heroDetail}>{hero.labels.join(' · ')}</Text> : null}
      </View>
    </View>
  );
}

export function RecapStats({ recap }: { recap: WeeklyRecap }) {
  const stats = statsForDisplay(recap);
  if (!stats.length) return null;
  return (
    <View style={s.stats} testID="recap-stats">
      {stats.slice(0, 4).map(stat => (
        <View key={stat.id} style={s.stat} accessible accessibilityLabel={stat.spoken} testID={`recap-stat-${stat.id}`}>
          <Text style={s.statValue}>{stat.value}</Text>
          <Text style={s.statLabel}>{stat.label.toUpperCase()}</Text>
        </View>
      ))}
    </View>
  );
}

export function RecapMotion({ recap }: { recap: WeeklyRecap }) {
  const days = motionForDisplay(recap);
  return (
    <View style={s.motion} testID="recap-motion" accessibilityLabel="Your week at a glance">
      {days.map(d => (
        <View key={d.dateKey} style={s.day} accessible accessibilityLabel={d.spoken} testID={`recap-day-${d.dateKey}`}>
          <View style={[s.dayBar, { height: 6 + Math.min(d.practices, 3) * 10 }, d.practices === 0 && s.dayBarEmpty]} />
          <View style={s.dayMarks}>{Array.from({ length: Math.min(d.markers, 3) }).map((_, i) => <View key={i} style={s.dayMark} />)}</View>
          <Text style={s.dayLetter}>{d.letter}</Text>
        </View>
      ))}
    </View>
  );
}

export function RecapHighlights({ recap }: { recap: WeeklyRecap }) {
  if (!recap.highlights.length) return null;
  return (
    <View style={s.section} testID="recap-highlights">
      <Text style={s.sectionTitle}>ALSO THIS WEEK</Text>
      {recap.highlights.map(h => <HighlightRow key={h.dedupeKey} item={h} accent={accentFor(recap, h.anchorId)} />)}
      {recap.highlightsOverflow > 0 ? <Text style={s.more} testID="recap-overflow">+{recap.highlightsOverflow} more this week</Text> : null}
    </View>
  );
}
const HighlightRow = ({ item, accent }: { item: RecapItem; accent: string }) => (
  <View style={s.row} accessible accessibilityLabel={`${HERO_EYEBROW[item.kind]}: ${itemLabel(item)}`}>
    <View style={[s.dot, { backgroundColor: accent }]} />
    <View style={s.rowCopy}>
      <Text style={s.rowEyebrow}>{HERO_EYEBROW[item.kind]}</Text>
      <Text style={s.rowTitle} numberOfLines={2}>{itemLabel(item)}</Text>
    </View>
  </View>
);

export function RecapAnchors({ recap, openable, focusAnchorId, onOpenAnchor }: { recap: WeeklyRecap; openable: ReadonlySet<string>; focusAnchorId?: string; onOpenAnchor: (id: string) => void }) {
  if (recap.anchors.length < 2 && !focusAnchorId) return null;
  if (!recap.anchors.length) return null;
  return (
    <View style={s.section} testID="recap-anchors">
      <Text style={s.sectionTitle}>ACROSS YOUR ANCHORS</Text>
      {recap.anchors.map(a => {
        const ref = recap.refs.anchors[a.anchorId];
        const parts = [a.practices ? `${a.practices} ${a.practices === 1 ? 'practice' : 'practices'}` : null, a.moves ? `${a.moves} ${a.moves === 1 ? 'move' : 'moves'}` : null, a.waypoints ? `${a.waypoints} ${a.waypoints === 1 ? 'waypoint' : 'waypoints'}` : null].filter(Boolean).join(' · ');
        const content = (
          <>
            <View style={[s.dot, { backgroundColor: accentFor(recap, a.anchorId) }]} />
            <View style={s.rowCopy}>
              <Text style={s.rowTitle} numberOfLines={1}>{ref?.intention ?? 'Your Anchor'}{ref?.isReleased ? ' · Released' : ''}</Text>
              <Text style={s.rowEyebrow}>{parts}</Text>
            </View>
          </>
        );
        const focused = a.anchorId === focusAnchorId;
        // A link only when the Anchor can really be opened here; deleted or archived Anchors stay readable but inert.
        return openable.has(a.anchorId) ? (
          <Pressable key={a.anchorId} style={[s.row, focused && s.rowFocused]} onPress={() => onOpenAnchor(a.anchorId)} accessibilityRole="button" accessibilityLabel={`Open ${ref?.intention ?? 'Anchor'}`} testID={`recap-anchor-${a.anchorId}`}>{content}</Pressable>
        ) : (
          <View key={a.anchorId} style={[s.row, focused && s.rowFocused]} testID={`recap-anchor-${a.anchorId}`}>{content}</View>
        );
      })}
      {recap.anchorsOverflow > 0 ? <Text style={s.more}>+{recap.anchorsOverflow} more</Text> : null}
    </View>
  );
}

export function RecapReflection({ recap }: { recap: WeeklyRecap }) {
  if (!recap.reflection.text) return null;
  return <Text style={s.reflection} testID="recap-reflection">{recap.reflection.text}</Text>;
}

const s = StyleSheet.create({
  opening: { paddingHorizontal: spacing[5], paddingTop: spacing[5], gap: 8 },
  eyebrow: { fontFamily: typography.bodyMedium, fontSize: 11, letterSpacing: 0.9, color: colors.text.disabled },
  headline: { fontFamily: typography.displaySemiBold, fontSize: 32, lineHeight: 36, letterSpacing: -1, color: colors.text.primary },
  summary: { fontFamily: typography.body, fontSize: 16, lineHeight: 23, color: colors.text.secondary },
  notice: { fontFamily: typography.body, fontSize: 13, lineHeight: 19, color: colors.text.secondary, backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing[3], marginTop: 6, borderWidth: 1, borderColor: colors.border.subtle },
  hero: { marginHorizontal: spacing[5], marginTop: spacing[5], padding: spacing[4], borderRadius: radii.lg, borderWidth: 1, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  heroArt: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1, gap: 4 },
  heroEyebrow: { fontFamily: typography.bodyMedium, fontSize: 11, letterSpacing: 0.9 },
  heroTitle: { fontFamily: typography.displaySemiBold, fontSize: 21, lineHeight: 26, letterSpacing: -0.4, color: colors.text.primary },
  heroDetail: { fontFamily: typography.body, fontSize: 13, lineHeight: 18, color: colors.text.secondary },
  stats: { flexDirection: 'row', marginHorizontal: spacing[5], marginTop: spacing[5], borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border.subtle },
  stat: { flex: 1, paddingVertical: spacing[4], alignItems: 'center', gap: 4 },
  statValue: { fontFamily: typography.displaySemiBold, fontSize: 24, color: colors.text.primary },
  statLabel: { fontFamily: typography.bodyMedium, fontSize: 10, letterSpacing: 0.8, color: colors.text.disabled },
  motion: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginHorizontal: spacing[5], marginTop: spacing[5], height: 92 },
  day: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  dayBar: { width: 10, borderRadius: 5, backgroundColor: colors.text.primary },
  dayBarEmpty: { backgroundColor: colors.border.subtle },
  dayMarks: { flexDirection: 'row', gap: 2, height: 6 },
  dayMark: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.text.secondary },
  dayLetter: { fontFamily: typography.bodyMedium, fontSize: 11, color: colors.text.disabled },
  section: { marginHorizontal: spacing[5], marginTop: spacing[6], gap: spacing[2] },
  sectionTitle: { fontFamily: typography.bodyMedium, fontSize: 11, letterSpacing: 0.9, color: colors.text.disabled, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3], minHeight: 48, borderRadius: radii.md },
  rowFocused: { backgroundColor: colors.surface },
  rowCopy: { flex: 1 },
  rowEyebrow: { fontFamily: typography.body, fontSize: 12, color: colors.text.secondary },
  rowTitle: { fontFamily: typography.bodyMedium, fontSize: 15, lineHeight: 20, color: colors.text.primary },
  dot: { width: 8, height: 8, borderRadius: 4 },
  more: { fontFamily: typography.body, fontSize: 12, color: colors.text.secondary, marginTop: 2 },
  reflection: { fontFamily: typography.body, fontSize: 14, lineHeight: 21, color: colors.text.secondary, marginHorizontal: spacing[5], marginTop: spacing[5] },
});
