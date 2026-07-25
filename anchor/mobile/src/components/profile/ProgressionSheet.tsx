import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useProgressionData } from '@/hooks/useProgressionData';
import { useAuthStore } from '@/stores/authStore';
import {
  DEVICE_LOCAL_MILESTONE_SCOPE,
  getMilestoneDates,
} from '@/utils/milestoneTracking';
import { colors, spacing, typography } from '@/theme';
import { withAlpha } from '@/utils/color';
import type { MilestoneDates } from '@/utils/milestoneTracking';
import type { RequirementStatus } from '@/utils/progression';

interface ProgressionSheetProps {
  visible: boolean;
  onClose: () => void;
}

// Formats unmet requirements for the "next" tier, or full requirements for others.
function buildTierThresholdText(
  requirements: RequirementStatus[],
  isNext: boolean,
  isReached: boolean,
  achievedDate: string | null
): string {
  if (requirements.length === 0) {
    return 'Starting tier';
  }

  const allReqText = requirements
    .map((r) => `${r.required} ${r.shortLabel}`)
    .join(' · ');

  if (isReached) {
    if (achievedDate === 'pre-launch') return `${allReqText} · Before tracking`;
    if (achievedDate) return `${allReqText} · ${achievedDate}`;
    return allReqText;
  }

  if (isNext) {
    const unmet = requirements.filter((r) => !r.met);
    if (unmet.length > 0) {
      return unmet
        .map((r) => `${r.required - r.current} ${r.shortLabel} away`)
        .join(' · ');
    }
  }

  return allReqText;
}

// ─── ProgressTrack ────────────────────────────────────────────────────────────
// Renders an animated progress bar with evenly-spaced tier dots and labels.
// `targetFillPct` (0–100) is the resting position; `fillAnim` animates toward it.

