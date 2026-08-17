import React, { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Check, ChevronRight, SlidersHorizontal, Volume2, VolumeX, X } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { AnalyticsService } from '@/services/AnalyticsService';
import {
  isSessionAudioSelectionAvailable,
  isVoiceAvailable,
  SESSION_AUDIO_LOCALE,
} from '@/services/SessionAudioManifest';
import { stopVoicePreview } from '@/services/VoicePreviewService';
import { colors, spacing, typography } from '@/theme';
import {
  formatCompactSessionAudioSummary,
  type GuidanceVoice,
  type SessionAudioDefaults,
  type SessionAudioSessionType,
} from '@/types/sessionAudio';

type SheetProps = {
  visible: boolean;
  sessionType: SessionAudioSessionType;
  durationSeconds: number;
  initialValue: SessionAudioDefaults;
  onCancel: () => void;
  onConfirm: (value: SessionAudioDefaults, makeDefault: boolean, durationSeconds?: number) => void;
  durationOptions?: readonly number[];
  onDurationChange?: (duration: number) => void;
  themeColor?: string;
};

const DEFAULT_FOCUS_DURATIONS = [10, 30, 60] as const;
const DEFAULT_DEEP_PRIME_DURATIONS = [120, 300, 600] as const;
const FOCUS_SESSION_PURPLE = colors.practiceMode.focus.primary;

const VOICE_OPTIONS: Array<{
  voice: GuidanceVoice;
  label: string;
  description: string;
}> = [
  {
    voice: 'female',
    label: 'Female Voice',
    description: 'Warm, calm guidance',
  },
  {
    voice: 'male',
    label: 'Male Voice',
    description: 'Grounded, steady guidance',
  },
  {
    voice: 'none',
    label: 'No Voice',
    description: 'Visual and haptic guidance only',
  },
];

