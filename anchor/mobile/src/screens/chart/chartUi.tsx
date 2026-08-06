import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, LockKeyhole, RefreshCw } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme';
import type { CourseStatus, WaypointSummary } from '@/types/chart';

export const ChartScreenFrame: React.FC<{
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  scroll?: boolean;
  headerActions?: React.ReactNode;
  headerTopInset?: number;
}> = ({ title, subtitle, children, scroll = true, headerActions, headerTopInset = 0 }) => {
  const content = (
    <View style={[styles.content, !scroll && styles.contentFixed]}>
      <View style={[styles.titleRow, headerTopInset ? { marginTop: headerTopInset } : null]}>
        <View style={styles.titleCopy}>
          <Text style={styles.screenTitle} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text style={styles.screenSubtitle}>{subtitle}</Text> : null}
        </View>
        {headerActions ? <View style={styles.headerActions}>{headerActions}</View> : null}
      </View>
      {children}
    </View>
  );

  return (
    <View style={styles.screen}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </View>
  );
};

export const ChartButton: React.FC<{
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  secondary?: boolean;
  destructive?: boolean;
  hint?: string;
  testID?: string;
}> = ({ label, onPress, disabled = false, secondary = false, destructive = false, hint, testID }) => (
  <Pressable
    testID={testID}
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityHint={hint}
    style={({ pressed }) => [
      styles.button,
      secondary && styles.buttonSecondary,
      destructive && styles.buttonDestructive,
      disabled && styles.buttonDisabled,
      pressed && !disabled && styles.buttonPressed,
    ]}
  >
    <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary, destructive && styles.buttonTextDestructive]}>
      {label}
    </Text>
  </Pressable>
);

export const ChartCard: React.FC<{ children: React.ReactNode; emphasis?: boolean; style?: object }> = ({ children, emphasis, style }) => (
  <View style={[styles.card, emphasis && styles.cardEmphasis, style]}>{children}</View>
);

export const ChartSection: React.FC<{ children: React.ReactNode; style?: object }> = ({ children, style }) => (
  <View style={[styles.section, style]}>{children}</View>
);

export const ChartSheetHandle: React.FC = () => <View accessibilityElementsHidden style={styles.sheetHandle} />;

export const ChartIconButton: React.FC<{
  label: string;
  icon: React.ReactNode;
  onPress?: () => void;
}> = ({ label, icon, onPress }) => (
  <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.iconButton}>
    {icon}
  </Pressable>
);

export const ChartKicker: React.FC<{ children: React.ReactNode; color?: string; style?: object }> = ({ children, color, style }) => (
  <Text style={[styles.kicker, color ? { color } : null, style]}>{children}</Text>
);

export const ChartPanel: React.FC<{ children: React.ReactNode; style?: object }> = ({ children, style }) => (
  <View style={[styles.panel, style]}>{children}</View>
);

export const ChartGhostButton: React.FC<{
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  color?: string;
  style?: object;
  disabled?: boolean;
}> = ({ label, onPress, icon, color = 'rgba(245,240,232,0.62)', style, disabled = false }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={({ pressed }) => [styles.ghostButton, pressed && !disabled && styles.ghostPressed, disabled && styles.buttonDisabled, style]}
  >
    {icon}
    <Text style={[styles.ghostText, { color }]}>{label}</Text>
  </Pressable>
);

export const ChartStatusPill: React.FC<{ status: CourseStatus | string }> = ({ status }) => (
  <View style={styles.statusPill}>
    <Text style={styles.statusPillText}>{status.replace('_', ' ')}</Text>
  </View>
);

