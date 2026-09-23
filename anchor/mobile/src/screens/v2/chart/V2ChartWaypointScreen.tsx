import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Pencil, Plus, Sparkles, Star, X } from 'lucide-react-native';
import { V2Button } from '@/components/v2/primitives/V2Button';
import { V2SheetModal } from '@/components/v2/primitives/V2SheetModal';
import { MetricBar } from '@/components/v2/chart/ChartActiveView';
import { ChartCreamPanel, ChartEyebrow, ChartInkScreen, ChartTopBar } from '@/components/v2/chart/ChartChrome';
import { ChartLandscape, type ChartMarker } from '@/components/v2/chart/ChartLandscape';
import { CHART_WINDOWS } from '@/components/v2/chart/chartRouteGeometry';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { useAnchorChart } from '@/hooks/v2/chart/useAnchorChart';
import { useV2ReduceMotion } from '@/hooks/v2/useV2ReduceMotion';
import { colors, getCategoryColor, radii, spacing, typography } from '@/theme/v2';
import type { MoveSummary } from '@/types/chart';
import { useSharedValue } from 'react-native-reanimated';
import { CenteredMessage, actionErrorCopy } from './V2ChartScreen';
import { useChartContext } from './chartScreenSupport';

type Params = { anchorId: string; waypointId: string };

