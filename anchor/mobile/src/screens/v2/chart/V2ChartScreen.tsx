import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import {
  ChevronRight,
  Eye,
  MoreHorizontal,
  RotateCcw,
  Sparkles,
  WifiOff,
} from 'lucide-react-native';
import {
  V2ChartEmptyState,
  V2ChartRouteMap,
  V2OneMoveCard,
  V2WaypointDetailSheet,
  V2WaypointReachedModal,
  V2WaypointCelebrationModal,
  V2EditChartSheet,
  V2JourneyOverviewSheet,
  V2VisionDetailSheet,
  V2VisionBrowseSheet,
  V2AnchorDetailSheet,
} from '@/components/v2/chart';
import { V2Button, V2Screen, V2TopBar } from '@/components/v2';
import { useV2Chart } from '@/hooks/v2/chart';
import { useAnchorStore } from '@/stores/anchorStore';
import { colors, radii, spacing, typography } from '@/theme/v2';

export interface V2ChartRouteParams {
  courseId?: string;
  anchorId?: string;
}

export interface V2ChartScreenProps {
  courseId?: string;
  anchorId?: string;
  onBack?: () => void;
  onCreateAnchor?: () => void;
  onOpenVision?: (anchorId?: string) => void;
  onReinforceAnchor?: (anchorId: string) => void;
  testID?: string;
}

