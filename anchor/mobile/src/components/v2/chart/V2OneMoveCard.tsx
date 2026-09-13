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
  const size = 72;
  const strokeWidth = 5.5;
  const r = 29;
  const circumference = 2 * Math.PI * r;
  const progress = total > 0 ? (done / total) * circumference : 0;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${done} of ${total} steps completed`}
      style={styles.progressCircleContainer}
    >
      <Svg width={size} height={size} viewBox="0 0 72 72">
        <Circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke="#EAE6DF"
          strokeWidth={strokeWidth}
        />
        <Circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke="#3157D8"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          transform="rotate(-90 36 36)"
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
          <Text style={styles.body}>
            {currentWaypoint.description ||
              'Choose one concrete move that brings you closer.'}
          </Text>
        </View>
        <ProgressCircle done={doneCount} total={totalCount} />
      </View>

      <View style={styles.divider} />

      {/* One Move Section */}
      <View style={styles.oneMoveSection}>
        <Text style={styles.eyebrow}>ONE MOVE</Text>

        {oneMove ? (
          <View style={styles.moveRowCard}>
            <Pressable
              onPress={() => onCompleteMove(currentWaypoint.id, oneMove.id)}
              accessibilityRole="button"
              accessibilityLabel={`Complete move: ${oneMove.text}`}
              hitSlop={10}
              style={styles.checkCircle}
            >
              {oneMove.done && (
                <Check size={14} color="#3157D8" strokeWidth={3} />
              )}
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
              hitSlop={6}
              style={styles.markCompleteButton}
            >
              <Text style={styles.markCompleteText}>Mark complete</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.emptyMovesContainer}>
            <Text style={styles.body}>
              {currentWaypoint.moves.length > 0
                ? 'Your moves are complete. Have you reached this waypoint?'
                : 'What is one move you can make toward this waypoint?'}
            </Text>
            {currentWaypoint.moves.length === 0 && (
              <Pressable
                onPress={() => onAddMovePress(currentWaypoint.id)}
                accessibilityRole="button"
                accessibilityLabel="Add a move"
                hitSlop={8}
                style={styles.addMoveLink}
              >
                <Plus size={14} color="#3157D8" />
                <Text style={styles.addMoveText}>Add a move</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* Reached milestone prompt */}
      <Pressable
        testID="reached-waypoint-prompt"
        onPress={onPromptReached}
        accessibilityRole="button"
        accessibilityLabel="Mark waypoint reached prompt"
        hitSlop={8}
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
    borderRadius: radii.xl,
    backgroundColor: '#FDFBF8',
    borderWidth: 1,
    borderColor: '#E9E5DE',
    gap: spacing[3],
    shadowColor: '#182235',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  eyebrow: {
    ...typography.caption,
    color: '#717686',
    letterSpacing: 0.9,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    ...typography.headingSM,
    color: colors.text.primary,
    fontSize: 20,
    letterSpacing: -0.4,
  },
  body: {
    ...typography.bodyMD,
    color: '#6B7280',
    lineHeight: 20,
    fontSize: 13,
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
    width: 72,
    height: 72,
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
    fontWeight: '800',
    fontSize: 13,
    color: colors.text.primary,
  },
  progressLabel: {
    ...typography.caption,
    fontSize: 8,
    color: colors.text.secondary,
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#EAE6DF',
  },
  oneMoveSection: {
    gap: spacing[2],
  },
  moveRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 15,
    backgroundColor: '#F0EAFA',
    borderWidth: 1,
    borderColor: '#E6DEFA',
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#223B6A',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveDetails: {
    flex: 1,
  },
  moveText: {
    ...typography.labelMD,
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  moveContext: {
    ...typography.caption,
    color: '#717686',
    marginTop: 2,
    fontSize: 11,
  },
  markCompleteButton: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#3157D8',
    minHeight: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markCompleteText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11.5,
  },
  emptyMovesContainer: {
    gap: spacing[2],
    paddingVertical: spacing[1],
  },
  addMoveLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    minHeight: 44,
  },
  addMoveText: {
    ...typography.labelSM,
    color: '#3157D8',
    fontWeight: '700',
    fontSize: 13,
  },
  reachedPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: '#EAE6DF',
    minHeight: 44,
  },
  reachedPromptText: {
    ...typography.labelSM,
    color: '#3157D8',
    fontWeight: '600',
    fontSize: 12.5,
  },
});