export function V2ChartWaypointScreen() {
  const route = useRoute<RouteProp<Record<string, Params>, string>>();
  const navigation = useNavigation<any>();
  const { anchorId, waypointId } = route.params ?? { anchorId: '', waypointId: '' };
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useV2ReduceMotion();
  const chart = useAnchorChart(anchorId);
  const context = useChartContext(anchorId, chart.data);
  const [newMove, setNewMove] = useState('');
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [rationaleDraft, setRationaleDraft] = useState('');
  const [progressDraft, setProgressDraft] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [suggestState, setSuggestState] = useState<'idle' | 'unavailable'>('idle');
  const view = chart.view;
  const waypoint = view?.waypoints.find((item) => item.id === waypointId) ?? null;
  const travelled = useSharedValue(view ? Math.min(1, view.reachedCount / Math.max(1, view.total)) : 0);
  const categoryColor = getCategoryColor(context.identity?.category);

  const markers: ChartMarker[] = useMemo(
    () =>
      (view?.waypoints ?? []).map((item) => ({
        id: item.id,
        number: item.number,
        // The waypoint being viewed carries the emphasis on this screen.
        state: item.id === waypointId && item.state !== 'completed' ? 'current' : item.state === 'current' ? 'upcoming' : item.state,
        accessibilityLabel: item.accessibilityLabel,
      })),
    [view?.waypoints, waypointId]
  );

  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('V2Chart', { anchorId }));

  if (!view || !waypoint) {
    return (
      <ChartInkScreen testID="v2-chart-waypoint-missing">
        <ChartTopBar title={CHART_COPY.waypoint.headerTitle} onBack={back} />
        <CenteredMessage title={chart.loading ? '' : CHART_COPY.errors.load} />
      </ChartInkScreen>
    );
  }

  const isCurrent = waypoint.state === 'current';
  const editable = waypoint.state !== 'completed';
  const committed = waypoint.moves;
  const suggestions = waypoint.suggestedMoves;
  const oneMoveId = view.oneMove?.id ?? null;
  const busy = chart.busy;

  const submitMove = async () => {
    const title = newMove.trim();
    if (!title) return;
    const ok = await chart.addMove(waypoint.id, title, { makeCurrent: isCurrent && !oneMoveId });
    if (ok) setNewMove('');
  };

  const saveEdit = async () => {
    const title = titleDraft.trim();
    if (!title) return;
    const ok = await chart.editWaypoint(waypoint.id, { title, rationale: rationaleDraft.trim() || null });
    if (ok) setEditing(false);
  };

  const saveProgress = async () => {
    if (progressDraft === null) return;
    const value = progressDraft.trim() === '' ? null : Number(progressDraft.replace(/,/g, ''));
    if (value !== null && (!Number.isFinite(value) || value < 0)) return;
    const ok = await chart.updateProgress(waypoint.id, value);
    if (ok) setProgressDraft(null);
  };

  const reach = async () => {
    setConfirmOpen(false);
    const result = await chart.reachWaypoint(waypoint.id);
    if (!result) return;
    navigation.navigate('V2Chart', {
      anchorId,
      reached: {
        completedTitle: result.completedTitle,
        nextTitle: result.nextTitle,
        reachedCount: view.reachedCount + 1,
        total: view.total,
        destinationReached: result.destinationReached,
      },
    });
  };

  const suggest = async () => {
    const outcome = await chart.suggestMoves(waypoint.id);
    setSuggestState(outcome === 'ok' ? 'idle' : 'unavailable');
  };

  return (
    <ChartInkScreen testID="v2-chart-waypoint">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          <ChartTopBar
            title={CHART_COPY.waypoint.headerTitle}
            onBack={back}
            utility={
              editable ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={CHART_COPY.waypoint.edit}
                  hitSlop={8}
                  onPress={() => {
                    setTitleDraft(waypoint.title);
                    setRationaleDraft(waypoint.rationale ?? '');
                    setEditing((value) => !value);
                  }}
                >
                  <Pencil size={20} color={colors.ink.text.primary} />
                </Pressable>
              ) : null
            }
          />
          <ChartLandscape
            width={width}
            category={context.identity?.category}
            window={CHART_WINDOWS.strip}
            markers={markers}
            travelled={travelled}
            anchorArt={context.anchorArt}
            scrimTop
            scrimBottom={colors.ink.base}
            accessibilityLabel={waypoint.accessibilityLabel}
          />
          <View style={styles.header}>
            <Text style={styles.position}>
              Waypoint {waypoint.number} of {view.total}
              {waypoint.state === 'completed' ? ' · reached' : ''}
            </Text>
            {editing ? (
              <View style={styles.editBlock}>
                <TextInput
                  value={titleDraft}
                  onChangeText={setTitleDraft}
                  maxLength={60}
                  accessibilityLabel="Waypoint title"
                  style={styles.editTitle}
                  placeholderTextColor={colors.ink.text.tertiary}
                />
                <TextInput
                  value={rationaleDraft}
                  onChangeText={setRationaleDraft}
                  maxLength={400}
                  multiline
                  placeholder="Why this matters"
                  placeholderTextColor={colors.ink.text.tertiary}
                  accessibilityLabel="Why this waypoint matters"
                  style={styles.editRationale}
                />
                <View style={styles.row}>
                  <V2Button variant="secondary" onPress={() => setEditing(false)} style={styles.flex}>
                    Cancel
                  </V2Button>
                  <V2Button onPress={() => void saveEdit()} loading={busy === `wp-edit:${waypoint.id}`} style={styles.flex}>
                    Save
                  </V2Button>
                </View>
                {!isCurrent && view.total > 1 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={CHART_COPY.waypoint.remove}
                    onPress={async () => {
                      const ok = await chart.removeWaypoint(waypoint.id);
                      if (ok) back();
                    }}
                    style={styles.remove}
                  >
                    <Text style={styles.removeText}>{CHART_COPY.waypoint.remove}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <>
                <Text accessibilityRole="header" style={styles.title}>
                  {waypoint.title}
                </Text>
                {waypoint.rationale ? <Text style={styles.rationale}>{waypoint.rationale}</Text> : null}
              </>
            )}
            {waypoint.metric ? (
              <View>
                <MetricBar metric={waypoint.metric} color={categoryColor} />
                {isCurrent ? (
                  progressDraft === null ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={CHART_COPY.waypoint.progress}
                      onPress={() => setProgressDraft(waypoint.metric?.current != null ? String(waypoint.metric.current) : '')}
                      style={styles.inlineAction}
                      testID="chart-waypoint-progress"
                    >
                      <Text style={styles.inlineActionText}>{CHART_COPY.waypoint.progress}</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.progressRow}>
                      <TextInput
                        value={progressDraft}
                        onChangeText={setProgressDraft}
                        keyboardType="decimal-pad"
                        autoFocus
                        accessibilityLabel={`Current ${waypoint.metric.label ?? 'value'}`}
                        style={styles.progressInput}
                        placeholderTextColor={colors.ink.text.tertiary}
                        placeholder="0"
                      />
                      <V2Button size="compact" onPress={() => void saveProgress()} loading={busy === `progress:${waypoint.id}`}>
                        Save
                      </V2Button>
                    </View>
                  )
                ) : null}
              </View>
            ) : null}
          </View>

          <ChartCreamPanel style={[styles.panel, { paddingBottom: insets.bottom + spacing[4] }]}>
            {committed.length > 0 ? (
              <View style={styles.section}>
                <ChartEyebrow tone="cream">{CHART_COPY.labels.yourMoves}</ChartEyebrow>
                {committed.map((move) => (
                  <MoveRow
                    key={move.id}
                    move={move}
                    isOneMove={move.id === oneMoveId}
                    busy={busy === `move:${move.id}`}
                    canPromote={isCurrent && move.status === 'ACTIVE' && move.id !== oneMoveId}
                    onComplete={() => void chart.completeMove(move.id)}
                    onPromote={() => void chart.acceptMove(move.id, { makeCurrent: true })}
                    onRemove={() => void chart.dismissMove(move.id)}
                  />
                ))}
              </View>
            ) : null}

            {editable ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <ChartEyebrow tone="cream">{CHART_COPY.labels.suggestedMoves}</ChartEyebrow>
                </View>
                {suggestions.map((move) => (
                  <View key={move.id} style={styles.suggestion}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Add suggested move: ${move.title}`}
                      onPress={() => void chart.acceptMove(move.id, { makeCurrent: isCurrent && !oneMoveId })}
                      style={styles.suggestionAccept}
                    >
                      <View style={styles.checkboxEmpty} />
                      <Text style={styles.moveText}>{move.title}</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Dismiss suggestion: ${move.title}`} hitSlop={8} onPress={() => void chart.dismissMove(move.id)}>
                      <X size={16} color={colors.text.secondary} />
                    </Pressable>
                  </View>
                ))}
                {suggestions.length === 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={CHART_COPY.waypoint.suggest}
                    onPress={() => void suggest()}
                    disabled={busy === `suggest:${waypoint.id}`}
                    style={styles.suggestButton}
                    testID="chart-suggest-moves"
                  >
                    <Sparkles size={16} color={colors.text.primary} />
                    <Text style={styles.suggestText}>{busy === `suggest:${waypoint.id}` ? 'Finding moves…' : CHART_COPY.waypoint.suggest}</Text>
                  </Pressable>
                ) : null}
                {suggestState === 'unavailable' ? <Text style={styles.hint}>{CHART_COPY.waypoint.suggestUnavailable}</Text> : null}
                <View style={styles.addRow}>
                  <Plus size={18} color={colors.text.primary} />
                  <TextInput
                    value={newMove}
                    onChangeText={setNewMove}
                    placeholder={CHART_COPY.waypoint.addMove}
                    placeholderTextColor={colors.text.tertiary}
                    maxLength={120}
                    returnKeyType="done"
                    onSubmitEditing={() => void submitMove()}
                    accessibilityLabel={CHART_COPY.waypoint.addMove}
                    style={styles.addInput}
                    testID="chart-add-move"
                  />
                  {newMove.trim() ? (
                    <Pressable accessibilityRole="button" accessibilityLabel="Save move" onPress={() => void submitMove()} hitSlop={8}>
                      <Check size={18} color={colors.text.primary} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : null}

            {actionErrorCopy(chart.lastError) ? <Text style={styles.error}>{actionErrorCopy(chart.lastError)}</Text> : null}

            {isCurrent ? (
              <V2Button
                size="large"
                onPress={() => setConfirmOpen(true)}
                loading={busy === `reach:${waypoint.id}`}
                testID="chart-mark-waypoint"
                accessibilityLabel={CHART_COPY.waypoint.markComplete}
                style={styles.primary}
              >
                {CHART_COPY.waypoint.markComplete}
              </V2Button>
            ) : null}
          </ChartCreamPanel>
        </ScrollView>
      </KeyboardAvoidingView>

      <V2SheetModal visible={confirmOpen} onClose={() => setConfirmOpen(false)} reduceMotion={reducedMotion} testID="chart-reach-confirm">
        <View style={styles.sheet}>
          <Text accessibilityRole="header" style={styles.sheetTitle}>
            {waypoint.isDestination ? CHART_COPY.labels.destinationReached.charAt(0) + CHART_COPY.labels.destinationReached.slice(1).toLowerCase() + '?' : CHART_COPY.waypoint.confirmTitle}
          </Text>
          <Text style={styles.sheetBody}>{waypoint.isDestination ? view.destination : CHART_COPY.waypoint.confirmBody}</Text>
          <V2Button size="large" onPress={() => void reach()} testID="chart-reach-yes">
            {CHART_COPY.waypoint.confirmCta}
          </V2Button>
          <V2Button variant="tertiary" onPress={() => setConfirmOpen(false)}>
            {CHART_COPY.waypoint.notYet}
          </V2Button>
        </View>
      </V2SheetModal>
    </ChartInkScreen>
  );
}

