import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { V2Button, V2EmptyState, V2Screen } from '@/components/v2';
import { V2PracticeAnchorContext } from '@/components/v2/practice';
import { V2_PRACTICE_DURATIONS, V2_PRACTICE_MODE_BY_ID, v2PracticeDurationLabel, type V2PracticeMode } from '@/constants/v2/practice';
import { colors, radii, spacing, typography } from '@/theme/v2';
import type { Anchor } from '@/types';
import type { HomeVisionState } from '@/adapters/v2/home';
import type { V2PracticeStartRequest } from './practiceRoutes';

type Props = {
  anchor: Anchor;
  mode: V2PracticeMode;
  vision: HomeVisionState;
  source: 'practice_hub' | 'recommended_today';
  onBack: () => void;
  onCreateVision: (anchorId: string) => void;
  onOpenVision?: (anchorId: string) => void;
  onReleaseRequested: (anchorId: string, reason?: string) => void;
  onBeginPractice?: (request: V2PracticeStartRequest) => void;
};

export function V2PracticePrepareScreen({ anchor, mode, vision, source, onBack, onCreateVision, onOpenVision, onReleaseRequested, onBeginPractice }: Props) {
  const definition = V2_PRACTICE_MODE_BY_ID[mode];
  const durations = mode === 'release' ? [] : V2_PRACTICE_DURATIONS[mode];
  const [duration, setDuration] = useState(durations[1] ?? durations[0]);
  const isVisionEmpty = mode === 'visualize' && vision.state === 'none';
  const begin = () => {
    if (mode === 'release') { onReleaseRequested(anchor.id, 'practice_prepare'); return; }
    if (isVisionEmpty || !duration) return;
    onBeginPractice?.({ anchorId: anchor.id, mode, durationSeconds: duration, source });
  };
  return <V2Screen scroll testID={`v2-practice-prepare-${mode}`}><Pressable accessibilityRole="button" accessibilityLabel="Back to Practice" onPress={onBack} style={styles.back}><ArrowLeft size={20} color={colors.text.primary} /><Text style={styles.backText}>Practice</Text></Pressable><View style={styles.content}><Text style={[styles.eyebrow, { color: definition.accent }]}>PREPARE</Text><Text style={styles.title}>{definition.title}</Text><Text style={styles.purpose}>{definition.purpose}</Text><V2PracticeAnchorContext anchor={anchor} />
    {isVisionEmpty ? <V2EmptyState title="Create a Vision first" message="Visualize rehearses a future you have chosen for this Anchor." action={<V2Button accessibilityLabel="Create a Vision for this Anchor" onPress={() => onCreateVision(anchor.id)}>Create a Vision</V2Button>} /> : mode === 'release' ? <View style={styles.release}><Text style={styles.releaseTitle}>Close this intention with care.</Text><Text style={styles.releaseBody}>Release preserves this Anchor and its history. It never deletes the record.</Text></View> : <><Text style={styles.durationLabel}>CHOOSE A DURATION</Text><View style={styles.durations}>{durations.map((option) => <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: option === duration }} accessibilityLabel={`${v2PracticeDurationLabel(option)}${option === duration ? ', selected' : ''}`} onPress={() => setDuration(option)} style={[styles.duration, option === duration && { borderColor: definition.accent, backgroundColor: `${definition.accent}12` }]}><Text style={[styles.durationText, option === duration && { color: definition.accent }]}>{v2PracticeDurationLabel(option)}</Text></Pressable>)}</View>{mode === 'visualize' && vision.state === 'ready' ? <Pressable accessibilityRole="button" accessibilityLabel="Open this Anchor's Vision" onPress={() => onOpenVision?.(anchor.id)}><Text numberOfLines={3} style={styles.visionPreview}>{vision.previewText}</Text></Pressable> : null}</>}
    <V2Button size="large" variant={mode === 'release' ? 'secondary' : 'primary'} accessibilityLabel={mode === 'release' ? 'Continue to Release' : `Begin ${definition.title}`} onPress={begin}>{mode === 'release' ? 'Continue to Release' : `Begin ${definition.title}`}</V2Button>
  </View></V2Screen>;
}

export const V2FocusPrepareScreen = (props: Omit<Props, 'mode'>) => <V2PracticePrepareScreen {...props} mode="focus" />;
export const V2DeepPrimePrepareScreen = (props: Omit<Props, 'mode'>) => <V2PracticePrepareScreen {...props} mode="deep_prime" />;
export const V2VisualizePrepareScreen = (props: Omit<Props, 'mode'>) => <V2PracticePrepareScreen {...props} mode="visualize" />;
export const V2ReleasePrepareScreen = (props: Omit<Props, 'mode'>) => <V2PracticePrepareScreen {...props} mode="release" />;

const styles = StyleSheet.create({ back: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing[2], minHeight: 44 }, backText: { ...typography.labelLG, color: colors.text.primary }, content: { gap: spacing[5], paddingTop: spacing[4] }, eyebrow: { ...typography.labelSM }, title: { ...typography.displayMedium, color: colors.text.primary }, purpose: { ...typography.bodyLG, color: colors.text.secondary }, durationLabel: { ...typography.labelSM, color: colors.text.secondary }, durations: { flexDirection: 'row', gap: spacing[2] }, duration: { flex: 1, minHeight: 52, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[2] }, durationText: { ...typography.labelMD, color: colors.text.primary }, visionPreview: { ...typography.bodyMD, color: colors.text.secondary, padding: spacing[4], backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radii.md }, release: { gap: spacing[2], padding: spacing[4], borderRadius: radii.md, backgroundColor: '#F28A2E12', borderWidth: 1, borderColor: '#F28A2E52' }, releaseTitle: { ...typography.headingSM, color: colors.text.primary }, releaseBody: { ...typography.bodyMD, color: colors.text.secondary } });
