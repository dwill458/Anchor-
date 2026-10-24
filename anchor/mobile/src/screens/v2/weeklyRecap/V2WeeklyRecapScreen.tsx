import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, History } from 'lucide-react-native';
import { colors, radii, typography } from '@/theme/v2';
import { ArrivalScope, Reveal } from '@/components/v2/motion';
import { useAnchorStore } from '@/stores/anchorStore';
import { useWeeklyRecap } from '@/hooks/v2/weeklyRecap/useWeeklyRecap';
import { RecapHero, RecapHighlights, RecapNextAction, RecapStats, RecapStatusBanner, RecapWeekStrip } from '@/components/v2/weeklyRecap/RecapSections';
import { RecapHistoricalMap } from '@/components/v2/weeklyRecap/RecapHistoricalMap';
import { WeeklyFeedbackWidget } from '@/components/v2/weeklyInsight';

export interface V2WeeklyRecapScreenProps {
  /** Anchor the user came from (Progress); the recap stays global but keeps this context. */
  anchorId?: string;
  onBack: () => void;
  onNavigateToChart?: (anchorId?: string) => void;
  onStartPractice?: (anchorId?: string) => void;
  /** Fall back to the classic experience (server flag off, or user chose the classic archive). */
  onUseClassic: () => void;
  testID?: string;
}

