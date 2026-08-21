// Anchor – Session Configuration Sheet
// Shared "this session" bottom sheet for Focus Session, Deep Prime, and Visualize.
// One DOM/structure for all three modes — only `SessionModeConfig` tokens and copy differ.
// Reference: Session Configuration Sheet - Comparison.html

import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Check, X } from 'lucide-react-native';

import { AnalyticsService } from '@/services/AnalyticsService';
import {
  isSessionAudioSelectionAvailable,
  isVoiceAvailable,
  SESSION_AUDIO_LOCALE,
} from '@/services/SessionAudioManifest';
import { stopVoicePreview } from '@/services/VoicePreviewService';
import { colors as themeColors, spacing, typography } from '@/theme';
import type {
  BackgroundAudioMode,
  GuidanceVoice,
  SessionAudioSessionType,
} from '@/types/sessionAudio';

// ─── Restrained bone/hairline palette ──────────────────────────────────────────
// Not yet promoted to the shared theme (see VisualizePreparationScreen for the
// same convention of extending theme colors locally with opacity ramps).
const bone = themeColors.bone;
const boneSoft = 'rgba(245,240,232,0.62)';
const boneFaint = 'rgba(245,240,232,0.36)';
const hairline = 'rgba(245,240,232,0.09)';
const hairlineBg = 'rgba(245,240,232,0.03)';
const sheetBg = 'rgba(16,17,20,0.97)';
const scrimBg = 'rgba(3,2,6,0.72)';

const accentBorder = (accent: string) => `${accent}8C`; // ~55%
const accentFill = (accent: string) => `${accent}1A`; // ~10%
const accentFillStrong = (accent: string) => `${accent}52`; // ~32%, CTA glow only

// ─── Types ──────────────────────────────────────────────────────────────────

export type GuidanceOption = { id: GuidanceVoice; label: string; sub: string };
export type DurationOption = { seconds: number; label: string };

export type SessionModeConfig = {
  key: SessionAudioSessionType;
  title: string;
  accent: string;
  durations: readonly DurationOption[];
  /** Always 3 rows: Female Voice / Male Voice / No Voice — subtitle differs per mode. */
  guidance: readonly GuidanceOption[];
  defaultDurationSeconds: number;
  defaultGuidanceId: GuidanceVoice;
  defaultBackground: BackgroundAudioMode;
  makeDefaultHelper: string;
};

export type SessionDraft = {
  durationSeconds: number;
  guidanceVoice: GuidanceVoice;
  backgroundAudio: BackgroundAudioMode;
  makeDefault: boolean;
};

export type SessionConfigurationSheetProps = {
  visible: boolean;
  mode: SessionModeConfig;
  /** The session's current (already-applied) config. */
  config: SessionDraft;
  /** Fires only on "Apply to This Session". Never mutates defaults unless draft.makeDefault is true — persisting that is the caller's job. */
  onApply: (draft: SessionDraft) => void;
  onClose: () => void;
};

// ─── Per-mode configs ───────────────────────────────────────────────────────

export const FOCUS_SESSION_MODE: SessionModeConfig = {
  key: 'focus',
  title: 'Focus Session',
  accent: '#6B4FA0',
  durations: [
    { seconds: 10, label: '10 SEC' },
    { seconds: 30, label: '30 SEC' },
    { seconds: 60, label: '1 MIN' },
  ],
  guidance: [
    { id: 'female', label: 'Female Voice', sub: 'Brief spoken cues open and close the session.' },
    { id: 'male', label: 'Male Voice', sub: 'Same cues, alternate voice.' },
    { id: 'none', label: 'No Voice', sub: 'Silent — only the Anchor marks the return.' },
  ],
  defaultDurationSeconds: 30,
  defaultGuidanceId: 'female',
  defaultBackground: 'ambient',
  makeDefaultHelper: 'Applies to every Focus Session from now on.',
};

