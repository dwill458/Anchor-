import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Polygon } from 'react-native-svg';
import type { V2HomeTodayState } from '@/adapters/v2/home';
import { V2_PRACTICE_MODE_BY_ID, v2PracticeDurationLabel, type V2PracticeMode } from '@/constants/v2/practice';
import { colors, typography } from '@/theme/v2';

type Props = {
  today: V2HomeTodayState;
  onStartPractice?: (mode: V2PracticeMode) => void;
  onRetry?: () => void;
};

function PurpleUnderline() {
  return (
    <Svg width={54} height={9} viewBox="0 0 54 9" fill="none" accessibilityElementsHidden>
      <Path d="M2 6 Q24 1 52 4 L47 5 Q27 3 2 8Z" fill="#7C5CFA" opacity={0.75} />
      <Path d="M5 5 Q26 2 48 3.5" stroke="#7C5CFA" strokeWidth={0.8} fill="none" />
    </Svg>
  );
}

function BlueFocusUnderline() {
  return (
    <Svg width={130} height={6} viewBox="0 0 130 6" fill="none" accessibilityElementsHidden>
      <Polygon points="0,4 23,1 91,0 130,2 74,4 4,6" fill="#7391F2" />
    </Svg>
  );
}

function ArrowLongRight() {
  return (
    <Svg width={18} height={12} viewBox="0 0 18 12" fill="none" accessibilityElementsHidden>
      <Path d="M1 6H16M11 1L16 6L11 11" stroke={colors.text.primary} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Today is a server recommendation, not a default practice disguised as one. */
export function V2HomePracticeEntry({ today, onStartPractice, onRetry }: Props) {
  if (today.state === 'none') return null;

  return (
    <View testID="v2-home-today" style={styles.container}>
      <View style={styles.heading}>
        <View style={styles.flagContainer}>
          <Svg width={68} height={22} viewBox="0 0 68 22" style={styles.flagSvg} accessibilityElementsHidden>
            <Polygon points="1,1 57,0 67,11 58,21 0,20" fill="#7252C9" />
          </Svg>
          <Text style={styles.flagText}>TODAY</Text>
        </View>
        {today.state === 'loading' ? <ActivityIndicator color="#7252C9" accessibilityLabel="Loading today’s practice" /> : null}
      </View>

      {today.state === 'loading' ? (
        <Text style={styles.statusCopy}>Loading today’s practice…</Text>
      ) : today.state === 'error' ? (
        <View style={styles.errorRow}>
          <Text numberOfLines={2} style={styles.statusCopy}>{today.message}</Text>
          {onRetry ? <Pressable accessibilityRole="button" accessibilityLabel="Retry today’s practice" onPress={onRetry}><Text style={styles.retry}>Retry</Text></Pressable> : null}
        </View>
      ) : (
        <>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{V2_PRACTICE_MODE_BY_ID[today.mode].title}</Text>
            <View style={styles.titleBrush}><PurpleUnderline /></View>
          </View>
          {today.reason ? <Text style={styles.copy}>{today.reason}</Text> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Start ${V2_PRACTICE_MODE_BY_ID[today.mode].title} practice`}
            onPress={() => onStartPractice?.(today.mode)}
            style={({ pressed }) => [styles.focusLink, pressed && styles.pressed]}
          >
            <View style={styles.focusLinkTextRow}>
              <Text style={styles.focusLinkText}>
                {today.durationSeconds ? `${v2PracticeDurationLabel(today.durationSeconds)} ${V2_PRACTICE_MODE_BY_ID[today.mode].title}` : V2_PRACTICE_MODE_BY_ID[today.mode].title}
              </Text>
              <ArrowLongRight />
            </View>
            <View style={styles.focusUnderline}><BlueFocusUnderline /></View>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginHorizontal: 26, marginTop: 23, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#D8D2C8' },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flagContainer: { position: 'relative', width: 68, height: 22, justifyContent: 'center', paddingLeft: 10 },
  flagSvg: { position: 'absolute', left: 0, top: 0 },
  flagText: { fontFamily: typography.utilitySemibold.fontFamily, fontSize: 10, letterSpacing: 1.6, color: '#FFFFFF', fontWeight: '700' },
  titleRow: { position: 'relative', marginTop: 11 },
  title: { fontFamily: typography.utilitySemibold.fontFamily, fontSize: 18, fontWeight: '700', color: colors.text.primary, letterSpacing: -0.3, lineHeight: 23 },
  titleBrush: { position: 'absolute', right: 8, bottom: -5 },
  copy: { fontFamily: typography.utility.fontFamily, fontSize: 14, color: '#737B84', lineHeight: 20, marginTop: 5 },
  statusCopy: { fontFamily: typography.utility.fontFamily, flex: 1, fontSize: 14, color: '#737B84', lineHeight: 20, marginTop: 12 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  retry: { fontFamily: typography.utilitySemibold.fontFamily, fontSize: 13, color: '#3157D8' },
  focusLink: { alignSelf: 'flex-start', marginTop: 12, paddingBottom: 8 },
  focusLinkTextRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  focusLinkText: { fontFamily: typography.utilitySemibold.fontFamily, fontSize: 16, fontWeight: '600', color: colors.text.primary },
  focusUnderline: { marginTop: 2 },
  pressed: { opacity: 0.72 },
});
