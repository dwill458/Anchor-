import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ArrowDown, ArrowUp, Check, ChevronRight, Plus, X } from 'lucide-react-native';
import type {
  ChartRouteTemplate,
  V2WaypointMove,
  V2WaypointPresentation,
} from '@/adapters/v2/chart';
import { V2Button } from '@/components/v2';
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

  const handleAdd = () => {
    if (newMoveText.trim()) {
      onAddMove(waypoint.id, newMoveText.trim());
      setNewMoveText('');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
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
              style={styles.closeButton}
            >
              <X size={18} color={colors.text.secondary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.sheetScroll}>
            <Text style={styles.sheetTitle}>{waypoint.value}</Text>
            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.statusBadge,
                  waypoint.reached && { backgroundColor: '#2FA879' },
                ]}
              >
                <Text style={styles.statusBadgeText}>
                  {waypoint.state.toUpperCase()}
                </Text>
              </View>
            </View>

            {Boolean(waypoint.description) && (
              <Text style={styles.sheetDesc}>{waypoint.description}</Text>
            )}

            {/* Steps list */}
            <View style={styles.stepsSection}>
              <Text style={styles.sectionHeader}>STEPS</Text>
              {waypoint.moves.map((move, idx) => (
                <View key={move.id || idx} style={styles.moveRow}>
                  <View
                    style={[
                      styles.tinyCheck,
                      move.done && styles.tinyCheckDone,
                    ]}
                  >
                    {move.done && <Check size={12} color={colors.surface} strokeWidth={3} />}
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
              ))}

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
  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
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
              style={styles.secondaryModalButton}
            >
              <Text style={styles.secondaryModalText}>Keep going</Text>
            </Pressable>
            <Pressable
              testID="confirm-waypoint-reached-btn"
              onPress={onConfirm}
              accessibilityRole="button"
              accessibilityLabel="Yes, waypoint reached"
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
  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onContinue}>
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
            accessibilityLabel="Continue your journey"
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
  onChangeTemplate: (tmpl: ChartRouteTemplate) => void;
  onToggleVision: () => void;
}