export const DEEP_PRIME_MODE: SessionModeConfig = {
  key: 'deep_prime',
  title: 'Deep Prime',
  accent: '#B8763E',
  durations: [
    { seconds: 120, label: '2 MIN' },
    { seconds: 300, label: '5 MIN' },
    { seconds: 600, label: '10 MIN' },
  ],
  guidance: [
    { id: 'female', label: 'Female Voice', sub: 'Spoken guidance moves with you through all five phases.' },
    { id: 'male', label: 'Male Voice', sub: 'Same guidance, alternate voice.' },
    { id: 'none', label: 'No Voice', sub: 'Phases unfold in silence, marked by the Anchor alone.' },
  ],
  defaultDurationSeconds: 120,
  defaultGuidanceId: 'female',
  defaultBackground: 'ambient',
  makeDefaultHelper: 'Applies to every Deep Prime from now on.',
};

export const VISUALIZE_MODE: SessionModeConfig = {
  key: 'visualize',
  title: 'Visualize',
  accent: '#4A6FA5',
  durations: [
    { seconds: 60, label: '1 MIN' },
    { seconds: 180, label: '3 MIN' },
    { seconds: 300, label: '5 MIN' },
  ],
  guidance: [
    { id: 'female', label: 'Female Voice', sub: 'Spoken prompts guide the scene as it unfolds.' },
    { id: 'male', label: 'Male Voice', sub: 'Same prompts, alternate voice.' },
    { id: 'none', label: 'No Voice', sub: 'Rehearse the scene in silence.' },
  ],
  defaultDurationSeconds: 180,
  defaultGuidanceId: 'female',
  defaultBackground: 'ambient',
  makeDefaultHelper: 'Applies to every Visualize session from now on.',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const GUIDANCE_LABELS: Record<GuidanceVoice, string> = {
  female: 'Female Voice',
  male: 'Male Voice',
  none: 'No Voice',
};

const formatDuration = (seconds: number): string =>
  seconds < 60 ? `${seconds} sec` : `${Math.round(seconds / 60)} min`;

// ─── Component ──────────────────────────────────────────────────────────────

export const SessionConfigurationSheet: React.FC<SessionConfigurationSheetProps> = ({
  visible,
  mode,
  config,
  onApply,
  onClose,
}) => {
  const [draft, setDraft] = useState<SessionDraft>(config);

  useEffect(() => {
    if (!visible) return;
    setDraft(config);
    AnalyticsService.track('session_audio_override_opened', {
      session_type: mode.key,
      duration_seconds: config.durationSeconds,
      guidance_voice: config.guidanceVoice,
      background_audio: config.backgroundAudio,
      source: 'session_override',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => () => stopVoicePreview(), []);

  const selectionAvailable = isSessionAudioSelectionAvailable({
    sessionType: mode.key,
    durationSeconds: draft.durationSeconds,
    defaults: { guidanceVoice: draft.guidanceVoice, backgroundAudio: draft.backgroundAudio },
  });

  const close = () => {
    stopVoicePreview();
    setDraft(config);
    onClose();
  };

  const apply = () => {
    if (!selectionAvailable) return;
    stopVoicePreview();
    AnalyticsService.track('session_audio_override_applied', {
      session_type: mode.key,
      duration_seconds: draft.durationSeconds,
      guidance_voice: draft.guidanceVoice,
      background_audio: draft.backgroundAudio,
      source: 'session_override',
      make_default: draft.makeDefault,
    });
    onApply(draft);
  };

  const recap = `${formatDuration(draft.durationSeconds)} · ${GUIDANCE_LABELS[draft.guidanceVoice]} · ${
    draft.backgroundAudio === 'ambient' ? 'Ambient' : 'Silence'
  }`;

  return (
    <Modal animationType="slide" onRequestClose={close} transparent visible={visible}>
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityLabel="Close session configuration"
          onPress={close}
          style={styles.backdrop}
        />
        <SafeAreaView style={[styles.sheet, { borderColor: accentBorder(mode.accent) }]}>
          <View accessibilityViewIsModal style={styles.sheetContent}>
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>

            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.eyebrow}>SESSION CONFIGURATION</Text>
                <Text style={styles.title}>{mode.title}</Text>
              </View>
              <TouchableOpacity
                accessibilityLabel="Close"
                accessibilityRole="button"
                activeOpacity={0.82}
                onPress={close}
                style={styles.closeButton}
              >
                <X color={boneSoft} size={16} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.intro}>Adjust this session without changing your defaults.</Text>

              {/* DURATION */}
              <View style={styles.section}>
                <Text style={styles.ctrlLabel}>DURATION</Text>
                <View accessibilityRole="radiogroup" style={styles.segRow}>
                  {mode.durations.map((option) => {
                    const isSelected = draft.durationSeconds === option.seconds;
                    return (
                      <TouchableOpacity
                        key={option.seconds}
                        accessibilityLabel={`${option.label} duration`}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isSelected }}
                        activeOpacity={0.82}
                        onPress={() => setDraft((d) => ({ ...d, durationSeconds: option.seconds }))}
                        style={[
                          styles.segChip,
                          isSelected
                            ? {
                                borderColor: accentBorder(mode.accent),
                                backgroundColor: accentFill(mode.accent),
                              }
                            : styles.segChipUnselected,
                        ]}
                      >
                        <Text style={[styles.segChipText, isSelected && styles.segChipTextSelected]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* GUIDANCE */}
              <View style={styles.section}>
                <Text style={styles.ctrlLabel}>GUIDANCE</Text>
                <View accessibilityRole="radiogroup" style={styles.optionList}>
                  {mode.guidance.map((option) => {
                    const isSelected = draft.guidanceVoice === option.id;
                    const available = isVoiceAvailable({
                      voice: option.id,
                      sessionType: mode.key,
                      durationSeconds: draft.durationSeconds,
                      locale: SESSION_AUDIO_LOCALE,
                    });
                    return (
                      <TouchableOpacity
                        key={option.id}
                        accessibilityLabel={`${option.label}. ${option.sub}`}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isSelected, disabled: !available }}
                        activeOpacity={0.82}
                        disabled={!available}
                        onPress={() => setDraft((d) => ({ ...d, guidanceVoice: option.id }))}
                        style={[
                          styles.optionRow,
                          !available && styles.optionRowDisabled,
                          isSelected
                            ? {
                                borderColor: accentBorder(mode.accent),
                                backgroundColor: accentFill(mode.accent),
                              }
                            : styles.optionRowUnselected,
                        ]}
                      >
                        <View
                          style={[styles.radioDot, isSelected && { borderColor: mode.accent }]}
                        >
                          {isSelected ? (
                            <View style={[styles.radioDotInner, { backgroundColor: mode.accent }]} />
                          ) : null}
                        </View>
                        <View style={styles.optionText}>
                          <Text style={styles.optionLabel}>{option.label}</Text>
                          <Text style={styles.optionSub}>{option.sub}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* BACKGROUND */}
              <View style={styles.section}>
                <Text style={styles.ctrlLabel}>BACKGROUND</Text>
                <View accessibilityRole="radiogroup" style={styles.segRow}>
                  {(['ambient', 'off'] as const).map((value) => {
                    const isSelected = draft.backgroundAudio === value;
                    return (
                      <TouchableOpacity
                        key={value}
                        accessibilityLabel={value === 'ambient' ? 'Ambient background' : 'Silence background'}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isSelected }}
                        activeOpacity={0.82}
                        onPress={() => setDraft((d) => ({ ...d, backgroundAudio: value }))}
                        style={[
                          styles.segChip,
                          isSelected
                            ? {
                                borderColor: accentBorder(mode.accent),
                                backgroundColor: accentFill(mode.accent),
                              }
                            : styles.segChipUnselected,
                        ]}
                      >
                        <Text style={[styles.segChipText, isSelected && styles.segChipTextSelected]}>
                          {value === 'ambient' ? 'Ambient' : 'Silence'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* MAKE DEFAULT */}
              <TouchableOpacity
                accessibilityLabel="Make this my new default"
                accessibilityRole="checkbox"
                accessibilityState={{ checked: draft.makeDefault }}
                activeOpacity={0.82}
                onPress={() => setDraft((d) => ({ ...d, makeDefault: !d.makeDefault }))}
                style={styles.defaultRow}
              >
                <View
                  style={[
                    styles.checkbox,
                    draft.makeDefault && {
                      borderColor: mode.accent,
                      backgroundColor: accentFill(mode.accent),
                    },
                  ]}
                >
                  {draft.makeDefault ? <Check color={mode.accent} size={12} strokeWidth={3} /> : null}
                </View>
                <Text style={styles.defaultRowText}>Make this my new default</Text>
              </TouchableOpacity>
              {draft.makeDefault ? (
                <Text style={styles.defaultHelper}>{mode.makeDefaultHelper}</Text>
              ) : null}

              {!selectionAvailable ? (
                <Text accessibilityRole="alert" style={styles.validationText}>
                  Choose a voice with complete audio coverage for this session and duration.
                </Text>
              ) : null}

              {/* RECAP */}
              <View style={styles.recap}>
                <Text style={styles.recapLabel}>CURRENT EXPERIENCE</Text>
                <Text style={styles.recapValue}>{recap}</Text>
              </View>
            </ScrollView>

            <View style={styles.actions}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ disabled: !selectionAvailable }}
                activeOpacity={0.88}
                disabled={!selectionAvailable}
                onPress={apply}
                style={[
                  styles.cta,
                  { backgroundColor: mode.accent, shadowColor: accentFillStrong(mode.accent) },
                  !selectionAvailable && styles.ctaDisabled,
                ]}
              >
                <Text style={styles.ctaText}>Apply to This Session</Text>
              </TouchableOpacity>
              <Text style={styles.footer}>Your session defaults remain unchanged.</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: scrimBg },
  sheet: {
    backgroundColor: sheetBg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopWidth: 1,
    maxHeight: '92%',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.4,
    shadowRadius: 26,
    elevation: 16,
  },
  sheetContent: { maxHeight: '100%' },
  handleContainer: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(245,240,232,0.16)' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: 4,
    paddingBottom: spacing.sm,
  },
  headerText: { flex: 1, minWidth: 0, gap: 4 },
  eyebrow: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 9,
    letterSpacing: 1.4,
    color: boneFaint,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 19,
    letterSpacing: 0.2,
    color: bone,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: hairline,
    backgroundColor: hairlineBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  intro: {
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 19,
    color: boneSoft,
  },
  section: { gap: 9 },
  ctrlLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 9.5,
    letterSpacing: 2.2,
    color: boneFaint,
    textTransform: 'uppercase',
  },
  segRow: { flexDirection: 'row', gap: 8 },
  segChip: {
    flex: 1,
    minHeight: 46,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  segChipUnselected: { borderColor: hairline, backgroundColor: hairlineBg },
  segChipText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 12.5,
    color: boneSoft,
    textAlign: 'center',
  },
  segChipTextSelected: { color: bone, fontWeight: '600' },
  optionList: { gap: 8 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    borderRadius: 14,
    borderWidth: 1,
    padding: 13,
  },
  optionRowUnselected: { borderColor: hairline, backgroundColor: hairlineBg },
  optionRowDisabled: { opacity: 0.4 },
  radioDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(245,240,232,0.28)',
    marginTop: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDotInner: { width: 8, height: 8, borderRadius: 4 },
  optionText: { flex: 1, gap: 2 },
  optionLabel: { fontFamily: typography.fontFamily.sans, fontSize: 13.5, fontWeight: '600', color: bone },
  optionSub: {
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontStyle: 'italic',
    fontSize: 13,
    lineHeight: 17,
    color: boneFaint,
  },
  defaultRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(245,240,232,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultRowText: { fontFamily: typography.fontFamily.sans, fontSize: 13.5, color: boneSoft },
  defaultHelper: {
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontStyle: 'italic',
    fontSize: 12.5,
    lineHeight: 17,
    color: boneFaint,
    marginLeft: 28,
    marginTop: -4,
  },
  validationText: { fontFamily: typography.fontFamily.sans, fontSize: 12, lineHeight: 17, color: '#E5A29A' },
  recap: { gap: 3, paddingTop: 2 },
  recapLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 8.5,
    letterSpacing: 2,
    color: boneFaint,
    textTransform: 'uppercase',
  },
  recapValue: { fontFamily: typography.fontFamily.sans, fontSize: 12.5, color: boneSoft },
  actions: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  cta: {
    width: '100%',
    minHeight: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 6,
  },
  ctaDisabled: { opacity: 0.42 },
  ctaText: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  footer: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 8,
    letterSpacing: 1.2,
    color: boneFaint,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
});
