import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SlidersHorizontal, X } from 'lucide-react-native';

import { VoiceAndSoundControls } from '@/components/settings/VoiceAndSoundControls';
import { colors, spacing, typography } from '@/theme';
import { formatSessionAudioSummary, type SessionAudioDefaults, type SessionAudioSessionType } from '@/types/sessionAudio';

export const SessionConfigurationPill: React.FC<{
  value: SessionAudioDefaults;
  durationSeconds?: number;
  onPress: () => void;
}> = ({ value, durationSeconds, onPress }) => (
  <Pressable accessibilityRole="button" accessibilityLabel="Edit session configuration" onPress={onPress} style={styles.pill}>
    <SlidersHorizontal color={colors.gold} size={14} />
    <Text style={styles.pillText} numberOfLines={1}>
      {durationSeconds ? `${durationSeconds / 60} min · ` : ''}{formatSessionAudioSummary(value)}
    </Text>
  </Pressable>
);

export const SessionConfigurationSheet: React.FC<{
  visible: boolean;
  value: SessionAudioDefaults;
  sessionType: SessionAudioSessionType;
  durationSeconds: number;
  onChange: (value: SessionAudioDefaults) => void;
  onClose: () => void;
  durationOptions?: readonly number[];
  onDurationChange?: (duration: number) => void;
}> = ({ visible, value, sessionType, durationSeconds, onChange, onClose, durationOptions, onDurationChange }) => (
  <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
    <Pressable style={styles.overlay} onPress={onClose}>
      <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>SESSION CONFIGURATION</Text>
            <Text style={styles.title}>Guidance & sound</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close configuration" onPress={onClose} style={styles.close}>
            <X color={colors.gold} size={18} />
          </Pressable>
        </View>
        {durationOptions?.length ? (
          <View style={styles.durationRow} accessibilityRole="radiogroup">
            {durationOptions.map((duration) => (
              <Pressable
                key={duration}
                accessibilityRole="radio"
                accessibilityState={{ selected: durationSeconds === duration }}
                onPress={() => onDurationChange?.(duration)}
                style={[styles.duration, durationSeconds === duration && styles.durationSelected]}
              >
                <Text style={[styles.durationText, durationSeconds === duration && styles.durationTextSelected]}>{duration / 60} min</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <VoiceAndSoundControls
          value={value}
          onChange={onChange}
          sessionType={sessionType}
          durationSeconds={durationSeconds}
          showPreview={false}
        />
      </Pressable>
    </Pressable>
  </Modal>
);

const styles = StyleSheet.create({
  pill: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(212,175,55,.28)', backgroundColor: 'rgba(14,31,55,.78)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, maxWidth: '92%' },
  pillText: { color: 'rgba(245,245,220,.78)', fontFamily: typography.fonts.body, fontSize: 12 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,7,15,.78)' },
  sheet: { backgroundColor: '#0D1B2E', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: 'rgba(212,175,55,.18)', padding: spacing.lg, paddingBottom: 34, maxHeight: '88%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  eyebrow: { color: colors.gold, fontSize: 9, letterSpacing: 2, fontFamily: typography.fonts.body },
  title: { color: '#F5F5DC', fontSize: 21, fontFamily: typography.fonts.heading, marginTop: 4 },
  close: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: 'rgba(255,255,255,.05)' },
  durationRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.lg },
  duration: { flex: 1, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,.1)', alignItems: 'center' },
  durationSelected: { backgroundColor: 'rgba(212,175,55,.12)', borderColor: colors.gold },
  durationText: { color: 'rgba(245,245,220,.6)', fontFamily: typography.fonts.body },
  durationTextSelected: { color: colors.gold },
});
