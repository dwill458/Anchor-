import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, Play, Square } from 'lucide-react-native';
import { V2Button, V2SheetGrabZone, V2SheetModal, V2_SHEET_SKIRT } from '@/components/v2/primitives';
import { useV2ReduceMotion } from '@/hooks/v2/useV2ReduceMotion';
import { isSessionAudioSelectionAvailable, lookupVoicePreviewTrack } from '@/services/SessionAudioManifest';
import {
  getActivePreviewVoice,
  startVoicePreview,
  stopVoicePreview,
  subscribeToVoicePreview,
} from '@/services/VoicePreviewService';
import { colors, radii, spacing, typography } from '@/theme/v2';
import {
  BACKGROUND_AUDIO_LABELS,
  GUIDANCE_VOICE_DESCRIPTIONS,
  GUIDANCE_VOICE_LABELS,
  type BackgroundAudioMode,
  type GuidanceVoice,
  type SessionAudioDefaults,
  type SessionAudioSessionType,
} from '@/types/sessionAudio';
import { safeHaptics } from '@/utils/haptics';

/**
 * Guidance voice order:
 * For Focus and Deep Focus: Grounded (2.0 male), Serene (2.0 female),
 * Warm (1.5 female), Soothing (1.5 male), then No guidance.
 * For Visualize: Grounded (male), Serene (female), then No guidance.
 */
const PRACTICE_VOICE_ORDER: readonly GuidanceVoice[] = [
  'male',
  'female',
  'warm',
  'soothing',
  'none',
];
const DEFAULT_VOICE_ORDER: readonly GuidanceVoice[] = ['male', 'female', 'none'];
const BACKGROUND_ORDER: readonly BackgroundAudioMode[] = ['ambient', 'off'];

export interface V2PracticeAudioSheetProps {
  visible: boolean;
  sessionType: SessionAudioSessionType;
  durationSeconds: number;
  /** The configuration this session currently has. */
  value: SessionAudioDefaults;
  /** The practice's own accent (Focus purple, Deep Focus gold, Visualize blue). */
  accent: string;
  /** Fill for the Done button; defaults to the accent. */
  actionColor?: string;
  /** Prefix for test ids, e.g. "focus" gives `focus-voice-male`. */
  testIDPrefix: string;
  onApply: (value: SessionAudioDefaults, makeDefault: boolean) => void;
  onClose: () => void;
}

/**
 * The configuration sheet shared by Focus, Deep Focus and Visualize. It edits
 * a draft: nothing reaches the session until Done, and nothing reaches the
 * global default unless "Make this my default" is ticked.
 */
