import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Bell, Check, Clock, Repeat } from 'lucide-react-native';
import { V2Button } from '@/components/v2/primitives/V2Button';
import { colors, radii, spacing } from '@/theme/v2';
import type { AskUiMessage } from '@/hooks/v2/chart/askChartState';
import { chartTypography as typography } from '../chartTypography';
import type { AskAccent } from './askChartTheme';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { formatPlanTime, formatPlanWhen } from '@/adapters/v2/chart/movePlan';
import type { AskPlan } from '@/services/v2/askChartApi';

export type ProposalError = 'stale' | 'offline' | 'failed';

/** After an applied proposal whose moves have a day and a time: the one-tap reminder offer. */
export type ProposalRemind = { time: string; state: 'offer' | 'busy' | 'on' | 'denied' };

const ASK_COPY = CHART_COPY.ask.proposal;

/** The same cue and day/time chips as the One Move card, on the cream conversation. Never a bell here. */
function PlanChips({ plan, accent, now }: { plan: Partial<AskPlan> | null | undefined; accent: AskAccent; now: Date }) {
  const when = plan?.date ? formatPlanWhen({ date: plan.date, time: plan.time ?? null }, now) : '';
  if (!plan?.cue && !when) return null;
  return (
    <View style={styles.chips} testID="ask-proposal-plan">
      {plan?.cue ? (
        <View style={styles.chip}>
          <Repeat size={12} color={accent.text} strokeWidth={2.2} />
          <Text style={styles.chipText}>{plan.cue}</Text>
        </View>
      ) : null}
      {when ? (
        <View style={styles.chip}>
          <Clock size={12} color={accent.text} strokeWidth={2.2} />
          <Text style={styles.chipText}>{when}</Text>
        </View>
      ) : null}
    </View>
  );
}

type Props = {
  message: AskUiMessage;
  accent: AskAccent;
  busy: 'approving' | 'dismissing' | null;
  error: ProposalError | null;
  reducedMotion: boolean;
  onApprove: () => void;
  onDismiss: () => void;
  onReview: () => void;
  /** Shown under an applied card when its moves now have a day and a time. */
  remind?: ProposalRemind | null;
  onRemind?: () => void;
  now?: Date;
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
export const AskProposalCard = memo(function AskProposalCard({ message, accent, busy, error, reducedMotion, onApprove, onDismiss, onReview, remind = null, onRemind, now: nowProp }: Props) {
  const action = message.action;
  if (!action) return null;
  const now = nowProp ?? new Date();
  const isPlan = action.type === 'PLAN_MOVES';
  const isMoves = action.type === 'ADD_MOVES';
  const isWaypoint = action.scope === 'WAYPOINT';

  if (action.status === 'APPLIED') {
    return (
      <View>
        <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(180)} style={styles.done} testID="ask-proposal-applied" accessibilityLiveRegion="polite">
          <Check size={16} color={accent.text} strokeWidth={2.6} />
          <Text style={[styles.doneText, { color: accent.text }]}>{isPlan ? ASK_COPY.planApplied : isMoves ? 'Added to your Chart' : 'Route updated'}</Text>
        </Animated.View>
        {remind ? (
          remind.state === 'on' ? (
            <View style={[styles.chip, styles.remindChip]} testID="ask-proposal-remind-on">
              <Bell size={13} color={accent.text} strokeWidth={2.2} />
              <Text style={styles.chipText}>{ASK_COPY.remindSet}</Text>
            </View>
          ) : remind.state === 'denied' ? (
            <Text style={styles.moveWhy} testID="ask-proposal-remind-denied">{CHART_COPY.plan.remindDenied}</Text>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: remind.state === 'busy', disabled: remind.state === 'busy' }}
              disabled={remind.state === 'busy'}
              onPress={onRemind}
              hitSlop={6}
              style={({ pressed }) => [styles.chip, styles.remindChip, styles.remindOffer, { borderColor: accent.border }, pressed && { opacity: 0.75 }]}
              testID="ask-proposal-remind"
            >
              <Bell size={13} color={accent.text} strokeWidth={2.2} />
              <Text style={styles.chipText}>{ASK_COPY.remindAt.replace('{time}', formatPlanTime(remind.time))}</Text>
            </Pressable>
          )
        ) : null}
      </View>
    );
  }
  if (action.status === 'DISMISSED') {
    return <Text style={styles.dismissed} testID="ask-proposal-dismissed">{isPlan ? ASK_COPY.planDismissed : isMoves ? 'Not added' : 'Route left as it was'}</Text>;
  }

  const stale = error === 'stale';
  return (
    <View style={[styles.card, { borderColor: accent.border }]} testID="ask-proposal">
      <Text style={[styles.eyebrow, { color: accent.text }]}>{isPlan ? ASK_COPY.planEyebrow : isMoves ? 'SUGGESTED MOVES' : isWaypoint ? 'SUGGESTED WAYPOINT CHANGE' : 'SUGGESTED ROUTE CHANGE'}</Text>
      <Text style={styles.summary}>{action.summary}</Text>
      {!isMoves && !isPlan && action.routeReason ? <Text style={styles.reason} testID="ask-proposal-reason">{action.routeReason}</Text> : null}
      {(isMoves || isPlan) && action.waypointTitle ? <Text style={styles.context}>For “{action.waypointTitle}”</Text> : null}

      {isPlan ? (
        <View style={styles.list}>
          {(action.plans ?? []).map((plan, index) => (
            <View key={plan.moveId} style={styles.row} testID="ask-proposal-plan-row">
              <Text style={[styles.index, { color: accent.text }]}>{index + 1}</Text>
              <View style={styles.rowBody}>
                <Text style={styles.moveTitle}>{plan.title}</Text>
                <PlanChips plan={plan} accent={accent} now={now} />
              </View>
            </View>
          ))}
        </View>
      ) : isMoves ? (
        <View style={styles.list}>
          {action.moves.map((move, index) => (
            <View key={`${index}-${move.title}`} style={styles.row}>
              <Text style={[styles.index, { color: accent.text }]}>{index + 1}</Text>
              <View style={styles.rowBody}>
                <Text style={styles.moveTitle}>{move.title}</Text>
                {move.rationale ? <Text numberOfLines={1} style={styles.moveWhy}>{move.rationale}</Text> : null}
                <PlanChips plan={move} accent={accent} now={now} />
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
            <Text style={styles.notNowText}>{isPlan ? ASK_COPY.notNow : isMoves ? 'Not yet' : 'Not now'}</Text>
          </Pressable>
          <View style={styles.primary}>
            <V2Button size="medium" loading={busy === 'approving'} disabled={busy !== null} onPress={isMoves || isPlan ? onApprove : onReview} testID="ask-proposal-approve">
              {isPlan ? ASK_COPY.usePlan : isMoves ? 'Apply to chart' : 'Review route'}
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing[1] },
  chip: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.canvas, maxWidth: '100%' },
  chipText: { ...typography.bodySM, color: colors.text.primary, flexShrink: 1 },
  remindChip: { alignSelf: 'flex-start', marginTop: spacing[2] },
  remindOffer: { minHeight: 44, borderWidth: 1, backgroundColor: 'transparent' },
});
