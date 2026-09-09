import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { V2Button } from '@/components/v2/primitives/V2Button';
import { colors, radii, spacing, typography } from '@/theme/v2';
import type { V2PersistedThreadEvent } from '@/adapters/v2/threadEvents';

type Props = { event: V2PersistedThreadEvent | null; visible: boolean; onClose: () => void; testID?: string };
const formatTimestamp = (value: string) => new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Detail is an inspection of stored event fields, deliberately without delta/range calculations. */
export function V2ThreadEventDetailSheet({ event, visible, onClose, testID = 'v2-thread-event-detail-sheet' }: Props) {
  if (!event) return null;
  const fields = [
    ['Occurred', formatTimestamp(event.occurredAt)],
    ['Event type', event.eventType.replaceAll('_', ' ')],
    ['Anchor', event.metadata.anchorName],
    ['Waypoint', event.metadata.waypointTitle],
    ['Stage', event.metadata.stageName],
    ['Thread Strength', typeof event.metadata.threadValue === 'number' ? String(event.metadata.threadValue) : undefined],
    ['Ledger ID', event.eventId],
  ].filter((field): field is [string, string] => Boolean(field[1]));
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} testID={testID}><View style={styles.overlay}><Pressable style={StyleSheet.absoluteFill} onPress={onClose} /><View style={styles.sheet}>
    <Pressable accessibilityRole="button" accessibilityLabel="Close event details" onPress={onClose} style={styles.close}><X size={20} color={colors.text.secondary} /></Pressable>
    <Text style={styles.kicker}>THREAD EVENT</Text><Text accessibilityRole="header" style={styles.title}>{event.eventType.replaceAll('_', ' ')}</Text>
    <View style={styles.list}>{fields.map(([label, value]) => <View key={label} style={styles.row}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>)}</View>
    <V2Button variant="tertiary" onPress={onClose} testID={`${testID}-close`}>Close</V2Button>
  </View></View></Modal>;
}
const styles = StyleSheet.create({ overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(23,23,23,0.36)' }, sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: spacing[6], paddingTop: spacing[8], gap: spacing[5] }, close: { position: 'absolute', top: spacing[3], right: spacing[3], minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }, kicker: { ...typography.labelSM, color: colors.text.secondary, letterSpacing: 1 }, title: { ...typography.headingLG, color: colors.text.primary }, list: { borderTopWidth: 1, borderColor: colors.border.default }, row: { paddingVertical: spacing[3], borderBottomWidth: 1, borderColor: colors.border.default, gap: spacing[1] }, label: { ...typography.labelSM, color: colors.text.secondary }, value: { ...typography.bodyMD, color: colors.text.primary } });
