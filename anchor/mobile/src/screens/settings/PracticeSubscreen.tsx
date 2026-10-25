import React, { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import {
  GroupLabel,
  GroupRow,
  MinusGlyph,
  PlusGlyph,
  RoundIconButton,
  SettingsGroup,
  SettingsScreenFrame,
  SwitchRow,
  cardTheme,
} from '@/components/settings/SettingsCards';
import { settingsTypography } from '@/components/settings/settingsTheme';
import { AnalyticsService } from '@/services/AnalyticsService';
import { useSettingsStore, type DailyPracticeGoalPreset } from '@/stores/settingsStore';
import { SessionDefaultsPanel } from './SessionDefaultsPanel';
import { ThreadStrengthPanel } from './ThreadStrengthPanel';

interface Props {
  onBack: () => void;
}

type PracticePanel = 'main' | 'session' | 'thread';

const MIN_GOAL = 1;
const MAX_GOAL = 20;

const goalPresetFor = (goal: number): DailyPracticeGoalPreset =>
  goal === 1 ? 'once' : goal === 3 ? 'three' : goal === 5 ? 'five' : 'custom';

export const threadStrengthLabel = (value: string | undefined): string =>
  value === 'lenient' ? 'Lenient' : value === 'strict' ? 'Strict' : 'Balanced';

export const PracticeSubscreen: React.FC<Props> = ({ onBack }) => {
  const [panel, setPanel] = useState<PracticePanel>('main');

  const traceDefaultEnabled = useSettingsStore((s) => s.traceDefaultEnabled ?? true);
  const setTraceDefaultEnabled = useSettingsStore((s) => s.setTraceDefaultEnabled);
  const guideMode = useSettingsStore((s) => s.guideMode ?? true);
  const setGuideMode = useSettingsStore((s) => s.setGuideMode);
  const reduceIntentionVisibility = useSettingsStore((s) => s.reduceIntentionVisibility ?? false);
  const setReduceIntentionVisibility = useSettingsStore((s) => s.setReduceIntentionVisibility);
  const dailyPracticeGoal = useSettingsStore((s) => s.dailyPracticeGoal ?? 1);
  const setDailyPracticeGoal = useSettingsStore((s) => s.setDailyPracticeGoal);
  const setDailyPracticeGoalPreset = useSettingsStore((s) => s.setDailyPracticeGoalPreset);
  const threadStrengthSensitivity = useSettingsStore((s) => s.threadStrengthSensitivity ?? 'balanced');
  const openToPractice = useSettingsStore((s) => s.openDailyAnchorAutomatically);
  const setOpenToPractice = useSettingsStore((s) => s.setOpenDailyAnchorAutomatically);

  // Android hardware back returns from a sub-panel to Practice before leaving Practice.
  useEffect(() => {
    if (panel === 'main') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setPanel('main');
      return true;
    });
    return () => subscription.remove();
  }, [panel]);

  if (panel === 'session') return <SessionDefaultsPanel onBack={() => setPanel('main')} />;
  if (panel === 'thread') return <ThreadStrengthPanel onBack={() => setPanel('main')} />;

  const changeGoal = (delta: number) => {
    const next = Math.max(MIN_GOAL, Math.min(MAX_GOAL, dailyPracticeGoal + delta));
    if (next === dailyPracticeGoal) return;
    setDailyPracticeGoal(next);
    setDailyPracticeGoalPreset(goalPresetFor(next));
  };

  return (
    <SettingsScreenFrame title="Practice" onBack={onBack} testID="practice-settings-screen">
      <GroupLabel first>Your practice</GroupLabel>
      <SettingsGroup>
        <View style={styles.goalRow} testID="settings-row-Daily goal">
          <View style={styles.goalText}>
            <Text style={styles.goalTitle}>Daily goal</Text>
            <Text style={styles.goalSubtitle}>Practice sessions per day</Text>
          </View>
          <View style={styles.stepper}>
            <RoundIconButton
              label="Decrease daily goal"
              onPress={() => changeGoal(-1)}
              disabled={dailyPracticeGoal <= MIN_GOAL}
              testID="practice-goal-decrease"
            >
              <MinusGlyph />
            </RoundIconButton>
            <Text style={styles.goalValue} accessibilityLabel={`${dailyPracticeGoal} per day`}>
              {dailyPracticeGoal}
            </Text>
            <RoundIconButton
              label="Increase daily goal"
              onPress={() => changeGoal(1)}
              disabled={dailyPracticeGoal >= MAX_GOAL}
              testID="practice-goal-increase"
            >
              <PlusGlyph />
            </RoundIconButton>
          </View>
        </View>
        <GroupRow
          title="Thread Strength"
          subtitle="What happens when you miss a day"
          value={threadStrengthLabel(threadStrengthSensitivity)}
          onPress={() => setPanel('thread')}
          testID="settings-row-Thread Strength"
        />
        <GroupRow
          title="Session defaults"
          subtitle="Duration, voice and audio for each mode"
          onPress={() => setPanel('session')}
          testID="settings-row-Session defaults"
        />
      </SettingsGroup>

      <GroupLabel>During practice</GroupLabel>
      <SettingsGroup>
        <SwitchRow
          title="Guide mode"
          subtitle="Show guidance while you create and practice"
          on={guideMode}
          onChange={setGuideMode}
          testID="settings-row-Guide mode"
        />
        <SwitchRow
          title="Hide intention text"
          subtitle="Keep your intention out of sight while you practice"
          on={reduceIntentionVisibility}
          onChange={setReduceIntentionVisibility}
          testID="settings-row-Hide intention text"
        />
        <SwitchRow
          title="Anchor tracing"
          subtitle="Offer to trace your anchor after a session"
          on={traceDefaultEnabled}
          onChange={(value) => {
            setTraceDefaultEnabled(value);
            AnalyticsService.track(value ? 'trace_default_enabled' : 'trace_default_disabled', {
              source: 'settings_practice',
            });
          }}
          testID="settings-row-Anchor tracing"
        />
      </SettingsGroup>

      <GroupLabel>When you open Anchor</GroupLabel>
      <SettingsGroup>
        <SwitchRow
          title="Open to Practice"
          subtitle="Skip Sanctuary and start in Practice"
          on={openToPractice}
          onChange={setOpenToPractice}
          testID="settings-row-Open to Practice"
        />
      </SettingsGroup>
    </SettingsScreenFrame>
  );
};

const styles = StyleSheet.create({
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 66,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  goalText: { flex: 1, minWidth: 0, gap: 2 },
  goalTitle: { fontFamily: settingsTypography.bodySemiBold, fontSize: 16, color: cardTheme.ink },
  goalSubtitle: { fontFamily: settingsTypography.body, fontSize: 14, color: cardTheme.muted },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  goalValue: {
    minWidth: 28,
    textAlign: 'center',
    fontFamily: settingsTypography.bodyBold,
    fontSize: 20,
    color: cardTheme.ink,
  },
});
