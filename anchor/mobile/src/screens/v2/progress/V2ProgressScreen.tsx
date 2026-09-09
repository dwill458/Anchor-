import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Compass, Eye, RefreshCw } from 'lucide-react-native';
import { colors, radii, spacing, typography } from '@/theme/v2';
import { V2Button } from '@/components/v2';
import { useV2Progress } from '@/hooks/v2/progress';
import {
  V2ProgressHero,
  V2EvidenceSummary,
  V2ThreadEventTimeline,
  V2ThreadEventDetailSheet,
} from '@/components/v2/progress';

export interface V2ProgressScreenProps {
  anchorId?: string;
  onBack?: () => void;
  onNavigateToChart?: (anchorId: string) => void;
  onNavigateToVision?: (anchorId: string) => void;
  onNavigateToPractice?: (anchorId: string) => void;
  testID?: string;
}

export const V2ProgressScreen: React.FC<V2ProgressScreenProps> = ({
  anchorId,
  onBack,
  onNavigateToChart,
  onNavigateToVision,
  onNavigateToPractice,
  testID = 'v2-progress-screen',
}) => {
  const insets = useSafeAreaInsets();
  const { model, loading, error, selectedEvent, setSelectedEvent, refresh } = useV2Progress({
    anchorId,
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading && !model) {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top }]} testID={`${testID}-loading`}>
        <ActivityIndicator size="large" color="#41C8C6" />
        <Text style={styles.loadingText}>Gathering verifiable evidence...</Text>
      </View>
    );
  }

  if (error && !model) {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top }]} testID={`${testID}-error`}>
        <Text style={styles.errorTitle}>Unable to load progress</Text>
        <Text style={styles.errorSubtext}>{error}</Text>
        <V2Button variant="primary" onPress={refresh} style={styles.retryBtn}>
          Retry
        </V2Button>
      </View>
    );
  }

  if (!model) {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top }]} testID={`${testID}-empty`}>
        <Text style={styles.emptyTitle}>No Anchor Selected</Text>
        <Text style={styles.emptySubtext}>Select or create an Anchor to view progress and evidence.</Text>
        {onBack && (
          <V2Button variant="tertiary" onPress={onBack}>
            Go Back
          </V2Button>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID={testID}>
      {/* Header */}
      <View style={styles.header}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            style={styles.backButton}
            testID={`${testID}-back-btn`}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <ArrowLeft size={22} color={colors.text.primary} />
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}

        <Text style={styles.headerTitle}>PROGRESS & EVIDENCE</Text>

        <Pressable
          onPress={handleRefresh}
          style={styles.refreshButton}
          testID={`${testID}-refresh-btn`}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Refresh progress"
        >
          <RefreshCw size={18} color={colors.text.secondary} />
        </Pressable>
      </View>

      {/* Main Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#41C8C6"
          />
        }
      >
        {/* Navigation Triangle Shortcuts */}
        <View style={styles.navTriangleRow}>
          {onNavigateToVision && (
            <Pressable
              style={styles.trianglePill}
              onPress={() => onNavigateToVision(model.anchorId)}
              testID={`${testID}-nav-vision`}
              accessibilityRole="button"
              accessibilityLabel="View Vision"
            >
              <Eye size={14} color="#8EE0CF" />
              <Text style={styles.trianglePillText}>Vision (See)</Text>
            </Pressable>
          )}

          {onNavigateToChart && (
            <Pressable
              style={styles.trianglePill}
              onPress={() => onNavigateToChart(model.anchorId)}
              testID={`${testID}-nav-chart`}
              accessibilityRole="button"
              accessibilityLabel="View Chart"
            >
              <Compass size={14} color="#6C90F3" />
              <Text style={styles.trianglePillText}>Chart (Move)</Text>
            </Pressable>
          )}
        </View>

        {/* 1. Hero Anchor Intention + Thread Strength */}
        <V2ProgressHero model={model} testID={`${testID}-hero`} />

        {/* 2. Verifiable Evidence Summary */}
        <V2EvidenceSummary model={model} testID={`${testID}-summary`} />

        {/* 3. Durable Thread Events Timeline */}
        <V2ThreadEventTimeline
          events={model.events}
          onSelectEvent={setSelectedEvent}
          testID={`${testID}-timeline`}
        />
      </ScrollView>

      {/* Event Detail Bottom Sheet */}
      <V2ThreadEventDetailSheet
        event={selectedEvent}
        visible={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        testID={`${testID}-event-detail`}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0D12',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0A0D12',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  loadingText: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  errorTitle: {
    ...typography.headingMD,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  errorSubtext: {
    ...typography.bodyMD,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryBtn: {
    minWidth: 140,
  },
  emptyTitle: {
    ...typography.headingMD,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    ...typography.bodyMD,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSpacer: {
    width: 36,
  },
  headerTitle: {
    ...typography.labelSM,
    color: colors.text.secondary,
    letterSpacing: 1.2,
  },
  refreshButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  navTriangleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  trianglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  trianglePillText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
  },
});
