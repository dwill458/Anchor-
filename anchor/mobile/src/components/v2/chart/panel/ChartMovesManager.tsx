import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, Plus, Sparkles, X } from 'lucide-react-native';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import type { ChartWaypointView } from '@/adapters/v2/chart/chartV2Model';
import type { UseAnchorChartResult } from '@/hooks/v2/chart/useAnchorChart';
import { CHART_MAP_TOKENS as T } from '../map/chartMapTokens';
import { CardKey } from './ChartPanelCards';
import type { PanelAccent } from './chartPanelColors';

type Props = {
  waypoint: ChartWaypointView;
  isCurrent: boolean;
  oneMoveId: string | null;
  accent: PanelAccent;
  chart: Pick<UseAnchorChartResult, 'busy' | 'addMove' | 'acceptMove' | 'dismissMove' | 'suggestMoves'>;
};

/**
 * Suggested moves, "Suggest moves" and "Add a move": existing Chart features
 * that live in the expanded move list of the ink panel (they are not dropped by
 * the redesign). AI suggestions stay suggestions until the person accepts one.
 */
export function ChartMovesManager({ waypoint, isCurrent, oneMoveId, accent, chart }: Props) {
  const [newMove, setNewMove] = useState('');
  const [suggestState, setSuggestState] = useState<'idle' | 'unavailable'>('idle');

  const submitMove = async () => {
    const title = newMove.trim();
    if (!title) return;
    if (await chart.addMove(waypoint.id, title, { makeCurrent: isCurrent && !oneMoveId })) setNewMove('');
  };

  const suggest = async () => {
    const outcome = await chart.suggestMoves(waypoint.id);
    setSuggestState(outcome === 'ok' ? 'idle' : 'unavailable');
  };

  const suggesting = chart.busy === `suggest:${waypoint.id}`;

  return (
    <View style={styles.root}>
      <CardKey color={accent.text}>{CHART_COPY.labels.suggestedMoves}</CardKey>
      {waypoint.suggestedMoves.map((move) => (
        <View key={move.id} style={styles.suggestion}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add suggested move: ${move.title}`}
            onPress={() => void chart.acceptMove(move.id, { makeCurrent: isCurrent && !oneMoveId })}
            style={styles.accept}
          >
            <View style={[styles.box, { borderColor: accent.fill }]} />
            <Text style={styles.moveText}>{move.title}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Dismiss suggestion: ${move.title}`}
            onPress={() => void chart.dismissMove(move.id)}
            style={styles.icon}
          >
            <X size={16} color={T.muted} />
          </Pressable>
        </View>
      ))}
      {waypoint.suggestedMoves.length === 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={CHART_COPY.waypoint.suggest}
          onPress={() => void suggest()}
          disabled={suggesting}
          style={styles.suggestButton}
          testID="chart-suggest-moves"
        >
          <Sparkles size={16} color={T.light} />
          <Text style={styles.suggestText}>{suggesting ? 'Finding moves…' : CHART_COPY.waypoint.suggest}</Text>
        </Pressable>
      ) : null}
      {suggestState === 'unavailable' ? <Text style={styles.hint}>{CHART_COPY.waypoint.suggestUnavailable}</Text> : null}
      <View style={styles.addRow}>
        <Plus size={18} color={T.light} />
        <TextInput
          value={newMove}
          onChangeText={setNewMove}
          placeholder={CHART_COPY.waypoint.addMove}
          placeholderTextColor={T.muted}
          maxLength={120}
          returnKeyType="done"
          onSubmitEditing={() => void submitMove()}
          accessibilityLabel={CHART_COPY.waypoint.addMove}
          style={styles.addInput}
          testID="chart-add-move"
        />
        {newMove.trim() ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Save move" onPress={() => void submitMove()} style={styles.icon}>
            <Check size={18} color={T.light} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingTop: 12, gap: 4 },
  suggestion: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  accept: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  box: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5 },
  moveText: { flex: 1, fontFamily: T.sans, fontSize: 15, lineHeight: 21, color: T.light },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  suggestButton: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: T.line, alignSelf: 'flex-start' },
  suggestText: { fontFamily: T.sansStrong, fontSize: 14, color: T.light },
  hint: { fontFamily: T.sans, fontSize: 13, color: T.muted },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: T.line, borderRadius: 12, paddingLeft: 12, marginTop: 6 },
  addInput: { flex: 1, fontFamily: T.sans, fontSize: 15, color: T.light, minHeight: 46 },
});
