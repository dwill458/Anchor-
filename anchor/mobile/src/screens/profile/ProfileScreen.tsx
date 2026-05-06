import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { SvgXml } from "react-native-svg";
import { OptimizedImage } from "@/components/common";
import { useAuthStore } from "@/stores/authStore";
import { useAnchorStore } from "@/stores/anchorStore";
import { useProfileStore } from "@/stores/profileStore";
import { useToast } from "@/components/ToastProvider";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProgressionSheet } from "@/components/profile/ProgressionSheet";
import { EditProfileSheet } from "@/components/EditProfileSheet";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { colors, spacing, typography } from "@/theme";
import { withAlpha } from "@/utils/color";
import {
  getDepthLevel,
  getDepthProgress,
  getNextDepthLevel,
} from "@/utils/practiceDepth";
import {
  getCurrentRank,
  getNextRank,
  getRankProgress,
  RANK_TIERS,
} from "@/utils/practiceRank";
import { apiClient } from "@/services/ApiClient";
import { logger } from "@/utils/logger";
import type { ApiResponse, Anchor, User } from "@/types";

const RANK_PIPS = 8;
const DEPTH_SEGMENTS = 20;
const CARD_RADIUS = 16;
const GRID_GAP = 10;

const CardShell: React.FC<{
  children: React.ReactNode;
  gradient?: readonly [string, string, ...string[]];
}> = ({ children, gradient }) => (
  <View style={styles.cardOuter}>
    {gradient ? (
      <LinearGradient
        colors={[...gradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardGradient}
      />
    ) : (
      <View style={styles.cardBackground} />
    )}
    <View style={styles.cardShimmer} />
    <View style={styles.cardContent}>{children}</View>
  </View>
);

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <Text style={styles.sectionLabel}>{children}</Text>;

const StatTile: React.FC<{ value: string; label: string }> = ({
  value,
  label,
}) => (
  <View style={styles.statTile}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const VaultCell: React.FC<{
  anchor?: Anchor;
  size: number;
}> = ({ anchor, size }) => {
  if (!anchor) {
    return (
      <View
        style={[
          styles.vaultCell,
          styles.vaultPlaceholder,
          { width: size, height: size },
        ]}
      />
    );
  }

  const isBurned = Boolean(
    anchor.isReleased || anchor.archivedAt || anchor.releasedAt,
  );
  const sigilXml = anchor.reinforcedSigilSvg || anchor.baseSigilSvg;
  const enhancedImageUrl = anchor.enhancedImageUrl;

  return (
    <View
      style={[
        styles.vaultCell,
        isBurned ? styles.vaultBurnedCell : styles.vaultActiveCell,
        { width: size, height: size },
      ]}
    >
      {!isBurned ? <View style={styles.vaultGlow} /> : null}
      {enhancedImageUrl ? (
        <View
          style={[
            styles.vaultArtworkWrap,
            isBurned ? styles.vaultArtworkWrapBurned : null,
          ]}
        >
          <OptimizedImage
            uri={enhancedImageUrl}
            style={styles.vaultArtwork}
            resizeMode="cover"
          />
          {isBurned ? <View style={styles.vaultBurnedImageWash} /> : null}
        </View>
      ) : (
        <View
          style={[
            styles.vaultSigilWrap,
            isBurned ? styles.vaultSigilWrapBurned : null,
          ]}
        >
          <SvgXml
            xml={sigilXml}
            width={Math.round(size * 0.58)}
            height={Math.round(size * 0.58)}
          />
        </View>
      )}
      {isBurned ? <View style={styles.emberDot} /> : null}
    </View>
  );
};

const ConstancyBlock: React.FC<{
  earned: boolean;
  currentStreak: number;
}> = ({ earned, currentStreak }) => (
  <CardShell
    gradient={
      earned
        ? [withAlpha(colors.gold, 0.08), withAlpha(colors.purple, 0.42)]
        : undefined
    }
  >
    <View style={styles.constancyRow}>
      <View
        style={[
          styles.constancySeal,
          earned ? styles.constancySealEarned : styles.constancySealLocked,
        ]}
      >
        {earned ? (
          <SvgXml
            xml={`
              <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="14" stroke="${colors.gold}" stroke-width="1" opacity="0.5" />
                <path d="M20 6 L22 17 L33 17 L24 24 L27 35 L20 28 L13 35 L16 24 L7 17 L18 17 Z" stroke="${colors.gold}" stroke-width="1.2" fill="rgba(212,175,55,0.15)" />
              </svg>
            `}
            width={22}
            height={22}
          />
        ) : (
          <Text style={styles.constancyQuestion}>?</Text>
        )}
      </View>

      <View style={styles.constancyCopy}>
        <Text
          style={[
            styles.constancyLabel,
            earned ? styles.constancyLabelEarned : null,
          ]}
        >
          CONSTANCY MARK
        </Text>
        <Text
          style={[
            styles.constancyText,
            earned ? styles.constancyTextEarned : null,
          ]}
        >
          {earned
            ? "100 Days of Practice"
            : "Forged at 100 consecutuve days primed"}
        </Text>
      </View>

      <Text
        style={[
          styles.constancyMetric,
          earned ? styles.constancyMetricEarned : null,
        ]}
      >
        {earned ? "Earned" : `${Math.min(currentStreak, 100)}/100`}
      </Text>
    </View>
  </CardShell>
);

export const ProfileScreen: React.FC = () => {
  const toast = useToast();
  const { width } = useWindowDimensions();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const anchors = useAnchorStore((state) => state.anchors);
  const storedTotalPrimes = useAnchorStore((state) => state.totalPrimes);
  const primeStreak = useAnchorStore((state) => state.primeStreak);
  const {
    name,
    axiom,
    timezone,
    mono,
    photo,
    memberSince,
    updateProfile,
    syncFromUser,
  } = useProfileStore();

  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [progressionSheetVisible, setProgressionSheetVisible] = useState(false);

  useEffect(() => {
    if (user) {
      syncFromUser(user);
    }
  }, [syncFromUser, user]);

  const lifetimePrimesFromAnchors = useMemo(
    () =>
      anchors.reduce((sum, anchor) => sum + (anchor.activationCount ?? 0), 0),
    [anchors],
  );
  const totalPrimes = Math.max(storedTotalPrimes, lifetimePrimesFromAnchors);
  const anchorsForged = anchors.length;
  const activeAnchors = anchors.filter(
    (anchor) => !anchor.isReleased && !anchor.archivedAt,
  ).length;
  const releasedAnchors = anchors.filter(
    (anchor) => anchor.isReleased || anchor.archivedAt,
  ).length;
  const currentStreak = user?.currentStreak ?? 0;
  const longestStreak = user?.longestStreak ?? 0;
  const constancyEarned = longestStreak >= 100;

  const rank = getCurrentRank(totalPrimes);
  const nextRank = getNextRank(totalPrimes);
  const rankProgress = getRankProgress(totalPrimes);
  const depth = getDepthLevel(totalPrimes);
  const nextDepth = getNextDepthLevel(totalPrimes);
  const depthProgress = getDepthProgress(totalPrimes);
  const isCompactProfileLayout = width < 420;
  const identityTextMaxWidth = isCompactProfileLayout ? undefined : 220;

  const resolvedName =
    name || user?.displayName || user?.email?.split("@")[0] || "Practitioner";
  const resolvedAxiom = axiom.trim();
  const resolvedTimezone = timezone;
  const memberSinceDate = memberSince
    ? new Date(memberSince)
    : user?.createdAt
      ? new Date(user.createdAt)
      : null;
  const memberSinceLabel =
    memberSinceDate && !Number.isNaN(memberSinceDate.getTime())
      ? memberSinceDate.toLocaleString("en-US", {
          month: "short",
          year: "numeric",
        })
      : "Now";

  const vaultAnchors = useMemo(
    () =>
      [...anchors].sort(
        (left, right) =>
          new Date(left.createdAt).getTime() -
          new Date(right.createdAt).getTime(),
      ),
    [anchors],
  );
  const paddedVaultAnchors = useMemo(() => {
    const remainder = vaultAnchors.length % 4;
    const placeholders = remainder === 0 ? 0 : 4 - remainder;
    return [
      ...vaultAnchors,
      ...Array.from({ length: placeholders }).map(() => undefined),
    ];
  }, [vaultAnchors]);

  const cellSize = Math.floor((width - spacing.lg * 2 - GRID_GAP * 3) / 4);
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";

  const handleSaveProfile = async (updates: {
    name: string;
    axiom: string;
    timezone: string;
    mono: typeof mono;
    photo: string | null;
  }) => {
    updateProfile(updates);

    if (user) {
      const nextUser = { ...user, displayName: updates.name };
      setUser(nextUser);

      try {
        const response = await apiClient.patch<ApiResponse<User>>(
          "/api/users/me",
          {
            displayName: updates.name,
          },
        );

        if (response.data?.success && response.data.data) {
          setUser(response.data.data);
        }
      } catch (error) {
        logger.warn(
          "[ProfileScreen] Failed to sync display name remotely",
          error,
        );
      }
    }

    setEditSheetOpen(false);
    toast.success("Profile updated");
  };

  const { isSubscribed } = useTrialStatus();
  const resolvedSubscriptionStatus = isSubscribed ? 'pro' : 'free';

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <LinearGradient
        colors={[colors.black, colors.navy]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={[styles.backgroundOrb, styles.backgroundOrbLeft]} />
      <View style={[styles.backgroundOrb, styles.backgroundOrbRight]} />
      <View style={styles.backgroundDust} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.identityRow,
            isCompactProfileLayout ? styles.identityRowCompact : null,
          ]}
        >
          <ProfileHeader
            displayName={resolvedName}
            subscriptionStatus={resolvedSubscriptionStatus}
          />

          <View
            style={[
              styles.identityTextWrap,
              isCompactProfileLayout ? styles.identityTextWrapCompact : null,
              identityTextMaxWidth ? { maxWidth: identityTextMaxWidth } : null,
            ]}
          >
            <Text style={styles.identityName}>
              {resolvedName}
            </Text>
            {resolvedAxiom ? (
              <Text style={styles.identityAxiom}>
                {resolvedAxiom}
              </Text>
            ) : null}
            <Text style={styles.memberSince}>{`Member since ${memberSinceLabel}`}</Text>
            <Pressable
              hitSlop={8}
              onPress={() => setEditSheetOpen(true)}
              style={styles.editButton}
            >
              <Text style={styles.editLabel}>Edit</Text>
            </Pressable>
          </View>
        </View>

        <Pressable onPress={() => setProgressionSheetVisible(true)}>
          <CardShell
            gradient={[
              withAlpha(colors.purple, 0.54),
              withAlpha(colors.navy, 0.92),
            ]}
          >
            <Text style={styles.cardViewHint}>VIEW ▾</Text>
            <SectionLabel>RANK</SectionLabel>
            <View style={styles.rankHeaderRow}>
              <Text style={[styles.rankName, { color: rank.color }]}>
                {rank.name}
              </Text>
              <Text style={styles.rankNextText}>
                {nextRank
                  ? `${nextRank.name} at ${nextRank.minPrimes} primes →`
                  : "Highest rank reached"}
              </Text>
            </View>
            <View style={styles.rankPipRow}>
              {Array.from({ length: RANK_PIPS }).map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.rankPip,
                    index < Math.round(rankProgress * RANK_PIPS)
                      ? styles.rankPipFilled
                      : null,
                  ]}
                />
              ))}
            </View>
            <View style={styles.rankSpineRow}>
              <View style={styles.rankTierRow}>
                {RANK_TIERS.map((tier) => (
                  <Text
                    key={tier.name}
                    style={[
                      styles.rankTierText,
                      tier.name === rank.name ? styles.rankTierTextActive : null,
                    ]}
                  >
                    {tier.name}
                  </Text>
                ))}
              </View>
              <Text style={styles.rankCountLabel}>{`${totalPrimes}p`}</Text>
            </View>
          </CardShell>
        </Pressable>

        <Pressable onPress={() => setProgressionSheetVisible(true)}>
          <CardShell>
            <Text style={styles.cardViewHint}>VIEW ▾</Text>
            <SectionLabel>PRACTICE DEPTH</SectionLabel>
            <View style={styles.depthHeaderRow}>
              <View>
                <Text style={[styles.depthLevelName, { color: depth.color }]}>
                  {depth.label}
                </Text>
              </View>
              <View style={styles.depthPrimeCountWrap}>
                <Text style={styles.depthPrimeCount}>{totalPrimes}</Text>
                <Text style={styles.depthPrimeCountLabel}>total primes</Text>
              </View>
            </View>

            <View style={styles.depthProgressRow}>
              {Array.from({ length: DEPTH_SEGMENTS }).map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.depthSegment,
                    index < Math.round(depthProgress * DEPTH_SEGMENTS)
                      ? { backgroundColor: depth.color, shadowColor: depth.color }
                      : null,
                  ]}
                />
              ))}
            </View>

            <View style={styles.depthFooterRow}>
              <Text style={styles.depthHint}>
                {nextDepth
                  ? `${nextDepth.minPrimes - totalPrimes} primes to ${nextDepth.label}`
                  : "Maximum depth reached"}
              </Text>

              <View style={styles.depthStatsWrap}>
                <View style={styles.depthStatItem}>
                  <Text style={styles.depthStatValue}>{anchorsForged}</Text>
                  <Text style={styles.depthStatLabel}>forged</Text>
                </View>
                <View style={styles.depthDivider} />
                <View style={styles.depthStatItem}>
                  <Text
                    style={[styles.depthStatValue, styles.depthStatValueMuted]}
                  >
                    {releasedAnchors}
                  </Text>
                  <Text style={styles.depthStatLabel}>released</Text>
                </View>
              </View>
            </View>

            <View style={styles.depthFinePrintRow}>
              <Text style={styles.depthFinePrint}>
                Cumulative across all anchors · never resets
              </Text>
            </View>
          </CardShell>
        </Pressable>

        <ConstancyBlock
          earned={constancyEarned}
          currentStreak={currentStreak}
        />

        <View style={styles.statsRow}>
          <StatTile value={String(primeStreak)} label={"Thread\nStrength"} />
          <StatTile value={String(totalPrimes)} label={"Total\nPrimes"} />
          <StatTile value={String(activeAnchors)} label={"Active\nAnchors"} />
        </View>

        <View style={styles.vaultHeaderRow}>
          <View style={styles.vaultHeaderLine} />
          <Text style={styles.vaultHeaderText}>THE VAULT</Text>
          <View style={styles.vaultHeaderLine} />
        </View>

        <View style={styles.vaultGrid}>
          {paddedVaultAnchors.map((anchor, index) => (
            <VaultCell
              key={anchor ? anchor.id : `placeholder-${index}`}
              anchor={anchor}
              size={cellSize}
            />
          ))}
        </View>

        <Text style={styles.vaultFinePrint}>
          Each mark is permanent. The intention released.
        </Text>

        {/* DEFERRED: moved to PracticeScreen only */}

        <Text style={styles.versionText}>{`Version ${appVersion}`}</Text>
      </ScrollView>

      <EditProfileSheet
        open={editSheetOpen}
        profile={{
          name: resolvedName,
          axiom: resolvedAxiom,
          timezone: resolvedTimezone,
          mono,
          photo,
        }}
        onClose={() => setEditSheetOpen(false)}
        onSave={handleSaveProfile}
      />
      <ProgressionSheet
        visible={progressionSheetVisible}
        onClose={() => setProgressionSheetVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 44,
  },
  backgroundOrb: {
    position: "absolute",
    borderRadius: 999,
  },
  backgroundOrbLeft: {
    width: 260,
    height: 220,
    left: -60,
    top: 10,
    backgroundColor: withAlpha(colors.purple, 0.34),
  },
  backgroundOrbRight: {
    width: 220,
    height: 180,
    right: -70,
    top: 110,
    backgroundColor: withAlpha(colors.gold, 0.05),
  },
  backgroundDust: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(colors.white, 0.01),
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  identityRowCompact: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: spacing.sm,
  },
  identityTextWrap: {
    flexShrink: 1,
    minWidth: 0,
    paddingTop: 6,
  },
  identityTextWrapCompact: {
    width: "100%",
    paddingTop: 0,
    paddingHorizontal: spacing.md,
  },
  identityName: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 24,
    color: colors.bone,
    letterSpacing: 0.4,
    lineHeight: 30,
  },
  identityAxiom: {
    marginTop: 4,
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 13,
    color: withAlpha(colors.gold, 0.62),
    lineHeight: 18,
  },
  memberSince: {
    marginTop: 4,
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: withAlpha(colors.silver, 0.42),
    letterSpacing: 0.8,
    lineHeight: 15,
  },
  editButton: {
    marginTop: 8,
    alignSelf: "flex-start",
  },
  editLabel: {
    fontFamily: typography.fonts.heading,
    fontSize: 12,
    color: withAlpha(colors.gold, 0.7),
    letterSpacing: 1.1,
  },
  cardOuter: {
    marginBottom: spacing.md,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.1),
    overflow: "hidden",
  },
  cardBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(colors.white, 0.03),
  },
  cardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  cardShimmer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: withAlpha(colors.gold, 0.28),
  },
  cardContent: {
    position: "relative",
    paddingHorizontal: spacing.md,
    paddingVertical: 16,
  },
  cardViewHint: {
    position: "absolute",
    top: 16,
    right: spacing.md,
    fontFamily: typography.fonts.heading,
    fontSize: 10,
    color: withAlpha(colors.gold, 0.5),
    letterSpacing: 1,
  },
  sectionLabel: {
    fontFamily: typography.fonts.heading,
    fontSize: 9,
    color: colors.gold,
    letterSpacing: 2.5,
    marginBottom: 6,
  },
  rankHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: 12,
  },
  rankName: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 24,
  },
  rankNextText: {
    flexShrink: 1,
    textAlign: "right",
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 12,
    color: withAlpha(colors.silver, 0.56),
  },
  rankPipRow: {
    flexDirection: "row",
    gap: 5,
    marginBottom: 10,
  },
  rankPip: {
    flex: 1,
    height: 3,
    borderRadius: 999,
    backgroundColor: withAlpha(colors.white, 0.08),
  },
  rankPipFilled: {
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 3,
  },
  rankSpineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rankTierRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginRight: spacing.sm,
  },
  rankTierText: {
    fontFamily: typography.fonts.heading,
    fontSize: 8,
    color: withAlpha(colors.silver, 0.3),
    letterSpacing: 0.8,
  },
  rankTierTextActive: {
    color: colors.gold,
  },
  rankCountLabel: {
    fontFamily: typography.fonts.heading,
    fontSize: 10,
    color: withAlpha(colors.gold, 0.48),
  },
  depthHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  depthLevelName: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 22,
    lineHeight: 28,
  },
  depthPrimeCountWrap: {
    alignItems: "flex-end",
    minWidth: 74,
    paddingTop: 6,
  },
  depthPrimeCount: {
    fontFamily: typography.fonts.heading,
    fontSize: 30,
    lineHeight: 32,
    color: colors.gold,
  },
  depthPrimeCountLabel: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    color: withAlpha(colors.silver, 0.4),
    letterSpacing: 0.8,
    marginTop: 2,
  },
  depthProgressRow: {
    flexDirection: "row",
    gap: 3,
    marginBottom: 10,
  },
  depthSegment: {
    flex: 1,
    height: 3,
    borderRadius: 999,
    backgroundColor: withAlpha(colors.white, 0.06),
  },
  depthFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  depthHint: {
    flex: 1,
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 12,
    color: withAlpha(colors.silver, 0.54),
  },
  depthStatsWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  depthStatItem: {
    alignItems: "center",
    minWidth: 36,
  },
  depthStatValue: {
    fontFamily: typography.fonts.heading,
    fontSize: 14,
    color: colors.gold,
  },
  depthStatValueMuted: {
    color: withAlpha(colors.silver, 0.56),
  },
  depthStatLabel: {
    fontFamily: typography.fonts.body,
    fontSize: 9,
    color: withAlpha(colors.silver, 0.34),
    letterSpacing: 0.6,
  },
  depthDivider: {
    width: 1,
    height: 22,
    backgroundColor: withAlpha(colors.white, 0.06),
  },
  depthFinePrintRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: withAlpha(colors.white, 0.06),
  },
  depthFinePrint: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 10,
    color: withAlpha(colors.silver, 0.28),
  },
  constancyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  constancySeal: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  constancySealLocked: {
    backgroundColor: withAlpha(colors.white, 0.03),
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: withAlpha(colors.silver, 0.24),
  },
  constancySealEarned: {
    backgroundColor: withAlpha(colors.gold, 0.14),
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.3),
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 4,
  },
  constancyQuestion: {
    fontFamily: typography.fonts.heading,
    fontSize: 18,
    color: withAlpha(colors.silver, 0.34),
  },
  constancyCopy: {
    flex: 1,
  },
  constancyLabel: {
    fontFamily: typography.fonts.heading,
    fontSize: 9,
    letterSpacing: 2.5,
    color: withAlpha(colors.silver, 0.34),
    marginBottom: 4,
  },
  constancyLabelEarned: {
    color: withAlpha(colors.gold, 0.72),
  },
  constancyText: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 12,
    color: withAlpha(colors.silver, 0.4),
  },
  constancyTextEarned: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 13,
    color: colors.bone,
  },
  constancyMetric: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    color: withAlpha(colors.silver, 0.44),
  },
  constancyMetricEarned: {
    fontFamily: typography.fonts.heading,
    fontSize: 9,
    color: withAlpha(colors.gold, 0.58),
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statTile: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.09),
    backgroundColor: withAlpha(colors.white, 0.03),
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  statValue: {
    fontFamily: typography.fonts.heading,
    fontSize: 22,
    color: colors.gold,
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: withAlpha(colors.silver, 0.5),
    textAlign: "center",
    lineHeight: 15,
  },
  vaultHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  vaultHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: withAlpha(colors.gold, 0.08),
  },
  vaultHeaderText: {
    fontFamily: typography.fonts.heading,
    fontSize: 9,
    color: withAlpha(colors.gold, 0.45),
    letterSpacing: 2.4,
  },
  vaultGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
  },
  vaultCell: {
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  vaultActiveCell: {
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.22),
    backgroundColor: withAlpha(colors.gold, 0.06),
  },
  vaultBurnedCell: {
    borderWidth: 1,
    borderColor: withAlpha(colors.white, 0.06),
    backgroundColor: withAlpha(colors.white, 0.02),
  },
  vaultPlaceholder: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: withAlpha(colors.white, 0.05),
    backgroundColor: withAlpha(colors.white, 0.01),
  },
  vaultGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(colors.gold, 0.05),
  },
  vaultSigilWrap: {
    opacity: 1,
  },
  vaultSigilWrapBurned: {
    opacity: 0.18,
  },
  vaultArtworkWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  vaultArtworkWrapBurned: {
    opacity: 0.24,
  },
  vaultArtwork: {
    width: "100%",
    height: "100%",
  },
  vaultBurnedImageWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(colors.silver, 0.18),
  },
  emberDot: {
    position: "absolute",
    right: 5,
    bottom: 5,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(200, 90, 30, 0.6)",
    shadowColor: "rgba(200, 90, 30, 0.9)",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 3,
  },
  vaultFinePrint: {
    marginTop: 12,
    marginBottom: spacing.xl,
    textAlign: "center",
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 11,
    color: withAlpha(colors.silver, 0.24),
  },
  versionText: {
    textAlign: "center",
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: withAlpha(colors.silver, 0.2),
    letterSpacing: 1,
  },
});
