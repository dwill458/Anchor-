import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Sliders } from 'lucide-react-native';
import { colors, radii, spacing, typography } from '@/theme/v2';
import { safeHaptics } from '@/utils/haptics';

export interface V2PracticeSettingsCardProps {
  soundOn: boolean;
  /** e.g. "Grounded · Ambient"; shown while Sound is on. */
  summary: string;
  hapticsOn: boolean;
  onToggleSound: () => void;
  onToggleHaptics: () => void;
  onOpenSettings: () => void;
  /** Prefix for test ids: `${prefix}-sound-toggle` and friends. */
  testIDPrefix: string;
}

/**
 * Sound + Haptics setup card shared by Focus, Deep Focus and Visualize. The
 * Sound status toggles immediately; the sliders icon opens the configuration
 * sheet. Sound and Haptics are independent.
 */
export function V2PracticeSettingsCard({
  soundOn,
  summary,
  hapticsOn,
  onToggleSound,
  onToggleHaptics,
  onOpenSettings,
  testIDPrefix,
}: V2PracticeSettingsCardProps) {
  return (
    <View style={styles.block}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: soundOn }}
          accessibilityLabel={`Sound: ${soundOn ? 'On' : 'Off'}. Tap to toggle.`}
          testID={`${testIDPrefix}-sound-toggle`}
          onPress={() => {
            void safeHaptics.selection();
            onToggleSound();
          }}
          style={styles.rowMain}
        >
          <View style={styles.info}>
            <Text style={styles.label}>Sound</Text>
            {soundOn ? <Text style={styles.subtext}>{summary}</Text> : null}
          </View>
          <Text style={[styles.value, soundOn && styles.valueActive]}>{soundOn ? 'ON' : 'OFF'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Customize sound settings"
          testID={`${testIDPrefix}-audio-customize-button`}
          onPress={onOpenSettings}
          hitSlop={8}
          style={styles.settingsButton}
        >
          <Sliders size={15} color={colors.text.secondary} />
        </Pressable>
      </View>

      <View style={styles.divider} />

      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: hapticsOn }}
        accessibilityLabel={`Haptics: ${hapticsOn ? 'On' : 'Off'}. Tap to toggle.`}
        testID={`${testIDPrefix}-haptics-toggle`}
        onPress={() => {
          void safeHaptics.selection();
          onToggleHaptics();
        }}
        style={styles.rowMain}
      >
        <Text style={styles.label}>Haptics</Text>
        <Text style={[styles.value, hapticsOn && styles.valueActive]}>{hapticsOn ? 'ON' : 'OFF'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radii.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[1],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
    minHeight: 48,
  },
  info: { flex: 1, justifyContent: 'center' },
  label: { ...typography.bodyMD, color: colors.text.primary, fontSize: 14 },
  subtext: { ...typography.caption, color: colors.text.secondary, fontSize: 11, marginTop: 2 },
  value: {
    ...typography.labelSM,
    color: colors.text.secondary,
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  valueActive: { color: colors.text.primary, fontWeight: '700' },
  settingsButton: {
    marginLeft: spacing[3],
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border.subtle },
});