export function V2PracticeAudioSheet({
  visible,
  sessionType,
  durationSeconds,
  value,
  accent,
  actionColor,
  testIDPrefix,
  onApply,
  onClose,
}: V2PracticeAudioSheetProps) {
  const reduceMotion = useV2ReduceMotion();
  const [draft, setDraft] = useState(value);
  const [makeDefault, setMakeDefault] = useState(false);
  const [previewing, setPreviewing] = useState<GuidanceVoice | null>(getActivePreviewVoice());

  // Each opening starts from the session's current choice.
  useEffect(() => {
    if (!visible) return;
    setDraft(value);
    setMakeDefault(false);
  }, [value, visible]);

  useEffect(() => subscribeToVoicePreview(setPreviewing), []);
  // A preview never outlives the sheet or runs into the session that follows.
  useEffect(() => {
    if (!visible) stopVoicePreview();
    return () => stopVoicePreview();
  }, [visible]);

  const available = (next: SessionAudioDefaults) =>
    isSessionAudioSelectionAvailable({ sessionType, durationSeconds, defaults: next });

  const selectVoice = (guidanceVoice: GuidanceVoice) => {
    void safeHaptics.selection();
    // One voice at a time: changing the choice cuts any preview.
    stopVoicePreview();
    setDraft((previous) => ({ ...previous, guidanceVoice }));
  };

  const selectBackground = (backgroundAudio: BackgroundAudioMode) => {
    void safeHaptics.selection();
    setDraft((previous) => ({ ...previous, backgroundAudio }));
  };

  const togglePreview = (voice: Exclude<GuidanceVoice, 'none'>) => {
    void safeHaptics.selection();
    if (previewing === voice) {
      stopVoicePreview();
      return;
    }
    void startVoicePreview(voice);
  };

  const done = () => {
    stopVoicePreview();
    onApply(draft, makeDefault);
    onClose();
  };

  const cancel = () => {
    stopVoicePreview();
    onClose();
  };

  return (
    <V2SheetModal
      visible={visible}
      onClose={cancel}
      reduceMotion={reduceMotion}
      scrimAccessibilityLabel="Dismiss sound settings"
      testID={`v2-${testIDPrefix}-settings-sheet`}
    >
      <SafeAreaView edges={['bottom']} style={styles.sheet} accessibilityViewIsModal>
        <V2SheetGrabZone>
          <View style={styles.handle} />
        </V2SheetGrabZone>

        <Text style={styles.eyebrow}>GUIDANCE</Text>
        <View style={styles.group}>
          {(sessionType === 'focus' || sessionType === 'deep_prime'
            ? PRACTICE_VOICE_ORDER
            : DEFAULT_VOICE_ORDER
          ).map((voice) => {
            const selected = draft.guidanceVoice === voice;
            const enabled = available({ ...draft, guidanceVoice: voice });
            const canPreview = voice !== 'none' && lookupVoicePreviewTrack(voice) != null;
            const label = GUIDANCE_VOICE_LABELS[voice];
            return (
              <View key={voice} style={styles.optionRow}>
                <Pressable
                  testID={`${testIDPrefix}-voice-${voice}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, disabled: !enabled }}
                  accessibilityLabel={`${label}. ${GUIDANCE_VOICE_DESCRIPTIONS[voice]}${enabled ? '' : ' Unavailable for this session.'}`}
                  disabled={!enabled}
                  onPress={() => selectVoice(voice)}
                  style={({ pressed }) => [styles.optionMain, pressed && styles.pressed, !enabled && styles.disabled]}
                >
                  <View style={styles.optionCopy}>
                    <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{label}</Text>
                    <Text style={styles.optionDescription}>{GUIDANCE_VOICE_DESCRIPTIONS[voice]}</Text>
                  </View>
                  {selected ? <Check size={16} color={accent} strokeWidth={2.4} /> : null}
                </Pressable>
                {voice !== 'none' ? (
                  <Pressable
                    testID={`${testIDPrefix}-preview-${voice}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${previewing === voice ? 'Stop' : 'Play'} ${label} preview`}
                    accessibilityState={{ disabled: !enabled || !canPreview }}
                    disabled={!enabled || !canPreview}
                    onPress={() => togglePreview(voice)}
                    hitSlop={6}
                    style={[styles.previewButton, (!enabled || !canPreview) && styles.disabled]}
                  >
                    {previewing === voice ? (
                      <Square size={12} color={accent} fill={accent} />
                    ) : (
                      <Play size={13} color={accent} fill={accent} />
                    )}
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>

        <Text style={[styles.eyebrow, styles.sectionGap]}>BACKGROUND</Text>
        <View style={styles.group}>
          {BACKGROUND_ORDER.map((mode) => {
            const selected = draft.backgroundAudio === mode;
            const enabled = available({ ...draft, backgroundAudio: mode });
            return (
              <View key={mode} style={styles.optionRow}>
              <Pressable
                testID={`${testIDPrefix}-ambient-${mode === 'ambient' ? 'on' : 'off'}`}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled: !enabled }}
                accessibilityLabel={`${BACKGROUND_AUDIO_LABELS[mode]}${enabled ? '' : '. Unavailable for this session.'}`}
                disabled={!enabled}
                onPress={() => selectBackground(mode)}
                style={({ pressed }) => [styles.optionMain, pressed && styles.pressed, !enabled && styles.disabled]}
              >
                <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                  {BACKGROUND_AUDIO_LABELS[mode]}
                </Text>
                {selected ? <Check size={16} color={accent} strokeWidth={2.4} /> : null}
              </Pressable>
              </View>
            );
          })}
        </View>

        <Text style={[styles.eyebrow, styles.sectionGap]}>PREFERENCE</Text>
        <Pressable
          testID={`${testIDPrefix}-make-default-toggle`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: makeDefault }}
          accessibilityLabel="Make this my default"
          onPress={() => {
            void safeHaptics.selection();
            setMakeDefault((previous) => !previous);
          }}
          style={styles.defaultRow}
        >
          <View style={[styles.checkbox, makeDefault && { backgroundColor: accent, borderColor: accent }]}>
            {makeDefault ? <Check size={11} color="#FFFFFF" strokeWidth={3} /> : null}
          </View>
          <View style={styles.optionCopy}>
            <Text style={styles.defaultLabel}>Make this my default</Text>
            <Text style={styles.optionDescription}>Used for Focus, Deep Focus and Visualize.</Text>
          </View>
        </Pressable>

        <View style={styles.action}>
          <V2Button
            size="large"
            onPress={done}
            accessibilityLabel="Done"
            testID={`${testIDPrefix}-settings-done`}
            style={{ backgroundColor: actionColor ?? accent }}
          >
            Done
          </V2Button>
        </View>
      </SafeAreaView>
    </V2SheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.default,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[4] + V2_SHEET_SKIRT,
    marginBottom: -V2_SHEET_SKIRT,
    flexShrink: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 99,
    backgroundColor: colors.border.default,
    marginBottom: spacing[3],
  },
  eyebrow: { ...typography.labelSM, color: colors.text.secondary, letterSpacing: 0.8 },
  sectionGap: { marginTop: spacing[4] },
  group: { marginTop: 2 },
  optionRow: { flexDirection: 'row', alignItems: 'center' },
  optionMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 2,
  },
  optionCopy: { flex: 1 },
  optionLabel: { ...typography.bodyMD, fontSize: 15, color: colors.text.primary },
  optionLabelSelected: { fontFamily: typography.bodyBold, fontWeight: '700' },
  optionDescription: { ...typography.caption, fontSize: 12, color: colors.text.secondary, marginTop: 1 },
  previewButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing[2],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.default,
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
  defaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginTop: 2,
    paddingVertical: 10,
    paddingHorizontal: 2,
    minHeight: 48,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.text.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultLabel: { ...typography.bodyMD, fontSize: 15, color: colors.text.primary },
  action: { marginTop: spacing[4] },
});
