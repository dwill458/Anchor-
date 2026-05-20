import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useProgressionData } from '@/hooks/useProgressionData';
import { colors, spacing, typography } from '@/theme';
import { withAlpha } from '@/utils/color';
import type { RequirementStatus } from '@/utils/progression';

interface ProgressionSheetProps {
  visible: boolean;
  onClose: () => void;
}

function formatRequirement(requirement: RequirementStatus): string {
  return `${requirement.current}/${requirement.required} ${requirement.label}`;
}

const RequirementRow: React.FC<{ requirement: RequirementStatus }> = ({
  requirement,
}) => (
  <View style={styles.requirementRow}>
    <Text
      style={[
        styles.requirementCheck,
        requirement.met ? styles.requirementCheckMet : styles.requirementCheckUnmet,
      ]}
    >
      {requirement.met ? '✓' : '○'}
    </Text>
    <Text
      style={[
        styles.requirementText,
        requirement.met ? styles.requirementTextMet : null,
      ]}
    >
      {formatRequirement(requirement)}
    </Text>
  </View>
);

export const ProgressionSheet: React.FC<ProgressionSheetProps> = ({
  visible,
  onClose,
}) => {
  const progression = useProgressionData();

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable style={styles.overlay} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={styles.handle} />
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
              <Text style={styles.closeLabel}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Your Progression</Text>
              <Text style={styles.subtitle}>
                Your private practice is taking shape.
              </Text>
            </View>

            <LinearGradient
              colors={[withAlpha(colors.purple, 0.42), withAlpha(colors.navy, 0.94)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.summaryCard}
            >
              <View>
                <Text style={styles.summaryLabel}>RANK</Text>
                <Text
                  style={[styles.summaryValue, { color: progression.rank.color }]}
                >
                  {progression.rank.currentName}
                </Text>
                <Text style={styles.summaryCopy}>{progression.rank.description}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryStats}>
                <Text style={styles.summaryStat}>{`${progression.practiceDays} practice days`}</Text>
                <Text style={styles.summaryStat}>{`${progression.totalPrimes} total primes`}</Text>
                <Text style={styles.summaryStat}>{`${progression.releasedAnchors} released anchors`}</Text>
              </View>
            </LinearGradient>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>RANK</Text>
              {progression.rank.tiers.map((tier) => (
                <View
                  key={tier.name}
                  style={[
                    styles.tierCard,
                    tier.isCurrent ? styles.tierCardCurrent : null,
                  ]}
                >
                  <View style={styles.tierHeader}>
                    <View style={styles.tierTitleWrap}>
                      <Text style={[styles.tierTitle, { color: tier.color }]}>
                        {tier.name}
                      </Text>
                      {tier.isCurrent ? (
                        <Text style={styles.currentBadge}>Current</Text>
                      ) : null}
                    </View>
                    {tier.isReached ? (
                      <Text style={styles.tierReached}>Reached</Text>
                    ) : null}
                  </View>
                  <Text style={styles.tierDescription}>{tier.description}</Text>
                  {tier.requirements.length > 0 ? (
                    <View style={styles.requirementsBlock}>
                      {tier.requirements.map((requirement) => (
                        <RequirementRow
                          key={`${tier.name}-${requirement.key}`}
                          requirement={requirement}
                        />
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.beginningCopy}>
                      Beginning state of the practice.
                    </Text>
                  )}
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>DEEPEST PRACTICE</Text>
              {progression.deepestPractice.empty ? (
                <View style={styles.tierCard}>
                  <Text style={styles.tierTitle}>
                    {progression.deepestPractice.title}
                  </Text>
                  <Text style={styles.tierDescription}>
                    {progression.deepestPractice.subtitle}
                  </Text>
                </View>
              ) : (
                <View style={styles.detailHero}>
                  <Text style={styles.detailLabel}>ANCHOR IN PRACTICE</Text>
                  <Text style={styles.detailTitle}>
                    {progression.deepestPractice.title}
                  </Text>
                  <Text
                    style={[
                      styles.detailMetric,
                      { color: progression.deepestPractice.tierColor },
                    ]}
                  >
                    {`${progression.deepestPractice.tierName} · ${progression.deepestPractice.stats.primes} primes`}
                  </Text>
                  <Text style={styles.detailDescription}>
                    {progression.deepestPractice.description}
                  </Text>
                </View>
              )}

              {progression.deepestPractice.tiers.map((tier) => (
                <View
                  key={tier.name}
                  style={[
                    styles.tierCard,
                    tier.isCurrent ? styles.tierCardCurrent : null,
                  ]}
                >
                  <View style={styles.tierHeader}>
                    <View style={styles.tierTitleWrap}>
                      <Text style={[styles.tierTitle, { color: tier.color }]}>
                        {tier.name}
                      </Text>
                      {tier.isCurrent ? (
                        <Text style={styles.currentBadge}>Current</Text>
                      ) : null}
                    </View>
                    {tier.isReached ? (
                      <Text style={styles.tierReached}>Reached</Text>
                    ) : null}
                  </View>
                  <Text style={styles.tierDescription}>{tier.description}</Text>
                  {tier.requirements.length > 0 ? (
                    <View style={styles.requirementsBlock}>
                      {tier.requirements.map((requirement) => (
                        <RequirementRow
                          key={`${tier.name}-${requirement.key}`}
                          requirement={requirement}
                        />
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.beginningCopy}>
                      Default depth before repetition begins.
                    </Text>
                  )}
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>NEXT MARK</Text>
              <View style={styles.detailHero}>
                <Text style={styles.detailLabel}>CURRENT TARGET</Text>
                <Text style={styles.detailTitle}>{progression.nextMark.name}</Text>
                <Text style={styles.detailMetric}>
                  {`${progression.nextMark.current}/${progression.nextMark.required}`}
                </Text>
                <Text style={styles.detailDescription}>
                  {progression.nextMark.subtitle}
                </Text>
              </View>

              {progression.nextMark.tiers.map((tier) => (
                <View
                  key={tier.name}
                  style={[
                    styles.tierCard,
                    tier.isCurrent ? styles.tierCardCurrent : null,
                  ]}
                >
                  <View style={styles.tierHeader}>
                    <View style={styles.tierTitleWrap}>
                      <Text style={styles.tierTitle}>{tier.name}</Text>
                      {tier.isCurrent ? (
                        <Text style={styles.currentBadge}>Current</Text>
                      ) : null}
                    </View>
                    {tier.isReached ? (
                      <Text style={styles.tierReached}>Forged</Text>
                    ) : null}
                  </View>
                  <Text style={styles.tierDescription}>{tier.subtitle}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 7, 10, 0.72)',
  },
  sheet: {
    height: '90%',
    backgroundColor: '#111820',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: withAlpha(colors.gold, 0.14),
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: withAlpha(colors.gold, 0.35),
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  closeLabel: {
    ...typography.caption,
    fontSize: 16,
    color: withAlpha(colors.silver, 0.6),
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 36,
  },
  header: {
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 24,
    color: colors.bone,
    marginBottom: 4,
  },
  subtitle: {
    ...typography.body,
    color: withAlpha(colors.bone, 0.78),
  },
  summaryCard: {
    borderRadius: 18,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.12),
    marginBottom: spacing.lg,
  },
  summaryLabel: {
    ...typography.caption,
    color: withAlpha(colors.gold, 0.72),
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 28,
    marginTop: 6,
  },
  summaryCopy: {
    ...typography.body,
    color: withAlpha(colors.bone, 0.82),
    marginTop: 6,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: withAlpha(colors.gold, 0.12),
    marginVertical: 14,
  },
  summaryStats: {
    gap: 4,
  },
  summaryStat: {
    ...typography.body,
    color: withAlpha(colors.silver, 0.82),
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    ...typography.caption,
    color: withAlpha(colors.gold, 0.72),
    textTransform: 'uppercase',
    letterSpacing: 1.8,
    marginBottom: spacing.sm,
  },
  detailHero: {
    borderRadius: 18,
    padding: spacing.md,
    backgroundColor: withAlpha(colors.ritual.glassStrong, 0.96),
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.12),
    marginBottom: spacing.sm,
  },
  detailLabel: {
    ...typography.caption,
    color: withAlpha(colors.silver, 0.72),
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  detailTitle: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 22,
    color: colors.bone,
    marginTop: 6,
  },
  detailMetric: {
    ...typography.bodyBold,
    color: colors.gold,
    marginTop: 6,
  },
  detailDescription: {
    ...typography.body,
    color: withAlpha(colors.bone, 0.8),
    marginTop: 8,
  },
  tierCard: {
    borderRadius: 18,
    padding: spacing.md,
    backgroundColor: withAlpha(colors.ritual.glassStrong, 0.94),
    borderWidth: 1,
    borderColor: withAlpha(colors.bone, 0.06),
    marginBottom: spacing.sm,
  },
  tierCardCurrent: {
    borderColor: withAlpha(colors.gold, 0.24),
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  tierTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  tierTitle: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 19,
    color: colors.bone,
  },
  currentBadge: {
    ...typography.caption,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  tierReached: {
    ...typography.caption,
    color: withAlpha(colors.gold, 0.82),
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  tierDescription: {
    ...typography.body,
    color: withAlpha(colors.bone, 0.8),
  },
  beginningCopy: {
    ...typography.body,
    color: withAlpha(colors.silver, 0.76),
    marginTop: 8,
  },
  requirementsBlock: {
    marginTop: 10,
    gap: 8,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  requirementCheck: {
    width: 18,
    textAlign: 'center',
    fontSize: 14,
  },
  requirementCheckMet: {
    color: colors.gold,
  },
  requirementCheckUnmet: {
    color: withAlpha(colors.silver, 0.54),
  },
  requirementText: {
    ...typography.body,
    flex: 1,
    color: withAlpha(colors.silver, 0.82),
  },
  requirementTextMet: {
    color: withAlpha(colors.bone, 0.84),
  },
});
