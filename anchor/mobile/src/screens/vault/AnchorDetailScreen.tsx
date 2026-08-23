// @ts-nocheck
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
  InteractionManager,
  StatusBar,
  Image,
  Alert,
  Modal,
  Pressable,
  Share,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, isToday } from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Info,
  Share2,
  X,
} from 'lucide-react-native';
import { useToast } from '@/components/ToastProvider';
import { usePracticeEntry } from '@/hooks/usePracticeEntry';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSessionStore } from '@/stores/sessionStore';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { del, post } from '@/services/ApiClient';
import {
  requestPhotoLibrarySavePermission,
  savePngToPhotoLibrary,
} from '@/services/AnchorArtworkExportService';
import { captureRef } from 'react-native-view-shot';
import { safeHaptics } from '@/utils/haptics';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography } from '@/theme';
import { useTeachingGate } from '@/utils/useTeachingGate';
import { calculateStreak } from '@/utils/streakHelpers';
import { selectCanonicalPracticeEvents } from '@/utils/practiceMetrics';
import {
  buildWeaveData,
  eventMatchesAnchor,
  formatWeaveDuration,
} from '@/screens/weave/weaveData';
import { buildWeaveGeometry, WEAVE_NEON_MODE_COLORS } from '@/screens/weave/weaveGeometry';
import { WeaveCanvas } from '@/screens/weave/WeaveCanvas';
import type { PracticeMode } from '@/types/practice';
import { MedallionCoin } from './components/MedallionCoin';
import { SigilSvg, ZenBackground } from '@/components/common';
import { useAppPerformanceTier } from '@/hooks/useAppPerformanceTier';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { ExportAnchorSheet } from '@/components/ExportAnchorSheet';
import {
  ThreadStrengthSheet,
  resolveAnchorStrengthPct,
} from '@/components/ThreadStrengthSheet';
import { ConfirmUnchargedBurnSheet } from '@/components/modals/ConfirmUnchargedBurnSheet';
import { ConfirmDeleteAnchorSheet } from '@/components/modals/ConfirmDeleteAnchorSheet';
import ShareCardRenderer from '@/components/ShareCardRenderer';
import { useShareCard } from '@/hooks/useShareCard';
import { logger } from '@/utils/logger';

const { width: SCREEN_W } = Dimensions.get('window');
const HERO_MEDALLION_SIZE = Math.min(Math.round(SCREEN_W * 0.55), 226);
const WEAVE_PLOT_HEIGHT = 110;

const MINI_WEEK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const CATEGORY_LABELS: Record<string, string> = {
  career: 'Career',
  health: 'Health',
  wealth: 'Wealth',
  relationships: 'Love',
  personal_growth: 'Growth',
  desire: 'Desire',
  experience: 'Experience',
  custom: 'Custom',
};

const EDITORIAL_MODE_META: Record<string, { label: string; color: string }> = {
  focus: { label: 'Focus', color: '#AD99D2' },
  visualize: { label: 'Visualize', color: '#78B4D1' },
  deep_prime: { label: 'Deep Prime', color: '#F0CB6A' },
  release: { label: 'Release', color: '#C8875A' },
};

const MODE_ORDER: PracticeMode[] = ['focus', 'visualize', 'deep_prime', 'release'];
const WEAVE_MODE_COLORS: Record<PracticeMode, string> = WEAVE_NEON_MODE_COLORS;

const threadStateFor = (value: number) => {
  if (value >= 80) return 'Well held';
  if (value >= 55) return 'In practice';
  if (value >= 30) return 'Taking shape';
  return 'Just beginning';
};

const modeLabel = (mode: string) =>
  EDITORIAL_MODE_META[mode]?.label ?? String(mode).replace(/_/g, ' ');

const modeColor = (mode: string) =>
  EDITORIAL_MODE_META[mode]?.color ?? colors.anchor15.ash;

const strengthExplanation = (sessions: number) => {
  if (sessions === 0) {
    return 'Your Thread Strength will begin to take shape with your first completed Practice.';
  }
  if (sessions === 1) {
    return 'One completed Practice has begun a thread you can return to.';
  }
  return `${sessions} completed sessions are held in this Anchor’s thread.`;
};

const getDateValue = (value: any) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const formatDate = (value: any, pattern = 'MMMM d, yyyy') => {
  const date = getDateValue(value);
  if (!date) return null;
  return format(date, pattern);
};

const localDateString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const isoWeekKey = (d: Date) => {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayOfWeek = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

const toDisplayAnchor = (rawAnchor: any) => {
  if (!rawAnchor) return null;

  const lastActivatedDate = getDateValue(rawAnchor.lastActivatedAt);
  const intention =
    rawAnchor.intention ?? rawAnchor.intentionText ?? 'No intention set';
  const categoryKey = rawAnchor.category ?? 'custom';
  const categoryLabel =
    CATEGORY_LABELS[categoryKey] ?? String(categoryKey).replace(/_/g, ' ');
  const distilled = rawAnchor.distilled ?? rawAnchor.distilledLetters ?? [];
  const charged = Boolean(rawAnchor.charged ?? rawAnchor.isCharged);
  const released = Boolean(rawAnchor.isReleased);
  const todayActivated =
    rawAnchor.today ??
    (lastActivatedDate && isToday(lastActivatedDate) ? 'Primed' : null);

  return {
    id: rawAnchor.id,
    name:
      rawAnchor.name ??
      rawAnchor.title ??
      (intention.length > 36 ? `${intention.slice(0, 36)}…` : intention),
    intention,
    category: categoryLabel,
    charged,
    isReleased: released,
    releasedAt:
      formatDate(rawAnchor.releasedAt, 'MMMM d, yyyy') ??
      (rawAnchor.releasedAt ? String(rawAnchor.releasedAt) : null),
    lastActivated:
      rawAnchor.lastActivated ??
      formatDate(rawAnchor.lastActivatedAt, 'MMM d, yyyy'),
    streak: rawAnchor.streak ?? (todayActivated ? 1 : 0),
    today: todayActivated,
    distilled,
    sigilUri: rawAnchor.sigilUri ?? rawAnchor.enhancedImageUrl ?? null,
    createdAt:
      formatDate(rawAnchor.createdAt, 'MMMM d, yyyy') ??
      String(rawAnchor.createdAt ?? 'Unknown'),
    practiceCreate: rawAnchor.practiceCreate ?? true,
    practiceCharge: rawAnchor.practiceCharge ?? charged,
    practiceActivateDays:
      rawAnchor.practiceActivateDays ??
      Math.min(rawAnchor.activationCount ?? 0, 7),
    reinforcedSigilSvg: rawAnchor.reinforcedSigilSvg ?? null,
    baseSigilSvg: rawAnchor.baseSigilSvg ?? '',
    enhancedImageUrl: rawAnchor.enhancedImageUrl,
  };
};

const FadeUp = ({ children, delay = 0, animate = true }: any) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    if (!animate) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [animate, delay, opacity, translateY]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
};

const EditorialRule = ({ style }: { style?: object }) => (
  <View pointerEvents="none" style={[editorial.rule, style]} />
);