function MoveRow({
  move,
  isOneMove,
  busy,
  canPromote,
  onComplete,
  onPromote,
  onRemove,
}: {
  move: MoveSummary;
  isOneMove: boolean;
  busy: boolean;
  canPromote: boolean;
  onComplete: () => void;
  onPromote: () => void;
  onRemove: () => void;
}) {
  const done = move.status === 'COMPLETED';
  return (
    <View style={styles.moveRow}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done, disabled: done || busy, busy }}
        accessibilityLabel={`${isOneMove ? 'One Move: ' : ''}${move.title}`}
        disabled={done || busy}
        onPress={onComplete}
        hitSlop={8}
        style={[styles.checkbox, done && styles.checkboxDone]}
      >
        {done ? <Check size={13} color={colors.text.inverse} strokeWidth={3} /> : null}
      </Pressable>
      <Text style={[styles.moveText, done && styles.moveDone]}>{move.title}</Text>
      {isOneMove ? <Star size={14} color={colors.semantic.warning} fill={colors.semantic.warning} accessibilityLabel="One Move" /> : null}
      {canPromote ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Make "${move.title}" your One Move`} hitSlop={8} onPress={onPromote}>
          <Star size={14} color={colors.text.tertiary} />
        </Pressable>
      ) : null}
      {!done ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove move: ${move.title}`} hitSlop={8} onPress={onRemove}>
          <X size={14} color={colors.text.tertiary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing[3] },
  header: { paddingHorizontal: spacing[5], paddingBottom: spacing[5], gap: spacing[2], marginTop: -spacing[6] },
  position: { ...typography.labelMD, color: colors.ink.text.secondary },
  title: { ...typography.displayMedium, fontSize: 32, lineHeight: 36, color: colors.ink.text.primary },
  rationale: { ...typography.bodyLG, color: colors.ink.text.secondary },
  editBlock: { gap: spacing[3] },
  editTitle: {
    ...typography.headingLG,
    color: colors.ink.text.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.ink.hairlineStrong,
    paddingVertical: spacing[2],
  },
  editRationale: {
    ...typography.bodyMD,
    color: colors.ink.text.primary,
    borderWidth: 1,
    borderColor: colors.ink.hairlineStrong,
    borderRadius: radii.md,
    padding: spacing[3],
    minHeight: 72,
    textAlignVertical: 'top',
  },
  remove: { minHeight: 40, justifyContent: 'center' },
  removeText: { ...typography.labelMD, color: '#E7A19C' },
  inlineAction: { minHeight: 36, justifyContent: 'center', alignSelf: 'flex-start', marginTop: spacing[1] },
  inlineActionText: { ...typography.labelMD, color: colors.ink.text.primary, textDecorationLine: 'underline' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: spacing[2] },
  progressInput: {
    flex: 1,
    ...typography.bodyLG,
    color: colors.ink.text.primary,
    borderWidth: 1,
    borderColor: colors.ink.hairlineStrong,
    borderRadius: radii.md,
    paddingHorizontal: spacing[3],
    minHeight: 44,
  },
  panel: { flexGrow: 1, gap: spacing[4] },
  section: { gap: spacing[2] },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  moveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: 44 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.text.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: colors.text.primary, borderColor: colors.text.primary },
  checkboxEmpty: { width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: colors.border.strong },
  moveText: { flex: 1, ...typography.bodyMD, color: colors.text.primary },
  moveDone: { color: colors.text.secondary, textDecorationLine: 'line-through' },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: 44 },
  suggestionAccept: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: 44 },
  suggestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: 44,
    paddingHorizontal: spacing[3],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignSelf: 'flex-start',
  },
  suggestText: { ...typography.labelMD, color: colors.text.primary },
  hint: { ...typography.bodySM, color: colors.text.secondary },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radii.md,
    paddingHorizontal: spacing[3],
    backgroundColor: colors.surface,
    marginTop: spacing[2],
  },
  addInput: { flex: 1, ...typography.bodyMD, color: colors.text.primary, minHeight: 46 },
  error: { ...typography.bodySM, color: colors.semantic.error },
  primary: { marginTop: 'auto' },
  sheet: { paddingHorizontal: spacing[5], paddingBottom: spacing[5], gap: spacing[3] },
  sheetTitle: { ...typography.headingLG, color: colors.text.primary },
  sheetBody: { ...typography.bodyMD, color: colors.text.secondary },
});
