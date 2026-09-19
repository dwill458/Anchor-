import React, { useEffect, useState } from 'react';
import {
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { T, settingsTypography, practiceSettingsTheme } from '@/components/settings/settingsTheme';
import {
  CompactPickerSheet,
  SectionLabel,
  SettingsChip,
  SettingsHeader,
  SettingsRow,
  SettingsToggleRow,
} from '@/components/settings/SettingsPrimitives';
import {
  useSettingsStore,
  type DailyPracticeGoalPreset,
  type ThreadStrengthSensitivity,
} from '@/stores/settingsStore';
import { useProfileStore, TIMEZONE_OPTIONS } from '@/stores/profileStore';
import { useAuthStore } from '@/stores/authStore';
import { updateUserSettings } from '@/services/ApiClient';
import { AnalyticsService } from '@/services/AnalyticsService';
import {
  getActivePreviewVoice,
  startVoicePreview,
  stopVoicePreview,
  subscribeToVoicePreview,
} from '@/services/VoicePreviewService';
import {
  DEFAULT_SESSION_AUDIO_DEFAULTS,
  type BackgroundAudioMode,
  type GuidanceVoice,
  type SessionAudioSessionType,
} from '@/types/sessionAudio';
import { logger } from '@/utils/logger';

interface Props {
  onBack: () => void;
}

type PracticePanel = 'main' | 'session' | 'goal' | 'thread';

const PD_MODES = [
  {
    id: 'focus' as const,
    name: 'Focus',
    themeKey: 'focus' as const,
    durations: ['10 sec', '30 sec', '1 min'],
    values: [10, 30, 60] as const,
  },
  {
    id: 'deep_prime' as const,
    name: 'Deep Prime',
    themeKey: 'deepPrime' as const,
    durations: ['2 min', '5 min', '10 min'],
    values: [120, 300, 600] as const,
  },
  {
    id: 'visualize' as const,
    name: 'Visualize',
    themeKey: 'visualize' as const,
    durations: ['1 min', '3 min', '5 min'],
    values: [60, 180, 300] as const,
  },
] as const;

const PD_VOICES: Array<{
  id: GuidanceVoice;
  label: string;
  desc: string;
  preview: boolean;
}> = [
  { id: 'female', label: 'Female Voice', desc: 'Warm, calm guidance', preview: true },
  { id: 'male', label: 'Male Voice', desc: 'Grounded, steady guidance', preview: true },
  { id: 'none', label: 'No Voice', desc: 'Visual and haptic guidance only', preview: false },
];

const PD_THREAD = {
  lenient: {
    days: ['done', 'done', 'done', 'safe', 'safe', 'done', 'done'],
    desc: 'Missing up to 2 days does not thin your thread. Decay is gradual.',
  },
  balanced: {
    days: ['done', 'done', 'done', 'safe', 'decay', 'done', 'done'],
    desc: 'One missed day pauses your thread. Two in a row begins decay.',
  },
  strict: {
    days: ['done', 'done', 'done', 'decay', 'decay', 'done', 'done'],
    desc: 'Any missed day begins decay.',
  },
} as const;

export const PracticeSubscreen: React.FC<Props> = ({ onBack }) => {
  const [panel, setPanel] = useState<PracticePanel>('main');
  const [activeModeTab, setActiveModeTab] = useState<SessionAudioSessionType>('focus');
  const [activePreviewVoice, setActivePreviewVoice] = useState<string | null>(getActivePreviewVoice());
  const [timezonePickerOpen, setTimezonePickerOpen] = useState(false);

  // Store bindings - Session & Practice
  const traceDefaultEnabled = useSettingsStore((s) => s.traceDefaultEnabled ?? true);
  const setTraceDefaultEnabled = useSettingsStore((s) => s.setTraceDefaultEnabled);
  const guideMode = useSettingsStore((s) => s.guideMode ?? true);
  const setGuideMode = useSettingsStore((s) => s.setGuideMode);
  const reduceIntentionVisibility = useSettingsStore((s) => s.reduceIntentionVisibility ?? false);
  const setReduceIntentionVisibility = useSettingsStore((s) => s.setReduceIntentionVisibility);
  const dailyPracticeGoal = useSettingsStore((s) => s.dailyPracticeGoal ?? 1);
  const dailyPracticeGoalPreset = useSettingsStore((s) => s.dailyPracticeGoalPreset ?? 'once');
  const setDailyPracticeGoal = useSettingsStore((s) => s.setDailyPracticeGoal);
  const setDailyPracticeGoalPreset = useSettingsStore((s) => s.setDailyPracticeGoalPreset);
  const threadStrengthSensitivity = useSettingsStore((s) => s.threadStrengthSensitivity ?? 'balanced');
  const setThreadStrengthSensitivity = useSettingsStore((s) => s.setThreadStrengthSensitivity);

  // Session duration stores
  const focusSessionDuration = useSettingsStore((s) => s.focusSessionDuration ?? 30);
  const setFocusSessionDuration = useSettingsStore((s) => s.setFocusSessionDuration);
  const primeSessionDuration = useSettingsStore((s) => s.primeSessionDuration ?? 300);
  const setPrimeSessionDuration = useSettingsStore((s) => s.setPrimeSessionDuration);
  const visualizeSessionDuration = useSettingsStore((s) => s.visualizeSessionDuration ?? 180);
  const setVisualizeSessionDuration = useSettingsStore((s) => s.setVisualizeSessionDuration);
  const setLastSessionDuration = useSettingsStore((s) => s.setLastSessionDuration);

  // Audio & Voice defaults per practice mode
  const sessionAudioDefaults = useSettingsStore((s) => s.sessionAudioDefaults ?? DEFAULT_SESSION_AUDIO_DEFAULTS);
  const setSessionAudioDefaults = useSettingsStore((s) => s.setSessionAudioDefaults);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { timezone, updateProfile } = useProfileStore();

  // Voice preview subscription
  useEffect(() => {
    const unsubscribe = subscribeToVoicePreview(setActivePreviewVoice);
    return () => {
      unsubscribe();
      stopVoicePreview();
    };
  }, []);

  // Handle Android hardware back: return from sub-panel to main Practice panel
  useEffect(() => {
    if (panel === 'main') return;
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      setPanel('main');
      return true;
    });
    return () => backHandler.remove();
  }, [panel]);

  const handleVoicePreview = async (voiceId: 'female' | 'male') => {
    if (activePreviewVoice === voiceId) {
      stopVoicePreview();
      return;
    }
    await startVoicePreview(voiceId);
  };

  const getGoalLabel = () => {
    if (dailyPracticeGoalPreset === 'once') return '1 / day';
    if (dailyPracticeGoalPreset === 'three') return '3 / day';
    if (dailyPracticeGoalPreset === 'five') return '5 / day';
    return `${dailyPracticeGoal} / day`;
  };

  const getThreadLabel = () => {
    if (threadStrengthSensitivity === 'lenient') return 'Lenient';
    if (threadStrengthSensitivity === 'strict') return 'Strict';
    return 'Balanced';
  };

  /* ── Panel: Session Defaults ── */
  if (panel === 'session') {
    const activeMode = PD_MODES.find((m) => m.id === activeModeTab) ?? PD_MODES[0];
    const activeTheme = practiceSettingsTheme[activeMode.themeKey];
    const currentModeDefaults = sessionAudioDefaults[activeModeTab] ?? DEFAULT_SESSION_AUDIO_DEFAULTS[activeModeTab];

    const rawDurationSeconds =
      activeModeTab === 'focus'
        ? focusSessionDuration
        : activeModeTab === 'deep_prime'
          ? primeSessionDuration
          : visualizeSessionDuration;

    const currentDurationSeconds = (activeMode.values as readonly number[]).includes(rawDurationSeconds)
      ? rawDurationSeconds
      : activeMode.values[1];

    const setDuration = (val: number) => {
      if (activeModeTab === 'focus') {
        setFocusSessionDuration(val);
        setLastSessionDuration?.('focus', val);
      } else if (activeModeTab === 'deep_prime') {
        setPrimeSessionDuration(val);
        setLastSessionDuration?.('deep_prime', val);
      } else {
        setVisualizeSessionDuration(val as 60 | 180 | 300);
        setLastSessionDuration?.('visualize', val as 60 | 180 | 300);
      }
    };

    const handleSelectVoice = (voice: GuidanceVoice) => {
      setSessionAudioDefaults(activeModeTab, {
        ...currentModeDefaults,
        guidanceVoice: voice,
      });
    };

    const handleSelectAudioMode = (mode: BackgroundAudioMode) => {
      setSessionAudioDefaults(activeModeTab, {
        ...currentModeDefaults,
        backgroundAudio: mode,
      });
    };

    const handleSaveDefaults = () => {
      stopVoicePreview();
      if (isAuthenticated) {
        void updateUserSettings({
          focusSessionDuration,
          primeSessionDuration,
          visualizeSessionDuration,
          sessionAudioDefaults,
        }).catch((error) => {
          logger.warn('[PracticeSubscreen] Failed to sync session defaults remotely', error);
        });
      }
      setPanel('main');
    };

    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <SettingsHeader
            title="Session defaults"
            onBack={handleSaveDefaults}
          />
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Semantic Mode Switcher Tabs */}
            <View style={styles.modeTabContainer} accessibilityRole="tablist">
              {PD_MODES.map((m) => {
                const isSelected = activeModeTab === m.id;
                const modeTheme = practiceSettingsTheme[m.themeKey];
                return (
                  <TouchableOpacity
                    key={m.id}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${m.name} mode`}
                    onPress={() => {
                      stopVoicePreview();
                      setActiveModeTab(m.id);
                    }}
                    style={[
                      styles.modeTab,
                      isSelected
                        ? {
                            backgroundColor: modeTheme.tint,
                            borderColor: modeTheme.borderSelected,
                            borderWidth: 1.5,
                          }
                        : {
                            backgroundColor: T.surface,
                            borderColor: T.line,
                            borderWidth: StyleSheet.hairlineWidth,
                          },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.modeTabText,
                        isSelected
                          ? {
                              color: modeTheme.ink,
                              fontFamily: settingsTypography.bodyBold,
                            }
                          : {
                              color: T.ink2,
                              fontFamily: settingsTypography.bodyMedium,
                            },
                      ]}
                    >
                      {m.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Duration Group with Semantic Tint */}
            <SectionLabel first>Duration</SectionLabel>
            <View style={styles.chipGrid}>
              {activeMode.durations.map((dur, i) => {
                const val = activeMode.values[i];
                const isSelected = currentDurationSeconds === val;
                return (
                  <SettingsChip
                    key={dur}
                    label={dur}
                    selected={isSelected}
                    onPress={() => setDuration(val)}
                    activeColor={{
                      tint: activeTheme.tint,
                      border: activeTheme.borderSelected,
                      ink: activeTheme.ink,
                    }}
                    wide
                  />
                );
              })}
            </View>

            {/* Guidance Voice Group - Controlled Radio Group */}
            <SectionLabel>Guidance Voice</SectionLabel>
            <View style={styles.voiceCard} accessibilityRole="radiogroup">
              {PD_VOICES.map((v) => {
                const isSelected = currentModeDefaults.guidanceVoice === v.id;
                const isPreviewPlaying = activePreviewVoice === v.id;
                return (
                  <View key={v.id} style={styles.voiceRow}>
                    <TouchableOpacity
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`${v.label}. ${v.desc}`}
                      onPress={() => handleSelectVoice(v.id)}
                      style={styles.voiceInfo}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.radioCircle,
                          isSelected && {
                            borderColor: activeTheme.borderSelected,
                            borderWidth: 2,
                          },
                        ]}
                      >
                        {isSelected ? (
                          <View
                            style={[
                              styles.radioDot,
                              { backgroundColor: activeTheme.accent },
                            ]}
                          />
                        ) : null}
                      </View>
                      <View style={styles.voiceTextGroup}>
                        <Text
                          style={[
                            styles.voiceTitle,
                            isSelected && {
                              color: activeTheme.ink,
                              fontFamily: settingsTypography.bodyBold,
                            },
                          ]}
                        >
                          {v.label}
                        </Text>
                        <Text style={styles.voiceDesc}>{v.desc}</Text>
                      </View>
                    </TouchableOpacity>

                    {v.preview ? (
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`Preview ${v.label}`}
                        onPress={() => void handleVoicePreview(v.id as 'female' | 'male')}
                        style={[
                          styles.previewBtn,
                          isPreviewPlaying && {
                            borderColor: activeTheme.borderSelected,
                            backgroundColor: activeTheme.tint,
                          },
                        ]}
                        activeOpacity={0.65}
                      >
                        <Text
                          style={[
                            styles.previewBtnText,
                            isPreviewPlaying && { color: activeTheme.ink, fontFamily: settingsTypography.bodyBold },
                          ]}
                        >
                          {isPreviewPlaying ? 'Playing…' : 'Preview'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })}
            </View>

            {/* Audio Group - Mutually Exclusive Ambient vs Silence */}
            <SectionLabel>Audio</SectionLabel>
            <View style={styles.chipRow}>
              <SettingsChip
                label="Ambient"
                selected={currentModeDefaults.backgroundAudio === 'ambient'}
                onPress={() => handleSelectAudioMode('ambient')}
                activeColor={{
                  tint: activeTheme.tint,
                  border: activeTheme.borderSelected,
                  ink: activeTheme.ink,
                }}
                wide
              />
              <SettingsChip
                label="Silence"
                selected={currentModeDefaults.backgroundAudio === 'off'}
                onPress={() => handleSelectAudioMode('off')}
                activeColor={{
                  tint: activeTheme.tint,
                  border: activeTheme.borderSelected,
                  ink: activeTheme.ink,
                }}
                wide
              />
            </View>

            <Text style={styles.helperText}>
              Each practice mode keeps its own defaults. Changing {activeMode.name} does not affect other modes.
            </Text>
          </ScrollView>

          <View style={styles.bottomBar}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Save defaults"
              onPress={handleSaveDefaults}
              style={styles.primaryButton}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>Save defaults</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  /* ── Panel: Daily Practice Goal ── */
  if (panel === 'goal') {
    const handleSetPreset = (preset: DailyPracticeGoalPreset, goalVal: number) => {
      setDailyPracticeGoalPreset(preset);
      if (preset !== 'custom') {
        setDailyPracticeGoal(goalVal);
      }
    };

    const handleCustomChange = (delta: number) => {
      const next = Math.max(1, Math.min(20, dailyPracticeGoal + delta));
      setDailyPracticeGoal(next);
      setDailyPracticeGoalPreset('custom');
    };

    const handleSaveGoal = () => {
      setPanel('main');
    };

    const options: Array<{ preset: DailyPracticeGoalPreset; goal: number; label: string; desc: string; tag?: string }> = [
      { preset: 'once', goal: 1, label: 'Once', desc: 'Once a day', tag: 'Recommended' },
      { preset: 'three', goal: 3, label: 'Three', desc: 'Three times a day' },
      { preset: 'five', goal: 5, label: 'Five', desc: 'Five times a day' },
      { preset: 'custom', goal: dailyPracticeGoal, label: 'Custom', desc: 'Set your own target' },
    ];

    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <SettingsHeader title="Daily practice goal" onBack={handleSaveGoal} />
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.subheadText}>Choose how many practices you'd like to complete each day.</Text>

            <View style={styles.optionsGroup} accessibilityRole="radiogroup">
              {options.map((opt) => {
                const isSelected = dailyPracticeGoalPreset === opt.preset;
                const fullLabel = [opt.label, opt.tag, opt.desc].filter(Boolean).join(', ');
                return (
                  <View key={opt.preset} style={styles.optionBlock}>
                    <TouchableOpacity
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={opt.label}
                      accessibilityHint={opt.desc}
                      onPress={() => handleSetPreset(opt.preset, opt.preset === 'custom' ? dailyPracticeGoal : opt.goal)}
                      style={styles.optionRow}
                      activeOpacity={0.65}
                    >
                      <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                        {isSelected ? <View style={styles.radioDot} /> : null}
                      </View>
                      <View style={styles.optionCopy}>
                        <View style={styles.optionTitleRow}>
                          <Text style={[styles.optionTitle, isSelected && styles.optionTitleSelected]}>
                            {opt.label}
                          </Text>
                          {opt.tag ? (
                            <View style={styles.tagBadge}>
                              <Text style={styles.tagBadgeText}>{opt.tag}</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.optionDesc}>{opt.desc}</Text>
                      </View>
                    </TouchableOpacity>

                    {opt.preset === 'custom' && isSelected ? (
                      <View style={styles.stepperContainer}>
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel="Decrease custom goal"
                          accessibilityState={{ disabled: dailyPracticeGoal <= 1 }}
                          disabled={dailyPracticeGoal <= 1}
                          onPress={() => handleCustomChange(-1)}
                          style={[styles.stepperBtn, dailyPracticeGoal <= 1 && styles.stepperBtnDisabled]}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.stepperSymbol, dailyPracticeGoal <= 1 && styles.stepperSymbolDisabled]}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.stepperValue}>{dailyPracticeGoal}</Text>
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel="Increase custom goal"
                          accessibilityState={{ disabled: dailyPracticeGoal >= 20 }}
                          disabled={dailyPracticeGoal >= 20}
                          onPress={() => handleCustomChange(1)}
                          style={[styles.stepperBtn, dailyPracticeGoal >= 20 && styles.stepperBtnDisabled]}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.stepperSymbol, dailyPracticeGoal >= 20 && styles.stepperSymbolDisabled]}>+</Text>
                        </TouchableOpacity>
                        <Text style={styles.stepperLimit}>{dailyPracticeGoal} of 20</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>

            <Text style={styles.helperText}>Focus sessions count toward your daily goal.</Text>
          </ScrollView>

          <View style={styles.bottomBar}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Save goal"
              onPress={handleSaveGoal}
              style={styles.primaryButton}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>Save goal</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  /* ── Panel: Thread Strength Behavior ── */
  if (panel === 'thread') {
    const threadOptions: Array<{ id: ThreadStrengthSensitivity; label: string; desc: string }> = [
      { id: 'lenient', label: 'Lenient', desc: PD_THREAD.lenient.desc },
      { id: 'balanced', label: 'Balanced', desc: PD_THREAD.balanced.desc },
      { id: 'strict', label: 'Strict', desc: PD_THREAD.strict.desc },
    ];

    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <SettingsHeader title="Thread Strength" onBack={() => setPanel('main')} />
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.subheadText}>Choose how missed days affect strength.</Text>

            {/* Legend */}
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.dayDot, styles.dayDotDone]} />
                <Text style={styles.legendText}>Practiced</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.dayDot, styles.dayDotSafe]} />
                <Text style={styles.legendText}>Missed, no effect</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.dayDot, styles.dayDotDecay]} />
                <Text style={styles.legendText}>Decaying</Text>
              </View>
            </View>

            <View style={styles.optionsGroup} accessibilityRole="radiogroup">
              {threadOptions.map((opt) => {
                const isSelected = threadStrengthSensitivity === opt.id;
                const days = PD_THREAD[opt.id].days;
                return (
                  <View key={opt.id} style={styles.optionBlock}>
                    <TouchableOpacity
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={opt.label}
                      accessibilityHint={opt.desc}
                      onPress={() => setThreadStrengthSensitivity(opt.id)}
                      style={styles.optionRow}
                      activeOpacity={0.65}
                    >
                      <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                        {isSelected ? <View style={styles.radioDot} /> : null}
                      </View>
                      <View style={styles.optionCopy}>
                        <Text style={[styles.optionTitle, isSelected && styles.optionTitleSelected]}>
                          {opt.label}
                        </Text>
                        <Text style={styles.optionDesc}>{opt.desc}</Text>
                      </View>
                    </TouchableOpacity>

                    <View style={styles.dotsRow}>
                      {days.map((dayState, i) => (
                        <View
                          key={i}
                          style={[
                            styles.dayDot,
                            dayState === 'done'
                              ? styles.dayDotDone
                              : dayState === 'safe'
                                ? styles.dayDotSafe
                                : styles.dayDotDecay,
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.bottomBar}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Save"
              onPress={() => setPanel('main')}
              style={styles.primaryButton}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  /* ── Main Practice Hub Screen ── */
  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <SettingsHeader title="Practice" onBack={onBack} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <SectionLabel first>Session</SectionLabel>
          <SettingsRow
            label="Session defaults"
            desc="Defaults for each practice mode"
            onPress={() => setPanel('session')}
          />
          <SettingsRow
            label="Daily practice goal"
            desc="Your daily practice target"
            value={getGoalLabel()}
            onPress={() => setPanel('goal')}
          />
          <SettingsRow
            label="Thread Strength behavior"
            desc="How missed days affect strength"
            value={getThreadLabel()}
            onPress={() => setPanel('thread')}
          />

          <SectionLabel>Practice Behavior</SectionLabel>
          <SettingsToggleRow
            label="Guide Mode"
            desc="Show guidance while creating and practicing"
            on={guideMode}
            onToggle={(val) => setGuideMode(val)}
            testID="settings-row-Guide Mode"
          />
          <SettingsToggleRow
            label="Hide Intention Text"
            desc="Hide intention text during practice"
            on={reduceIntentionVisibility}
            onToggle={(val) => setReduceIntentionVisibility(val)}
            testID="settings-row-Hide Intention Text"
          />
          <SettingsToggleRow
            label="Anchor Tracing"
            desc="Offer tracing after supported practices"
            on={traceDefaultEnabled}
            onToggle={(val) => {
              setTraceDefaultEnabled(val);
              AnalyticsService.track(val ? 'trace_default_enabled' : 'trace_default_disabled', {
                source: 'settings_practice',
              });
            }}
            testID="settings-row-Anchor Tracing"
          />

          <SectionLabel>Local Time</SectionLabel>
          <SettingsRow
            label="Timezone"
            value={timezone || 'Auto-detected'}
            onPress={() => setTimezonePickerOpen(true)}
            showDivider={false}
          />
        </ScrollView>
      </SafeAreaView>

      <CompactPickerSheet
        open={timezonePickerOpen}
        title="Timezone"
        options={TIMEZONE_OPTIONS.map((tz) => ({ label: tz, value: tz }))}
        value={timezone}
        onPick={(val) => updateProfile({ timezone: val })}
        onClose={() => setTimezonePickerOpen(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.bg,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingBottom: 40,
  },
  modeTabContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  modeTab: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  modeTabText: {
    fontSize: 14,
    letterSpacing: -0.1,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  voiceCard: {
    backgroundColor: T.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.line,
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.line,
  },
  voiceInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: T.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: T.ink,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: T.ink,
  },
  voiceTextGroup: {
    gap: 2,
  },
  voiceTitle: {
    fontFamily: settingsTypography.bodyMedium,
    fontSize: 15.5,
    color: T.ink,
  },
  voiceDesc: {
    fontFamily: settingsTypography.body,
    fontSize: 12.5,
    color: T.ink3,
  },
  previewBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.line,
  },
  previewBtnText: {
    fontFamily: settingsTypography.bodySemiBold,
    fontSize: 12.5,
    color: T.ink2,
  },
  helperText: {
    fontFamily: settingsTypography.body,
    fontSize: 12.5,
    color: T.ink3,
    lineHeight: 18,
    marginTop: 26,
  },
  subheadText: {
    fontFamily: settingsTypography.body,
    fontSize: 14.5,
    color: T.ink2,
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 8,
  },
  optionsGroup: {
    marginTop: 12,
  },
  optionBlock: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.line,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  optionCopy: {
    flex: 1,
    gap: 3,
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionTitle: {
    fontFamily: settingsTypography.bodyMedium,
    fontSize: 15.5,
    color: T.ink,
  },
  optionTitleSelected: {
    fontFamily: settingsTypography.bodyBold,
  },
  tagBadge: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: T.line,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagBadgeText: {
    fontFamily: settingsTypography.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    color: T.ink2,
  },
  optionDesc: {
    fontFamily: settingsTypography.body,
    fontSize: 12.5,
    color: T.ink3,
    lineHeight: 17,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingLeft: 32,
    paddingTop: 12,
  },
  stepperBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: T.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.35,
    borderColor: T.line,
  },
  stepperSymbol: {
    fontSize: 18,
    color: T.ink,
    lineHeight: 20,
  },
  stepperSymbolDisabled: {
    color: T.ink3,
  },
  stepperValue: {
    fontFamily: settingsTypography.displayBold,
    fontSize: 20,
    color: T.ink,
    minWidth: 28,
    textAlign: 'center',
  },
  stepperLimit: {
    fontFamily: settingsTypography.body,
    fontSize: 12.5,
    color: T.ink3,
    marginLeft: 'auto',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendText: {
    fontFamily: settingsTypography.body,
    fontSize: 11.5,
    color: T.ink3,
  },
  dayDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },
  dayDotDone: {
    backgroundColor: T.ink,
    borderWidth: 1.5,
    borderColor: T.ink,
  },
  dayDotSafe: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: T.ink3,
  },
  dayDotDecay: {
    backgroundColor: T.danger,
    borderWidth: 1.5,
    borderColor: T.danger,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingLeft: 32,
    paddingTop: 10,
  },
  bottomBar: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.line,
    backgroundColor: T.bg,
  },
  primaryButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: T.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: settingsTypography.bodyBold,
    fontSize: 16,
    color: T.surface,
  },
});