const EditorialInfoButton = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityHint="Opens a short explanation"
    hitSlop={8}
    onPress={onPress}
    style={({ pressed }) => [editorial.infoButton, pressed && editorial.pressed]}
  >
    <Info size={13} color={colors.anchor15.gilt} strokeWidth={1.5} />
  </Pressable>
);

const EditorialSheet = ({
  visible,
  title,
  children,
  onClose,
  reduceMotionEnabled,
}: {
  visible: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  reduceMotionEnabled: boolean;
}) => (
  <Modal
    transparent
    visible={visible}
    animationType={reduceMotionEnabled ? 'none' : 'slide'}
    onRequestClose={onClose}
    accessibilityViewIsModal
  >
    <Pressable
      accessibilityLabel={`Close ${title}`}
      onPress={onClose}
      style={editorial.sheetScrim}
    >
      <Pressable onPress={(event) => event.stopPropagation()} style={editorial.sheet}>
        <View style={editorial.sheetHandle} />
        <View style={editorial.sheetHeader}>
          <Text style={editorial.sheetTitle}>{title}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            style={editorial.sheetClose}
          >
            <X size={18} color={colors.anchor15.ash} strokeWidth={1.5} />
          </Pressable>
        </View>
        {children}
      </Pressable>
    </Pressable>
  </Modal>
);

