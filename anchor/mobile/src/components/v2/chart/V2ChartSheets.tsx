import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Plus,
  Trash2,
  X,
} from 'lucide-react-native';
import type {
  ChartRouteTemplate,
  V2WaypointPresentation,
} from '@/adapters/v2/chart';
import { V2Button } from '@/components/v2';
import { useV2ReduceMotion } from '@/hooks/v2/useV2ReduceMotion';
import { colors, radii, spacing, typography } from '@/theme/v2';

export function StarCelebrationArt({ done = true }: { done?: boolean }) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Milestone reached amber star"
      style={styles.starWrap}
    >
      <Svg width={90} height={90} viewBox="0 0 90 90">
        <Path
          d="m46 4 1 10m23-1-6 9m18 10-10 4m7 22-9-4M21 15l6 8M9 35l11 2M12 57l11-5m5 20 5-7"
          stroke="#FFAE43"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <Path
          d="m47 22 7 18 19 2-15 13 3 19-16-10-16 9 4-19-14-13 20-2Z"
          fill="#FFA32C"
          stroke="#FFAE43"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <Path
          d="m47 25 1 24 21-6-16 12 6 15-15-10-12 9 6-18-14-8 19 2Z"
          fill="#FFB044"
          opacity={0.5}
        />
        {done && (
          <Path
            d="m34 49 8 8 15-18"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </Svg>
    </View>
  );
}

// 1. Waypoint Detail Sheet
export interface V2WaypointDetailSheetProps {
  visible: boolean;
  waypoint: V2WaypointPresentation | null;
  isCurrent: boolean;
  onClose: () => void;
  onAddMove: (waypointId: string, text: string) => void;
  onGoToOneMove?: () => void;
  onReinforceAnchor?: () => void;
}

