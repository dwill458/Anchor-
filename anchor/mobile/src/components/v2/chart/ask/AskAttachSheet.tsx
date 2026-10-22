import React, { memo, useCallback, useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, ReduceMotion, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, Image as ImageIcon } from 'lucide-react-native';
import { colors, radii, spacing } from '@/theme/v2';
import { chartTypography as typography } from '../chartTypography';
import type { AskAccent } from './askChartTheme';

type Props = {
  visible: boolean;
  accent: AskAccent;
  reducedMotion: boolean;
  onClose: () => void;
  onCamera: () => void;
  onLibrary: () => void;
};

/**
 * Attachment choices as an in-screen sheet (not a Modal), so there is never a second layer of back navigation: the
 * hardware back button and a tap outside both just close it. It slides up over the conversation; the keyboard has
 * already been dismissed by the time it opens.
 */
export const AskAttachSheet = memo(function AskAttachSheet({ visible, accent, reducedMotion, onClose, onCamera, onLibrary }: Props) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(visible ? 1 : 0);
  const unmount = useCallback(() => setMounted(false), []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = reducedMotion ? 1 : withTiming(1, { duration: 230, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never });
    } else if (reducedMotion) {
      progress.value = 0;
      setMounted(false);
    } else {
      progress.value = withTiming(0, { duration: 170, easing: Easing.in(Easing.cubic), reduceMotion: ReduceMotion.Never }, finished => {
        if (finished) runOnJS(unmount)();
      });
    }
  }, [progress, reducedMotion, unmount, visible]);

  useEffect(() => {
    if (!visible) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [onClose, visible]);

  const scrim = useAnimatedStyle(() => ({ opacity: progress.value * 0.32 }));
  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - progress.value) * 280 }] }));
  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'} testID="ask-attach-sheet">
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrim]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" testID="ask-attach-scrim" />
      </Animated.View>
      <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + spacing[3] }, sheet]}>
        <View style={styles.grabber} />
        <Row icon={<Camera size={22} color={accent.text} />} label="Take photo" onPress={onCamera} testID="ask-attach-camera" />
        <Row icon={<ImageIcon size={22} color={accent.text} />} label="Photo library" onPress={onLibrary} testID="ask-attach-library" />
        <Text style={styles.note}>Photos are used for this answer and deleted within a day.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel" onPress={onClose} style={styles.cancel} testID="ask-attach-cancel">
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
});

function Row({ icon, label, onPress, testID }: { icon: React.ReactNode; label: string; onPress: () => void; testID: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]} testID={testID}>
      {icon}
      <Text style={styles.rowText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: '#111820' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: spacing[2], paddingHorizontal: spacing[4], gap: spacing[1], borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, backgroundColor: colors.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border.default },
  grabber: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: colors.border.strong, marginBottom: spacing[2] },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing[4], paddingHorizontal: spacing[3], borderRadius: radii.lg },
  pressed: { backgroundColor: colors.grouped },
  rowText: { ...typography.bodyLG, color: colors.text.primary },
  note: { ...typography.bodySM, color: colors.text.secondary, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  cancel: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radii.lg, backgroundColor: colors.surface, marginTop: spacing[1] },
  cancelText: { ...typography.labelLG, color: colors.text.primary },
});
