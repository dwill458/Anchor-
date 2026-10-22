import React from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Play } from 'lucide-react-native';
import { getCategoryColor, radii, spacing, typography } from '@/theme/v2';
import { V2Button } from '@/components/v2/primitives/V2Button';
import { MilestoneArtwork } from '@/components/v2/milestones/MilestoneArtwork';
import { formatEarnedDate } from '@/components/v2/milestones/MilestoneCelebrationScene';
import { progressTokens } from '@/components/v2/progress/progressTokens';
import { useAnchorMilestones } from '@/hooks/v2/milestones/useAnchorMilestones';
import { useAnchorStore } from '@/stores/anchorStore';
import { useMilestoneCelebrationStore } from '@/stores/v2/milestoneCelebrationStore';
import { FAMILY_LABEL, describeEarnedValue, getMilestoneSpec } from '@/milestones/registry';

export interface V2MilestoneDetailScreenProps {
  anchorId: string;
  definitionId: string;
  onBack?: () => void;
  onReplayReturn?: () => void;
  testID?: string;
}

const ART = 220;

/**
 * One milestone: its artwork, family, the condition, and (when earned) the date, the value the
 * server recorded and a Replay. Replay only queues the celebration in non-awarding mode: it can
 * never add strength, minutes, progress or a second award. A locked milestone shows its condition
 * and an outline, with no date, no value and no Replay.
 */