export function V2WaypointDetailSheet({
  visible,
  waypoint,
  isCurrent,
  onClose,
  onAddMove,
  onGoToOneMove,
  onReinforceAnchor,
}: V2WaypointDetailSheetProps) {
  const [newMoveText, setNewMoveText] = useState('');

  if (!visible || !waypoint) return null;

  const reduceMotion = useV2ReduceMotion();

  const handleAdd = () => {
    if (newMoveText.trim()) {
      onAddMove(waypoint.id, newMoveText.trim());
      setNewMoveText('');
    }
  };

  const getBadgeColor = () => {
    if (waypoint.reached) return '#2FA879';
    if (isCurrent) return '#3157D8';
    return '#8E95A5';
  };

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetEyebrow}>WAYPOINT</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close sheet"
              hitSlop={10}
              style={styles.closeButton}
            >
              <X size={18} color={colors.text.secondary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.sheetScroll}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sheetTitle}>{waypoint.value}</Text>
            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getBadgeColor() },
                ]}
              >
                <Text style={styles.statusBadgeText}>
                  {waypoint.state.toUpperCase()}
                </Text>
              </View>
            </View>

            <Text style={styles.sheetDesc}>
              {waypoint.description ||
                'One meaningful step toward your destination.'}
            </Text>

            {/* Steps list */}
            <View style={styles.stepsSection}>
              <Text style={styles.sectionHeader}>STEPS</Text>
              {waypoint.moves.length === 0 ? (
                <Text style={styles.noStepsText}>No moves added yet.</Text>
              ) : (
                waypoint.moves.map((move, idx) => (
                  <View key={move.id || idx} style={styles.moveRow}>
                    <View
                      style={[
                        styles.tinyCheck,
                        move.done && styles.tinyCheckDone,
                      ]}
                    >
                      {move.done && (
                        <Check
                          size={12}
                          color={colors.surface}
                          strokeWidth={3}
                        />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.moveText,
                        move.done && styles.moveTextDone,
                      ]}
                    >
                      {move.text}
                    </Text>
                  </View>
                ))
              )}

              {!waypoint.reached && (
                <View style={styles.addMoveInputRow}>
                  <TextInput
                    value={newMoveText}
                    onChangeText={setNewMoveText}
                    placeholder="One concrete next step…"
                    placeholderTextColor={colors.text.disabled}
                    style={styles.addInput}
                    maxLength={180}
                  />
                  <Pressable
                    onPress={handleAdd}
                    disabled={!newMoveText.trim()}
                    hitSlop={6}
                    style={[
                      styles.addButton,
                      !newMoveText.trim() && styles.addButtonDisabled,
                    ]}
                  >
                    <Plus size={16} color={colors.surface} />
                  </Pressable>
                </View>
              )}
            </View>

            {isCurrent && (
              <V2Button
                accessibilityLabel="Go to One Move"
                onPress={() => {
                  onClose();
                  onGoToOneMove?.();
                }}
              >
                Go to One Move
              </V2Button>
            )}

            {isCurrent && (
              <Pressable
                onPress={() => {
                  onClose();
                  onReinforceAnchor?.();
                }}
                hitSlop={8}
                style={styles.reinforceLink}
              >
                <Text style={styles.reinforceLinkText}>
                  Reinforce your Anchor →
                </Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// 2. Waypoint Reached Confirmation Modal
export interface V2WaypointReachedModalProps {
  visible: boolean;
  waypointTitle: string;
  hasPendingMoves: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function V2WaypointReachedModal({
  visible,
  waypointTitle,
  hasPendingMoves,
  onConfirm,
  onCancel,
}: V2WaypointReachedModalProps) {
  const reduceMotion = useV2ReduceMotion();
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'fade'}
      transparent
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <Text style={styles.sheetEyebrow}>MILESTONE CHECK</Text>
          <Text style={styles.sheetTitle}>Waypoint reached?</Text>
          <Text style={styles.modalTarget}>{waypointTitle}</Text>
          <Text style={styles.modalMessage}>
            {hasPendingMoves
              ? 'Completing your moves and reaching your waypoint are different. Have you reached this milestone in the real world?'
              : 'Your moves are complete. Have you reached this milestone in the real world?'}
          </Text>

          <View style={styles.modalActions}>
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Keep going"
              hitSlop={6}
              style={styles.secondaryModalButton}
            >
              <Text style={styles.secondaryModalText}>Keep going</Text>
            </Pressable>
            <Pressable
              testID="confirm-waypoint-reached-btn"
              onPress={onConfirm}
              accessibilityRole="button"
              accessibilityLabel="Yes, waypoint reached"
              hitSlop={6}
              style={styles.primaryModalButton}
            >
              <Text style={styles.primaryModalText}>Yes, waypoint reached</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// 3. Waypoint / Destination Celebration Modal
export interface V2WaypointCelebrationModalProps {
  visible: boolean;
  isDestination: boolean;
  destinationText: string;
  nextWaypointTitle?: string | null;
  onContinue: () => void;
}

export function V2WaypointCelebrationModal({
  visible,
  isDestination,
  destinationText,
  nextWaypointTitle,
  onContinue,
}: V2WaypointCelebrationModalProps) {
  const reduceMotion = useV2ReduceMotion();
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'fade'}
      transparent
      onRequestClose={onContinue}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalCard, styles.celebrationCard]}>
          <StarCelebrationArt done />
          <Text style={styles.celebrationEyebrow}>
            {isDestination ? 'DESTINATION REACHED' : 'ONE STEP CLOSER'}
          </Text>
          <Text style={styles.celebrationTitle}>
            {isDestination ? 'Look how far you’ve come.' : 'Waypoint reached.'}
          </Text>
          <Text style={styles.celebrationBody}>
            {isDestination
              ? `You reached ${destinationText}. Your steady work brought you here.`
              : nextWaypointTitle
                ? `Your next waypoint is ${nextWaypointTitle}. Keep your destination in view.`
                : 'Take a breath and continue forward on your route.'}
          </Text>

          <V2Button
            accessibilityLabel={
              isDestination ? 'View your journey' : 'Continue your journey'
            }
            onPress={onContinue}
          >
            {isDestination ? 'View your journey →' : 'Continue your journey →'}
          </V2Button>
        </View>
      </View>
    </Modal>
  );
}

