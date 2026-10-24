/**
 * Weekly Insight 2.0. A truthful, server-authored story of the week across every Anchor, then one next step.
 * Weekly Insight is global; `anchorId` (from Progress) only adds context. The screen renders what the server decided and
 * invents nothing: no map or route progress is drawn, because the recap carries no verified historical route state.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, History } from 'lucide-react-native';
import { colors, radii, spacing, typography } from '@/theme/v2';
import { ArrivalScope, Reveal } from '@/components/v2/motion';
import { useAnchorStore } from '@/stores/anchorStore';
import { useWeeklyRecap } from '@/hooks/v2/weeklyInsight/useWeeklyRecap';
import { fetchWeeklyInsightHistory } from '@/adapters/v2/weeklyInsight/weeklyInsightApiAdapter';
import type { WeeklyInsightSnapshot } from '@/adapters/v2/weeklyInsight/types';
import { nextActionFor, provisionalNotice } from '@/adapters/v2/weeklyRecap/weeklyRecapViewModel';
import {
  RecapAnchors, RecapHero, RecapHighlights, RecapMotion, RecapOpening, RecapReflection, RecapStats,
} from '@/components/v2/weeklyInsight/recap/WeeklyRecapSections';
import { WeeklyFeedbackWidget, WeeklyInsightEmptyState } from '@/components/v2/weeklyInsight';
import type { Anchor } from '@/types';

type Props = {
  navigation?: { navigate: (route: string, params?: object) => void; goBack?: () => void; canGoBack?: () => boolean };
  route?: { params?: { anchorId?: string; weekKey?: string } };
  onBack?: () => void;
  /** Called when the server says Weekly Insight 2.0 is off, so the host can show the legacy screen. */
  onDisabled?: () => void;
  testID?: string;
};

