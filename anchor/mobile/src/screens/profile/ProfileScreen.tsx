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
import * as FileSystem from 'expo-file-system/legacy';
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
import { persistProfilePhoto } from '@/services/ProfileMediaService';
import { logger } from '@/utils/logger';
import type { ApiResponse, Anchor, User } from '@/types';

const CARD_RADIUS = 16;
const GRID_GAP = 10;
const RANK_PIPS = 8;
const DEPTH_SEGMENTS = 20;

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
    {Array.from({ length: DEPTH_SEGMENTS }).map((_, index) => (
      <View
        key={index}
        style={[
          styles.segment,
          index < Math.round(progress * DEPTH_SEGMENTS)
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
  const displayVaultAnchors = useMemo(
    () => (vaultAnchors.length > 16 ? vaultAnchors.slice(-16) : vaultAnchors),
    [vaultAnchors]
  );
  const paddedVaultAnchors = useMemo(() => {
    const remainder = displayVaultAnchors.length % 4;
    const placeholders = remainder === 0 ? 0 : 4 - remainder;
    return [
      ...displayVaultAnchors,
      ...Array.from({ length: placeholders }).map(() => undefined),
    ];
  }, [displayVaultAnchors]);

  const cellSize = Math.floor((width - spacing.lg * 2 - GRID_GAP * 3) / 4);
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const handleSaveProfile = async (updates: {
    name: string;
    axiom: string;
    timezone: string;
    mono: typeof mono;
    photo: string | null;
  }) => {
    const persistedPhoto =
      user?.id != null
        ? await persistProfilePhoto({
            userId: user.id,
            photoUri: updates.photo,
            previousPhotoUri: photo,
          })
        : updates.photo;
    const nextUpdates = {
      ...updates,
      photo: persistedPhoto,
    };

    updateProfile(nextUpdates);

    if (user) {
      const nextUser = { ...user, displayName: nextUpdates.name };
      setUser(nextUser);

      try {
        const body: Record<string, unknown> = {
          displayName: nextUpdates.name,
        };

        if (persistedPhoto) {
          const photoData = await FileSystem.readAsStringAsync(persistedPhoto, {
            encoding: 'base64',
          });
          const mimeType = persistedPhoto.endsWith('.png')
            ? 'image/png'
            : 'image/jpeg';
          body.profilePictureBase64 = `data:${mimeType};base64,${photoData}`;
          body.profilePictureMimeType = mimeType;
        }

        const response = await apiClient.patch<ApiResponse<User>>(
          '/api/users/me',
          body
        );

        if (response.data?.success && response.data.data) {
          setUser(response.data.data);
        }
      } catch (error) {
        logger.warn(
          '[ProfileScreen] Failed to sync profile remotely',
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
            <View style={styles.rankHead}>
              <Text style={styles.rankName}>{progression.rank.currentName}</Text>
              {!progression.rank.isMax ? (
                <Text style={styles.rankNext}>{progression.rank.guidance}</Text>
              ) : null}
            </View>
            <View style={styles.pipRow}>
              {Array.from({ length: RANK_PIPS }).map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.pip,
                    index < Math.round(progression.rank.progress * RANK_PIPS)
                      ? styles.pipOn
                      : null,
                  ]}
                />
              ))}
            </View>
            <View style={styles.rankSpine}>
              <View style={styles.rankTierRow}>
                {(['Initiate', 'Practitioner', 'Architect', 'Sovereign'] as const).map((name) => (
                  <Text
                    key={name}
                    style={[
                      styles.rankTierText,
                      name === progression.rank.currentName ? styles.rankTierTextActive : null,
                    ]}
                  >
                    {name}
                  </Text>
                ))}
              </View>
            </View>
          </CardShell>
        </Pressable>

        {/* Deepest Practice card */}
        <Pressable onPress={() => setProgressionSheetVisible(true)}>
          <CardShell>
            <CardMetaRow label="DEEPEST PRACTICE" />
            {progression.deepestPractice.empty ? (
              <View style={styles.emptyDepthState}>
                <Text style={styles.emptyDepthTitle}>{progression.deepestPractice.title}</Text>
                <Text style={styles.emptyDepthSubtitle}>{progression.deepestPractice.subtitle}</Text>
              </View>
            ) : (
              <>
                <View style={styles.depthHead}>
                  <View style={styles.depthLevelWrap}>
                    <Text
                      style={[
                        styles.depthLevel,
                        { color: progression.deepestPractice.tierColor },
                      ]}
                    >
                      {progression.deepestPractice.tierName}
                    </Text>
                    <Text style={styles.depthAnchorTitle} numberOfLines={1}>
                      {progression.deepestPractice.title}
                    </Text>
                  </View>
                  <View style={styles.depthPrimeWrap}>
                    <Text style={styles.depthPrimeBig}>
                      {progression.deepestPractice.stats.primes}
                    </Text>
                    <Text style={styles.depthPrimeSub}>{'primes on\nthis Anchor'}</Text>
                  </View>
                </View>

                <SegmentedTrack
                  progress={progression.deepestPractice.progress}
                  color={progression.deepestPractice.tierColor}
                />

                <Text style={styles.depthHint}>{progression.deepestPractice.guidance}</Text>
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

        <Text style={styles.vaultFinePrint}>Each mark is permanent.</Text>

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
  rankHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 13,
  },
  rankName: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 26,
    color: colors.silver,
    lineHeight: 28,
  },
  rankNext: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontStyle: 'italic',
    fontSize: 12,
    color: withAlpha(colors.silver, 0.82),
    textAlign: 'right',
    flex: 1,
  },
  pipRow: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 10,
  },
  pip: {
    flex: 1,
    height: 3,
    borderRadius: 999,
    backgroundColor: withAlpha(colors.white, 0.07),
  },
  pipOn: {
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  rankSpine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rankTierRow: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'space-between',
    marginRight: 8,
    gap: 4,
  },
  rankTierText: {
    fontFamily: typography.fonts.heading,
    fontSize: 8,
    letterSpacing: 0.6,
    color: withAlpha(colors.silver, 0.48),
    textTransform: 'uppercase',
  },
  rankTierTextActive: {
    color: colors.gold,
  },
  rankPrimeLbl: {
    fontFamily: typography.fonts.heading,
    fontSize: 10,
    color: withAlpha(colors.gold, 0.45),
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
  // Depth card
  depthHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  depthLevel: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 24,
    lineHeight: 28,
  },
  depthPrimeWrap: {
    alignItems: 'flex-end',
    paddingTop: 4,
  },
  depthPrimeBig: {
    fontFamily: typography.fontFamily.serifBold,
    fontSize: 28,
    color: colors.gold,
    lineHeight: 32,
    fontWeight: '700' as any,
  },
  depthPrimeSub: {
    ...typography.caption,
    color: withAlpha(colors.silver, 0.48),
    marginTop: 2,
    textAlign: 'right',
  },
  depthFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  depthHint: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontStyle: 'italic',
    fontSize: 12,
    color: withAlpha(colors.silver, 0.82),
    flex: 1,
  },
  depthStatWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  depthStat: {
    alignItems: 'center',
    minWidth: 34,
  },
  depthStatVal: {
    fontFamily: typography.fonts.heading,
    fontSize: 14,
    color: colors.gold,
    lineHeight: 16,
  },
  depthStatValMuted: {
    color: withAlpha(colors.silver, 0.52),
  },
  depthStatLbl: {
    ...typography.caption,
    fontSize: 9,
    color: withAlpha(colors.silver, 0.48),
    letterSpacing: 0.5,
    marginTop: 2,
  },
  depthStatDiv: {
    width: 1,
    height: 22,
    backgroundColor: withAlpha(colors.white, 0.06),
  },
  depthFine: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontStyle: 'italic',
    fontSize: 10,
    color: withAlpha(colors.silver, 0.48),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: withAlpha(colors.white, 0.05),
    paddingTop: 10,
  },
  depthLevelWrap: {
    flex: 1,
    marginRight: 8,
  },
  depthAnchorTitle: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontStyle: 'italic',
    fontSize: 11,
    color: withAlpha(colors.silver, 0.52),
    marginTop: 2,
  },
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