const EditorialWeavePreview = ({
  anchorPractice,
  anchorId,
  sourceAnchor,
  practiceHistory,
  accountId,
  onPress,
  reduceMotionEnabled,
}: any) => {
  const previewWidth = Math.max(280, SCREEN_W - 44);

  const weaveData = useMemo(() => {
    const anchorAliases = [anchorId, sourceAnchor?.id, sourceAnchor?.localId].filter(Boolean) as string[];
    return buildWeaveData({
      history: practiceHistory,
      accountId,
      scope: { kind: 'anchor', anchorId: anchorId ?? '' },
      range: '12w',
      anchorAliases,
    });
  }, [accountId, anchorId, practiceHistory, sourceAnchor?.id, sourceAnchor?.localId]);

  const geometry = useMemo(() => {
    return buildWeaveGeometry({
      modes: MODE_ORDER,
      nodesByMode: weaveData.nodesByMode,
      bucketCount: weaveData.bucketCount,
      width: previewWidth,
      height: WEAVE_PLOT_HEIGHT,
    });
  }, [previewWidth, weaveData.bucketCount, weaveData.nodesByMode]);

  const hasNodes = weaveData.nodes.length > 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open The Weave. ${anchorPractice.totalPrimingSessions} completed sessions for this Anchor.`}
      accessibilityHint="Shows this Anchor’s completed Practice history"
      onPress={onPress}
      style={({ pressed }) => [editorial.weaveEntry, pressed && editorial.pressed]}
      testID="anchor-detail-open-weave"
    >
      <View style={editorial.weaveHeadingRow}>
        <Text style={editorial.sectionEyebrow}>THE WEAVE</Text>
        <ChevronRight size={16} color={colors.anchor15.gilt} strokeWidth={1.4} />
      </View>
      <View style={editorial.weaveCanvas} accessible={false}>
        <WeaveCanvas
          width={previewWidth}
          height={WEAVE_PLOT_HEIGHT}
          geometry={geometry}
          nodes={weaveData.nodes}
          modeColors={WEAVE_MODE_COLORS}
          backgroundColor="#0E141A"
          animationKey={anchorId ?? 'anchor'}
          still={reduceMotionEnabled}
        />

        {!hasNodes ? (
          <View pointerEvents="none" style={editorial.weaveEmptyWrap}>
            <Text style={editorial.weaveEmpty}>Your first completed Practice will appear here.</Text>
          </View>
        ) : null}
      </View>
      <View style={editorial.weaveFooter}>
        <Text style={editorial.weaveMeta}>
          {anchorPractice.totalPrimingSessions} {anchorPractice.totalPrimingSessions === 1 ? 'session' : 'sessions'} · Thread Strength {anchorPractice.threadStrengthValue}
        </Text>
        <Text style={editorial.weaveLink}>VIEW THE WEAVE →</Text>
      </View>
    </Pressable>
  );
};

const AnchorDetailEditorialPage = (props: any) => {
  const {
    anchor,
    sourceAnchor,
    hasAnchor,
    isLoading,
    loadError,
    insets,
    perfTier,
    reduceMotionEnabled,
    resolvedSigilSvg,
    anchorPractice,
    threadStrengthValue,
    practiceHistory,
    accountId,
    isExporting,
    isShareCardLoading,
    pendingExportAction,
    anchorCardRef,
    showOptions,
    showShareSheet,
    showDistilledForm,
    showWeaveInfo,
    showThreadStrength,
    showExportSheet,
    showConfirmDelete,
    showConfirmRelease,
    showShareCard,
    shareCardRef,
    shareFormat,
    onChangeShareFormat,
    onBack,
    onOpenOptions,
    onCloseOptions,
    onOpenShareSheet,
    onCloseShareSheet,
    onOpenDistilledForm,
    onCloseDistilledForm,
    onOpenWeaveInfo,
    onCloseWeaveInfo,
    onOpenThreadStrength,
    onCloseThreadStrength,
    onOpenWeave,
    onPractice,
    onShare,
    onSetWallpaper,
    onSavePng,
    onCloseExport,
    onRelease,
    onDelete,
    onCloseDelete,
    onConfirmDelete,
    onCloseRelease,
    onConfirmRelease,
    onShareCardRendered,
  } = props;

  const threadState = threadStateFor(threadStrengthValue);
  const hasHistory = anchorPractice.totalPrimingSessions > 0;
  const isCachedOffline = Boolean(loadError && hasAnchor);

  const statusTitle = isLoading
    ? 'Gathering your Anchor'
    : loadError
      ? 'This Anchor is unavailable right now'
      : 'Anchor not found';
  const statusBody = isLoading
    ? 'Your saved intention and Practice history are being prepared.'
    : loadError
      ? 'Reconnect, then return to Sanctuary and try again.'
      : 'This Anchor may have been released or removed.';

  return (
    <View style={editorial.root}>
      <StatusBar barStyle="light-content" />
      <ZenBackground
        variant="sanctuary"
        showOrbs={perfTier === 'high' && !reduceMotionEnabled}
        showGrain
        showVignette
        performanceTier={perfTier}
      />
      <View style={[editorial.header, { paddingTop: insets.top + 2 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Sanctuary"
          onPress={onBack}
          style={({ pressed }) => [editorial.headerControl, editorial.backControl, pressed && editorial.pressed]}
        >
          <ChevronLeft size={19} color={colors.anchor15.giltBright} strokeWidth={1.45} />
          <Text style={editorial.backLabel}>Sanctuary</Text>
        </Pressable>
      </View>

      {!hasAnchor ? (
        <View style={editorial.statusWrap} accessibilityRole={loadError ? 'alert' : undefined}>
          <View style={editorial.statusRule} />
          <Text style={editorial.statusTitle}>{statusTitle}</Text>
          <Text style={editorial.statusBody}>{statusBody}</Text>
          <Pressable accessibilityRole="button" onPress={onBack} style={editorial.statusAction}>
            <Text style={editorial.statusActionText}>BACK TO SANCTUARY</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={[editorial.scroll, { paddingBottom: insets.bottom + 104 }]}
            showsVerticalScrollIndicator={false}
          >
            {isCachedOffline ? (
              <Text accessibilityRole="alert" style={editorial.cachedLabel}>
                Showing saved Anchor details while offline.
              </Text>
            ) : null}

            <FadeUp animate={!reduceMotionEnabled}>
              <View style={editorial.heroArtworkWrap} accessible accessibilityLabel={`${anchor.name} Anchor artwork`}>
                <MedallionCoin
                  size={HERO_MEDALLION_SIZE}
                  imageUrl={anchor.sigilUri ?? anchor.enhancedImageUrl}
                  sigilXml={resolvedSigilSvg}
                  performanceTier={perfTier}
                  reduceMotionEnabled={reduceMotionEnabled}
                  showGlow={true}
                />
              </View>

              <View style={editorial.identity}>
                <Text numberOfLines={3} style={editorial.anchorName}>{anchor.name}</Text>
                <Text style={editorial.category}>{anchor.category}</Text>
                <Text style={editorial.intention}>“{anchor.intention}”</Text>
              </View>
            </FadeUp>

            <FadeUp delay={60} animate={!reduceMotionEnabled}>
              <View style={editorial.formSection}>
                <View style={editorial.centeredLabelRow}>
                  <Text style={editorial.sectionEyebrow}>DISTILLED FORM</Text>
                  <EditorialInfoButton label="About Distilled Form" onPress={onOpenDistilledForm} />
                </View>
                <View style={editorial.lettersRow}>
                  {anchor.distilled.length ? anchor.distilled.map((letter: string, index: number) => (
                    <React.Fragment key={`${letter}-${index}`}>
                      {index > 0 ? <View style={editorial.letterDot} /> : null}
                      <Text style={editorial.letter}>{letter}</Text>
                    </React.Fragment>
                  )) : <Text style={editorial.emptyForm}>No distilled form was saved for this Anchor.</Text>}
                </View>
              </View>

              <View style={editorial.strengthSection}>
                <View style={editorial.centeredLabelRow}>
                  <Text style={editorial.sectionEyebrow}>THREAD STRENGTH</Text>
                  <EditorialInfoButton label="About Thread Strength" onPress={onOpenThreadStrength} />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Thread Strength ${threadStrengthValue} out of 100. ${threadState}.`}
                  accessibilityHint="Opens an explanation of this Anchor’s Thread Strength"
                  onPress={onOpenThreadStrength}
                  style={({ pressed }) => [editorial.strengthContent, pressed && editorial.pressed]}
                  testID="anchor-thread-strength-row"
                >
                  <View style={editorial.strengthNumberRow}>
                    <Text testID="anchor-detail-streak-value" style={editorial.strengthNumber}>{threadStrengthValue}</Text>
                    <Text style={editorial.strengthOutOf}>/ 100</Text>
                  </View>
                  <View style={editorial.threadStateRow}>
                    <View style={editorial.stateRule} />
                    <Text style={editorial.threadState}>{threadState}</Text>
                    <View style={editorial.stateRule} />
                  </View>
                  <Text style={editorial.strengthExplanation}>{strengthExplanation(anchorPractice.totalPrimingSessions)}</Text>
                </Pressable>
              </View>
            </FadeUp>

            <EditorialRule style={editorial.firstRule} />

            <View style={editorial.weaveSection}>
              <View style={editorial.weaveTopLine}>
                <Text style={editorial.weaveIntro}>A living record of the Practice you return to.</Text>
                <EditorialInfoButton label="About The Weave" onPress={onOpenWeaveInfo} />
              </View>
              <EditorialWeavePreview
                anchorPractice={{ ...anchorPractice, threadStrengthValue }}
                anchorId={anchor.id}
                sourceAnchor={sourceAnchor}
                practiceHistory={practiceHistory}
                accountId={accountId}
                onPress={onOpenWeave}
                reduceMotionEnabled={reduceMotionEnabled}
              />
            </View>

            <EditorialRule />

            <View style={editorial.metricsSection}>
              <Text style={editorial.sectionEyebrow}>PRACTICE HISTORY</Text>
              <View style={editorial.metricsRow}>
                <View style={editorial.metric}>
                  <Text style={editorial.metricValue}>{anchorPractice.practiceDays}</Text>
                  <Text style={editorial.metricLabel}>PRACTICE DAYS</Text>
                </View>
                <View style={editorial.metric}>
                  <Text style={editorial.metricValue}>{anchorPractice.activeWeeks}</Text>
                  <Text style={editorial.metricLabel}>ACTIVE WEEKS</Text>
                </View>
                <View style={editorial.metric}>
                  <Text style={editorial.metricValue}>{formatWeaveDuration(anchorPractice.practicedSeconds)}</Text>
                  <Text style={editorial.metricLabel}>PRACTICED</Text>
                </View>
              </View>
              <View style={editorial.mixSection}>
                <Text style={editorial.sectionEyebrow}>PRACTICE MIX</Text>
                {hasHistory ? Object.keys(EDITORIAL_MODE_META).map((mode) => {
                  const count = anchorPractice.modeCounts[mode] ?? 0;
                  const percent = Math.round((count / Math.max(1, anchorPractice.totalPrimingSessions)) * 100);
                  return (
                    <View key={mode} style={editorial.mixRow}>
                      <Text style={[editorial.mixName, { color: modeColor(mode) }]}>{modeLabel(mode)}</Text>
                      <View style={editorial.mixTrack}>
                        <View style={[editorial.mixFill, { width: `${percent}%`, backgroundColor: modeColor(mode) }]} />
                      </View>
                      <Text style={editorial.mixValue}>{count}</Text>
                    </View>
                  );
                }) : <Text style={editorial.lowHistoryCopy}>A mix appears after a few completed Practice sessions.</Text>}
              </View>
            </View>

            <EditorialRule />

            <View style={editorial.activitySection}>
              <Text style={editorial.sectionEyebrow}>RECENT ACTIVITY</Text>
              {hasHistory ? anchorPractice.recentSessions.map((session: any, index: number) => (
                <View key={session.id ?? `${session.completedAt}-${index}`} style={[editorial.activityRow, index > 0 && editorial.activityRowRule]}>
                  <View style={[editorial.activityDot, { backgroundColor: modeColor(session.practiceMode) }]} />
                  <View style={editorial.activityCopy}>
                    <Text style={editorial.activityTitle}>{modeLabel(session.practiceMode)}</Text>
                    <Text style={editorial.activityMeta}>{formatDate(session.completedAt, 'MMM d')} · {formatWeaveDuration(session.completedDurationSeconds ?? 0)}</Text>
                  </View>
                </View>
              )) : <Text style={editorial.lowHistoryCopy}>Your completed returns will appear here.</Text>}
            </View>

            <EditorialRule />

            {/* ── UTILITY ROWS ── */}
            <View style={editorial.utilitySection}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Anchor options"
                onPress={onOpenOptions}
                style={({ pressed }) => [editorial.utilityRow, pressed && editorial.pressed]}
                testID="anchor-detail-options-button"
              >
                <Text style={editorial.utilityText}>ANCHOR OPTIONS</Text>
                <ChevronRight size={17} color={colors.anchor15.ash} strokeWidth={1.4} />
              </Pressable>
            </View>

            <View style={editorial.releaseSection}>
              <EditorialRule style={editorial.releaseRule} />
              {anchor.isReleased ? (
                <Text style={editorial.releasedText}>Released {anchor.releasedAt ?? 'previously'}</Text>
              ) : (
                <Pressable accessibilityRole="button" accessibilityLabel="Release Anchor" onPress={onRelease} style={({ pressed }) => [editorial.releaseRow, pressed && editorial.pressed]}>
                  <Text style={editorial.releaseText}>RELEASE ANCHOR</Text>
                  <ChevronRight size={17} color="rgba(200,135,96,0.8)" strokeWidth={1.4} />
                </Pressable>
              )}
              <Text style={editorial.createdDate}>Created {anchor.createdAt}</Text>
            </View>
          </ScrollView>

          <View pointerEvents="box-none" style={[editorial.floatingCtaWrap, { paddingBottom: insets.bottom + 16 }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={anchor.isReleased ? 'Anchor released' : 'Practice this Anchor'}
              accessibilityState={{ disabled: Boolean(anchor.isReleased) }}
              disabled={anchor.isReleased}
              onPress={onPractice}
              style={({ pressed }) => [editorial.floatingCta, (pressed || anchor.isReleased) && editorial.pressed]}
            >
              <Text style={editorial.floatingCtaText}>{anchor.isReleased ? 'ANCHOR RELEASED' : 'PRACTICE THIS ANCHOR →'}</Text>
            </Pressable>
          </View>
        </>
      )}

      {/* ── SHARE ANCHOR / WALLPAPER & EXPORT SHEET ── */}
      <EditorialSheet visible={showShareSheet} title="Share & Export" onClose={onCloseShareSheet} reduceMotionEnabled={reduceMotionEnabled}>
        <View style={editorial.exportModalWrap}>
          <Text style={editorial.exportModalTitle}>
            Keep your anchor where you will actually see it.
          </Text>
          <Text style={editorial.exportModalBody}>
            Share a branded card for messages and social, save the raw PNG, or open the wallpaper flow when you want the symbol on your lock screen.
          </Text>

          <View style={editorial.formatToggleRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Square format 1:1"
              onPress={() => onChangeShareFormat('square')}
              style={[
                editorial.formatPill,
                shareFormat === 'square' && editorial.formatPillActive,
              ]}
            >
              <Text
                style={[
                  editorial.formatPillText,
                  shareFormat === 'square' && editorial.formatPillTextActive,
                ]}
              >
                SQUARE
              </Text>
              <Text
                style={[
                  editorial.formatPillDim,
                  shareFormat === 'square' && editorial.formatPillDimActive,
                ]}
              >
                1:1
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Stories format 9:16"
              onPress={() => onChangeShareFormat('stories')}
              style={[
                editorial.formatPill,
                shareFormat === 'stories' && editorial.formatPillActive,
              ]}
            >
              <Text
                style={[
                  editorial.formatPillText,
                  shareFormat === 'stories' && editorial.formatPillTextActive,
                ]}
              >
                STORIES
              </Text>
              <Text
                style={[
                  editorial.formatPillDim,
                  shareFormat === 'stories' && editorial.formatPillDimActive,
                ]}
              >
                9:16
              </Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share My Anchor"
            disabled={isShareCardLoading}
            onPress={() => {
              onCloseShareSheet();
              onShare();
            }}
            style={({ pressed }) => [
              editorial.exportActionPrimary,
              (pressed || isShareCardLoading) && editorial.pressed,
            ]}
            testID="anchor-detail-share-card-button"
          >
            <View style={editorial.exportActionPrimaryContent}>
              <Share2 size={15} color="#10151A" />
              <Text style={editorial.exportActionPrimaryText}>
                {isShareCardLoading ? 'SHARING…' : 'SHARE MY ANCHOR'}
              </Text>
            </View>
          </Pressable>

          <View style={editorial.exportSecondaryRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Set Anchor as wallpaper"
              disabled={isExporting}
              onPress={() => {
                onCloseShareSheet();
                onSetWallpaper();
              }}
              style={({ pressed }) => [
                editorial.exportActionSecondary,
                (pressed || isExporting) && editorial.pressed,
              ]}
            >
              <Text style={editorial.exportActionSecondaryText}>
                {isExporting ? 'OPENING…' : 'SET AS WALLPAPER'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save PNG"
              onPress={() => {
                onCloseShareSheet();
                onSavePng();
              }}
              style={({ pressed }) => [
                editorial.exportActionSecondary,
                pressed && editorial.pressed,
              ]}
              testID="anchor-detail-download-png-button"
            >
              <Text style={editorial.exportActionSecondaryText}>SAVE PNG</Text>
            </Pressable>
          </View>
        </View>
      </EditorialSheet>

      <EditorialSheet visible={showOptions} title="Anchor options" onClose={onCloseOptions} reduceMotionEnabled={reduceMotionEnabled}>
        <Pressable accessibilityRole="button" onPress={() => { onCloseOptions(); onOpenShareSheet(); }} style={editorial.optionRow} testID="anchor-detail-share-button">
          <Text style={editorial.optionText}>Share Anchor</Text>
          <ChevronRight size={17} color={colors.anchor15.ash} />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => { onCloseOptions(); onSetWallpaper(); }} style={editorial.optionRow} testID="anchor-detail-set-wallpaper-button">
          <Text style={editorial.optionText}>Set as Wallpaper</Text>
          <ChevronRight size={17} color={colors.anchor15.ash} />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => { onCloseOptions(); onSavePng(); }} style={[editorial.optionRow, editorial.optionDelete]}>
          <Text style={editorial.optionText}>Save PNG</Text>
          <ChevronRight size={17} color={colors.anchor15.ash} />
        </Pressable>
      </EditorialSheet>

      <EditorialSheet visible={showDistilledForm} title="Distilled Form" onClose={onCloseDistilledForm} reduceMotionEnabled={reduceMotionEnabled}>
        <Text style={editorial.sheetBody}>Your intention was distilled into its essential letters before this Anchor took form.</Text>
        <Text style={editorial.sheetBody}>Those letters remain a quiet part of the Anchor you return to.</Text>
      </EditorialSheet>

      <EditorialSheet visible={showWeaveInfo} title="The Weave" onClose={onCloseWeaveInfo} reduceMotionEnabled={reduceMotionEnabled}>
        <Text style={editorial.sheetBody}>Each completed Practice becomes a point in this Anchor’s history. The Weave shows the rhythm of those returns over time.</Text>
      </EditorialSheet>

      {pendingExportAction ? (
        <View
          ref={anchorCardRef}
          collapsable={false}
          style={editorial.captureTarget}
        >
          <View style={editorial.captureArtwork}>
            {anchor.sigilUri ? (
              <Image source={{ uri: anchor.sigilUri }} style={editorial.captureImage} resizeMode="cover" />
            ) : resolvedSigilSvg ? (
              <SigilSvg xml={resolvedSigilSvg} width={720} height={720} color={colors.anchor15.giltBright} />
            ) : (
              <Text style={editorial.captureMark}>{anchor.name?.slice(0, 1)?.toUpperCase() ?? 'A'}</Text>
            )}
          </View>
          <Text style={editorial.captureIntention}>{anchor.intention}</Text>
          <Text style={editorial.captureWordmark}>ANCHOR</Text>
        </View>
      ) : null}

      <ThreadStrengthSheet visible={showThreadStrength} onClose={onCloseThreadStrength} anchorId={anchor.id} />
      <ConfirmUnchargedBurnSheet visible={showConfirmRelease} onConfirm={onConfirmRelease} onCancel={onCloseRelease} intentionText={anchor.intention} />
      <ConfirmDeleteAnchorSheet visible={showConfirmDelete} intentionText={anchor.intention} onBurnInstead={onRelease} onDelete={onConfirmDelete} onCancel={onCloseDelete} />
      <ExportAnchorSheet isVisible={showExportSheet} onClose={onCloseExport} sigilSvg={anchor.baseSigilSvg} sigilUri={anchor.sigilUri} intention={anchor.intention} onExportComplete={(uri) => logger.info('[AnchorDetail] Anchor exported', { uri })} />
      {showShareCard ? <ShareCardRenderer ref={shareCardRef} anchorSVG={anchor.baseSigilSvg} artworkUri={anchor.sigilUri ?? anchor.enhancedImageUrl} intention={anchor.intention} daysPrimed={anchorPractice.currentStreak} format={shareFormat} onRenderReady={onShareCardRendered} /> : null}
    </View>
  );
};