export function V2ChartScreen(props: V2ChartScreenProps) {
  const route = useRoute<RouteProp<Record<string, V2ChartRouteParams>, string>>();
  const navigation = useNavigation<any>();

  const courseId =
    props.courseId !== undefined ? props.courseId || undefined : route.params?.courseId;
  const anchorId =
    props.anchorId !== undefined ? props.anchorId : route.params?.anchorId;

  const {
    chart,
    activeCourse,
    loading,
    error,
    isOffline,
    template,
    setTemplate,
    connectedVisionId,
    setConnectedVisionId,
    completeOneMove,
    uncompleteOneMove,
    addMove,
    reachWaypoint,
    reorderWaypoints,
    updateWaypointTitle,
    addNewWaypoint,
    deleteWaypoint,
    createChart,
    activeAnchor,
    refresh,
  } = useV2Chart(courseId);

  const anchorFromStore = useAnchorStore((s) =>
    anchorId
      ? s.anchors.find((a) => a.id === anchorId || a.localId === anchorId)
      : null,
  );
  const effectiveAnchor = anchorFromStore ?? activeAnchor;

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
  const [isJourneyMode, setIsJourneyMode] = useState(false);
  const [isVisionDetailOpen, setIsVisionDetailOpen] = useState(false);
  const [isVisionBrowseOpen, setIsVisionBrowseOpen] = useState(false);
  const [isAnchorDetailOpen, setIsAnchorDetailOpen] = useState(false);

  // Toast with Undo state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const undoActionRef = useRef<(() => void) | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (message: string, onUndo?: () => void) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastMessage(message);
    undoActionRef.current = onUndo ?? null;
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      undoActionRef.current = null;
    }, 4500);
  };

  React.useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const handleBack = () => {
    if (props.onBack) {
      props.onBack();
    } else if (navigation?.canGoBack && navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleCreateAnchor = () => {
    if (props.onCreateAnchor) {
      props.onCreateAnchor();
    } else if (navigation?.navigate) {
      navigation.navigate('V2AnchorCreation');
    }
  };

  const handlePracticeAnchor = () => {
    const targetAnchorId = effectiveAnchor?.id ?? anchorId;
    if (targetAnchorId && props.onReinforceAnchor) {
      props.onReinforceAnchor(targetAnchorId);
    } else if (targetAnchorId && navigation?.navigate) {
      navigation.navigate('V2Practice', {
        anchorId: targetAnchorId,
        source: 'chart',
        returnRoute: 'V2Chart',
      });
    }
  };

  // State N: Error state with retry
  if (error && !chart && !loading) {
    return (
      <V2Screen testID="v2-chart-screen-error">
        <V2TopBar title="Chart" onBackPress={handleBack} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Unable to load Chart</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <V2Button accessibilityLabel="Try again" onPress={refresh}>
            Try again
          </V2Button>
        </View>
      </V2Screen>
    );
  }

  // Loading skeleton state
  if (loading && !chart) {
    return (
      <V2Screen testID="v2-chart-screen-loading">
        <V2TopBar title="Chart" onBackPress={handleBack} />
        <View style={styles.centerContainer}>
          <ActivityIndicator color="#3157D8" size="large" />
          <Text style={styles.loadingText}>Charting your path…</Text>
        </View>
      </V2Screen>
    );
  }

  // State A & State B: Dedicated illustrated Empty States
  if (!chart || !activeCourse) {
    return (
      <V2Screen testID="v2-chart-screen-empty">
        <V2TopBar title="Chart" onBackPress={handleBack} />
        <V2ChartEmptyState
          hasAnchor={Boolean(effectiveAnchor)}
          anchorName={(effectiveAnchor as any)?.name ?? effectiveAnchor?.intentionText}
          onCreateAnchor={handleCreateAnchor}
          onCreateChart={async (destination, tmpl) => {
            setTemplate(tmpl);
            await createChart(destination);
          }}
        />
      </V2Screen>
    );
  }

  const selectedWaypoint =
    chart.waypoints.find((w) => w.id === selectedWaypointId) ??
    chart.currentWaypoint;

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
      showToast(
        result.isDestination
          ? 'Destination reached! Look how far you’ve come.'
          : `Reached ${chart.currentWaypoint.value}!`,
      );
    }
  };

  const handleCompleteMove = (waypointId: string, moveId: string) => {
    completeOneMove(waypointId, moveId);
    showToast('Move completed', () => {
      uncompleteOneMove(waypointId, moveId);
    });
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
            hitSlop={8}
            onPress={() => setIsEditSheetOpen(true)}
            style={styles.headerButton}
          >
            <MoreHorizontal size={20} color={colors.text.primary} />
          </Pressable>
        }
      />

      {/* Floating Toast Notification with Undo */}
      {Boolean(toastMessage) && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toastMessage}</Text>
          {Boolean(undoActionRef.current) && (
            <Pressable
              onPress={() => {
                undoActionRef.current?.();
                setToastMessage(null);
                undoActionRef.current = null;
              }}
              accessibilityRole="button"
              accessibilityLabel="Undo action"
              hitSlop={6}
              style={styles.undoButton}
            >
              <RotateCcw size={12} color="#CBD5FF" />
              <Text style={styles.undoText}>Undo</Text>
            </Pressable>
          )}
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Offline Banner (State M) */}
        {isOffline && (
          <View style={styles.offlineBanner}>
            <WifiOff size={14} color="#8E95A5" />
            <Text style={styles.offlineText}>
              Offline mode · changes will sync when connected
            </Text>
          </View>
        )}

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
              if (chart.hasConnectedVision) {
                setIsVisionDetailOpen(true);
              } else {
                setIsVisionBrowseOpen(true);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={
              chart.hasConnectedVision
                ? 'Open connected Vision'
                : 'Connect Vision'
            }
            hitSlop={6}
            style={styles.visionButton}
          >
            {chart.connectedVisionAssetUrl ? (
              <Image
                source={{ uri: chart.connectedVisionAssetUrl }}
                style={styles.visionThumbnail}
                resizeMode="cover"
              />
            ) : (
              <Eye size={14} color="#3157D8" />
            )}
            <Text style={styles.visionButtonText}>
              {chart.hasConnectedVision ? 'Connected Vision' : 'Vision'}
            </Text>
            <ChevronRight size={12} color="#3157D8" />
          </Pressable>
        </View>

        {/* Illustrated Painterly SVG Route Map Canvas */}
        <View style={styles.mapCanvasWrapper}>
          <V2ChartRouteMap
            waypoints={chart.waypoints}
            currentWaypointIndex={chart.currentWaypointIndex}
            template={chart.template}
            onWaypointPress={handleWaypointPress}
            onAnchorPress={() => setIsAnchorDetailOpen(true)}
            onAllWaypointsPress={() => {
              setIsJourneyMode(false);
              setIsJourneySheetOpen(true);
            }}
          />
        </View>

        {/* One Move / Current Waypoint Action Card */}
        <V2OneMoveCard
          currentWaypoint={chart.currentWaypoint}
          oneMove={chart.oneMove}
          isFinished={chart.isFinished}
          destinationText={chart.destinationText}
          onCompleteMove={handleCompleteMove}
          onPromptReached={handlePromptReached}
          onAddMovePress={(wpId) => {
            setSelectedWaypointId(wpId);
            setIsDetailSheetOpen(true);
          }}
          onLookBackPress={() => {
            setIsJourneyMode(true);
            setIsJourneySheetOpen(true);
          }}
        />

        {/* Footer Journey Summary */}
        <View style={styles.footerRow}>
          <Text style={styles.footerProgress}>
            {chart.reachedCount} of {chart.totalWaypoints} waypoints reached
          </Text>
          <Pressable
            testID="view-journey-btn"
            onPress={() => {
              setIsJourneyMode(true);
              setIsJourneySheetOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="View journey"
            hitSlop={6}
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
          selectedWaypoint &&
            chart.currentWaypoint &&
            selectedWaypoint.id === chart.currentWaypoint.id,
        )}
        onClose={() => setIsDetailSheetOpen(false)}
        onAddMove={addMove}
        onGoToOneMove={() => setIsDetailSheetOpen(false)}
        onReinforceAnchor={handlePracticeAnchor}
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
      {Boolean(celebrationDetails) && (
        <V2WaypointCelebrationModal
          visible={isCelebrationModalOpen}
          isDestination={celebrationDetails?.isDestination ?? false}
          destinationText={
            celebrationDetails?.destinationText ?? chart.destinationText
          }
          nextWaypointTitle={celebrationDetails?.nextWaypointTitle}
          onContinue={() => {
            setIsCelebrationModalOpen(false);
            if (celebrationDetails?.isDestination) {
              setIsJourneyMode(true);
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
        onDeleteWaypoint={deleteWaypoint}
        onChangeTemplate={setTemplate}
        onToggleVision={() =>
          setConnectedVisionId(connectedVisionId ? null : 'vision-linked')
        }
      />

      {/* 5. Journey Overview / All Waypoints Sheet */}
      <V2JourneyOverviewSheet
        visible={isJourneySheetOpen}
        waypoints={chart.waypoints}
        isJourneyMode={isJourneyMode}
        onClose={() => setIsJourneySheetOpen(false)}
        onSelectWaypoint={handleWaypointPress}
        onEditChartPress={() => setIsEditSheetOpen(true)}
      />

      {/* 6. Connected Vision Detail Sheet */}
      <V2VisionDetailSheet
        visible={isVisionDetailOpen}
        visionTitle={chart.connectedVisionTitle ?? 'A brighter future.'}
        onClose={() => setIsVisionDetailOpen(false)}
        onDisconnectVision={() => setConnectedVisionId(null)}
      />

      {/* 7. Browse Visions Sheet */}
      <V2VisionBrowseSheet
        visible={isVisionBrowseOpen}
        onClose={() => setIsVisionBrowseOpen(false)}
        onConnectVision={() => setConnectedVisionId('vision-linked')}
      />

      {/* 8. Anchor Detail Sheet */}
      <V2AnchorDetailSheet
        visible={isAnchorDetailOpen}
        anchorTitle={(effectiveAnchor as any)?.name ?? effectiveAnchor?.intentionText ?? 'Your Anchor'}
        anchorDescription={
          (effectiveAnchor as any)?.coreStatement ??
          effectiveAnchor?.intentionText ??
          'The foundational intention grounding your journey.'
        }
        anchorCategory={(effectiveAnchor as any)?.category ?? 'GROUNDING'}
        onClose={() => setIsAnchorDetailOpen(false)}
        onPracticeAnchor={handlePracticeAnchor}
      />
    </V2Screen>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
  },
  loadingText: {
    ...typography.bodyMD,
    color: colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
    gap: spacing[3],
  },
  errorTitle: {
    ...typography.headingSM,
    color: colors.text.primary,
  },
  errorBody: {
    ...typography.bodyMD,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing[2],
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
  toast: {
    position: 'absolute',
    top: 55,
    left: 20,
    right: 20,
    zIndex: 50,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#182235',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  toastText: {
    ...typography.bodyMD,
    color: '#FFFFFF',
    fontSize: 12.5,
    flex: 1,
  },
  undoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 12,
  },
  undoText: {
    ...typography.caption,
    color: '#CBD5FF',
    fontWeight: '700',
    fontSize: 12,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  offlineText: {
    ...typography.caption,
    color: '#6B7280',
    fontSize: 11.5,
  },
  destinationCard: {
    padding: spacing[4],
    borderRadius: radii.xl,
    backgroundColor: '#FDFBF8',
    borderWidth: 1,
    borderColor: '#E9E5DE',
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
    color: '#717686',
    letterSpacing: 0.9,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  destinationTitle: {
    ...typography.headingMD,
    color: colors.text.primary,
    fontSize: 22,
    letterSpacing: -0.4,
  },
  destinationDesc: {
    ...typography.bodyMD,
    color: '#6B7280',
    fontSize: 13,
  },
  visionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: spacing[2],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FAF5EE',
    borderWidth: 1,
    borderColor: '#EAE6DF',
  },
  visionThumbnail: {
    width: 18,
    height: 18,
    borderRadius: 4,
  },
  visionButtonText: {
    ...typography.labelSM,
    color: '#3157D8',
    fontWeight: '600',
    fontSize: 12,
  },
  mapCanvasWrapper: {
    width: '100%',
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: '#FAF5EE',
    borderWidth: 1,
    borderColor: '#EAE6DF',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
  },
  footerProgress: {
    ...typography.caption,
    color: '#717686',
    fontSize: 12,
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
    fontSize: 12.5,
  },
});
