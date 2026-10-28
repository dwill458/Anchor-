import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeInDown, ReduceMotion, runOnJS, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { Check, GripVertical, Lock, Plus, Trash2 } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme/v2';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import type { WaypointKind, WaypointProgressMode } from '@/types/chart';

export type DraftWaypoint = {
  /** Stable local key. */
  key: string;
  /** Server id when the waypoint already exists on a saved Chart. */
  id?: string | null;
  title: string;
  rationale: string | null;
  kind: WaypointKind;
  progressMode?: WaypointProgressMode;
  requirements?: Array<{ id: string; title: string; completed: boolean }>;
  completionCriteria?: string | null;
  metricLabel: string | null;
  metricTarget: number | null;
  metricBaseline: number | null;
  suggestedMoves?: Array<{ title: string; rationale: string | null }>;
  /** Reached waypoints are history: shown, never editable or movable. */
  locked?: boolean;
  /** Set when a revision added, changed or dropped this waypoint. A removed one stays visible, struck through, until confirmed. */
  change?: 'added' | 'changed' | 'removed';
};

const ROW_HEIGHT = 58;
const MAX_WAYPOINTS = 12;
const TITLE_MAX = 60;

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Resolve a drag target against measured row centers, including wrapped titles. */
export function routeDropIndexFromOffset(from: number, deltaY: number, rowHeights: number[]): number {
  'worklet';
  const center = rowHeights.slice(0, from).reduce((sum, height) => sum + height, 0) + rowHeights[from] / 2 + deltaY;
  let offset = 0;
  let target = 0;
  for (let row = 0; row < rowHeights.length; row += 1) {
    if (center >= offset + rowHeights[row] / 2) target = row;
    offset += rowHeights[row];
  }
  return target;
}

type Props = {
  waypoints: DraftWaypoint[];
  onChange: (next: DraftWaypoint[]) => void;
  /** Optional hook for analytics on structural edits. */
  onEdit?: (kind: 'reorder' | 'rename' | 'remove' | 'add') => void;
  /** Join the numbered waypoints with a thin rail, so the list reads as one route. */
  showRail?: boolean;
  /** False shows the route read-only: no drag handles, renaming, removal or Add waypoint. */
  editable?: boolean;
  testID?: string;
  renderRowExtra?: (waypoint: DraftWaypoint, index: number) => React.ReactNode;
  reducedMotion?: boolean;
  /** Only the initial proposal rows enter, after the review panel settles. */
  entranceDelayMs?: number;
  enteredKeys?: React.MutableRefObject<Set<string>>;
};

/**
 * Editable route. The human owns the Chart: every AI waypoint can be renamed,
 * removed, reordered, and new ones added. Locked (reached) rows stay put.
 */