export const ChartSyncNotice: React.FC<{
  lastSyncedAt: number | null;
  offline?: boolean;
  onRetry?: () => void;
}> = ({ lastSyncedAt, offline, onRetry }) => {
  if (!lastSyncedAt && !offline) return null;
  return (
    <View style={styles.syncNotice} accessibilityLiveRegion="polite">
      <Text style={styles.syncText}>
        {offline ? 'You are offline. Cached Chart data is viewable; changes are disabled.' : `Last synced ${formatRelativeTime(lastSyncedAt!)}`}
      </Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry Chart sync"
          style={styles.retryButton}
        >
          <RefreshCw size={16} color={colors.gold} />
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

export const LinearWaypointList: React.FC<{
  waypoints: WaypointSummary[];
  currentWaypointId?: string | null;
  onOpen: (waypoint: WaypointSummary) => void;
}> = ({ waypoints, currentWaypointId, onOpen }) => (
  <View accessibilityLabel="Linear waypoint list">
    {waypoints.map((waypoint, index) => {
      const anchorText = waypoint.anchorLink
        ? waypoint.anchorLink.anchorAvailable
          ? 'Anchor linked'
          : 'Anchor unavailable'
        : 'No Anchor linked';
      const dates = [waypoint.reachedAt, waypoint.skippedAt, waypoint.cancelledAt]
        .filter(Boolean)
        .map((date) => ` ${formatDate(date!)}`)
        .join(',');
      const label = `${index + 1}. ${waypoint.title}. State ${waypoint.state}. ${anchorText}.${waypoint.blockedReason ? ` Blocked because ${waypoint.blockedReason.replace(/_/g, ' ').toLowerCase()}.` : ''}`;
      return (
        <Pressable
          key={waypoint.id}
          onPress={() => onOpen(waypoint)}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint="Open waypoint details"
          style={[styles.waypointRow, waypoint.id === currentWaypointId && styles.waypointCurrent]}
        >
          <View style={styles.positionCircle}>
            <Text style={styles.positionText}>{index + 1}</Text>
          </View>
          <View style={styles.waypointCopy}>
            <Text style={styles.waypointTitle}>{waypoint.title}</Text>
            <Text style={styles.waypointMeta}>
              {waypoint.state.replace('_', ' ')} · {anchorText}
              {dates}
            </Text>
            {waypoint.blockedReason ? (
              <Text style={styles.blockedText}>Blocked: {waypoint.blockedReason.replace(/_/g, ' ').toLowerCase()}</Text>
            ) : null}
          </View>
          <ChevronRight size={18} color={colors.text.tertiary} />
        </Pressable>
      );
    })}
  </View>
);

export const ReadOnlyNotice: React.FC<{ reason?: string }> = ({ reason = 'Chart changes are unavailable right now.' }) => (
  <View style={styles.readOnlyNotice} accessibilityLiveRegion="polite">
    <LockKeyhole size={17} color={colors.gold} />
    <Text style={styles.readOnlyText}>{reason}</Text>
  </View>
);

export function formatRelativeTime(timestamp: number): string {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'date unavailable';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background.primary },
  scrollContent: { paddingBottom: 128 },
  content: { paddingHorizontal: 20, paddingTop: 10, gap: spacing.md },
  contentFixed: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  titleCopy: { flex: 1 },
  headerActions: { flexDirection: 'row', gap: spacing.sm, marginLeft: spacing.md },
  screenTitle: { fontFamily: typography.fonts.headingBold, fontSize: 21, letterSpacing: 2.9, color: colors.bone },
  screenSubtitle: { fontFamily: typography.fonts.body, fontSize: 11.5, lineHeight: 16, color: 'rgba(245,240,232,0.32)', marginTop: 4 },
  kicker: { fontFamily: typography.fonts.headingSemiBold, fontSize: 9.5, lineHeight: 13, letterSpacing: 2.1, color: 'rgba(212,175,55,0.62)', textTransform: 'uppercase' },
  panel: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.065)', backgroundColor: 'rgba(255,255,255,0.018)', overflow: 'hidden', position: 'relative' },
  ghostButton: { minHeight: 34, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
  ghostPressed: { opacity: 0.68 },
  ghostText: { fontFamily: typography.fonts.body, fontSize: 11.5, letterSpacing: 0.2 },
  section: { gap: 10 },
  sheetHandle: { alignSelf: 'center', width: 34, height: 3, borderRadius: 2, backgroundColor: 'rgba(212,175,55,0.32)', marginBottom: 2 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.065)',
    backgroundColor: 'rgba(255,255,255,0.018)',
    padding: 16,
    gap: spacing.sm,
  },
  cardEmphasis: { borderColor: 'rgba(212,175,55,0.24)', backgroundColor: 'rgba(20,26,35,0.74)' },
  iconButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(212,175,55,0.14)', backgroundColor: 'rgba(255,255,255,0.015)' },
  button: {
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D4AF37',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
  },
  buttonSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(212,175,55,0.24)', shadowOpacity: 0 },
  buttonDestructive: { backgroundColor: 'rgba(150,45,45,0.18)', borderColor: 'rgba(255,110,110,0.38)', borderWidth: 1 },
  buttonDisabled: { opacity: 0.42 },
  buttonPressed: { transform: [{ scale: 0.98 }] },
  buttonText: { fontFamily: typography.fonts.headingSemiBold, fontSize: 11, lineHeight: 16, letterSpacing: 1.8, color: '#14100A', textAlign: 'center', textTransform: 'uppercase' },
  buttonTextSecondary: { color: colors.text.primary },
  buttonTextDestructive: { color: '#FFB1B1' },
  statusPill: { alignSelf: 'flex-start', borderRadius: 99, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, backgroundColor: 'rgba(212,175,55,0.12)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.26)' },
  statusPillText: { ...typography.caption, color: colors.gold, letterSpacing: 0.8 },
  syncNotice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, padding: spacing.sm, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)' },
  syncText: { ...typography.caption, color: colors.text.secondary, flex: 1 },
  retryButton: { minHeight: 44, paddingHorizontal: spacing.sm, flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
  retryText: { ...typography.caption, color: colors.gold },
  waypointRow: { minHeight: 68, padding: spacing.sm, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)', marginBottom: spacing.sm },
  waypointCurrent: { borderColor: 'rgba(212,175,55,0.38)', backgroundColor: 'rgba(212,175,55,0.08)' },
  positionCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(212,175,55,0.14)' },
  positionText: { ...typography.bodyBold, color: colors.gold },
  waypointCopy: { flex: 1, gap: 2 },
  waypointTitle: { ...typography.bodyBold, color: colors.text.primary },
  waypointMeta: { ...typography.caption, color: colors.text.secondary, lineHeight: 18 },
  blockedText: { ...typography.caption, color: '#FFB1B1' },
  readOnlyNotice: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', padding: spacing.md, borderRadius: 14, backgroundColor: 'rgba(212,175,55,0.08)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.18)' },
  readOnlyText: { ...typography.caption, color: colors.text.secondary, flex: 1 },
});
