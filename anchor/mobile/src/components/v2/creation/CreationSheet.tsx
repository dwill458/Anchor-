import React, { useEffect } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { V2Button } from '@/components/v2';
import { colors, spacing, typography } from '@/theme/v2';

/** The creation flow's one explanatory surface: optional, dismissible, never blocking. */
export function CreationSheet({
  visible,
  title,
  onClose,
  children,
  testID,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  testID?: string;
}) {
  // A sheet opened from a text field should not stack under a lingering keyboard.
  useEffect(() => {
    if (visible) Keyboard.dismiss();
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID={testID}>
        <Pressable style={styles.container} onPress={(event) => event.stopPropagation()}>
          <SafeAreaView edges={['bottom']} style={styles.inner}>
            <View style={styles.handle} />
            <Pressable style={styles.close} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" hitSlop={8}>
              <X size={15} color={colors.text.secondary} />
            </Pressable>
            <Text style={styles.title} accessibilityRole="header">{title}</Text>
            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
            <V2Button size="large" style={styles.dismiss} onPress={onClose}>
              Got it
            </V2Button>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export const sheetText = StyleSheet.create({
  label: { ...typography.labelSM, color: colors.text.secondary },
  body: { ...typography.bodyMD, color: colors.text.primary },
  quiet: { ...typography.bodyMD, color: colors.text.secondary },
});

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(18, 26, 34, 0.38)', justifyContent: 'flex-end' },
  container: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
    maxHeight: '88%',
  },
  inner: { gap: spacing[4], position: 'relative' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border.default, alignSelf: 'center', marginBottom: spacing[2] },
  close: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.headingMD, color: colors.text.primary },
  body: { flexGrow: 0 },
  bodyContent: { gap: spacing[4] },
  dismiss: { height: 52, borderRadius: 16, marginTop: spacing[1] },
});
