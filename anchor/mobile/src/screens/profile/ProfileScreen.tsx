import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SvgXml } from 'react-native-svg';
import { OptimizedImage } from '@/components/common';
import { useAuthStore } from '@/stores/authStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { useProfileStore } from '@/stores/profileStore';
import { useToast } from '@/components/ToastProvider';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProgressionSheet } from '@/components/profile/ProgressionSheet';
import { EditProfileSheet } from '@/components/EditProfileSheet';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { useProgressionData } from '@/hooks/useProgressionData';
import { colors, spacing, typography } from '@/theme';
import { withAlpha } from '@/utils/color';
import { apiClient } from '@/services/ApiClient';
import { logger } from '@/utils/logger';
import type { ApiResponse, Anchor, User } from '@/types';

const CARD_RADIUS = 16;
const GRID_GAP = 10;
const TRACK_SEGMENTS = 18;

const MARK_SEAL_XML = `
  <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="22" cy="22" r="17.5" stroke="rgba(212,175,55,0.45)" />
    <circle cx="22" cy="22" r="12.5" stroke="rgba(212,175,55,0.22)" />
    <path d="M22 10.5 L24.7 18.1 L32.8 18.1 L26.2 22.9 L28.7 30.6 L22 25.9 L15.3 30.6 L17.8 22.9 L11.2 18.1 L19.3 18.1 Z" fill="rgba(212,175,55,0.18)" stroke="rgba(212,175,55,0.82)" stroke-width="1.1" />
  </svg>
`;

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

const CardMetaRow: React.FC<{
  label: string;
  showView?: boolean;
}> = ({ label, showView = true }) => (
  <View style={styles.cardMetaRow}>
    <SectionLabel>{label}</SectionLabel>
    {showView ? <Text style={styles.cardViewHint}>VIEW ▾</Text> : null}
  </View>
);

const SegmentedTrack: React.FC<{
  progress: number;
  color: string;
}> = ({ progress, color }) => (
  <View style={styles.segmentRow}>
    {Array.from({ length: TRACK_SEGMENTS }).map((_, index) => (
      <View
        key={index}
        style={[
          styles.segment,
          index < Math.round(progress * TRACK_SEGMENTS)
            ? {
                backgroundColor: color,
                borderColor: withAlpha(color, 0.7),
              }
            : null,
        ]}
      />
    ))}
  </View>
);

