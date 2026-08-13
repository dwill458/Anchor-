import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronRight } from 'lucide-react-native';

import { OptimizedImage, SigilSvg } from '@/components/common';
import { colors, typography } from '@/theme';
import type { Anchor } from '@/types';
import type { ThreadStrengthSnapshot } from '@/utils/practiceMetrics';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function anchorName(anchor?: Anchor) {
  return anchor?.intentionText?.trim() || 'Select an anchor';
}

function anchorMetadata(anchor?: Anchor) {
  return anchor?.category?.trim() || 'Personal Anchor';
}

export const PracticeOverviewCard: React.FC<{
  anchor?: Anchor;
  snapshot: ThreadStrengthSnapshot;
  onOpenDetails: () => void;
  onOpenAnchor: () => void;
}> = ({ anchor, snapshot, onOpenDetails, onOpenAnchor }) => {
  const reduceMotion = useReduceMotionEnabled();
  const sigil = anchor?.reinforcedSigilSvg ?? anchor?.baseSigilSvg ?? '';
  const remaining = snapshot.todayGoal.remaining;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Thread Strength ${snapshot.score} out of 100. ${snapshot.totalSessions} total sessions. Opens practice details.`}
      accessibilityHint="Double tap to open practice history and session breakdown."
      onPress={onOpenDetails}
      style={({ pressed }) => [styles.card, pressed && !reduceMotion && styles.pressed]}
    >
      <View style={styles.viewLabel}><Text style={styles.viewText}>VIEW</Text><ChevronRight size={11} color={colors.practiceMode.deepPrime.bright} /></View>
      <View style={styles.topRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Current anchor, ${anchorName(anchor)}. Double tap to choose another anchor.`}
          onPress={(event) => { event?.stopPropagation?.(); onOpenAnchor(); }}
          style={styles.anchorTrigger}
        >
          <View style={styles.sigil}>
            {anchor?.enhancedImageUrl ? <OptimizedImage uri={anchor.enhancedImageUrl} style={styles.image} resizeMode="cover" /> : sigil ? <SigilSvg xml={sigil} width={28} height={28} /> : <Text style={styles.fallback}>◈</Text>}
          </View>
          <View style={styles.anchorCopy}>
            <Text style={styles.eyebrow}>CURRENT ANCHOR</Text>
            <View style={styles.anchorNameRow}><Text style={styles.anchorName} numberOfLines={1}>{anchorName(anchor)}</Text><ChevronDown size={12} color="rgba(245,240,232,0.5)" /></View>
            <Text style={styles.anchorMetadata} numberOfLines={1}>{anchorMetadata(anchor)}</Text>
          </View>
        </Pressable>
        <View style={styles.total}><Text style={styles.totalValue}>{snapshot.totalSessions}</Text><Text style={styles.eyebrow}>TOTAL SESSIONS</Text></View>
      </View>

      <View style={styles.divider} />
      <View style={styles.metricRow}><Text style={styles.eyebrow}>THREAD STRENGTH</Text><Text style={styles.score}>{snapshot.score}</Text></View>
      <View style={styles.track}><View style={[styles.scoreFill, { width: `${snapshot.score}%` }]} /></View>
      <View style={styles.week}>
        {snapshot.currentWeek.map((day, index) => (
          <View key={day.localDateKey} style={styles.day}>
            <Text style={styles.dayLabel}>{DAY_LABELS[index]}</Text>
            <View style={[styles.dot, day.count > 0 ? styles.dotDone : day.isToday ? styles.dotToday : styles.dotEmpty]} />
          </View>
        ))}
      </View>
      <Text style={styles.message}>The symbol is becoming part of you.</Text>

      <View style={styles.divider} />
      <View style={styles.goalHeader}><Text style={styles.eyebrow}>TODAY'S GOAL</Text><Text style={styles.goalValue}>{snapshot.todayGoal.completed} of {snapshot.todayGoal.goal} sessions complete</Text></View>
      <View style={styles.goalTrack}><View style={[styles.goalFill, { width: `${snapshot.todayGoal.progress * 100}%` }]} /></View>
      <Text style={styles.remaining}>{remaining === 0 ? 'Goal complete for today' : `${remaining} session${remaining === 1 ? '' : 's'} remaining today`}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 20, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', backgroundColor: 'rgba(255,255,255,0.025)', overflow: 'hidden' },
  pressed: { transform: [{ scale: 0.985 }], borderColor: 'rgba(212,175,55,0.28)' },
  viewLabel: { position: 'absolute', top: 15, right: 17, flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewText: { fontFamily: typography.fontFamily.sansBold, fontSize: 10, letterSpacing: 1.1, color: colors.practiceMode.deepPrime.bright },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 44 },
  anchorTrigger: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  sigil: { width: 42, height: 42, borderRadius: 21, flexShrink: 0, overflow: 'hidden', backgroundColor: 'rgba(10,14,20,0.9)', borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.28)', alignItems: 'center', justifyContent: 'center' },
  image: { width: 42, height: 42 },
  fallback: { color: colors.gold, fontSize: 20 },
  anchorCopy: { flex: 1, minWidth: 0 },
  anchorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  anchorName: { flexShrink: 1, fontFamily: typography.fontFamily.bodySerifItalic, fontSize: 16, color: colors.bone },
  anchorMetadata: { marginTop: 2, fontFamily: typography.fontFamily.sans, fontSize: 9, letterSpacing: 0.8, color: 'rgba(245,240,232,0.38)', textTransform: 'uppercase' },
  eyebrow: { fontFamily: typography.fontFamily.sansBold, fontSize: 9, letterSpacing: 1, color: 'rgba(245,240,232,0.32)' },
  total: { alignItems: 'flex-end' },
  totalValue: { fontFamily: typography.fontFamily.serifBold, fontSize: 30, lineHeight: 32, color: colors.gold },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 11 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  score: { fontFamily: typography.fontFamily.sansBold, fontSize: 13, color: colors.gold },
  track: { height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  scoreFill: { height: '100%', borderRadius: 4, backgroundColor: colors.gold },
  week: { flexDirection: 'row', marginTop: 11 },
  day: { flex: 1, alignItems: 'center', gap: 7 },
  dayLabel: { fontFamily: typography.fontFamily.sans, fontSize: 10, color: 'rgba(245,240,232,0.32)' },
  dot: { borderRadius: 4 },
  dotDone: { width: 8, height: 8, backgroundColor: colors.gold },
  dotToday: { width: 8, height: 8, borderWidth: 1.5, borderColor: colors.gold },
  dotEmpty: { width: 6, height: 6, backgroundColor: 'rgba(255,255,255,0.12)' },
  message: { marginTop: 9, fontFamily: typography.fontFamily.bodySerifItalic, fontSize: 13, color: 'rgba(212,175,55,0.65)' },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 6 },
  goalValue: { fontFamily: typography.fontFamily.sans, fontSize: 12, color: colors.bone },
  goalTrack: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  goalFill: { height: '100%', backgroundColor: 'rgba(212,175,55,0.66)' },
  remaining: { marginTop: 6, fontFamily: typography.fontFamily.sans, fontSize: 11, color: 'rgba(245,240,232,0.32)' },
});
