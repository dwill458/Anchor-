import React from 'react';
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VisionHeaderRow, VisionIdentity, type VisionAnchorArt } from '@/components/v2/vision/VisionChrome';
import { colors, radii, spacing, typography } from '@/theme/v2';

/**
 * Chart shares Vision's ink chrome: the same header row and Anchor identity,
 * so Chart reads as another authored part of the product rather than a new kit.
 */

export type ChartIdentity = {
  intention: string;
  category?: string | null;
  art?: VisionAnchorArt | null;
  imageUrl?: string | null;
};

export function ChartInkScreen({
  children,
  style,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View testID={testID} style={[styles.screen, style]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.ink.base} animated />
      {children}
    </View>
  );
}

export function ChartTopBar({
  title,
  onBack,
  utility,
  identity,
}: {
  title?: string;
  onBack?: () => void;
  utility?: React.ReactNode;
  identity?: ChartIdentity | null;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.topBar, { paddingTop: insets.top }]}>
      <VisionHeaderRow title={title} onBack={onBack} utility={utility} tone="light" />
      {identity ? (
        <View style={styles.identity}>
          <VisionIdentity
            intention={identity.intention}
            category={identity.category}
            art={identity.art}
            imageUrl={identity.imageUrl}
            tone="light"
            size={48}
          />
        </View>
      ) : null}
    </View>
  );
}

/** Small uppercase label, e.g. CURRENT WAYPOINT. On ink or on cream. */
export function ChartEyebrow({
  children,
  tone = 'ink',
  color,
  style,
}: {
  children: React.ReactNode;
  tone?: 'ink' | 'cream';
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={style}>
      <Text
        style={[
          styles.eyebrow,
          { color: color ?? (tone === 'ink' ? colors.ink.text.secondary : colors.text.secondary) },
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

/** Raised ink card used below the hero. */
export function ChartInkCard({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <View testID={testID} style={[styles.inkCard, style]}>
      {children}
    </View>
  );
}

/** Cream sheet that rises out of the ink (mockup screens 1, 2, 4, 7, 9). */
export function ChartCreamPanel({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <View testID={testID} style={[styles.creamPanel, style]}>
      {children}
    </View>
  );
}

export function ChartTextArea({
  value,
  onChangeText,
  placeholder,
  maxLength,
  tone = 'ink',
  accessibilityLabel,
  autoFocus,
  testID,
  ...rest
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  maxLength: number;
  tone?: 'ink' | 'cream';
  accessibilityLabel: string;
  autoFocus?: boolean;
  testID?: string;
} & Pick<TextInputProps, 'onFocus' | 'onBlur'>) {
  const onInk = tone === 'ink';
  return (
    <View style={[styles.textAreaWrap, onInk ? styles.textAreaInk : styles.textAreaCream]}>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={onInk ? colors.ink.text.tertiary : colors.text.tertiary}
        multiline
        maxLength={maxLength}
        autoFocus={autoFocus}
        accessibilityLabel={accessibilityLabel}
        textAlignVertical="top"
        style={[styles.textArea, { color: onInk ? colors.ink.text.primary : colors.text.primary }]}
        {...rest}
      />
      <Text style={[styles.counter, { color: onInk ? colors.ink.text.tertiary : colors.text.tertiary }]}>
        {value.length}/{maxLength}
      </Text>
    </View>
  );
}

/** Pill button on ink: light outline (secondary) or bone fill (primary). */
export function ChartInkButton({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  accessibilityLabel,
  testID,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const inactive = Boolean(disabled || loading);
  const primary = variant === 'primary';
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: Boolean(loading) }}
      style={({ pressed }) => [
        styles.inkButton,
        primary ? styles.inkButtonPrimary : styles.inkButtonOutline,
        inactive && styles.inkButtonInactive,
        pressed && !inactive && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? colors.text.primary : colors.ink.text.primary} />
      ) : (
        <View style={styles.inkButtonContent}>
          <Text style={[styles.inkButtonLabel, { color: primary ? colors.text.primary : colors.ink.text.primary }]}>{label}</Text>
          {icon}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink.base },
  topBar: { paddingHorizontal: spacing[5], zIndex: 2 },
  identity: { paddingTop: spacing[2], paddingBottom: spacing[1] },
  eyebrow: { ...typography.labelSM, letterSpacing: 1.1 },
  inkCard: {
    backgroundColor: colors.ink.raised,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.ink.hairlineStrong,
    padding: spacing[4],
  },
  creamPanel: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
  },
  textAreaWrap: { borderRadius: radii.md, borderWidth: 1, paddingHorizontal: spacing[4], paddingTop: spacing[3], paddingBottom: spacing[2] },
  textAreaInk: { borderColor: colors.ink.hairlineStrong, backgroundColor: colors.ink.raised },
  textAreaCream: { borderColor: colors.border.default, backgroundColor: colors.surface },
  textArea: { ...typography.bodyMD, minHeight: 88, padding: 0 },
  counter: { ...typography.caption, alignSelf: 'flex-end' },
  inkButton: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[5] },
  inkButtonPrimary: { backgroundColor: colors.canvas },
  inkButtonOutline: { borderWidth: 1, borderColor: colors.ink.hairlineStrong, backgroundColor: 'transparent' },
  inkButtonInactive: { opacity: 0.5 },
  inkButtonContent: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  inkButtonLabel: { ...typography.labelLG, fontWeight: '700' },
  pressed: { opacity: 0.82 },
});
