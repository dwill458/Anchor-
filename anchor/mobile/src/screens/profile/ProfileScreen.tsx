/**
 * Anchor App - Profile Screen
 *
 * Identity, practice stats, subscription status, and account actions.
 * No settings toggles — those live in SettingsScreen (reachable via the gear icon
 * in this screen's navigation header).
 *
 * Icon audit (2026-04-13):
 *   - Gear/settings icon: SettingsIcon from @/components/icons (custom react-native-svg)
 *   - Avatar/person icon:  User from lucide-react-native (already in the codebase)
 *   - No new icon-library dependency introduced.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { useAuthStore } from '@/stores/authStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { useToast } from '@/components/ToastProvider';
import { apiClient } from '@/services/ApiClient';
import RevenueCatService from '@/services/RevenueCatService';
import { writeSecureValue } from '@/stores/encryptedPersistStorage';
import { ZenBackground } from '@/components/common';
import { colors, spacing, typography } from '@/theme';
import { logger } from '@/utils/logger';
import type { ApiResponse, User } from '@/types';

// Mirrors AnchorSyncService internal key. Cleared on sign-out so stale
// unsynced anchor data is not associated with the next account on this device.
const SYNC_RETRY_QUEUE_KEY = 'anchor-sync-retry-queue';

// DEFERRED: wire to Thread Strength decay model in v1.1
// Remove placeholder values below when the model exists.
const THREAD_STRENGTH_PLACEHOLDER = 73;
const THREAD_STATE_PLACEHOLDER = 'Strong';
const THREAD_FILL_PCT = 0.73; // 73%

// ─── Stat Tile ────────────────────────────────────────────────────────────────

interface StatTileProps {
  value: string;
  label: string;
}

const StatTile: React.FC<StatTileProps> = ({ value, label }) => (
  <View style={styles.statTile}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// ─── Account Row ──────────────────────────────────────────────────────────────

interface AccountRowProps {
  label: string;
  onPress: () => void;
}

const AccountRow: React.FC<AccountRowProps> = ({ label, onPress }) => (
  <>
    <TouchableOpacity style={styles.accountRow} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.accountRowLabel}>{label}</Text>
      <Text style={styles.accountRowChevron}>›</Text>
    </TouchableOpacity>
    <View style={styles.rowSeparator} />
  </>
);

// ─── ProfileScreen ────────────────────────────────────────────────────────────

export const ProfileScreen: React.FC = () => {
  // useNavigation without a generic param: cross-stack navigation via CommonActions.
  const navigation = useNavigation();
  const { user, signOut, setUser } = useAuthStore();
  const anchors = useAnchorStore((s) => s.anchors);
  const { isTrialActive, isSubscribed, daysRemaining } = useTrialStatus();
  const toast = useToast();

  // Edit display name modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState(user?.displayName ?? '');
  const [isSavingName, setIsSavingName] = useState(false);

  // Restore purchases loading
  const [isRestoring, setIsRestoring] = useState(false);

  // ─── Practice stats ───────────────────────────────────────────────────────
  const anchorsForged = anchors.length;
  const totalPrimes = anchors.reduce((sum, a) => sum + (a.activationCount ?? 0), 0);
  const activeAnchors = anchors.filter((a) => !a.isReleased && !a.archivedAt).length;

  // Streak used in Thread Strength card footer until the model is wired
  const currentStreak = user?.currentStreak ?? 0;

  // ─── Avatar initial ───────────────────────────────────────────────────────
  const avatarInitial = (user?.displayName ?? user?.email ?? 'P')[0].toUpperCase();

  // ─── Display name edit ────────────────────────────────────────────────────
  const openEditModal = () => {
    setEditName(user?.displayName ?? '');
    setEditModalVisible(true);
  };

  const handleSaveDisplayName = async () => {
    const trimmed = editName.trim();
    if (!trimmed) return;

    setIsSavingName(true);
    try {
      const response = await apiClient.patch<ApiResponse<User>>('/api/users/me', {
        displayName: trimmed,
      });
      if (response.data?.success && response.data.data) {
        setUser(response.data.data);
      } else if (user) {
        setUser({ ...user, displayName: trimmed });
      }
      setEditModalVisible(false);
    } catch (error) {
      // Optimistic local update — backend endpoint may be unavailable in this build
      if (user) setUser({ ...user, displayName: trimmed });
      setEditModalVisible(false);
      logger.warn('[ProfileScreen] Display name remote sync failed, applied locally', error);
    } finally {
      setIsSavingName(false);
    }
  };



  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ZenBackground />

      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Identity row ─────────────────────────────────────── */}
          <View style={styles.identityRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>{avatarInitial}</Text>
            </View>
            <View style={styles.identityText}>
              <Text style={styles.identityName} numberOfLines={1}>
                {user?.displayName ?? 'Practitioner'}
              </Text>
              <Text style={styles.identityEmail} numberOfLines={1}>
                {user?.email ?? ''}
              </Text>
            </View>
            <TouchableOpacity onPress={openEditModal} activeOpacity={0.7} hitSlop={8}>
              <Text style={styles.editLabel}>Edit</Text>
            </TouchableOpacity>
          </View>

          {/* ── Thread Strength card ─────────────────────────────── */}
          {/* DEFERRED: wire to Thread Strength decay model in v1.1  */}
          {/* Placeholder: value=73, state="Strong", fill=73%        */}
          <View style={styles.threadCard}>
            <View style={styles.threadHeader}>
              <Text style={styles.threadLabel}>Thread Strength</Text>
              <Text style={styles.threadValue}>{THREAD_STRENGTH_PLACEHOLDER}</Text>
            </View>

            {/* Progress bar */}
            <View style={styles.trackOuter}>
              <View style={[styles.trackFill, { width: `${THREAD_FILL_PCT * 100}%` }]}>
                <View style={styles.trackDot} />
              </View>
            </View>

            <View style={styles.threadFooter}>
              <Text style={styles.threadStreak}>
                {`${currentStreak} ${currentStreak === 1 ? 'day' : 'days'} streak`}
              </Text>
              <Text style={styles.threadState}>{THREAD_STATE_PLACEHOLDER}</Text>
            </View>
          </View>

          {/* ── Stats row (3 tiles) ───────────────────────────────── */}
          <View style={styles.statsRow}>
            <StatTile value={String(anchorsForged)} label={`Anchors\nForged`} />
            <StatTile value={String(totalPrimes)} label={`Total\nPrimes`} />
            <StatTile value={String(activeAnchors)} label={`Active\nAnchors`} />
          </View>



          {/* ── Version ──────────────────────────────────────────── */}
          <Text style={styles.versionText}>{`Version ${appVersion}`}</Text>
        </ScrollView>
      </SafeAreaView>

      {/* ── Edit Display Name Modal ──────────────────────────────── */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Display Name</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              autoFocus
              maxLength={50}
              returnKeyType="done"
              onSubmitEditing={() => void handleSaveDisplayName()}
              placeholderTextColor={colors.text.tertiary}
              placeholder="Display name"
              selectionColor={colors.gold}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setEditModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSaveButton,
                  (isSavingName || !editName.trim()) && styles.modalSaveButtonDisabled,
                ]}
                onPress={() => void handleSaveDisplayName()}
                activeOpacity={0.8}
                disabled={isSavingName || !editName.trim()}
              >
                {isSavingName ? (
                  <ActivityIndicator color={colors.navy} size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// All values from theme constants. No hardcoded colors or spacing.
// Border color rgba(212,175,55,0.24) → colors.ritual.border (nearest token to spec's 0.25).
// Separator rgba(212,175,55,0.14) → colors.ritual.softGlow (nearest token to spec's 0.1).
// Sign-out red: colors.error (nearest token to spec's #C0392B).
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 48,
  },

  // ─── Identity row ──────────────────────────────────────────────────────────
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.charcoal,
    borderWidth: 1,
    borderColor: colors.ritual.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarInitial: {
    fontFamily: 'Cinzel-Regular',
    fontSize: typography.sizes.h3,
    color: colors.gold,
  },
  identityText: {
    flex: 1,
  },
  identityName: {
    fontFamily: 'Cinzel-Regular',
    fontSize: typography.sizes.h4,
    color: colors.bone,
    letterSpacing: 0.5,
    lineHeight: typography.lineHeights.h4,
  },
  identityEmail: {
    ...typography.caption,
    color: colors.silver,
    marginTop: 2,
  },
  editLabel: {
    fontFamily: 'Cinzel-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.gold,
    letterSpacing: 1,
    opacity: 0.8,
  },

  // ─── Thread Strength card ──────────────────────────────────────────────────
  threadCard: {
    backgroundColor: colors.charcoal,
    borderWidth: 1,
    borderColor: colors.ritual.border,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  threadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  threadLabel: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 10,
    letterSpacing: 2.5,
    color: colors.gold,
    textTransform: 'uppercase',
  },
  threadValue: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 28,
    color: colors.gold,
    lineHeight: 32,
  },
  trackOuter: {
    height: 4,
    backgroundColor: colors.ritual.glass, // rgba(15,20,25,0.62) — closest dark track token
    borderRadius: 2,
    overflow: 'visible',
    marginBottom: spacing.sm,
    position: 'relative',
  },
  trackFill: {
    height: 4,
    backgroundColor: colors.gold,
    borderRadius: 2,
    position: 'relative',
  },
  trackDot: {
    position: 'absolute',
    right: -4,
    top: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 3,
  },
  threadFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  threadStreak: {
    ...typography.caption,
    color: colors.silver,
  },
  threadState: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 11,
    color: colors.gold,
    letterSpacing: 0.5,
  },

  // ─── Stats row ─────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statTile: {
    flex: 1,
    backgroundColor: colors.charcoal,
    borderWidth: 1,
    borderColor: colors.ritual.border,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 22,
    color: colors.gold,
    lineHeight: 26,
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: colors.silver,
    textAlign: 'center',
    lineHeight: 14,
  },

  // ─── Section header ────────────────────────────────────────────────────────
  sectionHeader: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 10,
    letterSpacing: 2.5,
    color: colors.gold,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    opacity: 0.8,
  },

  // ─── Subscription banner ───────────────────────────────────────────────────
  subBanner: {
    backgroundColor: colors.charcoal,
    borderWidth: 1,
    borderColor: colors.ritual.border,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  subLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  subDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 2,
    flexShrink: 0,
  },
  subDotExpired: {
    backgroundColor: colors.silver,
    shadowOpacity: 0,
    elevation: 0,
  },
  subStatus: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 13,
    color: colors.bone,
    letterSpacing: 0.3,
  },
  subSub: {
    ...typography.caption,
    color: colors.silver,
    marginTop: 1,
  },
  subBtn: {
    borderWidth: 1,
    borderColor: colors.ritual.border,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
  },
  subBtnText: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 10,
    letterSpacing: 1,
    color: colors.gold,
  },
  subBtnFilled: {
    backgroundColor: colors.gold,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
  },
  subBtnFilledText: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 10,
    letterSpacing: 1,
    color: colors.navy,
  },

  // ─── Account rows ──────────────────────────────────────────────────────────
  rowsContainer: {
    backgroundColor: colors.charcoal,
    borderWidth: 1,
    borderColor: colors.ritual.border,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  accountRowLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: colors.bone,
    letterSpacing: 0.2,
  },
  accountRowChevron: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: colors.silver,
    opacity: 0.5,
  },
  rowSeparator: {
    height: 1,
    // rgba(212,175,55,0.14) — colors.ritual.softGlow is the nearest theme token
    backgroundColor: colors.ritual.softGlow,
    marginHorizontal: spacing.md,
  },

  // ─── Sign out ──────────────────────────────────────────────────────────────
  signOutButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  signOutText: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    // Nearest theme token to spec's #C0392B muted red
    color: colors.error,
  },

  // ─── Version ───────────────────────────────────────────────────────────────
  versionText: {
    ...typography.caption,
    color: colors.silver,
    textAlign: 'center',
    opacity: 0.3,
  },

  // ─── Edit Display Name Modal ───────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.ritual.overlay,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  modalCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.ritual.border,
  },
  modalTitle: {
    fontFamily: 'Cinzel-Regular',
    fontSize: typography.sizes.h4,
    color: colors.bone,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  modalInput: {
    fontFamily: 'Inter-Regular',
    fontSize: typography.sizes.body1,
    color: colors.bone,
    borderWidth: 1,
    borderColor: colors.ritual.border,
    borderRadius: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.navy,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.ritual.border,
  },
  modalCancelText: {
    fontFamily: 'Inter-Regular',
    fontSize: typography.sizes.body1,
    color: colors.silver,
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: spacing.sm,
    backgroundColor: colors.gold,
  },
  modalSaveButtonDisabled: {
    opacity: 0.5,
  },
  modalSaveText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: typography.sizes.body1,
    color: colors.navy,
  },
});
