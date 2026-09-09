import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Check, ChevronRight, Plus } from 'lucide-react-native';
import type {
  V2WaypointMove,
  V2WaypointPresentation,
} from '@/adapters/v2/chart';
import { V2Button } from '@/components/v2';
import { colors, radii, spacing, typography } from '@/theme/v2';

export interface V2OneMoveCardProps {
  currentWaypoint: V2WaypointPresentation | null;
  oneMove: V2WaypointMove | null;
  isFinished: boolean;
  destinationText: string;
  onCompleteMove: (waypointId: string, moveId: string) => void;
  onPromptReached: () => void;
  onAddMovePress: (waypointId: string) => void;
  onLookBackPress: () => void;
  testID?: string;
}

function ProgressCircle({ done, total }: { done: number; total: number }) {
  const size = 64;
  const strokeWidth = 5;
  const r = 26;
  const circumference = 2 * Math.PI * r;
  const progress = total > 0 ? (done / total) * circumference : 0;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${done} of ${total} steps completed`}
      style={styles.progressCircleContainer}
    >
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={colors.border.subtle}
          strokeWidth={strokeWidth}
        />
        <Circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="#3157D8"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          transform="rotate(-90 32 32)"
        />
      </Svg>
      <View style={styles.progressTextCenter}>
        <Text style={styles.progressValue}>
          {done}/{total}
        </Text>
        <Text style={styles.progressLabel}>STEPS</Text>
      </View>
    </View>
  );
}

export function V2OneMoveCard({
  currentWaypoint,
  oneMove,
  isFinished,
  destinationText,
  onCompleteMove,
  onPromptReached,
  onAddMovePress,
  onLookBackPress,
  testID = 'v2-one-move-card',
}: V2OneMoveCardProps) {
  if (isFinished) {
    return (
      <View testID={testID} style={styles.card}>
        <Text style={styles.eyebrow}>DESTINATION REACHED</Text>
        <Text style={styles.title}>You made it.</Text>
        <Text style={styles.body}>
          {destinationText}. Take a moment to see how far you’ve come.
        </Text>
        <V2Button
          accessibilityLabel="Look back on your journey"
          onPress={onLookBackPress}
        >
          Look back on your journey →
        </V2Button>
      </View>
    );
  }

  if (!currentWaypoint) {
    return null;
  }

  const doneCount = currentWaypoint.doneMoveCount;
  const totalCount = currentWaypoint.totalMoveCount;

  return (
    <View testID={testID} style={styles.card}>
      {/* Waypoint summary row */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryTextGroup}>
          <Text style={styles.eyebrow}>CURRENT WAYPOINT</Text>
          <Text style={styles.title}>Reach {currentWaypoint.value}</Text>
          {Boolean(currentWaypoint.description) && (
            <Text style={styles.body}>{currentWaypoint.description}</Text>
          )}
        </View>
        <ProgressCircle done={doneCount} total={totalCount} />
      </View>

      <View style={styles.divider} />

      {/* One Move Section */}
      <View style={styles.oneMoveSection}>
        <Text style={styles.eyebrow}>ONE MOVE</Text>

        {oneMove ? (
          <View style={styles.moveRow}>
            <Pressable
              onPress={() => onCompleteMove(currentWaypoint.id, oneMove.id)}
              accessibilityRole="button"
              accessibilityLabel={`Complete move: ${oneMove.text}`}
              style={styles.checkCircle}
            >
              {oneMove.done && <Check size={14} color="#3157D8" strokeWidth={3} />}
            </Pressable>

            <View style={styles.moveDetails}>
              <Text style={styles.moveText}>{oneMove.text}</Text>
              {Boolean(oneMove.context) && (
                <Text style={styles.moveContext}>{oneMove.context}</Text>
              )}
            </View>

            <Pressable
              onPress={() => onCompleteMove(currentWaypoint.id, oneMove.id)}
              accessibilityRole="button"
              accessibilityLabel="Mark complete"
              style={styles.markCompleteButton}
            >
              <Text style={styles.markCompleteText}>Mark complete</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.emptyMovesContainer}>
            <Text style={styles.body}>
              {currentWaypoint.moves.length > 0
                ? 'Your moves are complete. Have you reached this milestone in the real world?'
                : 'What is one concrete move you can make toward this milestone?'}
            </Text>
            <Pressable
              onPress={() => onAddMovePress(currentWaypoint.id)}
              accessibilityRole="button"
              accessibilityLabel="Add a move"
              style={styles.addMoveLink}
            >
              <Plus size={14} color="#3157D8" />
              <Text style={styles.addMoveText}>Add a move</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Reached milestone prompt */}
      <Pressable
        testID="reached-waypoint-prompt"
        onPress={onPromptReached}
        accessibilityRole="button"
        accessibilityLabel="Mark waypoint reached prompt"
        style={styles.reachedPrompt}
      >
        <Text style={styles.reachedPromptText}>
          {oneMove
            ? 'Think you’ve arrived? Mark waypoint reached'
            : 'Mark waypoint reached'}
        </Text>
        <ChevronRight size={16} color="#3157D8" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing[4],
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: spacing[3],
  },
  eyebrow: {
    ...typography.caption,
    color: colors.text.secondary,
    letterSpacing: 0.8,
  },
  title: {
    ...typography.headingSM,
    color: colors.text.primary,
  },
  body: {
    ...typography.bodyMD,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  summaryTextGroup: {
    flex: 1,
    gap: 4,
  },
  progressCircleContainer: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  progressTextCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressValue: {
    ...typography.labelSM,
    fontWeight: '700',
    color: colors.text.primary,
  },
  progressLabel: {
    ...typography.caption,
    fontSize: 8,
    color: colors.text.secondary,
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
  },
  oneMoveSection: {
    gap: spacing[2],
  },
  moveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2],
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#3157D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveDetails: {
    flex: 1,
  },
  moveText: {
    ...typography.labelMD,
    color: colors.text.primary,
  },
  moveContext: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  markCompleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.sm,
    backgroundColor: '#3157D8',
  },
  markCompleteText: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: '700',
  },
  emptyMovesContainer: {
    gap: spacing[2],
  },
  addMoveLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  addMoveText: {
    ...typography.labelSM,
    color: '#3157D8',
    fontWeight: '700',
  },
  reachedPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  reachedPromptText: {
    ...typography.labelSM,
    color: '#3157D8',
    fontWeight: '600',
  },
});