export const AnchorDetailScreen = ({ navigation, route }: any) => {
  const insets = useSafeAreaInsets();
  const perfTier = useAppPerformanceTier();
  const reduceMotionEnabled = useReduceMotionEnabled();
  const { startPractice } = usePracticeEntry();
  const { navigateToPractice } = useTabNavigation();
  const toast = useToast();
  const getAnchorById = useAnchorStore((state) => state.getAnchorById);
  const removeAnchor = useAnchorStore((state) => state.removeAnchor);
  const isAnchorStoreLoading = useAnchorStore((state) => state.isLoading);
  const anchorStoreError = useAnchorStore((state) => state.error);
  const practiceHistory = useSessionStore((s) => s.practiceHistory);
  const accountId = useAuthStore((s) => s.user?.id ?? null);
  const [pendingExportAction, setPendingExportAction] = useState<'download' | 'wallpaper' | null>(null);
  const anchorCardRef = useRef<View>(null);
  const [isExporting, setIsExporting] = useState(false);
  const mediaLibraryPermissionGrantedRef = useRef(false);
  const [showExportSheet, setShowExportSheet] = useState(false);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [confirmUnchargedBurnVisible, setConfirmUnchargedBurnVisible] = useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [threadStrengthSheetVisible, setThreadStrengthSheetVisible] = useState(false);
  const [detailOptionsVisible, setDetailOptionsVisible] = useState(false);
  const [distilledFormSheetVisible, setDistilledFormSheetVisible] = useState(false);
  const [weaveInfoSheetVisible, setWeaveInfoSheetVisible] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const [shareFormat, setShareFormat] = useState<'square' | 'stories'>('square');
  const shareCardRef = useRef(null);
  const shareCardRenderedRef = useRef(false);
  const shareCardTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    captureAndShare,
    isLoading: isShareCardLoading,
    setIsRendered: setShareCardRendered,
  } = useShareCard(shareCardRef, shareCardRenderedRef);

  useEffect(
    () => () => {
      if (shareCardTimeoutRef.current) {
        clearTimeout(shareCardTimeoutRef.current);
      }
    },
    [],
  );

  const routeAnchor = route?.params?.anchor;
  const anchorId = route?.params?.anchorId ?? routeAnchor?.id;
  const storeAnchor = anchorId ? getAnchorById(anchorId) : null;
  const sourceAnchor = routeAnchor ?? storeAnchor;
  const anchor = useMemo(
    () =>
      toDisplayAnchor(sourceAnchor) ?? {
        id: anchorId,
        name: 'Untitled Anchor',
        intention: 'No intention found for this anchor.',
        category: 'Custom',
        charged: false,
        lastActivated: null,
        streak: 0,
        today: null,
        distilled: [],
        sigilUri: null,
        createdAt: 'Unknown',
        practiceCreate: true,
        practiceCharge: false,
        practiceActivateDays: 0,
        reinforcedSigilSvg: null,
        baseSigilSvg: '',
        enhancedImageUrl: null,
      },
    [sourceAnchor],
  );

  useEffect(() => {
    if (!anchorId) return;
    AnalyticsService.track(AnalyticsEvents.ANCHOR_DETAIL_VIEWED, {
      anchor_id: anchorId,
      source: routeAnchor ? 'navigation_params' : 'store',
      charged: Boolean(anchor.charged),
      released: Boolean(anchor.isReleased),
    });
  }, [anchorId]);

  const resolvedSigilSvg =
    anchor.reinforcedSigilSvg ?? anchor.baseSigilSvg ?? '';

  const anchorPractice = useMemo(() => {
    if (!anchorId) {
      return {
        currentStreak: 0,
        totalPrimingSessions: 0,
        lastPrimedAt: null,
        weekHistory: [false, false, false, false, false, false, false],
        practiceDays: 0,
        activeWeeks: 0,
        practicedSeconds: 0,
        modeCounts: { focus: 0, visualize: 0, deep_prime: 0, release: 0 },
        recentSessions: [],
      };
    }

    const currentWeekKey = isoWeekKey(new Date());
    const anchorAliases = [anchorId, sourceAnchor?.id, sourceAnchor?.localId];
    const primingSessions = selectCanonicalPracticeEvents(practiceHistory, accountId)
      .filter((entry) => eventMatchesAnchor(entry, anchorAliases))
      .sort(
        (a, b) =>
          new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
      );

    const weekHistoryForAnchor = [
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ];
    primingSessions.forEach((entry) => {
      const date = new Date(entry.completedAt);
      if (Number.isNaN(date.getTime()) || isoWeekKey(date) !== currentWeekKey)
        return;
      const dayIndex = (date.getDay() + 6) % 7;
      weekHistoryForAnchor[dayIndex] = true;
    });

    const currentStreak = calculateStreak(
      primingSessions.map((entry) => ({ createdAt: entry.completedAt })),
    ).currentStreak;

    return {
      currentStreak,
      totalPrimingSessions: primingSessions.length,
      lastPrimedAt: primingSessions[0]
        ? localDateString(new Date(primingSessions[0].completedAt))
        : null,
      weekHistory: weekHistoryForAnchor,
      practiceDays: new Set(primingSessions.map((entry) => entry.localDateKey)).size,
      activeWeeks: new Set(primingSessions.map((entry) => isoWeekKey(new Date(entry.completedAt)))).size,
      practicedSeconds: primingSessions.reduce((total, entry) => total + Math.max(0, entry.completedDurationSeconds || 0), 0),
      modeCounts: primingSessions.reduce((counts, entry) => ({ ...counts, [entry.practiceMode]: counts[entry.practiceMode] + 1 }), { focus: 0, visualize: 0, deep_prime: 0, release: 0 }),
      recentSessions: primingSessions.slice(0, 3),
    };
  }, [accountId, anchorId, practiceHistory, sourceAnchor?.id, sourceAnchor?.localId]);

  const threadStrengthValue = resolveAnchorStrengthPct({
    storedStrength: sourceAnchor?.threadStrength ?? null,
    totalSessions: anchorPractice.totalPrimingSessions,
    currentStreak: anchorPractice.currentStreak,
    thisWeekDays: MINI_WEEK_DAYS.map((day, index) => ({
      day,
      type: anchorPractice.weekHistory[index] ? 'focus' : 'empty',
      isToday: false,
    })),
  });

  const handleBurn = () => {
    if (!anchorId) return;
    if (!anchor.charged) {
      setConfirmUnchargedBurnVisible(true);
      return;
    }
    executeBurn();
  };

  const executeBurn = () => {
    if (!anchorId) return;
    setConfirmUnchargedBurnVisible(false);
    const burnAnchor = storeAnchor ?? sourceAnchor;
    startPractice({
      mode: 'release',
      anchorId,
      source: 'anchor_detail',
      intention:
        burnAnchor?.intentionText ?? burnAnchor?.intention ?? anchor.intention,
      sigilSvg:
        burnAnchor?.reinforcedSigilSvg ?? burnAnchor?.baseSigilSvg ?? '',
      enhancedImageUrl:
        anchor.sigilUri ||
        anchor.enhancedImageUrl ||
        burnAnchor?.enhancedImageUrl ||
        undefined,
    });
  };

  const handlePracticePress = () => {
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);
    if (anchorId) {
      startPractice({ mode: 'deepPrime', anchorId, source: 'anchor_detail' });
    }
  };

  const handleOpenWeave = () => {
    if (!anchorId) return;
    if (navigation?.navigate) {
      navigation.navigate('TheWeave', {
        origin: 'anchorDetail',
        originAnchorId: anchorId,
        initialScope: { kind: 'anchor', anchorId },
      });
      return;
    }
    navigateToPractice('TheWeave', {
      origin: 'anchorDetail',
      originAnchorId: anchorId,
      initialScope: { kind: 'anchor', anchorId },
    });
  };

  const handleDelete = () => {
    if (!anchorId) return;
    setConfirmDeleteVisible(true);
  };

  const confirmDeleteAnchor = async () => {
    if (!anchorId) return;
    setConfirmDeleteVisible(false);
    try {
      await del(`/api/anchors/${anchorId}`);
    } catch {
      // Keep local delete behavior even if backend is unreachable.
    }
    removeAnchor(anchorId);
    AnalyticsService.track(AnalyticsEvents.ANCHOR_DELETED, {
      anchor_id: anchorId,
      source: 'anchor_detail',
    });
    navigation.popToTop();
  };

  const ensureMediaLibraryPermission = async () => {
    if (mediaLibraryPermissionGrantedRef.current) return true;
    try {
      const granted = await requestPhotoLibrarySavePermission();
      mediaLibraryPermissionGrantedRef.current = granted;
      return granted;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (!pendingExportAction) return;
    let cancelled = false;

    const task = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(async () => {
          if (cancelled || !anchorCardRef.current) {
            if (!cancelled) {
              setPendingExportAction(null);
              setIsExporting(false);
            }
            return;
          }

          try {
            const granted = await ensureMediaLibraryPermission();
            if (!granted) {
              toast.warning('Allow photo library access to save your anchor');
              return;
            }

            const uri = await captureRef(anchorCardRef, {
              format: 'png',
              quality: 1,
            });
            const savedUri = await savePngToPhotoLibrary(
              uri,
              'anchor-wallpaper.png',
            );

            if (pendingExportAction === 'wallpaper') {
              await Share.share({ url: savedUri });
              toast.info(
                'Save the image, then set it as your wallpaper in Settings',
              );
            } else {
              toast.success('Anchor saved to your photo library');
            }
          } catch {
            toast.error(
              pendingExportAction === 'wallpaper'
                ? 'Could not open share sheet'
                : 'Could not save image. Check your permissions.',
            );
          } finally {
            if (!cancelled) {
              setPendingExportAction(null);
              setIsExporting(false);
            }
          }
        });
      });
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [pendingExportAction]);

  const handleSetWallpaper = async () => {
    if (isExporting) return;
    const granted = await ensureMediaLibraryPermission();
    if (!granted) {
      toast.warning('Allow photo library access to share your anchor');
      return;
    }
    setIsExporting(true);
    setPendingExportAction('wallpaper');
  };

  const handleShareAnchor = useCallback(() => {
    if (isShareCardLoading) return;

    if (shareCardTimeoutRef.current) {
      clearTimeout(shareCardTimeoutRef.current);
    }

    shareCardRenderedRef.current = false;
    setShareCardRendered(false);
    setShowShareCard(true);
    shareCardTimeoutRef.current = setTimeout(async () => {
      try {
        await captureAndShare(
          anchor.intention,
          anchorPractice.currentStreak,
          shareFormat,
        );
      } finally {
        setShowShareCard(false);
        shareCardRenderedRef.current = false;
        setShareCardRendered(false);
        shareCardTimeoutRef.current = null;
      }
    }, 250);
  }, [
    anchor.intention,
    anchorPractice.currentStreak,
    captureAndShare,
    isShareCardLoading,
    setShareCardRendered,
    shareFormat,
  ]);

  return (
    <AnchorDetailEditorialPage
      anchor={anchor}
      sourceAnchor={sourceAnchor}
      hasAnchor={Boolean(sourceAnchor)}
      isLoading={Boolean(isAnchorStoreLoading)}
      loadError={anchorStoreError}
      insets={insets}
      perfTier={perfTier}
      reduceMotionEnabled={reduceMotionEnabled}
      resolvedSigilSvg={resolvedSigilSvg}
      anchorPractice={anchorPractice}
      threadStrengthValue={threadStrengthValue}
      practiceHistory={practiceHistory}
      accountId={accountId}
      isExporting={isExporting}
      isShareCardLoading={isShareCardLoading}
      pendingExportAction={pendingExportAction}
      anchorCardRef={anchorCardRef}
      showOptions={detailOptionsVisible}
      showShareSheet={shareSheetVisible}
      showDistilledForm={distilledFormSheetVisible}
      showWeaveInfo={weaveInfoSheetVisible}
      showThreadStrength={threadStrengthSheetVisible}
      showExportSheet={showExportSheet}
      showConfirmDelete={confirmDeleteVisible}
      showConfirmRelease={confirmUnchargedBurnVisible}
      showShareCard={showShareCard}
      shareCardRef={shareCardRef}
      shareFormat={shareFormat}
      onChangeShareFormat={setShareFormat}
      onBack={() => navigation?.goBack()}
      onOpenOptions={() => setDetailOptionsVisible(true)}
      onCloseOptions={() => setDetailOptionsVisible(false)}
      onOpenShareSheet={() => setShareSheetVisible(true)}
      onCloseShareSheet={() => setShareSheetVisible(false)}
      onOpenDistilledForm={() => setDistilledFormSheetVisible(true)}
      onCloseDistilledForm={() => setDistilledFormSheetVisible(false)}
      onOpenWeaveInfo={() => setWeaveInfoSheetVisible(true)}
      onCloseWeaveInfo={() => setWeaveInfoSheetVisible(false)}
      onOpenThreadStrength={() => setThreadStrengthSheetVisible(true)}
      onCloseThreadStrength={() => setThreadStrengthSheetVisible(false)}
      onOpenWeave={handleOpenWeave}
      onPractice={handlePracticePress}
      onShare={handleShareAnchor}
      onSetWallpaper={handleSetWallpaper}
      onSavePng={() => setShowExportSheet(true)}
      onCloseExport={() => setShowExportSheet(false)}
      onRelease={() => {
        setDetailOptionsVisible(false);
        handleBurn();
      }}
      onDelete={() => {
        setDetailOptionsVisible(false);
        handleDelete();
      }}
      onCloseDelete={() => setConfirmDeleteVisible(false)}
      onConfirmDelete={confirmDeleteAnchor}
      onCloseRelease={() => setConfirmUnchargedBurnVisible(false)}
      onConfirmRelease={executeBurn}
      onShareCardRendered={() => {
        shareCardRenderedRef.current = true;
        setShareCardRendered(true);
      }}
    />
  );
};

