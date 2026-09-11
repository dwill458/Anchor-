import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ChevronRight, Eye, MoreHorizontal, Sparkles } from 'lucide-react-native';
import {
  V2ChartRouteMap,
  V2OneMoveCard,
  V2WaypointDetailSheet,
  V2WaypointReachedModal,
  V2WaypointCelebrationModal,
  V2EditChartSheet,
  V2JourneyOverviewSheet,
} from '@/components/v2/chart';
import { V2EmptyState, V2Screen, V2TopBar } from '@/components/v2';
import { useV2Chart } from '@/hooks/v2/chart';
import { useAnchorStore } from '@/stores/anchorStore';
import { colors, getCategoryColor, radii, spacing, typography } from '@/theme/v2';

export interface V2ChartRouteParams {
  courseId?: string;
  anchorId?: string;
}

export interface V2ChartScreenProps {
  courseId?: string;
  anchorId?: string;
  onBack?: () => void;
  onOpenVision?: (anchorId?: string) => void;
  onReinforceAnchor?: (anchorId: string) => void;
  testID?: string;
}

export function V2ChartScreen(props: V2ChartScreenProps) {
  const route = useRoute<RouteProp<Record<string, V2ChartRouteParams>, string>>();
  const navigation = useNavigation();

  const courseId = props.courseId ?? route.params?.courseId;
  const anchorId = props.anchorId ?? route.params?.anchorId;

  const anchor = useAnchorStore((s) =>
    anchorId ? s.anchors.find((a) => a.id === anchorId || a.localId === anchorId) : null,
  );
  const categoryColor = getCategoryColor(anchor?.category);

  const {
    chart,
    activeCourse,
    loading,
    error,
    template,
    setTemplate,
    connectedVisionId,
    setConnectedVisionId,
    completeOneMove,
    addMove,
    reachWaypoint,
    reorderWaypoints,
    updateWaypointTitle,
    addNewWaypoint,
  } = useV2Chart(courseId, anchorId);

  // Active sheets and modals state
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(null);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isCelebrationModalOpen, setIsCelebrationModalOpen] = useState(false);
  const [celebrationDetails, setCelebrationDetails] = useState<{
    isDestination: boolean;
    destinationText: string;
    nextWaypointTitle?: string | null;
  } | null>(null);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [isJourneySheetOpen, setIsJourneySheetOpen] = useState(false);

  const handleBack = () => {
    if (props.onBack) {
      props.onBack();
    } else if (navigation?.canGoBack && navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  if (loading && !chart) {
    return (
      <V2Screen testID="v2-chart-screen-loading">
        <V2TopBar title="Chart" onBackPress={handleBack} />
        <View style={styles.centerContainer}>
          <ActivityIndicator color={categoryColor} size="large" />
        </View>
      </V2Screen>
    );
  }

  if (!chart || !activeCourse) {
    return (
      <V2Screen testID="v2-chart-screen-empty">
        <V2TopBar title="Chart" onBackPress={handleBack} />
        <V2EmptyState
          title="No Active Chart"
          message={error ?? 'Start a Chart to map your route toward your destination.'}
        />
      </V2Screen>
    );
  }

  const selectedWaypoint =
    chart.waypoints.find((w) => w.id === selectedWaypointId) ?? chart.currentWaypoint;

  const handleWaypointPress = (wpId: string) => {
    setSelectedWaypointId(wpId);
    setIsDetailSheetOpen(true);
  };

  const handlePromptReached = () => {
    if (chart.currentWaypoint) {
      setIsConfirmModalOpen(true);
    }
  };

  const handleConfirmReach = async () => {
    if (!chart.currentWaypoint) return;
    const wpId = chart.currentWaypoint.id;
    const currentIndex = chart.currentWaypointIndex;
    const nextWp = chart.waypoints[currentIndex + 1];

    setIsConfirmModalOpen(false);
    const result = await reachWaypoint(wpId);

    if (result.success) {
      setCelebrationDetails({
        isDestination: result.isDestination,
        destinationText: chart.destinationText,
        nextWaypointTitle: nextWp?.value ?? null,
      });
      setIsCelebrationModalOpen(true);
    }
  };

  return (
    <V2Screen testID={props.testID ?? 'v2-chart-screen'}>
      <V2TopBar
        title="Chart"
        onBackPress={handleBack}
        utility={
          <Pressable
            testID="edit-chart-trigger-btn"
            accessibilityRole="button"
            accessibilityLabel="Edit Chart"
            onPress={() => setIsEditSheetOpen(true)}
            style={styles.headerButton}
          >
            <MoreHorizontal size={20} color={colors.text.primary} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Destination Heading Section */}
        <View style={styles.destinationCard}>
          <View style={styles.destinationTextGroup}>
            <View style={styles.destinationEyebrowRow}>
              <Text style={styles.eyebrow}>DESTINATION</Text>
              <Sparkles size={12} color="#FFA32C" />
            </View>
            <Text style={styles.destinationTitle}>{chart.destinationText}</Text>
            <Text style={styles.destinationDesc}>
              A bigger impact. More people anchored to a brighter future.
            </Text>
          </View>

          {/* Connected Vision Pill / Button */}
          <Pressable
            onPress={() => {
              if (props.onOpenVision) {
                props.onOpenVision(anchorId);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={
              chart.hasConnectedVision ? 'Open connected Vision' : 'Connect Vision'
            }
            style={styles.visionButton}
          >
            <Eye size={14} color="#3157D8" />
            <Text style={styles.visionButtonText}>
              {chart.hasConnectedVision ? 'Connected Vision' : 'Vision'}
            </Text>
            <ChevronRight size={12} color="#3157D8" />
          </Pressable>
        </View>

        {/* Illustrated SVG Route Map Canvas */}
        <View style={styles.mapCanvasWrapper}>
          <V2ChartRouteMap
            waypoints={chart.waypoints}
            currentWaypointIndex={chart.currentWaypointIndex}
            template={chart.template}
            onWaypointPress={handleWaypointPress}
            onAnchorPress={() => {
              if (anchorId && props.onReinforceAnchor) {
                props.onReinforceAnchor(anchorId);
              }
            }}
          />
        </View>

        {/* One Move / Current Waypoint Action Card */}
        <V2OneMoveCard
          currentWaypoint={chart.currentWaypoint}
          oneMove={chart.oneMove}
          isFinished={chart.isFinished}
          destinationText={chart.destinationText}
          onCompleteMove={completeOneMove}
          onPromptReached={handlePromptReached}
          onAddMovePress={(wpId) => {
            setSelectedWaypointId(wpId);
            setIsDetailSheetOpen(true);
          }}
          onLookBackPress={() => setIsJourneySheetOpen(true)}
        />

        {/* Footer Journey Summary */}
        <View style={styles.footerRow}>
          <Text style={styles.footerProgress}>
            {chart.reachedCount} of {chart.totalWaypoints} waypoints reached
          </Text>
          <Pressable
            testID="view-journey-btn"
            onPress={() => setIsJourneySheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="View journey"
            style={styles.journeyLink}
          >
            <Text style={styles.journeyLinkText}>View journey</Text>
            <ChevronRight size={14} color="#3157D8" />
          </Pressable>
        </View>
      </ScrollView>

      {/* 1. Waypoint Detail Sheet */}
      <V2WaypointDetailSheet
        visible={isDetailSheetOpen}
        waypoint={selectedWaypoint}
        isCurrent={Boolean(
          selectedWaypoint && chart.currentWaypoint && selectedWaypoint.id === chart.currentWaypoint.id,
        )}
        onClose={() => setIsDetailSheetOpen(false)}
        onAddMove={addMove}
        onGoToOneMove={() => setIsDetailSheetOpen(false)}
        onReinforceAnchor={() => {
          if (anchorId && props.onReinforceAnchor) {
            props.onReinforceAnchor(anchorId);
          }
        }}
      />

      {/* 2. Waypoint Reached Confirmation Modal */}
      <V2WaypointReachedModal
        visible={isConfirmModalOpen}
        waypointTitle={chart.currentWaypoint?.value ?? ''}
        hasPendingMoves={Boolean(chart.oneMove)}
        onConfirm={handleConfirmReach}
        onCancel={() => setIsConfirmModalOpen(false)}
      />

      {/* 3. Waypoint / Destination Celebration Modal */}
      {celebrationDetails && (
        <V2WaypointCelebrationModal
          visible={isCelebrationModalOpen}
          isDestination={celebrationDetails.isDestination}
          destinationText={celebrationDetails.destinationText}
          nextWaypointTitle={celebrationDetails.nextWaypointTitle}
          onContinue={() => {
            setIsCelebrationModalOpen(false);
            if (celebrationDetails.isDestination) {
              setIsJourneySheetOpen(true);
            }
          }}
        />
      )}

      {/* 4. Edit Chart Sheet */}
      <V2EditChartSheet
        visible={isEditSheetOpen}
        waypoints={chart.waypoints}
        template={template}
        hasConnectedVision={chart.hasConnectedVision}
        onClose={() => setIsEditSheetOpen(false)}
        onReorder={reorderWaypoints}
        onUpdateTitle={updateWaypointTitle}
        onAddWaypoint={(title) => addNewWaypoint(title)}
        onChangeTemplate={setTemplate}
        onToggleVision={() =>
          setConnectedVisionId(connectedVisionId ? null : 'vision-linked')
        }
      />

      {/* 5. Journey Overview Sheet */}
      <V2JourneyOverviewSheet
        visible={isJourneySheetOpen}
        waypoints={chart.waypoints}
        onClose={() => setIsJourneySheetOpen(false)}
      />
    </V2Screen>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: spacing[4],
    gap: spacing[4],
    paddingBottom: spacing[8],
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destinationCard: {
    padding: spacing[4],
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: spacing[2],
  },
  destinationTextGroup: {
    gap: 4,
  },
  destinationEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.text.secondary,
    letterSpacing: 0.8,
  },
  destinationTitle: {
    ...typography.headingMD,
    color: colors.text.primary,
  },
  destinationDesc: {
    ...typography.bodyMD,
    color: colors.text.secondary,
  },
  visionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: spacing[2],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  visionButtonText: {
    ...typography.labelSM,
    color: '#3157D8',
    fontWeight: '600',
  },
  mapCanvasWrapper: {
    width: '100%',
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
  },
  footerProgress: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  journeyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  journeyLinkText: {
    ...typography.labelSM,
    color: '#3157D8',
    fontWeight: '600',
  },
});
