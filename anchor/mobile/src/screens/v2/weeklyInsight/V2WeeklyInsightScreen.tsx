/**
 * Anchor 2.0 Weekly Insight Screen (Screen 23 of the locked 23-screen system).
 *
 * Sourced from:
 * - Section 23 of Anchor_Design_System_Living_Spec_v0_4_WEEKLY_INSIGHT_LOCKED.docx
 * - Anchor_2.0_Weekly_Insight_Prototype.html
 * - Section 14 of Anchor_Design_System_Living_Spec_v0_4_BRUSH_LANGUAGE_LOCKED.docx (LOW brush density)
 *
 * Characteristics:
 * - Editorial print aesthetic on warm mineral canvas (#F4F1E9)
 * - One deterministic primary narrative strictly driven by visible persisted evidence
 * - Visual evidence charts and stage graphics
 * - Collapsible detailed activity disclosure
 * - Preserved history snapshot archive drawer
 * - Reflection rating controls with toast feedback
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, History } from 'lucide-react-native';
import { colors, radii, spacing, typography } from '@/theme/v2';
import type {
  V2WeeklyInsightIntegrationCallbacks,
  V2WeeklyInsightRouteParams,
  WeeklyInsightFeedbackRating,
} from '@/constants/v2/weeklyInsightRoutes';
import { useWeeklyInsight } from '@/hooks/v2/weeklyInsight';
import {
  WeeklyActivityDisclosure,
  WeeklyEvidenceRow,
  WeeklyFeedbackWidget,
  WeeklyHistoryDrawer,
  WeeklyInsightEmptyState,
  WeeklyInsightVisual,
  WeeklyInterpretation,
  WeeklyNextDirection,
} from '@/components/v2/weeklyInsight';
import type { WeeklyInsightFacts } from '@/adapters/v2/weeklyInsight/types';

export interface V2WeeklyInsightScreenProps extends V2WeeklyInsightIntegrationCallbacks {
  route?: {
    params?: V2WeeklyInsightRouteParams;
  };
  navigation?: any;
  /** Direct parameters for component use or testing */
  anchorId?: string;
  snapshotId?: string;
  weekOffset?: number;
  factsOverride?: WeeklyInsightFacts;
  testID?: string;
}