export const SessionAudioOverrideSheet: React.FC<SheetProps> = ({
  visible,
  sessionType,
  durationSeconds,
  initialValue,
  onCancel,
  onConfirm,
  durationOptions,
  onDurationChange,
  themeColor,
}) => {
  const isFocus = sessionType === 'focus';
  const primaryColor = themeColor ?? (isFocus ? FOCUS_SESSION_PURPLE : colors.gold);
  const activeDurationOptions =
    durationOptions ?? (isFocus ? DEFAULT_FOCUS_DURATIONS : DEFAULT_DEEP_PRIME_DURATIONS);

  const [draft, setDraft] = useState<SessionAudioDefaults>(initialValue);
  const [draftDuration, setDraftDuration] = useState<number>(durationSeconds);
  const [makeDefault, setMakeDefault] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDraft(initialValue);
    setDraftDuration(durationSeconds);
    setMakeDefault(false);
    AnalyticsService.track('session_audio_override_opened', {
      session_type: sessionType,
      duration_seconds: durationSeconds,
      guidance_voice: initialValue.guidanceVoice,
      background_audio: initialValue.backgroundAudio,
      source: 'session_override',
    });
  }, [durationSeconds, initialValue, sessionType, visible]);

  useEffect(() => () => stopVoicePreview(), []);

  const selectionAvailable = isSessionAudioSelectionAvailable({
    sessionType,
    durationSeconds: draftDuration,
    defaults: draft,
  });

  const cancel = () => {
    stopVoicePreview();
    setDraft(initialValue);
    setDraftDuration(durationSeconds);
    setMakeDefault(false);
    onCancel();
  };

  const confirm = () => {
    if (!selectionAvailable) return;
    stopVoicePreview();
    AnalyticsService.track('session_audio_override_applied', {
      session_type: sessionType,
      duration_seconds: draftDuration,
      guidance_voice: draft.guidanceVoice,
      background_audio: draft.backgroundAudio,
      source: 'session_override',
      make_default: makeDefault,
    });
    onDurationChange?.(draftDuration);
    onConfirm(draft, makeDefault, draftDuration);
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={cancel}
      transparent
      visible={visible}
    >
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityLabel="Close session options"
          onPress={cancel}
          style={styles.backdrop}
        />
        <SafeAreaView style={[styles.sheet, { borderColor: `${primaryColor}3D` }]}>
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={88}
              tint="dark"
              pointerEvents="none"
              style={styles.glassLayer}
            />
          ) : (
            <View
              pointerEvents="none"
              style={[styles.glassLayer, styles.glassFallback]}
            />
          )}
          <LinearGradient
            colors={[
              'rgba(255,248,232,0.13)',
              `${primaryColor}18`,
              'rgba(24,13,8,0.68)',
            ]}
            start={{ x: 0.12, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            pointerEvents="none"
            style={styles.glassLayer}
          />
          <View pointerEvents="none" style={styles.glassGlow} />
          <View pointerEvents="none" style={styles.glassGlowSecondary} />
          <LinearGradient
            colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            pointerEvents="none"
            style={styles.glassSheen}
          />
          <View accessibilityViewIsModal style={styles.sheetContent}>
            {/* Grab Handle */}
            <View style={styles.handleContainer}>
              <View style={[styles.handle, { backgroundColor: `${primaryColor}4D` }]} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>THIS SESSION</Text>
                <Text style={styles.subtitle}>
                  Adjust this session without changing your defaults.
                </Text>
              </View>
              <TouchableOpacity
                accessibilityLabel="Cancel"
                accessibilityRole="button"
                activeOpacity={0.8}
                onPress={cancel}
                style={[styles.closeButton, { borderColor: `${primaryColor}33` }]}
              >
                <X color={primaryColor} size={18} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* DURATION Section */}
              {activeDurationOptions && activeDurationOptions.length > 0 ? (
                <View style={styles.sectionBlock}>
                  <Text style={[styles.sectionLabel, { color: primaryColor }]}>DURATION</Text>
                  <View accessibilityRole="radiogroup" style={styles.pillRow}>
                    {activeDurationOptions.map((optionDuration) => {
                      const isSelected = draftDuration === optionDuration;
                      const label =
                        optionDuration < 60
                          ? `${optionDuration} sec`
                          : `${Math.round(optionDuration / 60)} min`;

                      return (
                        <TouchableOpacity
                          key={optionDuration}
                          accessibilityRole="radio"
                          accessibilityLabel={`${label} duration`}
                          accessibilityState={{ selected: isSelected }}
                          activeOpacity={0.82}
                          onPress={() => setDraftDuration(optionDuration)}
                          style={[
                            styles.pillButton,
                            isSelected
                              ? [
                                  styles.pillButtonSelected,
                                  {
                                    borderColor: primaryColor,
                                    backgroundColor: `${primaryColor}24`,
                                  },
                                ]
                              : [
                                  styles.pillButtonUnselected,
                                  { borderColor: `${primaryColor}24` },
                                ],
                          ]}
                        >
                          <Text
                            style={[
                              styles.pillText,
                              isSelected
                                ? [styles.pillTextSelected, { color: '#F4EFE6' }]
                                : styles.pillTextUnselected,
                            ]}
                          >
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {/* GUIDANCE Section */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionLabel, { color: primaryColor }]}>GUIDANCE</Text>
                <View accessibilityRole="radiogroup" style={styles.pillRow}>
                  {VOICE_OPTIONS.map((option) => {
                    const isSelected = draft.guidanceVoice === option.voice;
                    const available = isVoiceAvailable({
                      voice: option.voice,
                      sessionType,
                      durationSeconds: draftDuration,
                      locale: SESSION_AUDIO_LOCALE,
                    });

                    return (
                      <TouchableOpacity
                        key={option.voice}
                        accessibilityRole="radio"
                        accessibilityLabel={`${option.label}. ${option.description}`}
                        accessibilityState={{ selected: isSelected, disabled: !available }}
                        activeOpacity={0.82}
                        disabled={!available}
                        onPress={() => setDraft({ ...draft, guidanceVoice: option.voice })}
                        style={[
                          styles.pillButton,
                          !available && styles.pillButtonDisabled,
                          isSelected
                            ? [
                                styles.pillButtonSelected,
                                {
                                  borderColor: primaryColor,
                                  backgroundColor: `${primaryColor}24`,
                                },
                              ]
                            : [
                                styles.pillButtonUnselected,
                                { borderColor: `${primaryColor}24` },
                              ],
                        ]}
                      >
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.pillText,
                            !available && styles.pillTextDisabled,
                            isSelected
                              ? [styles.pillTextSelected, { color: '#F4EFE6' }]
                              : styles.pillTextUnselected,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* BACKGROUND Section */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionLabel, { color: primaryColor }]}>BACKGROUND</Text>
                <View accessibilityRole="radiogroup" style={styles.pillRow}>
                  <TouchableOpacity
                    accessibilityRole="radio"
                    accessibilityLabel="Ambient background"
                    accessibilityState={{ selected: draft.backgroundAudio === 'ambient' }}
                    activeOpacity={0.82}
                    onPress={() => setDraft({ ...draft, backgroundAudio: 'ambient' })}
                    style={[
                      styles.pillButton,
                      draft.backgroundAudio === 'ambient'
                        ? [
                            styles.pillButtonSelected,
                            {
                              borderColor: primaryColor,
                              backgroundColor: `${primaryColor}24`,
                            },
                          ]
                        : [
                            styles.pillButtonUnselected,
                            { borderColor: `${primaryColor}24` },
                          ],
                    ]}
                  >
                    <Volume2
                      color={draft.backgroundAudio === 'ambient' ? primaryColor : 'rgba(244,239,230,0.6)'}
                      size={15}
                      style={styles.pillIcon}
                    />
                    <Text
                      style={[
                        styles.pillText,
                        draft.backgroundAudio === 'ambient'
                          ? [styles.pillTextSelected, { color: '#F4EFE6' }]
                          : styles.pillTextUnselected,
                      ]}
                    >
                      Ambient
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    accessibilityRole="radio"
                    accessibilityLabel="Silence background"
                    accessibilityState={{ selected: draft.backgroundAudio === 'off' }}
                    activeOpacity={0.82}
                    onPress={() => setDraft({ ...draft, backgroundAudio: 'off' })}
                    style={[
                      styles.pillButton,
                      draft.backgroundAudio === 'off'
                        ? [
                            styles.pillButtonSelected,
                            {
                              borderColor: primaryColor,
                              backgroundColor: `${primaryColor}24`,
                            },
                          ]
                        : [
                            styles.pillButtonUnselected,
                            { borderColor: `${primaryColor}24` },
                          ],
                    ]}
                  >
                    <VolumeX
                      color={draft.backgroundAudio === 'off' ? primaryColor : 'rgba(244,239,230,0.6)'}
                      size={15}
                      style={styles.pillIcon}
                    />
                    <Text
                      style={[
                        styles.pillText,
                        draft.backgroundAudio === 'off'
                          ? [styles.pillTextSelected, { color: '#F4EFE6' }]
                          : styles.pillTextUnselected,
                      ]}
                    >
                      Silence
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Make this my new default */}
              <TouchableOpacity
                accessibilityRole="checkbox"
                accessibilityLabel="Make this my new default"
                accessibilityState={{ checked: makeDefault }}
                activeOpacity={0.82}
                onPress={() => setMakeDefault((current) => !current)}
                style={[styles.defaultRow, { borderColor: `${primaryColor}2E` }]}
              >
                <View
                  style={[
                    styles.checkbox,
                    makeDefault && [styles.checkboxSelected, { backgroundColor: primaryColor, borderColor: primaryColor }],
                  ]}
                >
                  {makeDefault ? <Check color="#0F1419" size={13} strokeWidth={3} /> : null}
                </View>
                <View style={styles.defaultCopy}>
                  <Text style={styles.defaultTitle}>Make this my new default</Text>
                  <Text style={styles.defaultDescription}>
                    Otherwise, this choice applies only to the upcoming session.
                  </Text>
                </View>
              </TouchableOpacity>

              {!selectionAvailable ? (
                <Text accessibilityRole="alert" style={styles.validationText}>
                  Choose a voice with complete audio coverage for this session and duration.
                </Text>
              ) : null}
            </ScrollView>

            {/* Actions / CTA */}
            <View style={styles.actions}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ disabled: !selectionAvailable }}
                activeOpacity={0.88}
                disabled={!selectionAvailable}
                onPress={confirm}
                style={[
                  styles.ctaButtonWrapper,
                  !selectionAvailable && styles.disabledButton,
                  { shadowColor: primaryColor },
                ]}
              >
                <LinearGradient
                  colors={
                    isFocus
                      ? ['#C4B5E0', FOCUS_SESSION_PURPLE, '#8F7BB8']
                      : ['#F2DFA8', '#D9B36C', '#B99247']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.ctaButton}
                >
                  <Text style={styles.ctaText}>Apply to This Session</Text>
                </LinearGradient>
              </TouchableOpacity>

              <Text style={[styles.footnote, { color: `${primaryColor}A6` }]}>
                YOUR SESSION DEFAULTS REMAIN UNCHANGED.
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

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
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,2,6,0.72)' },
  sheet: {
    backgroundColor: 'rgba(24,13,8,0.70)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    maxHeight: '92%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 18,
  },
  glassLayer: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  glassFallback: {
    backgroundColor: 'rgba(24,13,8,0.92)',
  },
  glassGlow: {
    position: 'absolute',
    top: -126,
    left: -74,
    width: 270,
    height: 220,
    borderRadius: 140,
    backgroundColor: 'rgba(212,175,55,0.10)',
    opacity: 0.9,
  },
  glassGlowSecondary: {
    position: 'absolute',
    right: -112,
    bottom: -118,
    width: 260,
    height: 220,
    borderRadius: 140,
    backgroundColor: 'rgba(112,54,28,0.16)',
  },
  glassSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 96,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,248,232,0.08)',
  },
  sheetContent: { maxHeight: '100%', paddingBottom: spacing.sm },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(245,240,232,0.18)',
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: 10,
    paddingBottom: spacing.md,
  },
  headerCopy: { flex: 1, gap: 4, alignItems: 'center' },
  title: {
    color: '#F4EFE6',
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 18,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  subtitle: {
    color: 'rgba(244,239,230,0.65)',
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 13.5,
    lineHeight: 18,
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: spacing.lg,
    top: 10,
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  sectionBlock: {
    marginTop: spacing.lg,
    gap: 9,
  },
  sectionLabel: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'nowrap',
  },
  pillButton: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
    paddingVertical: 10,
    borderRadius: 13,
    borderWidth: 1,
  },
  pillButtonSelected: {
    borderWidth: 1.5,
  },
  pillButtonUnselected: {
    backgroundColor: 'rgba(245,240,232,0.025)',
  },
  pillButtonDisabled: {
    opacity: 0.45,
  },
  pillIcon: {
    marginRight: 6,
  },
  pillText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 12,
    textAlign: 'center',
  },
  pillTextSelected: {
    fontWeight: '700',
  },
  pillTextUnselected: {
    color: 'rgba(244,239,230,0.7)',
    fontWeight: '500',
  },
  pillTextDisabled: {
    color: 'rgba(192,192,192,0.4)',
  },
  defaultRow: {
    alignItems: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    marginTop: spacing.lg,
    minHeight: 56,
    padding: 12,
    backgroundColor: 'rgba(245,240,232,0.025)',
  },
  checkbox: {
    alignItems: 'center',
    borderColor: 'rgba(192,192,192,0.45)',
    borderRadius: 5,
    borderWidth: 1.5,
    height: 20,
    justifyContent: 'center',
    marginTop: 1,
    width: 20,
  },
  checkboxSelected: {},
  defaultCopy: { flex: 1, gap: 2 },
  defaultTitle: { color: '#F4EFE6', fontSize: 13, fontWeight: '600' },
  defaultDescription: { color: 'rgba(244,239,230,0.55)', fontSize: 11.5, lineHeight: 16 },
  validationText: { color: '#E5A29A', fontSize: 12, lineHeight: 17, marginTop: 10 },
  actions: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  ctaButtonWrapper: {
    width: '100%',
    borderRadius: 999,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 999,
  },
  ctaText: {
    color: '#080C10',
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  footnote: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 10,
    letterSpacing: 1.2,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  disabledButton: { opacity: 0.42 },
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