export const V2MilestoneDetailScreen: React.FC<V2MilestoneDetailScreenProps> = ({
  anchorId,
  definitionId,
  onBack,
  onReplayReturn,
  testID = 'v2-milestone-detail',
}) => {
  const insets = useSafeAreaInsets();
  const spec = getMilestoneSpec(definitionId);
  const { records, status } = useAnchorMilestones(anchorId);
  const category = useAnchorStore((state) => state.anchors.find((anchor) => anchor.id === anchorId)?.category);
  const record = React.useMemo(() => records.find((entry) => entry.definitionId === definitionId) ?? null, [records, definitionId]);
  const requestReplay = useMilestoneCelebrationStore((state) => state.requestReplay);

  const backButton = onBack ? (
    <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={styles.back} testID={`${testID}-back`}>
      <ArrowLeft size={18} color={progressTokens.heroText} />
    </Pressable>
  ) : (
    <View style={styles.back} />
  );

  if (!spec) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]} testID={`${testID}-unknown`}>
        <Text style={styles.title}>Milestone unavailable</Text>
        <Text style={styles.body}>This milestone comes from a newer version of Anchor. Update the app to see it.</Text>
        {onBack ? <V2Button variant="tertiary" onPress={onBack}>Go Back</V2Button> : null}
      </View>
    );
  }

  if (!record && status && status !== 'ready') {
    return <View style={[styles.root, styles.center, { paddingTop: insets.top }]} testID={`${testID}-pending`}>
      {backButton}
      <Text style={styles.title}>{spec.title}</Text>
      <Text style={styles.body}>{status === 'loading' ? 'Updating milestone progress…' : 'Connect to confirm this milestone.'}</Text>
    </View>;
  }

  const earned = Boolean(record);
  const date = record ? formatEarnedDate(record.earnedAt) : null;
  const value = record ? describeEarnedValue(spec, record.metadata) : null;

  return (
    <View style={styles.root} testID={testID}>
      <StatusBar barStyle="light-content" animated />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing[8] }} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { paddingTop: insets.top + spacing[2] }]}>
          <View style={styles.overscroll} pointerEvents="none" />
          <View style={styles.heroBar}>
            {backButton}
            <View style={styles.back} />
          </View>
          <Text style={styles.eyebrow}>{FAMILY_LABEL[spec.family].toUpperCase()}</Text>
          <View style={styles.art}>
            <MilestoneArtwork
              definitionId={spec.id}
              state={earned ? 'earned' : 'locked'}
              size={ART}
              categoryColor={getCategoryColor(category)}
              testID={`${testID}-art`}
            />
          </View>
          <Text accessibilityRole="header" style={styles.heroTitle} testID={`${testID}-title`}>
            {spec.title}
          </Text>
          <View style={[styles.pill, earned ? styles.pillEarned : styles.pillLocked]} testID={`${testID}-status`}>
            <Text style={[styles.pillText, earned ? styles.pillTextEarned : styles.pillTextLocked]}>
              {earned ? 'EARNED' : 'LOCKED'}
            </Text>
          </View>
        </View>

        <View style={styles.bodyWrap}>
          <View style={styles.card}>
            <Text style={styles.label}>{earned ? 'WHAT YOU DID' : 'HOW TO UNLOCK'}</Text>
            <Text style={styles.body} testID={`${testID}-condition`}>
              {earned ? spec.unlock : (spec.lockedHint ?? spec.unlock)}
            </Text>
          </View>

          {earned ? (
            <View style={styles.card}>
              {date ? (
                <>
                  <Text style={styles.label}>DATE EARNED</Text>
                  <Text style={styles.body} testID={`${testID}-date`}>{date}</Text>
                </>
              ) : null}
              {value ? (
                <>
                  <Text style={[styles.label, date ? styles.labelGap : null]}>RECORDED</Text>
                  <Text style={styles.body} testID={`${testID}-value`}>{value}</Text>
                </>
              ) : null}
              <Text style={[styles.label, date || value ? styles.labelGap : null]}>ABOUT</Text>
              <Text style={styles.body}>{spec.description}</Text>
            </View>
          ) : null}

          {earned && record ? (
            <View style={styles.replay}>
              <V2Button
                variant="secondary"
                size="large"
                iconLeft={<Play size={16} color={progressTokens.text} />}
                onPress={() => requestReplay(record, onReplayReturn ?? onBack)}
                testID={`${testID}-replay`}
              >
                Replay celebration
              </V2Button>
              <Text style={styles.note}>Replaying doesn’t change your progress.</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: progressTokens.bodyBg },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[6], gap: spacing[3] },
  hero: {
    backgroundColor: progressTokens.heroBg,
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    alignItems: 'center',
    paddingBottom: spacing[6],
    paddingHorizontal: spacing[5],
  },
  overscroll: { position: 'absolute', top: -1200, left: 0, right: 0, height: 1200, backgroundColor: progressTokens.heroBg },
  heroBar: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', paddingBottom: spacing[3] },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: progressTokens.heroHairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: { ...typography.labelSM, letterSpacing: 1.6, color: progressTokens.heroMuted },
  art: { marginVertical: spacing[4] },
  heroTitle: { fontFamily: progressTokens.serif, fontSize: 30, lineHeight: 36, color: progressTokens.heroText, textAlign: 'center' },
  pill: { marginTop: spacing[3], paddingHorizontal: 14, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  pillEarned: { borderColor: progressTokens.gold },
  pillLocked: { borderColor: progressTokens.heroHairline, borderStyle: 'dashed' },
  pillText: { ...typography.labelSM, fontSize: 10.5, letterSpacing: 1.6 },
  pillTextEarned: { color: progressTokens.gold },
  pillTextLocked: { color: progressTokens.heroMuted },
  bodyWrap: { paddingHorizontal: spacing[5], paddingTop: spacing[5], gap: spacing[4] },
  card: {
    backgroundColor: progressTokens.card,
    borderWidth: 1,
    borderColor: progressTokens.cardBorder,
    borderRadius: radii.xl,
    padding: spacing[4],
  },
  label: { ...typography.labelSM, fontSize: 10.5, letterSpacing: 1.4, color: progressTokens.muted },
  labelGap: { marginTop: spacing[4] },
  title: { fontFamily: progressTokens.serif, fontSize: 22, color: progressTokens.text, textAlign: 'center' },
  body: { ...typography.bodyMD, color: progressTokens.text, marginTop: 4 },
  replay: { alignItems: 'center', gap: spacing[2] },
  note: { ...typography.caption, color: progressTokens.muted },
});