// 4. Edit Chart Sheet
export interface V2EditChartSheetProps {
  visible: boolean;
  waypoints: V2WaypointPresentation[];
  template: ChartRouteTemplate;
  hasConnectedVision: boolean;
  onClose: () => void;
  onReorder: (fromIdx: number, toIdx: number) => void;
  onUpdateTitle: (waypointId: string, title: string) => void;
  onAddWaypoint: (title: string) => void;
  onDeleteWaypoint?: (waypointId: string) => void;
  onChangeTemplate: (tmpl: ChartRouteTemplate) => void;
  onToggleVision: () => void;
}

const TEMPLATE_NAMES: Record<ChartRouteTemplate, string> = {
  'gentle-s': 'Gentle S curve',
  'wide-zigzag': 'Wide zig-zag',
  'rising-arc': 'Rising arc',
  'double-bend': 'Double bend',
};

export function V2EditChartSheet({
  visible,
  waypoints,
  template,
  hasConnectedVision,
  onClose,
  onReorder,
  onUpdateTitle,
  onAddWaypoint,
  onDeleteWaypoint,
  onChangeTemplate,
  onToggleVision,
}: V2EditChartSheetProps) {
  const reduceMotion = useV2ReduceMotion();
  const [newWpTitle, setNewWpTitle] = useState('');

  if (!visible) return null;

  const handleAdd = () => {
    if (newWpTitle.trim()) {
      onAddWaypoint(newWpTitle.trim());
      setNewWpTitle('');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.sheetContainer}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetEyebrow}>EDIT CHART</Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={styles.closeButton}
            >
              <X size={18} color={colors.text.secondary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.sheetScroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Waypoints reordering, renaming, & deleting */}
            <Text style={styles.sectionHeader}>WAYPOINTS</Text>
            {waypoints.map((wp, idx) => {
              const isLast = idx === waypoints.length - 1;
              const canMoveUp =
                idx > 0 &&
                !isLast &&
                waypoints[idx - 1]?.reached === wp.reached;
              const canMoveDown =
                idx < waypoints.length - 2 &&
                waypoints[idx + 1]?.reached === wp.reached;
              const canDelete =
                waypoints.length > 2 && !isLast && !wp.reached;

              return (
                <View key={wp.id} style={styles.editRow}>
                  <View style={styles.reorderControls}>
                    <Pressable
                      disabled={!canMoveUp}
                      onPress={() => onReorder(idx, idx - 1)}
                      accessibilityLabel={`Move ${wp.value} up`}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={[
                        styles.reorderArrow,
                        !canMoveUp && styles.reorderArrowDisabled,
                      ]}
                    >
                      <ArrowUp
                        size={14}
                        color={
                          canMoveUp ? colors.text.primary : colors.text.disabled
                        }
                      />
                    </Pressable>
                    <Pressable
                      disabled={!canMoveDown}
                      onPress={() => onReorder(idx, idx + 1)}
                      accessibilityLabel={`Move ${wp.value} down`}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={[
                        styles.reorderArrow,
                        !canMoveDown && styles.reorderArrowDisabled,
                      ]}
                    >
                      <ArrowDown
                        size={14}
                        color={
                          canMoveDown
                            ? colors.text.primary
                            : colors.text.disabled
                        }
                      />
                    </Pressable>
                  </View>

                  <View style={styles.editInputWrapper}>
                    <Text style={styles.editItemLabel}>
                      {isLast
                        ? 'DESTINATION'
                        : `WAYPOINT ${idx + 1}${wp.reached ? ' · REACHED' : ''}`}
                    </Text>
                    <TextInput
                      defaultValue={wp.value}
                      onEndEditing={(e) =>
                        onUpdateTitle(wp.id, e.nativeEvent.text)
                      }
                      style={styles.editTitleInput}
                      accessibilityLabel={`Waypoint ${idx + 1} label`}
                      maxLength={120}
                    />
                  </View>

                  {canDelete && onDeleteWaypoint && (
                    <Pressable
                      onPress={() => onDeleteWaypoint(wp.id)}
                      accessibilityLabel={`Delete ${wp.value}`}
                      hitSlop={8}
                      style={styles.deleteWpButton}
                    >
                      <Trash2 size={16} color={colors.text.secondary} />
                    </Pressable>
                  )}
                </View>
              );
            })}

            {/* Add waypoint input */}
            <View style={styles.addMoveInputRow}>
              <TextInput
                value={newWpTitle}
                onChangeText={setNewWpTitle}
                placeholder="New waypoint title…"
                placeholderTextColor={colors.text.disabled}
                style={styles.addInput}
              />
              <Pressable
                onPress={handleAdd}
                disabled={!newWpTitle.trim()}
                hitSlop={6}
                style={[
                  styles.addButton,
                  !newWpTitle.trim() && styles.addButtonDisabled,
                ]}
              >
                <Plus size={16} color={colors.surface} />
              </Pressable>
            </View>

            {/* Route shape templates */}
            <Text style={styles.sectionHeader}>ROUTE SHAPE</Text>
            <View style={styles.templatePicker}>
              {(
                [
                  'gentle-s',
                  'wide-zigzag',
                  'rising-arc',
                  'double-bend',
                ] as ChartRouteTemplate[]
              ).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => onChangeTemplate(t)}
                  hitSlop={4}
                  style={[
                    styles.templateOption,
                    template === t && styles.templateOptionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.templateOptionText,
                      template === t && styles.templateOptionTextSelected,
                    ]}
                  >
                    {TEMPLATE_NAMES[t]}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Connected Vision toggle */}
            <Pressable
              onPress={onToggleVision}
              hitSlop={8}
              style={styles.toggleVisionButton}
            >
              <Text style={styles.toggleVisionText}>
                {hasConnectedVision
                  ? 'Disconnect Vision from Chart'
                  : 'Connect Vision to Chart'}
              </Text>
            </Pressable>

            <V2Button accessibilityLabel="Done editing" onPress={onClose}>
              Done
            </V2Button>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// 5. Journey Overview / All Waypoints Sheet
