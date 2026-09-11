import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { V2EmptyState, V2Screen, V2ThreadStrength } from '@/components/v2';
import { V2PracticeAnchorContext, V2PracticeModeRow, V2RecommendedTodayRibbon } from '@/components/v2/practice';
import { V2_PRACTICE_MODE_DEFINITIONS, V2_RECOMMENDATION_ACTION_TO_MODE, type V2PracticeMode } from '@/constants/v2/practice';
import { useV2SelectedAnchor } from '@/hooks/v2/home';
import { useV2PracticeModel, type V2PracticeCapabilities } from '@/hooks/v2/practice';
import { acknowledgeV2RecommendationSignal, type V2RecommendationContext } from '@/adapters/v2/practice';
import { colors, spacing, typography } from '@/theme/v2';
import type { Anchor } from '@/types';
import type { V2PracticeRouteIntents } from './practiceRoutes';
import { V2PracticePrepareScreen } from './V2PracticePrepareScreen';
import type { PracticeCompletionReturn } from '@/navigation/practiceCompletionReturn';

type Props = Partial<V2PracticeRouteIntents> & { anchor?: Anchor | null; recommendation?: V2RecommendationContext | null; capabilities?: V2PracticeCapabilities; onBack?: () => void; completion?: PracticeCompletionReturn | null };

export function V2PracticeScreen({ anchor: suppliedAnchor, recommendation: suppliedRecommendation, capabilities, onBack, onPremiumCapabilityRequired, onCreateVision, onOpenVision, onReleaseRequested, onBeginPractice }: Props) {
  const { selectedAnchor } = useV2SelectedAnchor();
  const fixedAnchor = suppliedAnchor === undefined ? selectedAnchor : suppliedAnchor;
  const model = useV2PracticeModel(fixedAnchor, suppliedRecommendation);
  const [prepareMode, setPrepareMode] = useState<V2PracticeMode | null>(null);
  const [prepareSource, setPrepareSource] = useState<'practice_hub' | 'recommended_today'>('practice_hub');
  const effectiveCapabilities = capabilities ?? model.capability;
  const selectMode = (mode: V2PracticeMode, source: 'practice_hub' | 'recommended_today') => {
    if (!fixedAnchor) return;
    if (mode !== 'release' && !effectiveCapabilities[mode]) { onPremiumCapabilityRequired?.({ capability: mode, anchorId: fixedAnchor.id, source }); return; }
    if (source === 'recommended_today' && model.recommendation?.completionSignal) void acknowledgeV2RecommendationSignal(fixedAnchor.id, model.recommendation.completionSignal.id, model.recommendation.completionSignal.type).catch(() => undefined);
    setPrepareSource(source);
    setPrepareMode(mode);
  };
  if (!fixedAnchor) return <V2Screen testID="v2-practice-screen"><View style={styles.empty}><V2EmptyState title="No Anchor selected" message="Choose an Anchor before beginning a practice." /></View></V2Screen>;
  if (prepareMode) return <V2PracticePrepareScreen anchor={fixedAnchor} mode={prepareMode} vision={model.vision} source={prepareSource} onBack={() => setPrepareMode(null)} onCreateVision={onCreateVision ?? (() => undefined)} onOpenVision={onOpenVision} onReleaseRequested={onReleaseRequested ?? (() => undefined)} onBeginPractice={onBeginPractice} />;
  const recommendedMode = model.recommendation ? V2_RECOMMENDATION_ACTION_TO_MODE[model.recommendation.recommendation.action] : 'focus';
  return <V2Screen scroll testID="v2-practice-screen"><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} disabled={!onBack} style={styles.back}><ArrowLeft size={20} color={colors.text.primary} /><Text style={styles.backText}>Practice</Text></Pressable><View style={styles.content}><V2PracticeAnchorContext anchor={fixedAnchor} />
    {model.thread ? <V2ThreadStrength testID="v2-practice-thread-strength" value={model.thread.value} category={model.thread.category} delta={model.thread.delta} trend={model.thread.trend} detail={model.thread.detail} /> : null}
    <View style={styles.recommendation}><Text style={styles.sectionLabel}>RECOMMENDED TODAY</Text><V2RecommendedTodayRibbon testID="v2-recommended-today" mode={recommendedMode} onPress={() => selectMode(recommendedMode, 'recommended_today')} />{model.recommendationError ? <Text style={styles.hint}>Focus is ready whenever you are.</Text> : null}</View>
    <View style={styles.all}><Text style={styles.allTitle}>All Practices</Text>{V2_PRACTICE_MODE_DEFINITIONS.map((item) => <V2PracticeModeRow key={item.mode} testID={`v2-practice-row-${item.mode}`} mode={item.mode} entitled={effectiveCapabilities[item.mode]} onPress={() => selectMode(item.mode, 'practice_hub')} />)}</View>
  </View></V2Screen>;
}

const styles = StyleSheet.create({ back: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing[2], minHeight: 44 }, backText: { ...typography.labelLG, color: colors.text.primary }, content: { gap: spacing[6], paddingTop: spacing[3] }, recommendation: { gap: spacing[2] }, sectionLabel: { ...typography.labelSM, color: colors.text.secondary }, hint: { ...typography.caption, color: colors.text.secondary, paddingTop: spacing[1] }, all: { gap: spacing[1] }, allTitle: { ...typography.headingLG, color: colors.text.primary, paddingBottom: spacing[1] }, empty: { flex: 1, justifyContent: 'center' } });