export function V2WeeklyRecapScreen({ navigation, route, onBack, onDisabled, testID = 'v2-weekly-recap' }: Props) {
  const insets = useSafeAreaInsets();
  const focusAnchorId = route?.params?.anchorId;
  const { state, history, selectedWeek, selectWeek, refresh, loadHistory, submitFeedback } = useWeeklyRecap(route?.params?.weekKey ?? 'latest');
  const anchors = useAnchorStore(s => s.anchors);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [legacy, setLegacy] = useState<WeeklyInsightSnapshot[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { if (state.status === 'disabled') onDisabled?.(); }, [state.status, onDisabled]);

  // Anchors that can really be opened here: present on this device, and either active or released (Details handles both).
  // The recap speaks in server ids; a local Anchor may still carry a local id too.
  const byId = useMemo(() => new Map<string, Anchor>(anchors.flatMap(a => [[a.id, a] as [string, Anchor], ...(a.localId ? [[a.localId, a] as [string, Anchor]] : [])])), [anchors]);
  const openable = useMemo(() => new Set(anchors.filter(a => a.isReleased || !a.archivedAt).flatMap(a => [a.id, ...(a.localId ? [a.localId] : [])])), [anchors]);
  const anchorOf = useCallback((id: string | null) => (id && openable.has(id) ? byId.get(id) : undefined), [byId, openable]);

  const goBack = () => (onBack ? onBack() : navigation?.canGoBack?.() ? navigation.goBack?.() : undefined);
  const openAnchor = (id: string) => navigation?.navigate('V2AnchorDetails', { anchorId: byId.get(id)?.id ?? id });
  const openHistory = () => { setHistoryOpen(true); void loadHistory(); void fetchWeeklyInsightHistory().then(setLegacy).catch(() => setLegacy([])); };
  const onRefresh = async () => { setRefreshing(true); try { await refresh(); } finally { setRefreshing(false); } };

  if (state.status === 'loading' || state.status === 'disabled')
    return <View style={[s.center, { paddingTop: insets.top }]} testID={`${testID}-loading`}><ActivityIndicator color={colors.text.secondary} /><Text style={s.muted}>Reading your week…</Text></View>;
  if (state.status === 'empty') return <View style={[s.root, { paddingTop: insets.top }]} testID={`${testID}-empty`}><WeeklyInsightEmptyState onBack={goBack} /></View>;
  if (state.status === 'error')
    return (
      <View style={[s.center, { paddingTop: insets.top }]} testID={`${testID}-error`}>
        <Text style={s.errTitle}>{state.kind === 'offline' ? 'You’re offline.' : 'Weekly Insight isn’t available right now.'}</Text>
        <Text style={s.muted}>Nothing has been lost. Try again in a moment.</Text>
        <Pressable onPress={onRefresh} accessibilityRole="button" style={s.retry} testID={`${testID}-retry`}><Text style={s.retryText}>Try again</Text></Pressable>
        <Pressable onPress={goBack} accessibilityRole="button" hitSlop={8}><Text style={s.muted}>Back</Text></Pressable>
      </View>
    );

  const { recap } = state;
  const notice = provisionalNotice(recap);
  const action = nextActionFor(recap, focusAnchorId, openable);
  const final = recap.status === 'FINAL';

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]} testID={testID}>
      <View style={s.header}>
        <Pressable onPress={goBack} style={s.iconBtn} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} testID={`${testID}-back`}><ArrowLeft size={19} color={colors.text.primary} /></Pressable>
        <Text style={s.title}>Weekly Insight</Text>
        <Pressable onPress={openHistory} style={s.iconBtn} accessibilityRole="button" accessibilityLabel="View previous Weekly Insights" hitSlop={12} testID={`${testID}-history`}><History size={19} color={colors.text.primary} /></Pressable>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={refreshing || state.refreshing} onRefresh={onRefresh} tintColor={colors.text.secondary} />}>
        {state.offline ? <Text style={s.offline} testID="recap-offline">Showing your saved copy. You’re offline.</Text> : null}
        <ArrivalScope animate>
          <Reveal order={0}><RecapOpening recap={recap} notice={notice} /></Reveal>
          <Reveal order={1}><RecapHero recap={recap} anchorOf={anchorOf} onOpenAnchor={openAnchor} /></Reveal>
          <Reveal order={2}><RecapStats recap={recap} /></Reveal>
          <Reveal order={3}><RecapMotion recap={recap} /></Reveal>
          <Reveal order={4}><RecapHighlights recap={recap} /></Reveal>
          <Reveal order={5}><RecapAnchors recap={recap} openable={openable} focusAnchorId={focusAnchorId} onOpenAnchor={openAnchor} /></Reveal>
          <Reveal order={6}><RecapReflection recap={recap} /></Reveal>
        </ArrivalScope>
        {action ? (
          <Pressable
            style={s.next} accessibilityRole="button" testID="recap-next-action"
            onPress={() => navigation?.navigate(action.target === 'CHART' ? 'V2Chart' : 'V2AnchorDetails', { anchorId: byId.get(action.anchorId)?.id ?? action.anchorId })}
          >
            <Text style={s.nextText}>{action.label}</Text>
          </Pressable>
        ) : null}
        {/* Feedback is collected only against finalized content. */}
        {final ? <WeeklyFeedbackWidget selectedRating={(state.feedback as any) ?? null} onSelectRating={r => void submitFeedback(r)} testID="recap-feedback" /> : null}
      </ScrollView>

      <Modal visible={historyOpen} transparent animationType="slide" onRequestClose={() => setHistoryOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setHistoryOpen(false)}>
          <Pressable style={s.sheet} onPress={e => e.stopPropagation()} testID="recap-history-sheet">
            <Text style={s.sheetTitle}>Weekly Insights</Text>
            <ScrollView>
              {history.map(item => (
                <Pressable key={item.id} style={s.histRow} accessibilityRole="button" testID={`recap-history-${item.weekKey}`}
                  onPress={() => { selectWeek(item.weekKey); setHistoryOpen(false); }}>
                  <Text style={s.histLabel}>{item.label}{item.weekKey === selectedWeek ? ' · viewing' : ''}</Text>
                  <Text style={s.histSub}>{item.headline}{item.provisional ? ' · not final' : ''}</Text>
                </Pressable>
              ))}
              {legacy.length ? <Text style={s.histSection}>EARLIER WEEKS</Text> : null}
              {legacy.map(item => (
                <Pressable key={item.id} style={s.histRow} accessibilityRole="button" testID={`recap-legacy-${item.id}`}
                  onPress={() => { setHistoryOpen(false); navigation?.navigate('V2WeeklyInsight', { snapshotId: item.id }); }}>
                  <Text style={s.histLabel}>{item.weekLabel}</Text>
                  <Text style={s.histSub} numberOfLines={1}>{item.headline}</Text>
                </Pressable>
              ))}
              {!history.length && !legacy.length ? <Text style={s.muted}>Past weeks will appear here.</Text> : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  center: { flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', gap: spacing[3], paddingHorizontal: spacing[6] },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: typography.bodyMedium, fontSize: 15, color: colors.text.primary },
  scroll: { paddingBottom: 48 },
  offline: { fontFamily: typography.body, fontSize: 12, color: colors.text.secondary, textAlign: 'center', paddingTop: 4 },
  muted: { fontFamily: typography.body, fontSize: 14, color: colors.text.secondary, textAlign: 'center' },
  errTitle: { fontFamily: typography.displaySemiBold, fontSize: 20, color: colors.text.primary, textAlign: 'center' },
  retry: { minHeight: 44, paddingHorizontal: spacing[5], borderRadius: radii.pill, backgroundColor: colors.text.primary, alignItems: 'center', justifyContent: 'center' },
  retryText: { fontFamily: typography.bodyMedium, fontSize: 15, color: colors.canvas },
  next: { marginHorizontal: spacing[5], marginTop: spacing[6], minHeight: 52, borderRadius: radii.pill, backgroundColor: colors.text.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[5] },
  nextText: { fontFamily: typography.bodyMedium, fontSize: 16, color: colors.canvas },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.canvas, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing[5], maxHeight: '75%' },
  sheetTitle: { fontFamily: typography.displaySemiBold, fontSize: 20, color: colors.text.primary, marginBottom: spacing[3] },
  histRow: { minHeight: 56, justifyContent: 'center', paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  histLabel: { fontFamily: typography.bodyMedium, fontSize: 15, color: colors.text.primary },
  histSub: { fontFamily: typography.body, fontSize: 13, color: colors.text.secondary },
  histSection: { fontFamily: typography.bodyMedium, fontSize: 11, letterSpacing: 0.9, color: colors.text.disabled, marginTop: spacing[4], marginBottom: 4 },
});
