import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TEACHING_COPY } from '@/constants/v2/teachingCopy';

export function TeachingWhisper({ body, reducedMotion, onDismiss }: { body: string; reducedMotion: boolean; onDismiss: (reason: string) => void }) {
  const insets = useSafeAreaInsets();
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(body);
    const timer = setTimeout(() => onDismiss('timeout'), 8000);
    return () => clearTimeout(timer);
  }, [body, onDismiss]);
  const bottomOffset = 28 + (insets?.bottom ?? 0);
  return <Animated.View pointerEvents="box-none" entering={reducedMotion ? undefined : FadeIn.duration(180)} exiting={reducedMotion ? undefined : FadeOut.duration(180)} style={[styles.pill, bottomOffset !== 28 ? { bottom: bottomOffset } : null]} testID="teaching-whisper">
    <Text style={styles.body}>{body}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={TEACHING_COPY.common.dismiss} onPress={() => onDismiss('close')} style={styles.close}><Text style={styles.x}>×</Text></Pressable>
  </Animated.View>;
}
const styles = StyleSheet.create({
  pill: { position: 'absolute', bottom: 28, left: 18, right: 18, zIndex: 30, elevation: 30, backgroundColor: '#F4EFE6', borderRadius: 14, padding: 14, paddingRight: 48 },
  body: { color: '#1D1B18', fontFamily: 'EBGaramond-Medium', fontSize: 17, lineHeight: 23 },
  close: { position: 'absolute', right: 2, top: 2, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  x: { color: '#4A463F', fontSize: 24 },
});
