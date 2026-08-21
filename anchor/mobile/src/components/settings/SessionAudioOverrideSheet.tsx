// Anchor – Voice & Sound summary pill.
// The "this session" sheet itself now lives in
// `@/components/practice/SessionConfigurationSheet` (shared across Focus Session,
// Deep Prime, and Visualize). This file keeps only the pill trigger, which stays
// as-is per screen.

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight, SlidersHorizontal } from 'lucide-react-native';
import { colors } from '@/theme';
import {
  formatCompactSessionAudioSummary,
  type SessionAudioDefaults,
  type SessionAudioSessionType,
} from '@/types/sessionAudio';

const FOCUS_SESSION_PURPLE = colors.practiceMode.focus.primary;

type SummaryRowProps = {
  value: SessionAudioDefaults;
  onPress: () => void;
  sessionType?: SessionAudioSessionType;
};

export const VoiceAndSoundSummaryRow: React.FC<SummaryRowProps> = ({
  value,
  onPress,
  sessionType = 'focus',
}) => {
  const isFocus = sessionType === 'focus';
  const primaryColor = isFocus ? FOCUS_SESSION_PURPLE : colors.gold;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Voice and Sound. ${formatCompactSessionAudioSummary(value)}. Change`}
      activeOpacity={0.84}
      onPress={onPress}
      style={[
        styles.summaryRow,
        {
          borderColor: `${primaryColor}38`,
          backgroundColor: isFocus ? 'rgba(173,153,210,0.10)' : 'rgba(255,255,255,0.06)',
        },
      ]}
    >
      <View
        style={[
          styles.summaryIcon,
          { backgroundColor: `${primaryColor}14` },
        ]}
      >
        <SlidersHorizontal color={primaryColor} size={16} />
      </View>
      <View style={styles.summaryCopy}>
        <Text style={styles.summaryTitle}>Voice & Sound</Text>
        <Text style={styles.summaryValue}>{formatCompactSessionAudioSummary(value)}</Text>
      </View>
      <Text style={[styles.changeText, { color: primaryColor }]}>Change</Text>
      <ChevronRight color={`${primaryColor}B3`} size={16} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  summaryRow: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 44,
    paddingHorizontal: 10,
  },
  summaryIcon: {
    alignItems: 'center',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    marginRight: 8,
    width: 28,
  },
  summaryCopy: { gap: 1 },
  summaryTitle: { color: '#F0EDE5', fontSize: 12, fontWeight: '700' },
  summaryValue: { color: 'rgba(229,229,229,0.58)', fontSize: 11 },
  changeText: { fontSize: 11, fontWeight: '700', marginLeft: 10, marginRight: 1 },
});