const StatCell: React.FC<{ value: string; label: string }> = ({
  value,
  label,
}) => (
  <View style={styles.statCell}>
    <Text style={styles.statCellValue}>{value}</Text>
    <Text style={styles.statCellLabel}>{label}</Text>
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
    anchor.isReleased || anchor.archivedAt || anchor.releasedAt
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

export const ProfileScreen: React.FC = () => {
  const toast = useToast();
  const { width } = useWindowDimensions();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const anchors = useAnchorStore((state) => state.anchors);
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
  const progression = useProgressionData();

  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [progressionSheetVisible, setProgressionSheetVisible] = useState(false);

  useEffect(() => {
    if (user) {
      syncFromUser(user);
    }
  }, [syncFromUser, user]);

  const resolvedName =
    name || user?.displayName || user?.email?.split('@')[0] || 'Practitioner';
  const resolvedAxiom = axiom.trim();
  const resolvedTimezone = timezone;
  const memberSinceDate = memberSince
    ? new Date(memberSince)
    : user?.createdAt
      ? new Date(user.createdAt)
      : null;
  const memberSinceLabel =
    memberSinceDate && !Number.isNaN(memberSinceDate.getTime())
      ? memberSinceDate.toLocaleString('en-US', {
          month: 'short',
          year: 'numeric',
        })
      : 'Now';

  const vaultAnchors = useMemo(
    () =>
      [...anchors].sort(
        (left, right) =>
          new Date(left.createdAt).getTime() -
          new Date(right.createdAt).getTime()
      ),
    [anchors]
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
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

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
          '/api/users/me',
          {
            displayName: updates.name,
          }
        );

        if (response.data?.success && response.data.data) {
          setUser(response.data.data);
        }
      } catch (error) {
        logger.warn(
          '[ProfileScreen] Failed to sync display name remotely',
          error
        );
      }
    }

    setEditSheetOpen(false);
    toast.success('Profile updated');
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
        {/* Hero header */}
        <View style={styles.heroHeader}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatarRingOuter} />
            <View style={styles.avatarRingMid} />
            <View style={styles.avatarGlow} />
            <View style={styles.avatarCircle}>
              <ProfileHeader
                displayName={resolvedName}
                subscriptionStatus={resolvedSubscriptionStatus}
                compact
              />
            </View>
          </View>
          <Text style={styles.heroName}>{resolvedName}</Text>
          <Text style={styles.heroSub}>
            <Text style={styles.heroRankHighlight}>
              {progression.rank.currentName}
            </Text>
            {'  ·  '}
            {`Member since ${memberSinceLabel}`}
          </Text>
          <Pressable
            hitSlop={8}
            onPress={() => setEditSheetOpen(true)}
            style={styles.editButton}
          >
            <Text style={styles.editLabel}>Edit Profile</Text>
          </Pressable>
        </View>

        {/* Rank card */}
        <Pressable onPress={() => setProgressionSheetVisible(true)}>
          <CardShell
            gradient={[
              withAlpha(colors.purple, 0.5),
              withAlpha(colors.navy, 0.94),
            ]}
          >
            <CardMetaRow label="RANK" />
            <Text style={styles.rankName}>{progression.rank.currentName}</Text>
            <View style={styles.rankProgressSection}>
              <View style={styles.rankTrack}>
                <View
                  style={[
                    styles.rankFill,
                    {
                      width: `${Math.min(
                        progression.rank.progress * 100,
                        100
                      )}%` as any,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.rankThumb,
                    {
                      left: `${Math.min(
                        progression.rank.progress * 100,
                        100
                      )}%` as any,
                    },
                  ]}
                />
              </View>
              <View style={styles.milestoneRow}>
                {progression.rank.tiers.map((tier) => (
                  <View key={tier.name} style={styles.milestoneTick}>
                    <View
                      style={[
                        styles.milestoneTickBar,
                        tier.isReached
                          ? styles.milestoneTickBarReached
                          : null,
                        tier.isCurrent
                          ? styles.milestoneTickBarCurrent
                          : null,
                      ]}
                    />
                    <Text
                      style={[
                        styles.milestoneLabel,
                        tier.isReached ? styles.milestoneLabelReached : null,
                        tier.isCurrent ? styles.milestoneLabelCurrent : null,
                      ]}
                    >
                      {tier.name}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.rankCaptionWrap}>
              <Text style={styles.rankCaption}>{progression.rank.guidance}</Text>
            </View>
          </CardShell>
        </Pressable>

        {/* Deepest practice card */}
        <Pressable onPress={() => setProgressionSheetVisible(true)}>
          <CardShell>
            <CardMetaRow label="DEEPEST PRACTICE" />
            {progression.deepestPractice.empty ? (
              <View style={styles.emptyDepthState}>
                <Text style={styles.emptyDepthTitle}>
                  {progression.deepestPractice.title}
                </Text>
                <Text style={styles.emptyDepthSubtitle}>
                  {progression.deepestPractice.subtitle}
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.depthHeaderRow}>
                  <Text
                    style={[
                      styles.depthTierName,
                      { color: progression.deepestPractice.tierColor },
                    ]}
                  >
                    {progression.deepestPractice.tierName}
                  </Text>
                  <View style={styles.depthSigilTile}>
                    {progression.deepestPractice.artworkUri ? (
                      <OptimizedImage
                        uri={progression.deepestPractice.artworkUri}
                        style={styles.depthSigilImage}
                        resizeMode="cover"
                      />
                    ) : progression.deepestPractice.sigilXml ? (
                      <SvgXml
                        xml={progression.deepestPractice.sigilXml}
                        width={36}
                        height={36}
                      />
                    ) : null}
                    <View style={styles.depthSigilBadge}>
                      <Text style={styles.depthSigilBadgeText}>
                        {progression.activeAnchors}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.depthDesc}>
                  {progression.deepestPractice.title}
                </Text>

                <SegmentedTrack
                  progress={progression.deepestPractice.progress}
                  color={progression.deepestPractice.tierColor}
                />

                <View style={styles.depthFooterRow}>
                  <Text style={styles.depthGuidance}>
                    {progression.deepestPractice.guidance}
                  </Text>
                  <View style={styles.depthPrimeCountWrap}>
                    <Text style={styles.depthPrimeCount}>
                      {progression.deepestPractice.stats.primes}
                    </Text>
                    <Text style={styles.depthPrimeCountLabel}>
                      total primes
                    </Text>
                  </View>
                </View>
              </>
            )}
          </CardShell>
        </Pressable>

        {/* Next mark card */}
        <Pressable onPress={() => setProgressionSheetVisible(true)}>
          <CardShell
            gradient={
              progression.nextMark.earned
                ? [withAlpha(colors.gold, 0.08), withAlpha(colors.purple, 0.4)]
                : undefined
            }
          >
            <CardMetaRow label="NEXT MARK" showView={false} />
            <View style={styles.markRow}>
              <View
                style={[
                  styles.markSeal,
                  progression.nextMark.earned ? styles.markSealEarned : null,
                ]}
              >
                <SvgXml xml={MARK_SEAL_XML} width={28} height={28} />
              </View>

              <View style={styles.markCopy}>
                <Text style={styles.markName}>{progression.nextMark.name}</Text>
                <Text style={styles.markSubtitle}>
                  {progression.nextMark.subtitle}
                </Text>
              </View>

              <Text style={styles.markMetric}>
                {`${progression.nextMark.current}/${progression.nextMark.required}`}
              </Text>
            </View>
          </CardShell>
        </Pressable>

        {/* Stats card */}
        <View style={styles.statsCard}>
          <View style={styles.statsInner}>
            <StatCell
              value={String(progression.practiceDays)}
              label={'Practice\nDays'}
            />
            <View style={styles.statDivider} />
            <StatCell
              value={String(progression.totalPrimes)}
              label={'Total\nPrimes'}
            />
            <View style={styles.statDivider} />
            <StatCell
              value={String(progression.activeAnchors)}
              label={'Active\nAnchors'}
            />
          </View>
        </View>

        {/* Vault */}
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
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: withAlpha(colors.purple, 0.18),
  },
  backgroundOrbLeft: {
    top: 72,
    left: -84,
  },
  backgroundOrbRight: {
    top: 260,
    right: -96,
  },
  backgroundDust: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(colors.gold, 0.015),
  },
  // Hero header
  heroHeader: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 20,
  },
  avatarWrap: {
    width: 92,
    height: 92,
    marginBottom: 16,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRingOuter: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.1),
  },
  avatarRingMid: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.38),
  },
  avatarGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: withAlpha(colors.gold, 0.07),
  },
  avatarCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.black,
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.28),
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
  },
  heroName: {
    fontFamily: typography.fonts.heading,
    fontSize: 24,
    letterSpacing: 2.8,
    color: colors.bone,
    marginBottom: 6,
  },
  heroSub: {
    fontFamily: typography.fonts.heading,
    fontSize: 8.5,
    letterSpacing: 2.5,
    color: withAlpha(colors.silver, 0.38),
    marginBottom: 14,
    textTransform: 'uppercase',
  },
  heroRankHighlight: {
    color: withAlpha(colors.gold, 0.5),
  },
  editButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.28),
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: withAlpha(colors.gold, 0.04),
  },
  editLabel: {
    ...typography.caption,
    letterSpacing: 1.8,
    color: withAlpha(colors.gold, 0.72),
    textTransform: 'uppercase',
  },
  // Cards
  cardOuter: {
    position: 'relative',
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.12),
  },
  cardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  cardBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(colors.ritual.glassStrong, 0.92),
  },
  cardShimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: withAlpha(colors.gold, 0.46),
  },
  cardContent: {
    padding: spacing.md,
    gap: 12,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardViewHint: {
    ...typography.caption,
    color: withAlpha(colors.gold, 0.7),
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  sectionLabel: {
    ...typography.caption,
    color: withAlpha(colors.silver, 0.82),
    textTransform: 'uppercase',
    letterSpacing: 1.8,
  },
  // Rank card
  rankName: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 28,
    color: colors.bone,
  },
  rankProgressSection: {
    gap: 8,
  },
  rankTrack: {
    height: 2,
    backgroundColor: withAlpha(colors.white, 0.07),
    borderRadius: 999,
    position: 'relative',
  },
  rankFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
  },
  rankThumb: {
    position: 'absolute',
    top: '50%' as any,
    marginTop: -4.5,
    marginLeft: -4.5,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.gold,
    borderWidth: 1.5,
    borderColor: colors.black,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  milestoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  milestoneTick: {
    alignItems: 'center',
    gap: 4,
  },
  milestoneTickBar: {
    width: 1,
    height: 5,
    backgroundColor: withAlpha(colors.white, 0.1),
  },
  milestoneTickBarReached: {
    backgroundColor: withAlpha(colors.gold, 0.3),
  },
  milestoneTickBarCurrent: {
    backgroundColor: colors.gold,
  },
  milestoneLabel: {
    fontFamily: typography.fonts.heading,
    fontSize: 7.5,
    letterSpacing: 0.5,
    color: withAlpha(colors.silver, 0.28),
    textTransform: 'uppercase',
  },
  milestoneLabelReached: {
    color: withAlpha(colors.gold, 0.45),
  },
  milestoneLabelCurrent: {
    color: colors.gold,
  },
  rankCaptionWrap: {
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: withAlpha(colors.white, 0.05),
  },
  rankCaption: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontStyle: 'italic',
    fontSize: 13,
    color: withAlpha(colors.silver, 0.38),
  },
  // Segmented track (depth card)
  segmentRow: {
    flexDirection: 'row',
    gap: 6,
  },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: withAlpha(colors.bone, 0.08),
    borderWidth: 1,
    borderColor: withAlpha(colors.bone, 0.04),
  },
  // Empty depth state
  emptyDepthState: {
    minHeight: 118,
    justifyContent: 'center',
    gap: 8,
  },
  emptyDepthTitle: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 20,
    color: colors.bone,
  },
  emptyDepthSubtitle: {
    ...typography.body,
    color: withAlpha(colors.bone, 0.78),
  },
  // Depth card
  depthHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  depthTierName: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 24,
    color: colors.bone,
    flex: 1,
  },
  depthSigilTile: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: withAlpha(colors.gold, 0.05),
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.16),
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  depthSigilImage: {
    width: 60,
    height: 60,
    borderRadius: 9,
  },
  depthSigilBadge: {
    position: 'absolute',
    top: -7,
    right: -7,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  depthSigilBadgeText: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 9,
    color: colors.black,
  },
  depthDesc: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 13,
    color: withAlpha(colors.silver, 0.38),
    lineHeight: 20,
  },
  depthFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: withAlpha(colors.white, 0.04),
    gap: 12,
  },
  depthGuidance: {
    ...typography.body,
    color: withAlpha(colors.bone, 0.78),
    flex: 1,
  },
  depthPrimeCountWrap: {
    alignItems: 'flex-end',
    minWidth: 74,
  },
  depthPrimeCount: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 34,
    color: colors.bone,
    lineHeight: 36,
  },
  depthPrimeCountLabel: {
    ...typography.caption,
    color: withAlpha(colors.silver, 0.75),
    textAlign: 'right',
  },
  // Mark card
  markRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  markSeal: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.gold, 0.06),
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.14),
  },
  markSealEarned: {
    shadowColor: colors.gold,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  markCopy: {
    flex: 1,
    gap: 4,
  },
  markName: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 20,
    color: colors.bone,
  },
  markSubtitle: {
    ...typography.body,
    color: withAlpha(colors.bone, 0.78),
  },
  markMetric: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 24,
    color: colors.gold,
  },
  // Stats card
  statsCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.09),
    borderTopColor: withAlpha(colors.gold, 0.22),
    backgroundColor: withAlpha(colors.white, 0.02),
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  statsInner: {
    flexDirection: 'row',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    gap: 5,
  },
  statDivider: {
    width: 1,
    backgroundColor: withAlpha(colors.gold, 0.07),
    marginVertical: 10,
  },
  statCellValue: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 28,
    color: colors.gold,
    lineHeight: 28,
  },
  statCellLabel: {
    fontFamily: typography.fonts.body,
    fontSize: 9.5,
    letterSpacing: 1.2,
    color: withAlpha(colors.silver, 0.38),
    textAlign: 'center',
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  // Vault
  vaultHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: spacing.md,
  },
  vaultHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: withAlpha(colors.gold, 0.12),
  },
  vaultHeaderText: {
    ...typography.caption,
    color: withAlpha(colors.gold, 0.72),
    letterSpacing: 2.2,
  },
  vaultGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  vaultCell: {
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  vaultPlaceholder: {
    backgroundColor: withAlpha(colors.bone, 0.03),
    borderColor: withAlpha(colors.bone, 0.04),
  },
  vaultActiveCell: {
    backgroundColor: withAlpha(colors.ritual.glassStrong, 0.92),
    borderColor: withAlpha(colors.gold, 0.14),
  },
  vaultBurnedCell: {
    backgroundColor: withAlpha(colors.charcoal, 0.8),
    borderColor: withAlpha(colors.bone, 0.08),
  },
  vaultGlow: {
    position: 'absolute',
    width: '72%',
    height: '72%',
    borderRadius: 999,
    backgroundColor: withAlpha(colors.gold, 0.08),
  },
  vaultArtworkWrap: {
    width: '100%',
    height: '100%',
  },
  vaultArtworkWrapBurned: {
    opacity: 0.66,
  },
  vaultArtwork: {
    width: '100%',
    height: '100%',
  },
  vaultBurnedImageWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(colors.black, 0.34),
  },
  vaultSigilWrap: {
    opacity: 0.94,
  },
  vaultSigilWrapBurned: {
    opacity: 0.48,
  },
  emberDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    bottom: 10,
    right: 10,
    backgroundColor: withAlpha(colors.bronze, 0.9),
  },
  vaultFinePrint: {
    ...typography.caption,
    color: withAlpha(colors.silver, 0.74),
    marginTop: spacing.md,
    textAlign: 'center',
  },
  versionText: {
    ...typography.caption,
    color: withAlpha(colors.silver, 0.5),
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
