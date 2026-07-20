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
import { Check, ChevronRight, SlidersHorizontal, X } from 'lucide-react-native';
import { VoiceAndSoundControls } from '@/components/settings/VoiceAndSoundControls';
import { AnalyticsService } from '@/services/AnalyticsService';
import { isSessionAudioSelectionAvailable } from '@/services/SessionAudioManifest';
import { stopVoicePreview } from '@/services/VoicePreviewService';
import { colors, spacing, typography } from '@/theme';
import {
  formatCompactSessionAudioSummary,
  type SessionAudioDefaults,
  type SessionAudioSessionType,
} from '@/types/sessionAudio';

type SheetProps = {
  visible: boolean;
  sessionType: SessionAudioSessionType;
  durationSeconds: number;
  initialValue: SessionAudioDefaults;
  onCancel: () => void;
  onConfirm: (value: SessionAudioDefaults, makeDefault: boolean) => void;
};

export const SessionAudioOverrideSheet: React.FC<SheetProps> = ({
  visible,
  sessionType,
  durationSeconds,
  initialValue,
  onCancel,
  onConfirm,
}) => {
  const [draft, setDraft] = useState(initialValue);
  const [makeDefault, setMakeDefault] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDraft(initialValue);
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
    durationSeconds,
    defaults: draft,
  });

  const cancel = () => {
    stopVoicePreview();
    setDraft(initialValue);
    setMakeDefault(false);
    onCancel();
  };

  const confirm = () => {
    if (!selectionAvailable) return;
    stopVoicePreview();
    AnalyticsService.track('session_audio_override_applied', {
      session_type: sessionType,
      duration_seconds: durationSeconds,
      guidance_voice: draft.guidanceVoice,
      background_audio: draft.backgroundAudio,
      source: 'session_override',
      make_default: makeDefault,
    });
    onConfirm(draft, makeDefault);
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
          accessibilityLabel="Close Voice and Sound options"
          onPress={cancel}
          style={styles.backdrop}
        />
        <SafeAreaView style={styles.sheet}>
          <View accessibilityViewIsModal style={styles.sheetContent}>
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>UPCOMING SESSION</Text>
                <Text style={styles.title}>Voice & Sound</Text>
              </View>
              <TouchableOpacity
                accessibilityLabel="Close Voice and Sound options"
                accessibilityRole="button"
                activeOpacity={0.8}
                onPress={cancel}
                style={styles.closeButton}
              >
                <X color={colors.silver} size={19} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <VoiceAndSoundControls
                value={draft}
                onChange={setDraft}
                sessionType={sessionType}
                durationSeconds={durationSeconds}
                showHeading={false}
              />

              <TouchableOpacity
                accessibilityRole="checkbox"
                accessibilityLabel="Make this my new default"
                accessibilityState={{ checked: makeDefault }}
                activeOpacity={0.82}
                onPress={() => setMakeDefault((current) => !current)}
                style={styles.defaultRow}
              >
                <View style={[styles.checkbox, makeDefault && styles.checkboxSelected]}>
                  {makeDefault ? <Check color="#101820" size={14} strokeWidth={3} /> : null}
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

            <View style={styles.actions}>
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.82}
                onPress={cancel}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ disabled: !selectionAvailable }}
                activeOpacity={0.86}
                disabled={!selectionAvailable}
                onPress={confirm}
                style={[styles.confirmButton, !selectionAvailable && styles.disabledButton]}
              >
                <Text style={styles.confirmText}>Apply</Text>
              </TouchableOpacity>
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
};

export const VoiceAndSoundSummaryRow: React.FC<SummaryRowProps> = ({ value, onPress }) => (
  <TouchableOpacity
    accessibilityRole="button"
    accessibilityLabel={`Voice and Sound. ${formatCompactSessionAudioSummary(value)}. Change`}
    activeOpacity={0.84}
    onPress={onPress}
    style={styles.summaryRow}
  >
    <View style={styles.summaryIcon}>
      <SlidersHorizontal color={colors.gold} size={16} />
    </View>
    <View style={styles.summaryCopy}>
      <Text style={styles.summaryTitle}>Voice & Sound</Text>
      <Text style={styles.summaryValue}>{formatCompactSessionAudioSummary(value)}</Text>
    </View>
    <Text style={styles.changeText}>Change</Text>
    <ChevronRight color="rgba(212,175,55,0.72)" size={16} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,8,12,0.72)' },
  sheet: {
    backgroundColor: '#111923',
    borderTopColor: 'rgba(212,175,55,0.28)',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    maxHeight: '90%',
  },
  sheetContent: { maxHeight: '100%' },
  header: {
    alignItems: 'center',
    borderBottomColor: 'rgba(212,175,55,0.1)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 16,
  },
  headerCopy: { gap: 2 },
  eyebrow: { color: 'rgba(212,175,55,0.66)', fontSize: 9, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: '#F2F0EA', fontFamily: typography.fonts.heading, fontSize: 20 },
  closeButton: {
    alignItems: 'center',
    borderColor: 'rgba(192,192,192,0.18)',
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  scrollContent: { padding: spacing.lg, paddingBottom: 16 },
  defaultRow: {
    alignItems: 'flex-start',
    borderColor: 'rgba(212,175,55,0.18)',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    marginTop: spacing.lg,
    minHeight: 64,
    padding: 12,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: 'rgba(192,192,192,0.55)',
    borderRadius: 5,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    marginTop: 1,
    width: 22,
  },
  checkboxSelected: { backgroundColor: colors.gold, borderColor: colors.gold },
  defaultCopy: { flex: 1, gap: 3 },
  defaultTitle: { color: '#F2F0EA', fontSize: 14, fontWeight: '700' },
  defaultDescription: { color: 'rgba(229,229,229,0.58)', fontSize: 12, lineHeight: 17 },
  validationText: { color: '#E5A29A', fontSize: 12, lineHeight: 17, marginTop: 10 },
  actions: {
    borderTopColor: 'rgba(212,175,55,0.1)',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    padding: spacing.lg,
  },
  cancelButton: {
    alignItems: 'center',
    borderColor: 'rgba(192,192,192,0.22)',
    borderRadius: 11,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 50,
  },
  cancelText: { color: colors.silver, fontSize: 14, fontWeight: '700' },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: colors.gold,
    borderRadius: 11,
    flex: 1.25,
    justifyContent: 'center',
    minHeight: 50,
  },
  confirmText: { color: '#101820', fontSize: 14, fontWeight: '800' },
  disabledButton: { opacity: 0.42 },
  summaryRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(16,24,32,0.78)',
    borderColor: 'rgba(212,175,55,0.22)',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 64,
    paddingHorizontal: 12,
    width: '100%',
  },
  summaryIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    marginRight: 10,
    width: 36,
  },
  summaryCopy: { flex: 1, gap: 2 },
  summaryTitle: { color: '#F0EDE5', fontSize: 13, fontWeight: '700' },
  summaryValue: { color: 'rgba(229,229,229,0.58)', fontSize: 12 },
  changeText: { color: colors.gold, fontSize: 12, fontWeight: '700', marginRight: 2 },
});