const editorial = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.anchor15.ink },
  pressed: { opacity: 0.75 },
  header: { minHeight: 52, paddingHorizontal: 14, paddingBottom: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerControl: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  backControl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingRight: 12 },
  backLabel: { color: colors.anchor15.bone, fontFamily: typography.fontFamily.instrument, fontSize: 13, marginLeft: 1 },
  statusWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 34 },
  statusRule: { width: 44, height: StyleSheet.hairlineWidth, backgroundColor: colors.anchor15.gilt, marginBottom: 22 },
  statusTitle: { color: colors.anchor15.bone, fontFamily: typography.fontFamily.voice, fontSize: 26, lineHeight: 31, textAlign: 'center' },
  statusBody: { maxWidth: 270, color: colors.anchor15.ash, fontFamily: typography.fontFamily.voiceItalic, fontSize: 16, lineHeight: 22, textAlign: 'center', marginTop: 10 },
  statusAction: { minHeight: 44, marginTop: 25, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.anchor15.gilt },
  statusActionText: { color: colors.anchor15.giltBright, fontFamily: typography.fontFamily.ritual, fontSize: 10, letterSpacing: 1.8 },
  scroll: { paddingHorizontal: 22, paddingTop: 0 },
  cachedLabel: { color: colors.anchor15.ash, fontFamily: typography.fontFamily.instrument, fontSize: 11, lineHeight: 16, textAlign: 'center', marginBottom: 10 },
  heroArtworkWrap: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: 4, marginBottom: 2 },
  identity: { alignItems: 'center', marginTop: 14 },
  anchorName: { maxWidth: '100%', color: colors.anchor15.bone, fontFamily: typography.fontFamily.ritualSemiBold, fontSize: 25, lineHeight: 30, letterSpacing: 2, textAlign: 'center', textTransform: 'uppercase' },
  category: { color: colors.anchor15.gilt, fontFamily: typography.fontFamily.ritual, fontSize: 10, letterSpacing: 2.2, textAlign: 'center', textTransform: 'uppercase', marginTop: 5 },
  intention: { maxWidth: 324, color: 'rgba(244,239,230,0.68)', fontFamily: typography.fontFamily.voiceItalic, fontSize: 16, lineHeight: 22, textAlign: 'center', marginTop: 8 },
  centeredLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  sectionEyebrow: { color: 'rgba(242,223,168,0.78)', fontFamily: typography.fontFamily.ritual, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase' },
  infoButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginHorizontal: -6 },
  formSection: { marginTop: 18, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.anchor15.hairline },
  lettersRow: { minHeight: 30, marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 10 },
  letter: { color: colors.anchor15.giltBright, fontFamily: typography.fontFamily.ritualSemiBold, fontSize: 16, letterSpacing: 1 },
  letterDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(217,179,108,0.48)' },
  emptyForm: { color: colors.anchor15.ash, fontFamily: typography.fontFamily.voiceItalic, fontSize: 13, textAlign: 'center' },
  strengthSection: { marginTop: 16 },
  strengthContent: { alignItems: 'center', paddingTop: 2 },
  strengthNumberRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 0 },
  strengthNumber: { color: colors.anchor15.bone, fontFamily: typography.fontFamily.instrument, fontSize: 54, fontWeight: '200', letterSpacing: -2.5, lineHeight: 60, fontVariant: ['tabular-nums'] },
  strengthOutOf: { color: 'rgba(135,147,157,0.66)', fontFamily: typography.fontFamily.instrument, fontSize: 11, letterSpacing: 1, marginLeft: 8 },
  threadStateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  stateRule: { width: 14, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(217,179,108,0.54)' },
  threadState: { color: colors.anchor15.giltBright, fontFamily: typography.fontFamily.ritualSemiBold, fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase' },
  strengthExplanation: { maxWidth: 285, color: 'rgba(244,239,230,0.58)', fontFamily: typography.fontFamily.voiceItalic, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.anchor15.hairline, marginTop: 16 },
  firstRule: { marginTop: 16 },
  weaveSection: { marginTop: 14 },
  weaveTopLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  weaveIntro: { flex: 1, color: 'rgba(244,239,230,0.52)', fontFamily: typography.fontFamily.voiceItalic, fontSize: 13.5, lineHeight: 18, paddingRight: 4 },
  weaveEntry: { paddingTop: 2 },
  weaveHeadingRow: { minHeight: 28, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weaveCanvas: {
    height: WEAVE_PLOT_HEIGHT,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(18, 25, 33, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(217,179,108,0.15)',
    marginTop: 6,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weaveEmptyWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  weaveEmpty: { color: 'rgba(244,239,230,0.48)', fontFamily: typography.fontFamily.voiceItalic, fontSize: 13, textAlign: 'center' },
  weaveFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 },
  weaveMeta: { flex: 1, color: 'rgba(244,239,230,0.66)', fontFamily: typography.fontFamily.instrument, fontSize: 11 },
  weaveLink: { color: colors.anchor15.giltBright, fontFamily: typography.fontFamily.ritualSemiBold, fontSize: 9, letterSpacing: 1.25, marginLeft: 10 },
  metricsSection: { marginTop: 14 },
  metricsRow: { flexDirection: 'row', paddingTop: 10 },
  metric: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  metricValue: { color: colors.anchor15.bone, fontFamily: typography.fontFamily.instrument, fontSize: 18, lineHeight: 22, textAlign: 'center' },
  metricLabel: { color: 'rgba(135,147,157,0.82)', fontFamily: typography.fontFamily.ritual, fontSize: 7.5, letterSpacing: 1.2, textAlign: 'center', marginTop: 3 },
  mixSection: { marginTop: 16 },
  mixRow: { flexDirection: 'row', alignItems: 'center', minHeight: 25, gap: 9 },
  mixName: { width: 83, fontFamily: typography.fontFamily.instrument, fontSize: 12 },
  mixTrack: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(244,239,230,0.12)' },
  mixFill: { height: 2, marginTop: -0.5 },
  mixValue: { width: 18, color: colors.anchor15.ash, fontFamily: typography.fontFamily.instrument, fontSize: 11, textAlign: 'right' },
  lowHistoryCopy: { color: 'rgba(244,239,230,0.52)', fontFamily: typography.fontFamily.voiceItalic, fontSize: 14, lineHeight: 20, marginTop: 8 },
  activitySection: { marginTop: 14 },
  activityRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center' },
  activityRowRule: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(244,239,230,0.08)' },
  activityDot: { width: 5, height: 5, borderRadius: 2.5, marginRight: 10 },
  activityCopy: { flex: 1 },
  activityTitle: { color: 'rgba(244,239,230,0.88)', fontFamily: typography.fontFamily.instrument, fontSize: 13 },
  activityMeta: { color: colors.anchor15.ash, fontFamily: typography.fontFamily.voiceItalic, fontSize: 12.5, marginTop: 1 },
  
  // ── UTILITY ROWS ──
  utilitySection: { marginTop: 14 },
  utilityRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(244,239,230,0.08)',
  },
  utilityText: {
    color: colors.anchor15.giltBright,
    fontFamily: typography.fontFamily.ritualSemiBold,
    fontSize: 10.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },

  // ── WALLPAPER & EXPORT MODAL ──
  exportModalWrap: { gap: 14, paddingTop: 6, paddingBottom: 10 },
  exportModalTitle: {
    color: colors.anchor15.bone,
    fontFamily: typography.fontFamily.voice,
    fontSize: 20,
    lineHeight: 25,
    textAlign: 'center',
  },
  exportModalBody: {
    color: 'rgba(244, 239, 230, 0.65)',
    fontFamily: typography.fontFamily.voiceItalic,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  formatToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  formatPill: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(217, 179, 108, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    paddingVertical: 7,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatPillActive: {
    borderColor: colors.anchor15.giltBright,
    backgroundColor: 'rgba(217, 179, 108, 0.1)',
  },
  formatPillText: {
    color: 'rgba(244, 239, 230, 0.55)',
    fontFamily: typography.fontFamily.ritualSemiBold,
    fontSize: 9.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  formatPillTextActive: {
    color: colors.anchor15.giltBright,
  },
  formatPillDim: {
    marginTop: 1,
    color: 'rgba(244, 239, 230, 0.4)',
    fontFamily: typography.fontFamily.instrument,
    fontSize: 9.5,
  },
  formatPillDimActive: {
    color: 'rgba(217, 179, 108, 0.85)',
  },
  exportActionPrimary: {
    backgroundColor: colors.anchor15.giltBright,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  exportActionPrimaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  exportActionPrimaryText: {
    color: '#10151A',
    fontFamily: typography.fontFamily.ritualSemiBold,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  exportSecondaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  exportActionSecondary: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(217, 179, 108, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingVertical: 9,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportActionSecondaryText: {
    color: 'rgba(244, 239, 230, 0.72)',
    fontFamily: typography.fontFamily.ritualSemiBold,
    fontSize: 9.5,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },

  releaseSection: { marginTop: 14 },
  releaseRule: { marginTop: 0, backgroundColor: 'rgba(217,179,108,0.14)' },
  releaseRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  releaseText: { color: 'rgba(200,135,96,0.86)', fontFamily: typography.fontFamily.ritualSemiBold, fontSize: 10.5, letterSpacing: 1.5, textTransform: 'uppercase' },
  releasedText: { minHeight: 44, color: 'rgba(200,135,96,0.74)', fontFamily: typography.fontFamily.voiceItalic, fontSize: 14, paddingTop: 10 },
  createdDate: { color: 'rgba(135,147,157,0.68)', fontFamily: typography.fontFamily.instrument, fontSize: 11, marginTop: 1 },
  floatingCtaWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 22, paddingTop: 28, backgroundColor: 'rgba(15,20,25,0.92)' },
  floatingCta: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, borderWidth: 1, borderColor: 'rgba(217,179,108,0.38)', backgroundColor: 'rgba(217,179,108,0.09)' },
  floatingCtaText: { color: colors.anchor15.giltBright, fontFamily: typography.fontFamily.ritualSemiBold, fontSize: 11.5, letterSpacing: 1.6 },
  sheetScrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.62)' },
  sheet: { backgroundColor: colors.anchor15.veil, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.anchor15.goldHairline, paddingHorizontal: 22, paddingBottom: 30 },
  sheetHandle: { width: 34, height: 3, borderRadius: 3, alignSelf: 'center', backgroundColor: 'rgba(244,239,230,0.28)', marginTop: 11 },
  sheetHeader: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.anchor15.hairline },
  sheetTitle: { color: colors.anchor15.bone, fontFamily: typography.fontFamily.voice, fontSize: 22, lineHeight: 27 },
  sheetClose: { width: 44, height: 44, alignItems: 'flex-end', justifyContent: 'center' },
  sheetBody: { color: 'rgba(244,239,230,0.7)', fontFamily: typography.fontFamily.voiceItalic, fontSize: 16, lineHeight: 23, marginTop: 14 },
  optionRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(244,239,230,0.08)' },
  optionText: { color: colors.anchor15.bone, fontFamily: typography.fontFamily.instrument, fontSize: 15 },
  optionRelease: { color: 'rgba(200,135,96,0.9)', fontFamily: typography.fontFamily.instrument, fontSize: 15 },
  optionDelete: { borderBottomWidth: 0 },
  optionDeleteText: { color: '#E8B7A4', fontFamily: typography.fontFamily.instrument, fontSize: 15 },
  captureTarget: { position: 'absolute', left: -9999, width: 1170, height: 2532, backgroundColor: colors.anchor15.navy, alignItems: 'center', justifyContent: 'center' },
  captureArtwork: { width: 720, height: 720, borderRadius: 360, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.anchor15.veil },
  captureImage: { width: '100%', height: '100%' },
  captureMark: { color: colors.anchor15.giltBright, fontFamily: typography.fontFamily.ritual, fontSize: 240 },
  captureIntention: { width: 920, color: colors.anchor15.bone, fontFamily: typography.fontFamily.voiceItalic, fontSize: 42, lineHeight: 56, textAlign: 'center', marginTop: 48 },
  captureWordmark: { color: colors.anchor15.gilt, fontFamily: typography.fontFamily.ritual, fontSize: 26, letterSpacing: 9, textAlign: 'center', marginTop: 24, marginBottom: 80 },
});

export const AnchorDetailsScreen = AnchorDetailScreen;
export default AnchorDetailScreen;