export const V2WeeklyInsightScreen: React.FC<V2WeeklyInsightScreenProps> = ({
  route,
  navigation,
  anchorId: propAnchorId,
  snapshotId: propSnapshotId,
  weekOffset: propWeekOffset,
  factsOverride,
  onBack,
  onNavigateToAnchor,
  onNavigateToChart,
  onNavigateToVision,
  onFeedbackSubmit,
  testID = 'v2-weekly-insight-screen',
}) => {
  const insets = useSafeAreaInsets();

  const anchorId = route?.params?.anchorId ?? propAnchorId;
  const snapshotId = route?.params?.snapshotId ?? propSnapshotId;
  const weekOffset = route?.params?.weekOffset ?? propWeekOffset ?? 0;

  const {
    snapshot,
    loading,
    isFirstWeekEmpty,
    archiveItems,
    isActivityOpen,
    toggleActivity,
    isArchiveOpen,
    openArchive,
    closeArchive,
    selectSnapshot,
    submitFeedback,
    feedbackSubmitted,
    refresh,
  } = useWeeklyInsight({
    anchorId,
    snapshotId,
    weekOffset,
    factsOverride,
    onFeedbackSubmit,
  });

  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (message: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(message);
    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();

    toastTimeoutRef.current = setTimeout(() => {
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => setToastMessage(null));
    }, 1400);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (navigation?.canGoBack?.()) {
      navigation.goBack();
    }
  };

  const handleFeedback = (rating: WeeklyInsightFeedbackRating) => {
    submitFeedback(rating);
    showToast('Reflection saved');
  };

  const handleSelectHistoricalSnapshot = (id: string) => {
    selectSnapshot(id);
    showToast('Historical snapshot');
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  // 1. Loading state (when no snapshot yet)
  if (loading && !snapshot) {
    return (
      <View
        style={[styles.centerRoot, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
        testID={`${testID}-loading`}
      >
        <ActivityIndicator size="small" color={colors.text.secondary} />
        <Text style={styles.loadingText}>Reading weekly evidence...</Text>
      </View>
    );
  }

  // 2. First-week empty state
  if (isFirstWeekEmpty || (!snapshot && !factsOverride)) {
    return (
      <View
        style={[styles.fullRoot, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
        testID={`${testID}-empty`}
      >
        <WeeklyInsightEmptyState onBack={handleBack} />
      </View>
    );
  }

  if (!snapshot) return null;

  return (
    <View
      style={[styles.fullRoot, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      testID={testID}
    >
      {/* Editorial Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.headerIconBtn}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          testID={`${testID}-back-btn`}
          hitSlop={12}
        >
          <ArrowLeft size={19} color={colors.text.primary} />
        </Pressable>

        <Text style={styles.headerTitle}>Weekly Insight</Text>

        <Pressable
          style={styles.headerIconBtn}
          onPress={openArchive}
          accessibilityRole="button"
          accessibilityLabel="View previous Weekly Insights"
          testID={`${testID}-history-btn`}
          hitSlop={12}
        >
          <History size={19} color={colors.text.primary} />
        </Pressable>
      </View>

      {/* Main Scrollable Surface */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.text.secondary}
          />
        }
      >
        {/* 1. Completed-Week Date Range */}
        <View style={styles.dateRow}>
          <Text style={styles.dateEyebrow}>{snapshot.weekLabel.toUpperCase()}</Text>
          <Text style={styles.dateSnapshot}>{snapshot.completedDateLabel}</Text>
        </View>

        {/* 2. Primary Story Hero Headline & Support */}
        <View style={styles.heroSection}>
          <Text style={styles.heroHeadline}>{snapshot.headline}</Text>
          <Text style={styles.heroSupport}>{snapshot.support}</Text>
        </View>

        {/* 3. Contextual Visual Shell */}
        <WeeklyInsightVisual
          visualType={snapshot.visualType}
          visualData={snapshot.visualData}
          accentColor={snapshot.accentColor}
          testID={`${testID}-visual`}
        />

        {/* 4. Compact Tabular Supporting Evidence */}
        <WeeklyEvidenceRow
          evidence={snapshot.evidence}
          comparison={snapshot.comparison}
          comparisonTone={snapshot.comparisonTone}
          accentColor={snapshot.accentColor}
          testID={`${testID}-evidence`}
        />

        {/* 5. Grounded Interpretation ("What this means") */}
        <WeeklyInterpretation
          interpretation={snapshot.interpretation}
          testID={`${testID}-interpretation`}
        />

        {/* 6. Next Direction Callout ("Next week") */}
        <WeeklyNextDirection
          nextDirection={snapshot.nextDirection}
          accentColor={snapshot.accentColor}
          testID={`${testID}-next-direction`}
        />

        {/* 7. Lightweight Reflection Feedback */}
        <WeeklyFeedbackWidget
          selectedRating={feedbackSubmitted ?? snapshot.feedback}
          onSelectRating={handleFeedback}
          testID={`${testID}-feedback`}
        />

        {/* 8. Detailed Activity Disclosure */}
        <WeeklyActivityDisclosure
          detailedActivity={snapshot.detailedActivity}
          isOpen={isActivityOpen}
          onToggle={toggleActivity}
          accentColor={snapshot.accentColor}
          testID={`${testID}-disclosure`}
        />
      </ScrollView>

      {/* Historical Preserved Snapshots Drawer */}
      <WeeklyHistoryDrawer
        visible={isArchiveOpen}
        onClose={closeArchive}
        items={archiveItems}
        onSelectSnapshot={handleSelectHistoricalSnapshot}
        testID={`${testID}-history-drawer`}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <Animated.View
          style={[styles.toast, { opacity: toastOpacity }]}
          pointerEvents="none"
          testID={`${testID}-toast`}
        >
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  fullRoot: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  centerRoot: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
  },
  loadingText: {
    fontFamily: typography.body,
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 12,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(216, 210, 200, 0.45)',
    backgroundColor: colors.canvas,
  },
  headerTitle: {
    fontFamily: typography.bodyMedium,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.1,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingTop: 22,
  },
  dateEyebrow: {
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.88,
    color: colors.text.disabled,
  },
  dateSnapshot: {
    fontFamily: typography.body,
    fontSize: 11,
    color: colors.text.disabled,
  },
  heroSection: {
    paddingHorizontal: spacing[5],
    paddingTop: 14,
    paddingBottom: spacing[4],
  },
  heroHeadline: {
    fontFamily: typography.displaySemiBold,
    fontSize: 35,
    lineHeight: 36,
    letterSpacing: -1.2,
    color: colors.text.primary,
    maxWidth: 335,
  },
  heroSupport: {
    fontFamily: typography.body,
    fontSize: 15.5,
    lineHeight: 23,
    color: colors.text.secondary,
    maxWidth: 337,
    letterSpacing: -0.15,
    marginTop: 13,
  },
  toast: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: colors.text.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radii.pill,
    zIndex: 99,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  toastText: {
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    fontWeight: '700',
    color: colors.canvas,
  },
});