export interface V2JourneyOverviewSheetProps {
  visible: boolean;
  waypoints: V2WaypointPresentation[];
  isJourneyMode?: boolean;
  onClose: () => void;
  onSelectWaypoint?: (waypointId: string) => void;
  onEditChartPress?: () => void;
}

export function V2JourneyOverviewSheet({
  visible,
  waypoints,
  isJourneyMode = false,
  onClose,
  onSelectWaypoint,
  onEditChartPress,
}: V2JourneyOverviewSheetProps) {
  const reduceMotion = useV2ReduceMotion();
  if (!visible) return null;

  const displayWaypoints = isJourneyMode
    ? [...waypoints].filter((w) => w.reached).reverse()
    : waypoints;

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetEyebrow}>
              {isJourneyMode ? 'YOUR JOURNEY' : 'ALL WAYPOINTS'}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={styles.closeButton}
            >
              <X size={18} color={colors.text.secondary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.sheetScroll}
            showsVerticalScrollIndicator={false}
          >
            {displayWaypoints.map((wp, idx) => {
              const origIdx = waypoints.findIndex((w) => w.id === wp.id);
              const isLast = origIdx === waypoints.length - 1;

              return (
                <Pressable
                  key={wp.id}
                  onPress={() => {
                    onClose();
                    onSelectWaypoint?.(wp.id);
                  }}
                  hitSlop={4}
                  style={styles.journeyItem}
                >
                  <View
                    style={[
                      styles.journeyDot,
                      wp.reached
                        ? styles.journeyDotReached
                        : wp.state === 'current'
                          ? styles.journeyDotCurrent
                          : isLast
                            ? styles.journeyDotDestination
                            : styles.journeyDotUpcoming,
                    ]}
                  >
                    {wp.reached ? (
                      <Check size={12} color={colors.surface} strokeWidth={3} />
                    ) : isLast ? (
                      <Text style={styles.destinationStarSymbol}>✦</Text>
                    ) : null}
                  </View>

                  <View style={styles.journeyItemDetails}>
                    <Text style={styles.journeyItemTitle}>{wp.value}</Text>
                    <Text style={styles.journeyItemStatus}>
                      {wp.state === 'current'
                        ? 'Current waypoint'
                        : wp.reached
                          ? `Reached${wp.reachedAt ? ` · ${new Date(wp.reachedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}`
                          : isLast
                            ? 'Destination'
                            : 'Upcoming'}
                    </Text>
                  </View>

                  <ChevronRight size={16} color={colors.text.secondary} />
                </Pressable>
              );
            })}

            {onEditChartPress && (
              <Pressable
                onPress={() => {
                  onClose();
                  onEditChartPress();
                }}
                hitSlop={8}
                style={styles.editChartLink}
              >
                <Text style={styles.editChartLinkText}>Edit Chart →</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// 6. Connected Vision Detail Sheet
export interface V2VisionDetailSheetProps {
  visible: boolean;
  visionTitle?: string;
  visionDescription?: string;
  onClose: () => void;
  onDisconnectVision?: () => void;
}

export function V2VisionDetailSheet({
  visible,
  visionTitle = 'A brighter future.',
  visionDescription = 'A bigger impact. More people anchored to a brighter future.',
  onClose,
  onDisconnectVision,
}: V2VisionDetailSheetProps) {
  const reduceMotion = useV2ReduceMotion();
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetEyebrow}>CONNECTED VISION</Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={styles.closeButton}
            >
              <X size={18} color={colors.text.secondary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.sheetScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.visionImageWrapper}>
              <Image
                source={require('@/../assets/chart/landscape.png')}
                style={styles.visionImage}
                resizeMode="cover"
              />
            </View>

            <Text style={styles.sheetTitle}>{visionTitle}</Text>
            <Text style={styles.sheetDesc}>{visionDescription}</Text>

            <V2Button
              accessibilityLabel="Return to Chart"
              onPress={onClose}
            >
              Return to Chart
            </V2Button>

            {onDisconnectVision && (
              <Pressable
                onPress={() => {
                  onDisconnectVision();
                  onClose();
                }}
                hitSlop={8}
                style={styles.disconnectVisionLink}
              >
                <Text style={styles.disconnectVisionLinkText}>
                  Disconnect Vision from Chart
                </Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// 7. Browse Visions Sheet
export interface V2VisionBrowseSheetProps {
  visible: boolean;
  onClose: () => void;
  onConnectVision: () => void;
}

export function V2VisionBrowseSheet({
  visible,
  onClose,
  onConnectVision,
}: V2VisionBrowseSheetProps) {
  const reduceMotion = useV2ReduceMotion();
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetEyebrow}>BROWSE VISIONS</Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={styles.closeButton}
            >
              <X size={18} color={colors.text.secondary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.sheetScroll}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sheetTitle}>Keep your future in sight.</Text>
            <Text style={styles.sheetDesc}>
              Connect a Vision to this Chart to ground your daily waypoints in what matters most.
            </Text>

            <View style={styles.visionImageWrapper}>
              <Image
                source={require('@/../assets/chart/landscape.png')}
                style={styles.visionImage}
                resizeMode="cover"
              />
            </View>

            <V2Button
              accessibilityLabel="Connect this Vision"
              onPress={() => {
                onConnectVision();
                onClose();
              }}
            >
              Connect this Vision
            </V2Button>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// 8. Anchor Detail Sheet
export interface V2AnchorDetailSheetProps {
  visible: boolean;
  anchorTitle?: string;
  anchorDescription?: string;
  anchorCategory?: string;
  onClose: () => void;
  onPracticeAnchor?: () => void;
}

export function V2AnchorDetailSheet({
  visible,
  anchorTitle = 'Your Anchor',
  anchorDescription = 'The foundational intention grounding your journey.',
  anchorCategory = 'GROUNDING',
  onClose,
  onPracticeAnchor,
}: V2AnchorDetailSheetProps) {
  const reduceMotion = useV2ReduceMotion();
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetEyebrow}>YOUR ANCHOR</Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={styles.closeButton}
            >
              <X size={18} color={colors.text.secondary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.sheetScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.anchorArtWrapper}>
              <Svg width={64} height={64} viewBox="0 0 24 24">
                <Circle
                  cx="12"
                  cy="5"
                  r="2.8"
                  fill="none"
                  stroke="#223B6A"
                  strokeWidth="2.2"
                />
                <Path
                  d="M12 7.8V19"
                  stroke="#223B6A"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <Path
                  d="M7.5 11h9"
                  stroke="#223B6A"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <Path
                  d="M4.5 13.5a7.5 7.5 0 0 0 15 0"
                  stroke="#223B6A"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  fill="none"
                />
              </Svg>
            </View>

            <View style={styles.badgeRow}>
              <View style={[styles.statusBadge, { backgroundColor: '#223B6A' }]}>
                <Text style={styles.statusBadgeText}>
                  {anchorCategory.toUpperCase()}
                </Text>
              </View>
            </View>

            <Text style={styles.sheetTitle}>{anchorTitle}</Text>
            <Text style={styles.sheetDesc}>{anchorDescription}</Text>

            {onPracticeAnchor && (
              <V2Button
                accessibilityLabel="Reinforce this Anchor"
                onPress={() => {
                  onClose();
                  onPracticeAnchor();
                }}
              >
                Reinforce this Anchor →
              </V2Button>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 32, 51, 0.45)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheetContainer: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: '#FDFBF8',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[6],
    borderWidth: 1,
    borderColor: '#E9E5DE',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D5D3CE',
    alignSelf: 'center',
    marginVertical: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
  },
  sheetEyebrow: {
    ...typography.caption,
    color: '#717686',
    letterSpacing: 1,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetScroll: {
    gap: spacing[3],
    paddingVertical: spacing[2],
  },
  sheetTitle: {
    ...typography.headingMD,
    color: colors.text.primary,
    fontSize: 22,
    letterSpacing: -0.5,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  sheetDesc: {
    ...typography.bodyMD,
    color: '#6B7280',
    lineHeight: 22,
    fontSize: 14,
  },
  stepsSection: {
    gap: spacing[2],
    marginVertical: spacing[2],
  },
  sectionHeader: {
    ...typography.caption,
    color: '#717686',
    letterSpacing: 0.9,
    fontWeight: '700',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  noStepsText: {
    ...typography.bodyMD,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  moveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: 6,
  },
  tinyCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#ABB2BC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tinyCheckDone: {
    backgroundColor: '#2FA879',
    borderColor: '#2FA879',
  },
  moveText: {
    ...typography.bodyMD,
    color: colors.text.primary,
    flex: 1,
    fontSize: 13,
  },
  moveTextDone: {
    color: colors.text.disabled,
    textDecorationLine: 'line-through',
  },
  addMoveInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: 8,
  },
  addInput: {
    flex: 1,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE6DF',
    paddingHorizontal: spacing[3],
    ...typography.bodyMD,
    color: colors.text.primary,
    fontSize: 13,
  },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: '#3157D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    opacity: 0.4,
  },
  reinforceLink: {
    paddingVertical: 12,
    alignItems: 'center',
    minHeight: 44,
  },
  reinforceLinkText: {
    ...typography.labelMD,
    color: '#3157D8',
    fontWeight: '600',
    fontSize: 13,
  },
  // Modal Cards
  modalCard: {
    width: '90%',
    backgroundColor: '#FDFBF8',
    borderRadius: 24,
    padding: spacing[5],
    gap: spacing[3],
    alignSelf: 'center',
    marginBottom: 'auto',
    marginTop: 'auto',
    borderWidth: 1,
    borderColor: '#E9E5DE',
    shadowColor: '#182235',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  celebrationCard: {
    alignItems: 'center',
    textAlign: 'center',
  },
  modalTarget: {
    ...typography.headingSM,
    color: colors.text.primary,
    fontSize: 18,
  },
  modalMessage: {
    ...typography.bodyMD,
    color: '#6B7280',
    lineHeight: 22,
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[3],
  },
  secondaryModalButton: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EAE6DF',
    backgroundColor: '#FFFFFF',
  },
  secondaryModalText: {
    ...typography.labelMD,
    color: colors.text.primary,
    fontWeight: '600',
  },
  primaryModalButton: {
    flex: 1.4,
    minHeight: 44,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#3157D8',
  },
  primaryModalText: {
    ...typography.labelMD,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  starWrap: {
    marginVertical: spacing[2],
  },
  celebrationEyebrow: {
    ...typography.caption,
    color: '#F28A2E',
    letterSpacing: 1.2,
    fontWeight: '700',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  celebrationTitle: {
    ...typography.headingMD,
    color: colors.text.primary,
    textAlign: 'center',
    fontSize: 22,
  },
  celebrationBody: {
    ...typography.bodyMD,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 14,
    marginBottom: spacing[2],
  },
  // Edit Chart
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: 4,
  },
  reorderControls: {
    flexDirection: 'row',
    gap: 4,
  },
  reorderArrow: {
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE6DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderArrowDisabled: {
    opacity: 0.35,
  },
  editInputWrapper: {
    flex: 1,
    gap: 2,
  },
  editItemLabel: {
    ...typography.caption,
    fontSize: 9,
    color: '#717686',
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  editTitleInput: {
    height: 38,
    borderRadius: radii.sm,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE6DF',
    paddingHorizontal: 10,
    ...typography.bodyMD,
    color: colors.text.primary,
    fontSize: 13,
  },
  deleteWpButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templatePicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  templateOption: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE6DF',
  },
  templateOptionSelected: {
    backgroundColor: '#3157D8',
    borderColor: '#3157D8',
  },
  templateOptionText: {
    ...typography.caption,
    color: '#717686',
    fontWeight: '600',
    fontSize: 11.5,
  },
  templateOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  toggleVisionButton: {
    paddingVertical: 12,
    alignItems: 'center',
    minHeight: 44,
  },
  toggleVisionText: {
    ...typography.labelMD,
    color: '#3157D8',
    fontWeight: '600',
    fontSize: 13,
  },
  // Journey / All
  journeyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EAE6DF',
    minHeight: 48,
  },
  journeyDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  journeyDotReached: {
    backgroundColor: '#2FA879',
  },
  journeyDotCurrent: {
    backgroundColor: '#3157D8',
  },
  journeyDotDestination: {
    backgroundColor: '#FFF0D4',
    borderWidth: 1.5,
    borderColor: '#FFA32C',
  },
  journeyDotUpcoming: {
    borderWidth: 1.5,
    borderColor: '#ABB2BC',
  },
  destinationStarSymbol: {
    color: '#F28A2E',
    fontSize: 12,
    fontWeight: '700',
  },
  journeyItemDetails: {
    flex: 1,
  },
  journeyItemTitle: {
    ...typography.bodyMD,
    fontWeight: '600',
    color: colors.text.primary,
    fontSize: 13.5,
  },
  journeyItemStatus: {
    ...typography.caption,
    color: '#717686',
    fontSize: 11,
    marginTop: 2,
  },
  editChartLink: {
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 44,
  },
  editChartLinkText: {
    ...typography.labelMD,
    color: '#3157D8',
    fontWeight: '700',
    fontSize: 13,
  },
  // Vision Sheets
  visionImageWrapper: {
    width: '100%',
    height: 150,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FAF5EE',
    borderWidth: 1,
    borderColor: '#EAE6DF',
    marginVertical: spacing[2],
  },
  visionImage: {
    width: '100%',
    height: '100%',
  },
  disconnectVisionLink: {
    paddingVertical: 12,
    alignItems: 'center',
    minHeight: 44,
  },
  disconnectVisionLinkText: {
    ...typography.labelMD,
    color: '#D32F2F',
    fontWeight: '600',
    fontSize: 13,
  },
  // Anchor Sheet
  anchorArtWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EEF2FC',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: spacing[2],
  },
});
