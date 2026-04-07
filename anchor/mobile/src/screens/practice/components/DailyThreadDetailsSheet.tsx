import React from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import type { SessionLogEntry } from '@/stores/sessionStore';
import { colors, spacing, typography } from '@/theme';

interface DailyThreadDetailsSheetProps {
  visible: boolean;
  onClose: () => void;
  todaySessionsCount: number;
  streakDays: number;
  sessions: SessionLogEntry[];
}

function formatSessionLabel(session: SessionLogEntry): string {
  const type = session.type === 'activate' ? 'Charge' : session.type === 'stabilize' ? 'Stabilize' : 'Reinforce';
  const when = new Date(session.completedAt);
  const dateLabel = Number.isNaN(when.getTime()) ? '' : when.toLocaleDateString();
  return `${type} • ${dateLabel}`;
}

export const DailyThreadDetailsSheet: React.FC<DailyThreadDetailsSheetProps> = ({
  visible,
  onClose,
  todaySessionsCount,
  streakDays,
  sessions,
}) => {
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, styles.androidFill]} />
          )}
          <View style={styles.drag} />
          <Text style={styles.title}>Daily thread</Text>

          <View style={styles.metrics}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Today</Text>
              <Text style={styles.metricValue}>{`${Math.min(todaySessionsCount, 1)}/1`}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Streak</Text>
              <Text style={styles.metricValue}>{`${streakDays}d`}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Recent sessions</Text>
          <FlatList
            data={sessions.slice(0, 6)}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<Text style={styles.empty}>No sessions yet.</Text>}
            renderItem={({ item }) => (
              <View style={styles.sessionRow}>
                <Text style={styles.sessionText}>{formatSessionLabel(item)}</Text>
              </View>
            )}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(212,175,55,0.24)',
    backgroundColor: 'rgba(10,14,20,0.95)',
    overflow: 'hidden',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    maxHeight: '72%',
  },
  androidFill: {
    backgroundColor: 'rgba(10,14,20,0.97)',
  },
  drag: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.24)',
    alignSelf: 'center',
  },
  title: {
    marginTop: spacing.md,
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 22,
    color: colors.text.primary,
  },
  metrics: {
    marginTop: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  metricLabel: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 11,
    color: colors.text.tertiary,
  },
  metricValue: {
    marginTop: 2,
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 22,
    color: colors.gold,
  },
  sectionTitle: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 12,
    color: colors.text.secondary,
  },
  listContent: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  sessionRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sessionText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 12,
    color: colors.text.secondary,
  },
  empty: {
    paddingVertical: spacing.lg,
    textAlign: 'center',
    fontFamily: typography.fontFamily.sans,
    color: colors.text.tertiary,
  },
});
