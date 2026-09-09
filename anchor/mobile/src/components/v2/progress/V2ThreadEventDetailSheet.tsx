import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { colors, radii, spacing, typography } from '@/theme/v2';
import { V2Button } from '@/components/v2';
import type { V2ThreadEventItem } from '@/adapters/v2/progress/types';

export interface V2ThreadEventDetailSheetProps {
  event: V2ThreadEventItem | null;
  visible: boolean;
  onClose: () => void;
  testID?: string;
}

export const V2ThreadEventDetailSheet: React.FC<V2ThreadEventDetailSheetProps> = ({
  event,
  visible,
  onClose,
  testID = 'v2-thread-event-detail-sheet',
}) => {
  if (!event) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} testID={`${testID}-backdrop`} />

        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.domainBadge}>
              <Text style={styles.domainBadgeText}>
                {event.sourceDomain.replace('_', ' ')}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              testID={`${testID}-close`}
              hitSlop={12}
            >
              <X size={20} color={colors.text.secondary} />
            </Pressable>
          </View>

          {/* Event Content */}
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.timestamp}>
            {event.formattedDate} {event.formattedTime ? `at ${event.formattedTime}` : ''}
          </Text>

          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>WHAT HAPPENED</Text>
            <Text style={styles.infoText}>{event.copy}</Text>
          </View>

          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>SIGNIFICANCE</Text>
            <Text style={styles.infoText}>{event.why}</Text>
          </View>

          {/* Thread Delta — Strictly Server Authoritative */}
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>THREAD DELTA</Text>
            {event.authoritativeDelta !== null ? (
              <Text style={styles.deltaValue}>
                {event.authoritativeDelta > 0 ? `+${event.authoritativeDelta}` : event.authoritativeDelta}
              </Text>
            ) : (
              <Text style={styles.emptyDeltaText}>
                No server delta recorded for this event.
              </Text>
            )}
          </View>

          {/* Source provenance */}
          {event.rawDomainEventId ? (
            <View style={styles.provenanceBlock}>
              <Text style={styles.provenanceText}>
                Event ID: {event.rawDomainEventId}
              </Text>
            </View>
          ) : null}

          {/* Dismiss Button */}
          <V2Button
            variant="tertiary"
            onPress={onClose}
            testID={`${testID}-done-btn`}
          >
            Close
          </V2Button>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetContainer: {
    backgroundColor: '#141820',
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  domainBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  domainBadgeText: {
    ...typography.caption,
    fontWeight: '700',
    color: '#8EE0CF',
    letterSpacing: 0.6,
  },
  closeButton: {
    padding: 4,
  },
  title: {
    ...typography.headingMD,
    color: colors.text.primary,
    marginBottom: 2,
  },
  timestamp: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  infoBlock: {
    marginBottom: spacing.md,
  },
  infoLabel: {
    ...typography.labelSM,
    color: colors.text.secondary,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  infoText: {
    ...typography.bodyMD,
    color: colors.text.secondary,
  },
  deltaValue: {
    ...typography.numericMedium,
    color: '#41C8C6',
  },
  emptyDeltaText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  provenanceBlock: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  provenanceText: {
    ...typography.caption,
    fontSize: 10,
    color: colors.text.secondary,
  },
});