export const V2WeeklyRecapScreen: React.FC<V2WeeklyRecapScreenProps> = ({ anchorId, onBack, onNavigateToChart, onStartPractice, onUseClassic, testID = 'v2-weekly-recap' }) => {
  const insets = useSafeAreaInsets();
  const r = useWeeklyRecap();
  const anchors = useAnchorStore((s) => s.anchors || []);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Server flag is off: hand over to the classic screen.
  React.useEffect(() => { if (r.featureDisabled) onUseClassic(); }, [r.featureDisabled, onUseClassic]);

  const focusAnchor = anchorId ? anchors.find((a: any) => a.id === anchorId) : undefined;
  const vm = r.viewModel;
  const highlights = useMemo(() => {
    if (!vm || !anchorId) return vm?.highlights ?? [];
    // Stable: this Anchor's items first, everything else keeps server order.
    return [...vm.highlights].sort((a, b) => Number(b.anchorId === anchorId) - Number(a.anchorId === anchorId));
  }, [vm, anchorId]);

  const mapAnchor = vm?.map.mode === 'VERIFIED' ? anchors.find((a: any) => a.id === vm.map.anchorId) : undefined;

  const openHistory = () => { setHistoryOpen(true); void r.loadHistory(); };
  const onRefresh = async () => { setRefreshing(true); try { await r.refresh(); } finally { setRefreshing(false); } };

  const header = (
    <View style={styles.header}>
      <Pressable style={styles.iconBtn} onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} testID={`${testID}-back`}>
        <ArrowLeft size={19} color={colors.text.primary} />
      </Pressable>
      <Text style={styles.title}>Weekly Insight</Text>
      <Pressable style={styles.iconBtn} onPress={openHistory} accessibilityRole="button" accessibilityLabel="Earlier weeks" hitSlop={12} testID={`${testID}-history`}>
        <History size={19} color={colors.text.primary} />
      </Pressable>
    </View>
  );

  if (r.loading && !vm) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]} testID={`${testID}-loading`}>
        <ActivityIndicator size="small" color={colors.text.secondary} />
        <Text style={styles.muted}>Reading your week…</Text>
      </View>
    );
  }

  if (!vm) {
    const message = r.unavailable
      ? 'Your first recap arrives Sunday evening.'
      : r.error ?? 'Weekly Insight is unavailable right now.';
    return (
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]} testID={`${testID}-empty`}>
        {header}
        <View style={[styles.center, { flex: 1 }]}>
          <Text style={styles.empty}>{message}</Text>
          {!r.unavailable ? (
            <Pressable onPress={() => void r.refresh()} accessibilityRole="button" style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  const openAction = () => {
    const id = vm.nextAction.anchorId ?? anchorId;
    if (vm.nextAction.kind === 'CHART') onNavigateToChart?.(id ?? undefined);
    else onStartPractice?.(id ?? undefined);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]} testID={testID}>
      {header}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text.secondary} />}>
        <ArrivalScope animate>
          {focusAnchor ? (
            <Reveal order={0}>
              <Text style={styles.context} testID={`${testID}-context`}>Across all your Anchors · opened from {(focusAnchor as any).intentionText ?? 'your Anchor'}</Text>
            </Reveal>
          ) : null}
          <Reveal order={0}><RecapStatusBanner status={vm.status} offline={r.offline} testID={`${testID}-status`} /></Reveal>
          <Reveal order={1}><RecapHero hero={vm.hero} weekLabel={vm.weekLabel} testID={`${testID}-hero`} /></Reveal>
          <Reveal order={2}>
            <RecapHistoricalMap map={vm.map} category={(mapAnchor as any)?.category ?? null} title={vm.hero.headline} testID={`${testID}-map`} />
          </Reveal>
          <Reveal order={3}><RecapStats stats={vm.stats} testID={`${testID}-stats`} /></Reveal>
          <Reveal order={3}><RecapWeekStrip days={vm.days} testID={`${testID}-days`} /></Reveal>
          <Reveal order={4}><RecapHighlights items={highlights} moreCount={vm.moreCount} testID={`${testID}-highlights`} /></Reveal>
          <Reveal order={5}><RecapNextAction action={vm.nextAction} onPress={openAction} testID={`${testID}-next`} /></Reveal>
          {vm.feedbackEnabled ? (
            <Reveal order={5}>
              <View style={styles.feedback}>
                <WeeklyFeedbackWidget selectedRating={r.feedback} onSelectRating={r.submitFeedback} testID={`${testID}-feedback`} />
                {r.feedbackError ? <Text style={styles.muted}>{r.feedbackError}</Text> : null}
              </View>
            </Reveal>
          ) : null}
          <Pressable onPress={onUseClassic} accessibilityRole="button" style={styles.classic} testID={`${testID}-classic`}>
            <Text style={styles.classicText}>Classic Weekly Insight</Text>
          </Pressable>
        </ArrivalScope>
      </ScrollView>

      <Modal visible={historyOpen} transparent animationType="fade" onRequestClose={() => setHistoryOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setHistoryOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} testID={`${testID}-history-sheet`}>
          <Text style={styles.sheetTitle}>Earlier weeks</Text>
          <ScrollView style={{ maxHeight: 360 }}>
            {r.history.length === 0 ? <Text style={styles.muted}>No earlier recaps yet.</Text> : r.history.map((h) => (
              <Pressable key={h.weekKey} style={styles.historyRow} accessibilityRole="button"
                onPress={() => { setHistoryOpen(false); r.selectWeek(h.weekKey); }}>
                <Text style={styles.historyWeek}>{h.weekKey}{h.status === 'DRAFT' ? ' · provisional' : ''}</Text>
                {h.headline ? <Text style={styles.historyHeadline}>{h.headline}</Text> : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(216, 210, 200, 0.45)' },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: typography.bodyMedium, fontSize: 14, color: colors.text.primary, letterSpacing: -0.1 },
  muted: { fontFamily: typography.body, fontSize: 13, color: colors.text.secondary, marginTop: 10 },
  empty: { fontFamily: typography.body, fontSize: 15, color: colors.text.secondary, textAlign: 'center' },
  retry: { marginTop: 14, paddingVertical: 10, paddingHorizontal: 18, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border.strong },
  retryText: { fontFamily: typography.bodyMedium, fontSize: 13, color: colors.text.primary },
  context: { fontFamily: typography.body, fontSize: 12, color: colors.text.secondary, marginHorizontal: 20, marginTop: 14 },
  feedback: { marginHorizontal: 20, marginTop: 20 },
  classic: { alignSelf: 'center', marginTop: 28, padding: 10 },
  classicText: { fontFamily: typography.body, fontSize: 12, color: colors.text.disabled },
  scrim: { flex: 1, backgroundColor: 'rgba(18, 26, 34, 0.35)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: 20 },
  sheetTitle: { fontFamily: typography.displaySemiBold, fontSize: 20, color: colors.text.primary, marginBottom: 8 },
  historyRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  historyWeek: { fontFamily: typography.bodyMedium, fontSize: 13, color: colors.text.primary },
  historyHeadline: { fontFamily: typography.body, fontSize: 13, color: colors.text.secondary, marginTop: 2 },
});