export function ChartRouteEditor({ waypoints, onChange, onEdit, showRail = false, editable = true, testID, renderRowExtra, reducedMotion = false, entranceDelayMs, enteredKeys }: Props) {
  const localEntered = useRef(new Set<string>());
  const entered = enteredKeys ?? localEntered;
  const initialArrival = useRef(entered.current.size === 0);
  const initialKeys = useRef(new Set(waypoints.map(waypoint => waypoint.key)));
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});
  const dragIndex = useSharedValue(-1);
  const dragY = useSharedValue(0);
  const firstMovable = Math.max(0, waypoints.findIndex((waypoint) => !waypoint.locked));
  const activeCount = waypoints.filter((waypoint) => waypoint.change !== 'removed').length;
  // Removed rows trail the list (struck through), so nothing can be dropped past the last live waypoint.
  const lastIndex = Math.max(0, activeCount - 1);

  const commitMove = useCallback(
    (from: number, to: number) => {
      const target = Math.max(firstMovable, Math.min(lastIndex, to));
      if (target !== from) {
        onChange(moveItem(waypoints, from, target));
        onEdit?.('reorder');
      }
      dragIndex.value = -1;
      dragY.value = 0;
    },
    [dragIndex, dragY, firstMovable, lastIndex, onChange, onEdit, waypoints]
  );

  const startEdit = (waypoint: DraftWaypoint) => {
    if (waypoint.locked || !editable) return;
    setEditingKey(waypoint.key);
    setDraftTitle(waypoint.title);
  };

  const finishEdit = () => {
    const title = draftTitle.replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX);
    if (editingKey && title) {
      onChange(waypoints.map((waypoint) => (waypoint.key === editingKey ? { ...waypoint, title } : waypoint)));
      onEdit?.('rename');
    }
    setEditingKey(null);
  };

  const remove = (key: string) => {
    if (waypoints.filter((waypoint) => !waypoint.locked).length <= 1) return;
    onChange(waypoints.filter((waypoint) => waypoint.key !== key));
    onEdit?.('remove');
    setEditingKey(null);
  };

  const add = () => {
    if (activeCount >= MAX_WAYPOINTS) return;
    const key = `new-${Date.now().toString(36)}`;
    // New waypoints go just before the destination so the destination stays last.
    const insertAt = Math.max(firstMovable, activeCount - 1);
    const next = [...waypoints];
    next.splice(insertAt, 0, {
      key,
      title: '',
      rationale: null,
      kind: 'MILESTONE',
      metricLabel: null,
      metricTarget: null,
      metricBaseline: null,
    });
    onChange(next);
    onEdit?.('add');
    setEditingKey(key);
    setDraftTitle('');
  };

  return (
    <View testID={testID} style={styles.list}>
      {waypoints.map((waypoint, index) => (
        <Row
          key={waypoint.key}
          waypoint={waypoint}
          index={index}
          total={waypoints.length}
          liveTotal={activeCount}
          firstMovable={firstMovable}
          editing={editingKey === waypoint.key}
          draftTitle={draftTitle}
          onDraftTitle={setDraftTitle}
          onStartEdit={() => startEdit(waypoint)}
          onFinishEdit={finishEdit}
          onRemove={() => remove(waypoint.key)}
          onMove={(to) => commitMove(index, to)}
          dragIndex={dragIndex}
          dragY={dragY}
          canRemove={waypoints.filter((item) => !item.locked).length > 1}
          showRail={showRail}
          editable={editable}
          rowHeights={waypoints.map((item) => rowHeights[item.key] ?? ROW_HEIGHT)}
          onHeightChange={(height) => setRowHeights((current) => current[waypoint.key] === height ? current : { ...current, [waypoint.key]: height })}
          extra={renderRowExtra?.(waypoint, index)}
          entering={(() => {
            if (entered.current.has(waypoint.key)) return undefined;
            entered.current.add(waypoint.key);
            if (!initialArrival.current || reducedMotion || entranceDelayMs === undefined || !initialKeys.current.has(waypoint.key)) return undefined;
            return FadeInDown.duration(360).delay(entranceDelayMs + Math.min(index, 7) * 70).reduceMotion(ReduceMotion.Never);
          })()}
        />
      ))}
      {editable && activeCount < MAX_WAYPOINTS ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={CHART_COPY.review.addWaypoint}
          onPress={add}
          style={({ pressed }) => [styles.addRow, pressed && styles.pressed]}
          testID="chart-route-add"
        >
          <Plus size={18} color={colors.text.primary} />
          <Text style={styles.addText}>{CHART_COPY.review.addWaypoint}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Row({
  waypoint,
  index,
  total,
  liveTotal,
  firstMovable,
  editing,
  draftTitle,
  onDraftTitle,
  onStartEdit,
  onFinishEdit,
  onRemove,
  onMove,
  dragIndex,
  dragY,
  canRemove,
  showRail,
  editable,
  rowHeights,
  onHeightChange,
  extra,
  entering,
}: {
  waypoint: DraftWaypoint;
  index: number;
  total: number;
  /** Waypoints not being removed: what a screen reader counts. */
  liveTotal: number;
  firstMovable: number;
  editing: boolean;
  draftTitle: string;
  onDraftTitle: (value: string) => void;
  onStartEdit: () => void;
  onFinishEdit: () => void;
  onRemove: () => void;
  onMove: (to: number) => void;
  dragIndex: SharedValue<number>;
  dragY: SharedValue<number>;
  canRemove: boolean;
  showRail: boolean;
  editable: boolean;
  rowHeights: number[];
  onHeightChange: (height: number) => void;
  extra?: React.ReactNode;
  entering?: ReturnType<typeof FadeInDown.duration>;
}) {
  const removed = waypoint.change === 'removed';
  const locked = Boolean(waypoint.locked) || removed || !editable;
  // Only a waypoint the person has reached is "Reached"; a read-only route still lets them rename nothing.
  const reached = Boolean(waypoint.locked) && !removed;
  const pan = Gesture.Pan()
    .enabled(!locked && !editing)
    .activeOffsetY([-6, 6])
    .onStart(() => {
      dragIndex.value = index;
      dragY.value = 0;
    })
    .onUpdate((event) => {
      dragY.value = event.translationY;
    })
    .onEnd(() => {
      runOnJS(onMove)(routeDropIndexFromOffset(index, dragY.value, rowHeights));
    })
    .onFinalize(() => {
      if (dragIndex.value === index) dragY.value = withTiming(0, { duration: 120 });
    });

  const animated = useAnimatedStyle(() => {
    const from = dragIndex.value;
    if (from < 0) return { transform: [{ translateY: 0 }], zIndex: 0 };
    if (from === index) return { transform: [{ translateY: dragY.value }], zIndex: 10 };
    const target = Math.max(firstMovable, Math.min(total - 1, routeDropIndexFromOffset(from, dragY.value, rowHeights)));
    let shift = 0;
    if (from < index && target >= index) shift = -rowHeights[from];
    if (from > index && target <= index) shift = rowHeights[from];
    return { transform: [{ translateY: withTiming(shift, { duration: 120 }) }], zIndex: 0 };
  });

  const number = index + 1;
  const highlighted = waypoint.change === 'added' || waypoint.change === 'changed';
  const label = waypoint.title || 'New waypoint';
  const actions = locked
    ? []
    : [
        { name: 'activate', label: 'Rename' },
        ...(index > firstMovable ? [{ name: 'moveUp', label: 'Move up' }] : []),
        ...(index < total - 1 ? [{ name: 'moveDown', label: 'Move down' }] : []),
        ...(canRemove ? [{ name: 'remove', label: 'Remove' }] : []),
      ];

  return (
    <Animated.View entering={entering} style={[styles.row, highlighted && styles.rowChanged, animated]} onLayout={(event: LayoutChangeEvent) => onHeightChange(event.nativeEvent.layout.height)}>
      {showRail && total > 1 ? (
        <View
          pointerEvents="none"
          style={[styles.rail, { top: index === 0 ? ROW_HEIGHT / 2 : 0, bottom: index === total - 1 ? Math.max(0, rowHeights[index] - ROW_HEIGHT / 2) : 0 }]}
        />
      ) : null}
      <View style={styles.rowContent}>
      <View style={[styles.badge, reached && styles.badgeLocked, removed && styles.badgeRemoved]}>
        {reached ? <Check size={14} color={colors.text.inverse} strokeWidth={3} /> : <Text style={styles.badgeText}>{removed ? '–' : number}</Text>}
      </View>
      {editing ? (
        <View style={styles.editWrap}>
          <TextInput
            value={draftTitle}
            onChangeText={onDraftTitle}
            autoFocus
            maxLength={TITLE_MAX}
            placeholder="Name this waypoint"
            placeholderTextColor={colors.text.tertiary}
            returnKeyType="done"
            onSubmitEditing={onFinishEdit}
            onBlur={onFinishEdit}
            accessibilityLabel={`Waypoint ${number} title`}
            style={styles.input}
          />
          {canRemove ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Remove waypoint" hitSlop={8} onPress={onRemove} style={styles.iconButton}>
              <Trash2 size={18} color={colors.semantic.error} />
            </Pressable>
          ) : null}
        </View>
      ) : (
        <Pressable
          style={styles.titleButton}
          onPress={onStartEdit}
          disabled={locked}
          accessibilityRole={locked ? 'text' : 'button'}
          accessibilityLabel={`Waypoint ${number} of ${liveTotal}: ${label}${reached ? ', reached' : ''}${removed ? ', removed' : ''}${waypoint.change === 'added' ? ', new' : ''}${waypoint.change === 'changed' ? ', updated' : ''}`}
          accessibilityHint={locked ? undefined : 'Double tap to rename'}
          accessibilityActions={actions}
          onAccessibilityAction={(event) => {
            const name = event.nativeEvent.actionName;
            if (name === 'activate') onStartEdit();
            if (name === 'moveUp') onMove(index - 1);
            if (name === 'moveDown') onMove(index + 1);
            if (name === 'remove') onRemove();
          }}
        >
          <Text style={[styles.title, !waypoint.title && styles.titlePlaceholder, (reached || removed) && styles.titleLocked, removed && styles.titleRemoved]}>
            {label}
          </Text>
          {highlighted ? <Text style={styles.changeTag}>{waypoint.change === 'added' ? CHART_COPY.adjust.addedTag : CHART_COPY.adjust.changedTag}</Text> : null}
        </Pressable>
      )}
      {reached ? (
        <View style={styles.reachedTag} testID="chart-route-reached">
          <Lock size={13} color={colors.text.tertiary} />
          <Text style={styles.reachedText}>{CHART_COPY.adjust.reached}</Text>
        </View>
      ) : removed ? (
        <Text style={styles.reachedText}>{CHART_COPY.adjust.removed}</Text>
      ) : !editable ? null : (
        <GestureDetector gesture={pan}>
          <View style={styles.handle} accessible={false} importantForAccessibility="no-hide-descendants">
            {/* DEFERRED: GripHorizontal is replaced by the vertical reorder handle (Oct 2026). */}
            <GripVertical size={18} color={colors.text.secondary} />
          </View>
        </GestureDetector>
      )}
      </View>
      {extra ? <View style={styles.rowExtra}>{extra}</View> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 0 },
  row: {
    minHeight: ROW_HEIGHT,
    flexDirection: 'column',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
    backgroundColor: colors.canvas,
  },
  rowContent: { minHeight: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  // DEFERRED: the single horizontal row now lives inside this measured column, above its optional next move (Oct 2026).
  rowExtra: { marginLeft: 28 + spacing[3], paddingBottom: spacing[3] },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.text.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLocked: { backgroundColor: colors.semantic.success },
  badgeRemoved: { backgroundColor: colors.text.tertiary },
  rowChanged: { backgroundColor: colors.surface },
  changeTag: { ...typography.labelSM, color: colors.semantic.success, paddingHorizontal: spacing[2] },
  titleRemoved: { textDecorationLine: 'line-through', color: colors.text.tertiary },
  reachedTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing[2] },
  reachedText: { ...typography.labelSM, color: colors.text.tertiary },
  rail: { position: 'absolute', left: 13.5, width: 1, backgroundColor: colors.border.default },
  badgeText: { ...typography.labelMD, color: colors.text.inverse },
  titleButton: { flex: 1, justifyContent: 'center', minHeight: 44 },
  title: { ...typography.bodyMD, color: colors.text.primary },
  titlePlaceholder: { color: colors.text.tertiary },
  titleLocked: { color: colors.text.secondary },
  editWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  input: {
    flex: 1,
    ...typography.bodyMD,
    color: colors.text.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.text.primary,
    paddingVertical: 6,
  },
  iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 44, height: ROW_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  addRow: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
  },
  addText: { ...typography.labelLG, color: colors.text.primary },
  pressed: { opacity: 0.7 },
});

export const CHART_ROUTE_ROW_HEIGHT = ROW_HEIGHT;