export function V2EditChartSheet({
  visible,
  waypoints,
  template,
  hasConnectedVision,
  onClose,
  onReorder,
  onUpdateTitle,
  onAddWaypoint,
  onChangeTemplate,
  onToggleVision,
}: V2EditChartSheetProps) {
  const [newWpTitle, setNewWpTitle] = useState('');

  if (!visible) return null;

  const handleAdd = () => {
    if (newWpTitle.trim()) {
      onAddWaypoint(newWpTitle.trim());
      setNewWpTitle('');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetEyebrow}>EDIT CHART</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <X size={18} color={colors.text.secondary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.sheetScroll}>
            {/* Waypoints reordering & renaming */}
            <Text style={styles.sectionHeader}>WAYPOINTS</Text>
            {waypoints.map((wp, idx) => {
              const isLast = idx === waypoints.length - 1;
              return (
                <View key={wp.id} style={styles.editRow}>
                  <View style={styles.reorderControls}>
                    <Pressable
                      disabled={idx === 0 || isLast}
                      onPress={() => onReorder(idx, idx - 1)}
                      style={styles.reorderArrow}
                    >
                      <ArrowUp size={14} color={idx === 0 || isLast ? colors.text.disabled : colors.text.primary} />
                    </Pressable>
                    <Pressable
                      disabled={idx >= waypoints.length - 2}
                      onPress={() => onReorder(idx, idx + 1)}
                      style={styles.reorderArrow}
                    >
                      <ArrowDown size={14} color={idx >= waypoints.length - 2 ? colors.text.disabled : colors.text.primary} />
                    </Pressable>
                  </View>

                  <TextInput
                    defaultValue={wp.value}
                    onEndEditing={(e) => onUpdateTitle(wp.id, e.nativeEvent.text)}
                    style={styles.editTitleInput}
                  />
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
                style={[styles.addButton, !newWpTitle.trim() && styles.addButtonDisabled]}
              >
                <Plus size={16} color={colors.surface} />
              </Pressable>
            </View>

            {/* Route shape templates */}
            <Text style={styles.sectionHeader}>ROUTE SHAPE</Text>
            <View style={styles.templatePicker}>
              {(['gentle-s', 'wide-zigzag', 'rising-arc', 'double-bend'] as ChartRouteTemplate[]).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => onChangeTemplate(t)}
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
                    {t.replace('-', ' ').toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Connected Vision toggle */}
            <Pressable onPress={onToggleVision} style={styles.toggleVisionButton}>
              <Text style={styles.toggleVisionText}>
                {hasConnectedVision ? 'Disconnect Vision from Chart' : 'Connect Vision to Chart'}
              </Text>
            </Pressable>

            <V2Button accessibilityLabel="Done editing" onPress={onClose}>
              Done
            </V2Button>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// 5. Journey Overview Sheet
export interface V2JourneyOverviewSheetProps {
  visible: boolean;
  waypoints: V2WaypointPresentation[];
  onClose: () => void;
}

export function V2JourneyOverviewSheet({
  visible,
  waypoints,
  onClose,
}: V2JourneyOverviewSheetProps) {
  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetEyebrow}>YOUR JOURNEY</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <X size={18} color={colors.text.secondary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.sheetScroll}>
            {waypoints.map((wp, idx) => (
              <View key={wp.id} style={styles.journeyItem}>
                <View
                  style={[
                    styles.journeyDot,
                    wp.reached ? styles.journeyDotReached : styles.journeyDotUpcoming,
                  ]}
                >
                  {wp.reached && <Check size={12} color={colors.surface} />}
                </View>
                <View style={styles.journeyItemDetails}>
                  <Text style={styles.journeyItemTitle}>{wp.value}</Text>
                  <Text style={styles.journeyItemStatus}>
                    {wp.reached
                      ? `Reached${wp.reachedAt ? ` · ${new Date(wp.reachedAt).toLocaleDateString()}` : ''}`
                      : idx === waypoints.length - 1
                        ? 'Destination'
                        : 'Upcoming'}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 23, 23, 0.45)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheetContainer: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[6],
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.strong,
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
    color: colors.text.secondary,
    letterSpacing: 0.8,
  },
  closeButton: {
    width: 32,
    height: 32,
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
  },
  badgeRow: {
    flexDirection: 'row',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    backgroundColor: '#3157D8',
  },
  statusBadgeText: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: '700',
    fontSize: 10,
  },
  sheetDesc: {
    ...typography.bodyMD,
    color: colors.text.secondary,
  },
  stepsSection: {
    gap: spacing[2],
    marginVertical: spacing[2],
  },
  sectionHeader: {
    ...typography.caption,
    color: colors.text.secondary,
    letterSpacing: 0.8,
  },
  moveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: 4,
  },
  tinyCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tinyCheckDone: {
    backgroundColor: '#3157D8',
    borderColor: '#3157D8',
  },
  moveText: {
    ...typography.bodyMD,
    color: colors.text.primary,
    flex: 1,
  },
  moveTextDone: {
    color: colors.text.disabled,
    textDecorationLine: 'line-through',
  },
  addMoveInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: 4,
  },
  addInput: {
    flex: 1,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: spacing[3],
    ...typography.bodyMD,
    color: colors.text.primary,
  },
  addButton: {
    width: 40,
    height: 40,
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
  },
  reinforceLinkText: {
    ...typography.labelMD,
    color: '#3157D8',
    fontWeight: '600',
  },
  // Modal Cards
  modalCard: {
    width: '90%',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing[5],
    gap: spacing[3],
    alignSelf: 'center',
    marginBottom: 'auto',
    marginTop: 'auto',
  },
  celebrationCard: {
    alignItems: 'center',
    textAlign: 'center',
  },
  modalTarget: {
    ...typography.headingSM,
    color: colors.text.primary,
  },
  modalMessage: {
    ...typography.bodyMD,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[3],
  },
  secondaryModalButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  secondaryModalText: {
    ...typography.labelMD,
    color: colors.text.primary,
    fontWeight: '600',
  },
  primaryModalButton: {
    flex: 1.4,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: '#3157D8',
  },
  primaryModalText: {
    ...typography.labelMD,
    color: colors.surface,
    fontWeight: '700',
  },
  starWrap: {
    marginVertical: spacing[2],
  },
  celebrationEyebrow: {
    ...typography.caption,
    color: '#FFA32C',
    letterSpacing: 1,
    fontWeight: '700',
  },
  celebrationTitle: {
    ...typography.headingMD,
    color: colors.text.primary,
    textAlign: 'center',
  },
  celebrationBody: {
    ...typography.bodyMD,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing[2],
  },
  // Edit Chart
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  reorderControls: {
    flexDirection: 'row',
    gap: 4,
  },
  reorderArrow: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editTitleInput: {
    flex: 1,
    height: 38,
    borderRadius: radii.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: 8,
    ...typography.bodyMD,
    color: colors.text.primary,
  },
  templatePicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  templateOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  templateOptionSelected: {
    backgroundColor: '#3157D8',
    borderColor: '#3157D8',
  },
  templateOptionText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  templateOptionTextSelected: {
    color: colors.surface,
    fontWeight: '700',
  },
  toggleVisionButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  toggleVisionText: {
    ...typography.labelMD,
    color: '#3157D8',
    fontWeight: '600',
  },
  // Journey
  journeyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  journeyDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  journeyDotReached: {
    backgroundColor: '#2FA879',
  },
  journeyDotUpcoming: {
    borderWidth: 1.5,
    borderColor: colors.border.strong,
  },
  journeyItemDetails: {
    flex: 1,
  },
  journeyItemTitle: {
    ...typography.bodyMD,
    fontWeight: '600',
    color: colors.text.primary,
  },
  journeyItemStatus: {
    ...typography.caption,
    color: colors.text.secondary,
  },
});
