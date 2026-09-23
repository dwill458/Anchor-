import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { Check, GripHorizontal, Lock, Plus, Trash2 } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme/v2';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import type { WaypointKind } from '@/types/chart';

export type DraftWaypoint = {
  /** Stable local key. */
  key: string;
  /** Server id when the waypoint already exists on a saved Chart. */
  id?: string | null;
  title: string;
  rationale: string | null;
  kind: WaypointKind;
  metricLabel: string | null;
  metricTarget: number | null;
  metricBaseline: number | null;
  /** Reached waypoints are history: shown, never editable or movable. */
  locked?: boolean;
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

type Props = {
  waypoints: DraftWaypoint[];
  onChange: (next: DraftWaypoint[]) => void;
  /** Optional hook for analytics on structural edits. */
  onEdit?: (kind: 'reorder' | 'rename' | 'remove' | 'add') => void;
  testID?: string;
};

/**
 * Editable route. The human owns the Chart: every AI waypoint can be renamed,
 * removed, reordered, and new ones added. Locked (reached) rows stay put.
 */
export function ChartRouteEditor({ waypoints, onChange, onEdit, testID }: Props) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const dragIndex = useSharedValue(-1);
  const dragY = useSharedValue(0);
  const firstMovable = Math.max(0, waypoints.findIndex((waypoint) => !waypoint.locked));
  const lastIndex = waypoints.length - 1;

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
    if (waypoint.locked) return;
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
    if (waypoints.length >= MAX_WAYPOINTS) return;
    const key = `new-${Date.now().toString(36)}`;
    // New waypoints go just before the destination so the destination stays last.
    const insertAt = Math.max(firstMovable, waypoints.length - 1);
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
        />
      ))}
      {waypoints.length < MAX_WAYPOINTS ? (
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
}: {
  waypoint: DraftWaypoint;
  index: number;
  total: number;
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
}) {
  const locked = Boolean(waypoint.locked);
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
      const target = Math.round(index + dragY.value / ROW_HEIGHT);
      runOnJS(onMove)(target);
    })
    .onFinalize(() => {
      if (dragIndex.value === index) dragY.value = withTiming(0, { duration: 120 });
    });

  const animated = useAnimatedStyle(() => {
    const from = dragIndex.value;
    if (from < 0) return { transform: [{ translateY: 0 }], zIndex: 0 };
    if (from === index) return { transform: [{ translateY: dragY.value }], zIndex: 10 };
    const target = Math.max(firstMovable, Math.min(total - 1, Math.round(from + dragY.value / ROW_HEIGHT)));
    let shift = 0;
    if (from < index && target >= index) shift = -ROW_HEIGHT;
    if (from > index && target <= index) shift = ROW_HEIGHT;
    return { transform: [{ translateY: withTiming(shift, { duration: 120 }) }], zIndex: 0 };
  });

  const number = index + 1;
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
    <Animated.View style={[styles.row, animated]}>
      <View style={[styles.badge, locked && styles.badgeLocked]}>
        {locked ? <Check size={14} color={colors.text.inverse} strokeWidth={3} /> : <Text style={styles.badgeText}>{number}</Text>}
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
          accessibilityLabel={`Waypoint ${number} of ${total}: ${label}${locked ? ', reached' : ''}`}
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
          <Text style={[styles.title, !waypoint.title && styles.titlePlaceholder, locked && styles.titleLocked]} numberOfLines={2}>
            {label}
          </Text>
        </Pressable>
      )}
      {locked ? (
        <Lock size={15} color={colors.text.tertiary} />
      ) : (
        <GestureDetector gesture={pan}>
          <View style={styles.handle} accessible={false} importantForAccessibility="no-hide-descendants">
            <GripHorizontal size={18} color={colors.text.secondary} />
          </View>
        </GestureDetector>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 0 },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
    backgroundColor: colors.canvas,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.text.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLocked: { backgroundColor: colors.semantic.success },
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
