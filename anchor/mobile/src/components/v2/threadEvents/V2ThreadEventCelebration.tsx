import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { CircularAnchorRenderer } from '@/components/v2/anchor/CircularAnchorRenderer';
import { V2Button } from '@/components/v2/primitives/V2Button';
import { getCategoryColor, colors, spacing, typography } from '@/theme/v2';
import type { V2ThreadEventBundle } from '@/adapters/v2/threadEvents';
import { livingColorForEvent, livingColorLayers } from './livingColor';

type Props = { bundle: V2ThreadEventBundle | null; visible: boolean; anchorSvg?: string | null; category?: string | null; reducedMotion?: boolean; onPresented?: () => void; onAcknowledge: () => void; onDismiss: () => void; testID?: string };

function headline(bundle: V2ThreadEventBundle) {
  const { eventType, metadata } = bundle.primary;
  if (eventType === 'EVOLUTION_STAGE_REACHED') return `Your Anchor became ${metadata.stageName ?? 'established'}.`;
  if (eventType === 'WAYPOINT_REACHED') return `You reached ${metadata.waypointTitle ?? 'your current waypoint'}.`;
  if (eventType === 'DESTINATION_REACHED') return 'You reached your Destination.';
  if (eventType === 'PRACTICE_MILESTONE_REACHED') return `You completed ${metadata.practiceCount ?? 'a'} Practices with this Anchor.`;
  return eventType.replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

export function V2ThreadEventCelebration({ bundle, visible, anchorSvg, category, reducedMotion = false, onPresented, onAcknowledge, onDismiss, testID = 'v2-thread-event-celebration' }: Props) {
  const event = bundle?.primary;
  const treatment = livingColorForEvent(event?.significance ?? 'LOW', reducedMotion);
  const categoryColor = getCategoryColor(category);
  const layers = livingColorLayers(treatment, categoryColor);
  useEffect(() => { if (visible && bundle) onPresented?.(); }, [bundle, onPresented, visible]);
  if (!bundle || !event) return null;
  const dark = treatment.darkChamber;
  const persistedThreadValue = typeof event.metadata.threadValue === 'number' ? event.metadata.threadValue : null;
  return <Modal visible={visible} transparent animationType={reducedMotion ? 'fade' : 'slide'} onRequestClose={onDismiss} testID={testID}>
    <View style={styles.overlay}><View style={[styles.chamber, dark ? styles.darkChamber : styles.lightChamber]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss event" onPress={onDismiss} style={styles.close} testID={`${testID}-dismiss`}><X size={20} color={dark ? '#F5F0E8' : colors.text.primary} /></Pressable>
      {treatment.intensity >= 2 ? <View testID={`${testID}-bloom`} pointerEvents="none" style={[styles.bloom, layers.bloom]} /> : null}
      <Text style={[styles.eyebrow, { color: categoryColor }]}>{event.metadata.stageName ?? event.eventType.replaceAll('_', ' ')}</Text>
      <View style={styles.artworkWrap}>
        {treatment.intensity >= 1 ? <View testID={`${testID}-halo`} pointerEvents="none" style={[styles.halo, layers.halo]} /> : null}
        {treatment.structuralAccent ? <View testID={`${testID}-structural-accent`} pointerEvents="none" style={[styles.ring, layers.ring]} /> : null}
        {anchorSvg ? <CircularAnchorRenderer svg={anchorSvg} category={category} size="large" accessibilityLabel={`${event.metadata.anchorName ?? 'Anchor'} event artwork`} /> : <View style={[styles.objectFallback, { backgroundColor: `${categoryColor}20`, borderColor: categoryColor }]} />}
      </View>
      <Text accessibilityRole="header" style={[styles.title, dark && styles.darkText]}>{headline(bundle)}</Text>
      <Text style={[styles.copy, dark && styles.darkCopy]}>{event.metadata.anchorName ? `${event.metadata.anchorName}. ` : ''}{event.eventType === 'EVOLUTION_STAGE_REACHED' ? 'A permanent structural stage changed for the first time.' : 'This is a persisted event from your Anchor history.'}</Text>
      {persistedThreadValue !== null ? <Text style={[styles.threadValue, { color: categoryColor }]}>Thread Strength {persistedThreadValue}</Text> : null}
      {bundle.supporting.length ? <View style={styles.supporting}>{bundle.supporting.map((support) => <Text key={support.eventId} style={[styles.supportingText, dark && styles.darkCopy]}>• {support.eventType === 'PRACTICE_MILESTONE_REACHED' ? `${support.metadata.practiceCount ?? ''} Practices completed` : support.metadata.waypointTitle ?? support.eventType.replaceAll('_', ' ').toLowerCase()}</Text>)}</View> : null}
      <V2Button size="large" onPress={onAcknowledge} testID={`${testID}-done`}>Continue</V2Button>
    </View></View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(23,23,23,0.42)' },
  chamber: { minHeight: 520, overflow: 'hidden', paddingHorizontal: spacing[6], paddingTop: spacing[8], paddingBottom: spacing[7] }, lightChamber: { backgroundColor: colors.canvas }, darkChamber: { backgroundColor: '#0E0C09' },
  close: { position: 'absolute', right: spacing[5], top: spacing[5], minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  bloom: { position: 'absolute', height: 420, width: 420, borderRadius: 210, top: -170, alignSelf: 'center' }, artworkWrap: { height: 180, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[5] },
  halo: { position: 'absolute', width: 180, height: 180, borderRadius: 90 }, ring: { position: 'absolute', width: 174, height: 174, borderRadius: 87, borderWidth: 2 }, objectFallback: { width: 152, height: 152, borderRadius: 76, borderWidth: 1 },
  eyebrow: { ...typography.labelSM, letterSpacing: 1.1, textAlign: 'center', marginBottom: spacing[3] }, title: { ...typography.headingXL, color: colors.text.primary, textAlign: 'center' }, copy: { ...typography.bodyMD, color: colors.text.secondary, textAlign: 'center', marginTop: spacing[3] }, darkText: { color: '#F5F0E8' }, darkCopy: { color: '#C8C0B5' }, threadValue: { ...typography.numericMedium, textAlign: 'center', marginTop: spacing[4] }, supporting: { gap: spacing[1], marginTop: spacing[4], marginBottom: spacing[5] }, supportingText: { ...typography.bodySM, color: colors.text.secondary, textAlign: 'center' },
});