const ProgressTrack: React.FC<{
  label: string;
  posLabel: string;
  tierNames: readonly string[];
  currentTierIndex: number;
  targetFillPct: number;
  isDepth?: boolean;
  fillAnim: Animated.Value;
  pulseAnim: Animated.Value;
}> = ({
  label,
  posLabel,
  tierNames,
  currentTierIndex,
  targetFillPct,
  isDepth,
  fillAnim,
  pulseAnim,
}) => {
  const n = tierNames.length;
  const dotsPositions = tierNames.map((_, idx) =>
    n <= 1 ? 0 : (idx / (n - 1)) * 100
  );

  const safeTarget = Math.max(targetFillPct, 0.01);

  const fillWidth = fillAnim.interpolate({
    inputRange: [0, safeTarget],
    outputRange: ['0%', `${targetFillPct}%`],
    extrapolate: 'clamp',
  });

  const cursorScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.3],
  });

  return (
    <View style={styles.trackBlock}>
      <View style={styles.trackHd}>
        <Text style={styles.trackSysLbl}>{label}</Text>
        <Text style={styles.trackPosLbl}>{posLabel}</Text>
      </View>

      <View style={styles.trackBar}>
        <View style={styles.trackBg} />

        <Animated.View style={[styles.trackFillWrap, { width: fillWidth }]}>
          <View style={styles.trackFill} />
        </Animated.View>

        {dotsPositions.map((dotPct, idx) => (
          <View
            key={idx}
            style={[
              isDepth ? styles.trackDotSq : styles.trackDot,
              idx <= currentTierIndex
                ? styles.trackDotReached
                : styles.trackDotUnreached,
              { left: `${dotPct}%` as any },
            ]}
          />
        ))}

        <Animated.View
          style={[
            styles.trackCursor,
            {
              left: `${targetFillPct}%` as any,
              opacity: pulseAnim,
              transform: [{ scale: cursorScale }],
            },
          ]}
        />
      </View>

      <View style={styles.trackLabels}>
        {tierNames.map((name, idx) => (
          <View
            key={name}
            style={[
              styles.trackLabelItem,
              { left: `${dotsPositions[idx]}%` as any },
              idx === n - 1 ? styles.trackLabelItemLast : null,
            ]}
          >
            <View style={styles.trackTick} />
            <Text
              style={[
                styles.trackLabelTxt,
                idx <= currentTierIndex ? styles.trackLabelTxtReached : null,
                idx === currentTierIndex ? styles.trackLabelTxtCurrent : null,
              ]}
            >
              {name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// ─── TierRow ──────────────────────────────────────────────────────────────────

const TierRow: React.FC<{
  tier: { name: string; color: string; copy: string };
  isCurrent: boolean;
  isReached: boolean;
  isNext: boolean;
  achievedDate: string | null;
  requirements: RequirementStatus[];
  isDepth?: boolean;
}> = ({
  tier,
  isCurrent,
  isReached,
  isNext,
  achievedDate,
  requirements,
  isDepth,
}) => {
  const thresholdText = buildTierThresholdText(
    requirements,
    isNext,
    isReached,
    achievedDate
  );

  return (
    <View style={[styles.tierRow, !isReached ? styles.tierRowUnreached : null]}>
      <View
        style={[
          isDepth ? styles.tierDotSq : styles.tierDot,
          {
            backgroundColor: isReached ? tier.color : 'rgba(255,255,255,0.12)',
            borderColor: isReached ? tier.color : 'transparent',
          },
        ]}
      />
      <View style={styles.tierBody}>
        <View style={styles.tierName}>
          <Text style={[styles.tierNameText, { color: tier.color }]}>
            {tier.name}
          </Text>
          {isCurrent ? (
            <Text style={styles.tierBadge}>CURRENT</Text>
          ) : null}
        </View>
        <Text style={styles.tierCopy}>{tier.copy}</Text>
        <Text style={styles.tierThreshold}>{thresholdText}</Text>
      </View>
    </View>
  );
};

// ─── ProgressionSheet ─────────────────────────────────────────────────────────

export const ProgressionSheet: React.FC<ProgressionSheetProps> = ({
  visible,
  onClose,
}) => {
  const progression = useProgressionData();
  const milestoneScopeId = useAuthStore(
    (state) => state.user?.id ?? DEVICE_LOCAL_MILESTONE_SCOPE
  );
  const [milestoneDates, setMilestoneDates] = useState<MilestoneDates>({
    rank: {},
    mark: {},
  });
  const [milestoneDatesLoaded, setMilestoneDatesLoaded] = useState(false);

  const rankFillAnim = useRef(new Animated.Value(0)).current;
  const depthFillAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const rankFillPct = progression.rank.progress * 100;
  const depthFillPct = progression.deepestPractice.empty
    ? 0
    : progression.deepestPractice.progress * 100;

  // The sheet is a read model. Awarding and migration happen in the ledger service,
  // never as a side effect of opening progress UI.
  useEffect(() => {
    if (!visible) return;

    const loadDates = async () => {
      const dates = await getMilestoneDates(milestoneScopeId);
      setMilestoneDates(dates);
      setMilestoneDatesLoaded(true);
    };

    loadDates();
  }, [
    visible,
    milestoneScopeId,
  ]);

  // Animate tracks on open; reset on close
  useEffect(() => {
    if (!visible) {
      rankFillAnim.setValue(0);
      depthFillAnim.setValue(0);
      pulseLoopRef.current?.stop();
      setMilestoneDatesLoaded(false);
      return;
    }

    pulseLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.9,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    );
    pulseLoopRef.current.start();

    const fillTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(rankFillAnim, {
          toValue: rankFillPct,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(depthFillAnim, {
          toValue: depthFillPct,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start();
    }, 200);

    return () => {
      clearTimeout(fillTimer);
    };
  }, [
    visible,
    rankFillPct,
    depthFillPct,
    rankFillAnim,
    depthFillAnim,
    pulseAnim,
  ]);

  const rankTiers = progression.rank.tiers;
  const depthTiers = progression.deepestPractice.tiers;

  const rankCurrentIdx = rankTiers.findIndex((t) => t.isCurrent);
  const depthCurrentIdx = depthTiers.findIndex((t) => t.isCurrent);

  const rankTierNames = rankTiers.map((t) => t.name);
  const depthTierNames = depthTiers.map((t) => t.name);

  const nextRankName = rankTiers.find((t) => !t.isReached)?.name ?? null;
  const nextDepthName = depthTiers.find((t) => !t.isReached)?.name ?? null;

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
          <View style={styles.sheetHandle} />

          <ScrollView
            style={styles.sheetScroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.shHeader}>
              <Text style={styles.shTitle}>Your Progression</Text>
              <Text style={styles.shSub}>Every prime compounds. None are lost.</Text>
            </View>

            {/* Hero: total primes + rank guidance */}
            <View style={styles.shHero}>
              <View>
                <Text style={styles.shPrimeCount}>{progression.totalPrimes}</Text>
                <Text style={styles.shPrimeLbl}>TOTAL PRIMES</Text>
              </View>
              <View style={styles.shAside}>
                <Text style={styles.shAsideName} numberOfLines={4}>
                  {progression.rank.isMax
                    ? 'Highest rank reached'
                    : progression.rank.guidance}
                </Text>
              </View>
            </View>

            {/* Tracks */}
            <View style={styles.shTracks}>
              <ProgressTrack
                label="RANK"
                posLabel={
                  progression.rank.isMax
                    ? 'Sovereign'
                    : nextRankName
                      ? `to ${nextRankName}`
                      : ''
                }
                tierNames={rankTierNames}
                currentTierIndex={rankCurrentIdx >= 0 ? rankCurrentIdx : 0}
                targetFillPct={rankFillPct}
                fillAnim={rankFillAnim}
                pulseAnim={pulseAnim}
              />

              <ProgressTrack
                label="DEEPEST PRACTICE"
                posLabel={
                  progression.deepestPractice.empty
                    ? 'No anchor yet'
                    : nextDepthName
                      ? `to ${nextDepthName}`
                      : 'Maximum depth reached'
                }
                tierNames={depthTierNames}
                currentTierIndex={depthCurrentIdx >= 0 ? depthCurrentIdx : 0}
                targetFillPct={depthFillPct}
                isDepth
                fillAnim={depthFillAnim}
                pulseAnim={pulseAnim}
              />
            </View>

            <View style={styles.shDivider} />

            {/* Rank tier list */}
            <View style={styles.shCopySec}>
              <View style={styles.shCopyHd}>
                <Text style={styles.shCopyTitle}>RANK</Text>
                <Text style={styles.shCopyTagline}>
                  Your standing through depth + consistency
                </Text>
              </View>

              {rankTiers.map((tier, idx) => (
                <TierRow
                  key={tier.name}
                  tier={{
                    name: tier.name,
                    color: tier.color,
                    copy: tier.description,
                  }}
                  isCurrent={tier.isCurrent}
                  isReached={tier.isReached}
                  isNext={
                    !tier.isReached &&
                    idx === (rankCurrentIdx >= 0 ? rankCurrentIdx : 0) + 1
                  }
                  achievedDate={
                    milestoneDatesLoaded
                      ? (milestoneDates.rank[
                          tier.name as keyof typeof milestoneDates.rank
                        ] ?? null)
                      : null
                  }
                  requirements={tier.requirements}
                />
              ))}
            </View>

            <View style={styles.shDivider} />

            {/* Deepest Practice tier list */}
            <View style={styles.shCopySec}>
              <View style={styles.shCopyHd}>
                <Text style={styles.shCopyTitle}>DEEPEST PRACTICE</Text>
                <Text style={styles.shCopyTagline}>
                  {progression.deepestPractice.empty
                    ? 'Your relationship with a symbol'
                    : 'Your relationship with this symbol'}
                </Text>
              </View>

              {depthTiers.map((tier, idx) => (
                <TierRow
                  key={tier.name}
                  tier={{
                    name: tier.name,
                    color: tier.color,
                    copy: tier.description,
                  }}
                  isCurrent={tier.isCurrent}
                  isReached={tier.isReached}
                  isNext={
                    !tier.isReached &&
                    idx === (depthCurrentIdx >= 0 ? depthCurrentIdx : 0) + 1
                  }
                  achievedDate={null}
                  requirements={tier.requirements}
                  isDepth
                />
              ))}
            </View>

            <Text style={styles.shFine}>
              {progression.deepestPractice.empty
                ? 'Forge an Anchor to begin deepening a symbol.'
                : 'Depth on your strongest active Anchor · never resets'}
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  sheet: {
    flex: 1,
    marginTop: 60,
    backgroundColor: '#131c27',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: withAlpha(colors.gold, 0.16),
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: withAlpha(colors.gold, 0.2),
    alignSelf: 'center',
    marginTop: 14,
    marginBottom: 6,
  },
  sheetScroll: {
    flex: 1,
  },
  // Header
  shHeader: {
    marginBottom: 20,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  shTitle: {
    ...typography.h2,
    color: colors.bone,
    marginBottom: 3,
  },
  shSub: {
    ...typography.body,
    fontStyle: 'italic',
    color: withAlpha(colors.bone, 0.78),
  },
  // Hero card
  shHero: {
    marginHorizontal: 20,
    marginBottom: 30,
    paddingHorizontal: 24,
    paddingVertical: 26,
    minHeight: 144,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.15),
    backgroundColor: withAlpha(colors.gold, 0.05),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    gap: 18,
  },
  shPrimeCount: {
    ...typography.h1,
    fontSize: 58,
    color: colors.gold,
    lineHeight: 60,
  },
  shPrimeLbl: {
    ...typography.caption,
    color: colors.silver,
    marginTop: 6,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  shAside: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: 6,
  },
  shAsideName: {
    ...typography.bodySerifItalic,
    fontSize: 14,
    color: colors.gold,
    textAlign: 'right',
    lineHeight: 21,
  },
  // Tracks
  shTracks: {
    paddingHorizontal: 20,
    gap: 20,
    marginBottom: 28,
  },
  trackBlock: {
    gap: 10,
  },
  trackHd: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  trackSysLbl: {
    ...typography.caption,
    color: colors.silver,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  trackPosLbl: {
    ...typography.bodySerifItalic,
    fontSize: 11,
    color: withAlpha(colors.silver, 0.65),
  },
  trackBar: {
    height: 14,
    alignItems: 'center',
  },
  trackBg: {
    ...StyleSheet.absoluteFillObject,
    height: 6,
    borderRadius: 3,
    backgroundColor: withAlpha(colors.bone, 0.06),
  },
  trackFillWrap: {
    ...StyleSheet.absoluteFillObject,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  trackFill: {
    flex: 1,
    backgroundColor: colors.gold,
  },
  trackDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#131c27',
    transform: [{ translateX: -5 }, { translateY: -2 }],
  },
  trackDotSq: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
    borderWidth: 2,
    borderColor: '#131c27',
    transform: [{ translateX: -5 }, { translateY: -2 }],
  },
  trackDotReached: {
    backgroundColor: colors.silver,
  },
  trackDotUnreached: {
    backgroundColor: withAlpha(colors.bone, 0.12),
    borderColor: 'transparent',
  },
  trackCursor: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: '#131c27',
    transform: [{ translateX: -7 }, { translateY: -2 }],
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  trackLabels: {
    position: 'relative',
    height: 36,
    marginTop: 2,
  },
  trackLabelItem: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -15 }],
  },
  trackLabelItemLast: {
    transform: [{ translateX: -30 }],
  },
  trackTick: {
    width: 1,
    height: 5,
    backgroundColor: withAlpha(colors.bone, 0.1),
  },
  trackLabelTxt: {
    ...typography.caption,
    fontSize: 7.5,
    color: withAlpha(colors.silver, 0.3),
    marginTop: 2,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trackLabelTxtReached: {
    color: withAlpha(colors.silver, 0.62),
  },
  trackLabelTxtCurrent: {
    color: colors.gold,
  },
  // Divider
  shDivider: {
    height: 1,
    backgroundColor: withAlpha(colors.bone, 0.06),
    marginVertical: 24,
  },
  // Copy sections
  shCopySec: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  shCopyHd: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
    marginBottom: 14,
  },
  shCopyTitle: {
    ...typography.caption,
    color: colors.silver,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  shCopyTagline: {
    ...typography.bodySerifItalic,
    fontSize: 10,
    color: withAlpha(colors.silver, 0.42),
    textAlign: 'right',
  },
  // Tier rows
  tierRow: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: withAlpha(colors.bone, 0.05),
  },
  tierRowUnreached: {
    opacity: 0.35,
  },
  tierDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    marginTop: 4,
    flexShrink: 0,
  },
  tierDotSq: {
    width: 10,
    height: 10,
    borderRadius: 2,
    borderWidth: 2,
    marginTop: 4,
    flexShrink: 0,
  },
  tierBody: {
    flex: 1,
  },
  tierName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  tierNameText: {
    ...typography.h3,
    fontSize: 14,
  },
  tierBadge: {
    ...typography.caption,
    fontSize: 7.5,
    color: colors.gold,
    backgroundColor: withAlpha(colors.gold, 0.1),
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.22),
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  tierCopy: {
    ...typography.bodySerifItalic,
    fontSize: 13,
    color: withAlpha(colors.silver, 0.74),
    lineHeight: 18,
    marginTop: 2,
  },
  tierThreshold: {
    ...typography.caption,
    fontSize: 9.5,
    color: withAlpha(colors.silver, 0.28),
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  // Footer fine print
  shFine: {
    ...typography.bodySerifItalic,
    fontSize: 11,
    color: withAlpha(colors.silver, 0.32),
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 48,
  },
});
