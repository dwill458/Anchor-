import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Check } from 'lucide-react-native';
import { V2Button } from '@/components/v2/primitives/V2Button';
import { colors, radii, spacing } from '@/theme/v2';
import type { AskUiMessage } from '@/hooks/v2/chart/askChartState';
import { chartTypography as typography } from '../chartTypography';
import type { AskAccent } from './askChartTheme';

export type ProposalError = 'stale' | 'offline' | 'failed';

type Props = {
  message: AskUiMessage;
  accent: AskAccent;
  busy: 'approving' | 'dismissing' | null;
  error: ProposalError | null;
  reducedMotion: boolean;
  onApprove: () => void;
  onDismiss: () => void;
  onReview: () => void;
};

const MAX_ROUTE_ROWS = 6;

const ERROR_COPY: Record<ProposalError, string> = {
  stale: 'That part of your route is already behind you, so this no longer fits. Ask me for a fresh suggestion.',
  offline: 'You’re offline. Nothing was changed; try again when you’re back.',
  failed: 'That didn’t save, so nothing changed. Try again.',
};

/**
 * A change Ask Chart suggests, shown in the conversation. Nothing on the Chart changes until the person approves,
 * and the card only says "added" once the server has saved it.
 */
export const AskProposalCard = memo(function AskProposalCard({ message, accent, busy, error, reducedMotion, onApprove, onDismiss, onReview }: Props) {
  const action = message.action;
  if (!action) return null;
  const isMoves = action.type === 'ADD_MOVES';
  const isWaypoint = action.scope === 'WAYPOINT';

  if (action.status === 'APPLIED') {
    return (
      <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(180)} style={styles.done} testID="ask-proposal-applied" accessibilityLiveRegion="polite">
        <Check size={16} color={accent.text} strokeWidth={2.6} />
        <Text style={[styles.doneText, { color: accent.text }]}>{isMoves ? 'Added to your Chart' : 'Route updated'}</Text>
      </Animated.View>
    );
  }
  if (action.status === 'DISMISSED') {
    return <Text style={styles.dismissed} testID="ask-proposal-dismissed">{isMoves ? 'Not added' : 'Route left as it was'}</Text>;
  }

  const stale = error === 'stale';
  return (
    <View style={[styles.card, { borderColor: accent.border }]} testID="ask-proposal">
      <Text style={[styles.eyebrow, { color: accent.text }]}>{isMoves ? 'SUGGESTED MOVES' : isWaypoint ? 'SUGGESTED WAYPOINT CHANGE' : 'SUGGESTED ROUTE CHANGE'}</Text>
      <Text style={styles.summary}>{action.summary}</Text>
      {!isMoves && action.routeReason ? <Text style={styles.reason} testID="ask-proposal-reason">{action.routeReason}</Text> : null}
      {isMoves && action.waypointTitle ? <Text style={styles.context}>For “{action.waypointTitle}”</Text> : null}

      {isMoves ? (
        <View style={styles.list}>
          {action.moves.map((move, index) => (
            <View key={`${index}-${move.title}`} style={styles.row}>
              <Text style={[styles.index, { color: accent.text }]}>{index + 1}</Text>
              <View style={styles.rowBody}>
                <Text style={styles.moveTitle}>{move.title}</Text>
                {move.rationale ? <Text numberOfLines={1} style={styles.moveWhy}>{move.rationale}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.list}>
          {(action.routeTitles ?? []).slice(0, MAX_ROUTE_ROWS).map((title, index) => (
            <View key={`${index}-${title}`} style={styles.row}>
              <Text style={[styles.index, { color: accent.text }]}>{index + 1}</Text>
              <Text style={[styles.moveTitle, styles.rowBody]}>{title}</Text>
            </View>
          ))}
          {(action.routeTitles?.length ?? 0) > MAX_ROUTE_ROWS ? <Text style={styles.moveWhy}>+{(action.routeTitles?.length ?? 0) - MAX_ROUTE_ROWS} more</Text> : null}
          <Text style={styles.moveWhy}>You’ll review every step before anything changes.</Text>
        </View>
      )}

      {error ? <Text style={styles.error} accessibilityLiveRegion="polite" testID="ask-proposal-error">{ERROR_COPY[error]}</Text> : null}

      {!stale ? (
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={onDismiss} disabled={busy !== null} hitSlop={8} style={styles.notNow} testID="ask-proposal-dismiss">
            <Text style={styles.notNowText}>{isMoves ? 'Not yet' : 'Not now'}</Text>
          </Pressable>
          <View style={styles.primary}>
            <V2Button size="medium" loading={busy === 'approving'} disabled={busy !== null} onPress={isMoves ? onApprove : onReview} testID="ask-proposal-approve">
              {isMoves ? 'Apply to chart' : 'Review route'}
            </V2Button>
          </View>
        </View>
      ) : (
        <Pressable accessibilityRole="button" onPress={onDismiss} hitSlop={8} style={styles.notNow} testID="ask-proposal-dismiss">
          <Text style={styles.notNowText}>Dismiss</Text>
        </Pressable>
      )}
    </View>
  );
});

/** Shown under an assistant message when it promised a change that could not be prepared. Never as a success. */
export const AskActionUnavailable = memo(function AskActionUnavailable() {
  return <Text style={styles.unavailable} testID="ask-action-unavailable">I couldn’t prepare that change just now. Ask me again in a moment and I’ll try once more.</Text>;
});

const styles = StyleSheet.create({
  card: { marginTop: spacing[3], padding: spacing[4], gap: spacing[2], borderRadius: radii.lg, borderWidth: 1, backgroundColor: colors.surface },
  eyebrow: { ...typography.labelSM, letterSpacing: 0.8 },
  summary: { ...typography.headingSM, color: colors.text.primary },
  reason: { ...typography.bodyMD, color: colors.text.secondary },
  context: { ...typography.bodySM, color: colors.text.secondary },
  list: { gap: spacing[2], paddingTop: spacing[1] },
  row: { flexDirection: 'row', gap: spacing[3], alignItems: 'flex-start' },
  rowBody: { flex: 1, flexShrink: 1 },
  index: { ...typography.labelMD, width: 16, textAlign: 'center', marginTop: 1 },
  moveTitle: { ...typography.bodyMD, color: colors.text.primary },
  moveWhy: { ...typography.bodySM, color: colors.text.secondary, marginTop: 1 },
  error: { ...typography.bodySM, color: colors.semantic.error },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3], paddingTop: spacing[2] },
  notNow: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing[2] },
  notNowText: { ...typography.labelMD, color: colors.text.secondary },
  primary: { flexShrink: 1 },
  done: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingTop: spacing[3] },
  doneText: { ...typography.labelMD },
  dismissed: { ...typography.bodySM, color: colors.text.tertiary, paddingTop: spacing[2] },
  unavailable: { ...typography.bodySM, color: colors.text.secondary, paddingTop: spacing[2] },
});
