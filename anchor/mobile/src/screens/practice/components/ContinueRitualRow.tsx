/**
 * ContinueRitualRow — compact one-tap row shown below TodayAnchorCard when
 * the user has a recent session they can resume with the same configuration.
 *
 * Only renders if the lastSession was completed within the last 24 hours.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import type { SessionLogEntry } from '@/stores/sessionStore';
import type { Anchor } from '@/types';
import { colors, spacing, typography } from '@/theme';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.round(seconds / 60);
  return `${m}m`;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function buildLabel(session: SessionLogEntry): string {
  const type = capitalize(session.type);
  const dur = formatDuration(session.durationSeconds);
  const mode = capitalize(session.mode);
  return `${type} ${dur} · ${mode} + Haptics`;
}

interface ContinueRitualRowProps {
  lastSession: SessionLogEntry;
  anchor: Anchor | undefined;
  onContinue: () => void;
}

/** Don't render if session is older than 24 hours. */
function isRecent(completedAt: string): boolean {
  const completedMs = new Date(completedAt).getTime();
  if (isNaN(completedMs)) return false;
  return Date.now() - completedMs < 24 * 60 * 60 * 1000;
}

export const ContinueRitualRow: React.FC<ContinueRitualRowProps> = ({
  lastSession,
  anchor,
  onContinue,
}) => {
  if (!isRecent(lastSession.completedAt)) return null;

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onContinue}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Continue: ${buildLabel(lastSession)}`}
    >
      <View style={styles.indicator} />
      <View style={styles.textBlock}>
        <Text style={styles.prefix}>Continue</Text>
        <Text style={styles.description} numberOfLines={1}>
          {buildLabel(lastSession)}
        </Text>
      </View>
      <ChevronRight size={16} color={colors.text.tertiary} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${colors.gold}20`,
    backgroundColor: `${colors.gold}08`,
    gap: spacing.sm,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gold,
    opacity: 0.7,
  },
  textBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  prefix: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
    opacity: 0.85,
  },
  description: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    flexShrink: 1,
  },
});
