import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, typography } from '@/theme';

type ScreenProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Shared low-light shell for locked Anchor 1.5 surfaces. */
export function Anchor15Screen({ children, style }: ScreenProps) {
  return (
    <View style={[styles.screen, style]}>
      <LinearGradient
        colors={[colors.anchor15.creationTop, colors.anchor15.navy, colors.anchor15.ink]}
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.topOrb} />
      <View pointerEvents="none" style={styles.bottomOrb} />
      <SafeAreaView style={styles.safeArea}>{children}</SafeAreaView>
    </View>
  );
}

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityHint?: string;
  testID?: string;
};

export function Anchor15PrimaryButton({
  label,
  onPress,
  disabled = false,
  accessibilityHint,
  testID,
}: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.primaryPressable, (disabled || pressed) && styles.primaryPressed]}
    >
      <LinearGradient
        colors={[colors.anchor15.giltBright, colors.anchor15.gilt, '#A7793A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryGradient}
      >
        <Text style={styles.primaryLabel}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

type TextButtonProps = {
  label: string;
  onPress: () => void;
  accessibilityHint?: string;
};

export function Anchor15TextButton({ label, onPress, accessibilityHint }: TextButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      hitSlop={12}
      style={styles.textButton}
    >
      <Text style={styles.textButtonLabel}>{label}</Text>
    </Pressable>
  );
}

type TeachingSheetProps = {
  visible: boolean;
  title: string;
  body: string;
  onDismiss: () => void;
};

/** A replayable, accessible first-use explanation surface. */
export function Anchor15TeachingSheet({ visible, title, body, onDismiss }: TeachingSheetProps) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onDismiss}
      accessibilityViewIsModal
    >
      <Pressable style={styles.sheetBackdrop} onPress={onDismiss} accessibilityLabel="Dismiss teaching tip">
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetEyebrow}>A SMALL NOTE</Text>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Text style={styles.sheetBody}>{body}</Text>
          <Anchor15PrimaryButton label="I understand" onPress={onDismiss} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.anchor15.ink },
  safeArea: { flex: 1 },
  topOrb: {
    position: 'absolute',
    width: 340,
    height: 340,
    top: -170,
    right: -110,
    borderRadius: 170,
    backgroundColor: 'rgba(61, 32, 96, 0.23)',
  },
  bottomOrb: {
    position: 'absolute',
    width: 300,
    height: 300,
    bottom: -175,
    left: -110,
    borderRadius: 150,
    backgroundColor: 'rgba(217, 179, 108, 0.06)',
  },
  primaryPressable: { minHeight: 52, borderRadius: 26, overflow: 'hidden' },
  primaryPressed: { opacity: 0.72 },
  primaryGradient: { minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  primaryLabel: {
    color: colors.anchor15.ink,
    fontFamily: typography.fontFamily.instrumentSemiBold,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.35,
    textTransform: 'uppercase',
  },
  textButton: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  textButtonLabel: {
    color: colors.anchor15.ash,
    fontFamily: typography.fontFamily.instrument,
    fontSize: 13,
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(135, 147, 157, 0.5)',
  },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(4, 6, 12, 0.72)' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.anchor15.goldHairline,
    backgroundColor: colors.anchor15.veil,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 30,
    gap: 14,
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(244, 239, 230, 0.22)', alignSelf: 'center' },
  sheetEyebrow: { color: colors.anchor15.ash, fontFamily: typography.fontFamily.ritual, fontSize: 10, letterSpacing: 2.1, textAlign: 'center' },
  sheetTitle: { color: colors.anchor15.bone, fontFamily: typography.fontFamily.voice, fontSize: 25, lineHeight: 30, textAlign: 'center' },
  sheetBody: { color: colors.anchor15.ash, fontFamily: typography.fontFamily.instrument, fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 4 },
});
