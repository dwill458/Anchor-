import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Anchor } from 'lucide-react-native';
import { V2SheetModal, V2_SHEET_SKIRT } from '@/components/v2/primitives/V2SheetModal';
import { TimeWheel } from '@/components/v2/notifications/TimeWheel';
import NotificationService from '@/services/NotificationService';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import {
  dayChips,
  deviceUses24HourClock,
  formatPlanTime,
  hasPlan,
  planSavedToast,
  reminderBody,
} from '@/adapters/v2/chart/movePlan';
import type { MovePlanInput, MoveSummary } from '@/types/chart';
import { CHART_MAP_TOKENS as T } from '../map/chartMapTokens';
import { PanelButton } from './ChartPanelCards';
import type { PanelAccent } from './chartPanelColors';

const COPY = CHART_COPY.plan;
const CUE_MAX = 60;
const DEFAULT_TIMES = ['08:00', '12:30', '18:00', '21:00'];

type Props = {
  visible: boolean;
  move: MoveSummary;
  /** Every Move on this Chart: earlier cues and times become chips. */
  chartMoves: readonly MoveSummary[];
  accent: PanelAccent;
  reducedMotion: boolean;
  busy?: boolean;
  now?: Date;
  /** 24-hour labels; defaults to the device's clock style. */
  use24h?: boolean;
  /** Saves the plan (`null` clears it). Resolves true once the server has it. */
  onSave: (plan: MovePlanInput | null) => Promise<boolean>;
  /** Closes after a save with the toast text, or without one when dismissed. */
  onClose: (savedToast?: string) => void;
  /** Injectable for tests; production uses the existing NotificationService request. */
  requestPermission?: () => Promise<boolean>;
};

const byNewest = (a: MoveSummary, b: MoveSummary) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '');

function uniqueBy(values: Array<string | null | undefined>, limit: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const text = value?.replace(/\s+/g, ' ').trim();
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

/** Cue chips: this move's cue, cues on other moves (newest first), then the defaults. At most 5. */
export function planCueOptions(move: MoveSummary, chartMoves: readonly MoveSummary[]): string[] {
  const others = chartMoves.filter((item) => item.id !== move.id).sort(byNewest).map((item) => item.plan?.cue);
  return uniqueBy([move.plan?.cue, ...others, ...COPY.cueDefaults], 5);
}

/** Time chips: this move's time, the latest other time on this Chart, then four defaults. At most 5. */
export function planTimeOptions(move: MoveSummary, chartMoves: readonly MoveSummary[]): string[] {
  const latestOther = chartMoves.filter((item) => item.id !== move.id && item.plan?.time).sort(byNewest)[0]?.plan?.time;
  return uniqueBy([move.plan?.time, latestOther, ...DEFAULT_TIMES], 5);
}

function Chip({ label, selected, disabled, onPress, testID, dashed }: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
  testID?: string;
  dashed?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="togglebutton"
      accessibilityLabel={label}
      accessibilityState={{ selected: Boolean(selected), checked: Boolean(selected), disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        dashed && styles.chipDashed,
        selected && styles.chipSelected,
        disabled && styles.chipDisabled,
        pressed && !disabled && { opacity: 0.8 },
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

/** "When will you do it?" A cue, a day, a time and an optional reminder for one Move. */
export function ChartMovePlanSheet({
  visible, move, chartMoves, accent, reducedMotion, busy = false, now: nowProp, use24h: use24hProp,
  onSave, onClose, requestPermission = () => NotificationService.requestPermissions(),
}: Props) {
  const now = useMemo(() => nowProp ?? new Date(), [nowProp, visible]);
  const use24h = use24hProp ?? deviceUses24HourClock();
  const days = useMemo(() => dayChips(now), [now]);
  const cueOptions = useMemo(() => planCueOptions(move, chartMoves), [move, chartMoves]);
  const timeOptions = useMemo(() => planTimeOptions(move, chartMoves), [move, chartMoves]);

  const [cue, setCue] = useState<string | null>(null);
  const [writingOwn, setWritingOwn] = useState(false);
  const [ownCue, setOwnCue] = useState('');
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [otherTime, setOtherTime] = useState(false);
  const [remind, setRemind] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const requesting = useRef(false);

  // Preselect the current plan each time the sheet opens. A Move with no plan starts on the first cue only.
  useEffect(() => {
    if (!visible) return;
    const plan = move.plan;
    const planned = hasPlan(plan);
    const knownDate = plan?.date && days.some((day) => day.date === plan.date) ? plan.date : null;
    setCue(planned ? plan!.cue ?? null : cueOptions[0] ?? null);
    setWritingOwn(false);
    setOwnCue('');
    setDate(knownDate);
    setTime(knownDate ? plan?.time ?? null : null);
    setOtherTime(Boolean(knownDate && plan?.time && !timeOptions.includes(plan.time)));
    setRemind(Boolean(knownDate && plan?.time && plan?.remind));
    setDenied(false);
    setError(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, move.id]);

  const effectiveCue = writingOwn ? ownCue.replace(/\s+/g, ' ').trim() || null : cue;
  const ownCueInvalid = writingOwn && (!effectiveCue || effectiveCue.length > CUE_MAX);
  const canRemind = Boolean(date && time);
  const remindOn = remind && canRemind;

  const pickDay = (value: string) => {
    if (date === value) {
      setDate(null);
      setTime(null);
      setOtherTime(false);
      setRemind(false);
    } else setDate(value);
  };
  const pickTime = (value: string | null) => {
    setOtherTime(false);
    setTime(value);
    if (!value) setRemind(false);
  };
  const toggleRemind = async (next: boolean) => {
    if (!next) {
      setRemind(false);
      return;
    }
    if (!canRemind || requesting.current) return;
    requesting.current = true;
    setRemind(true);
    try {
      const granted = await requestPermission();
      setDenied(!granted);
      if (!granted) setRemind(false);
    } catch {
      setDenied(true);
      setRemind(false);
    } finally {
      requesting.current = false;
    }
  };

  const save = async () => {
    if (saving || busy || ownCueInvalid) return;
    setSaving(true);
    setError(false);
    const plan = { cue: effectiveCue, date, time: date ? time : null, remind: remindOn };
    try {
      const ok = await onSave(plan);
      if (ok) onClose(planSavedToast(plan, now, use24h));
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    if (saving || busy) return;
    setSaving(true);
    setError(false);
    try {
      const ok = await onSave(null);
      if (ok) onClose();
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  const previewTime = time ? formatPlanTime(time, use24h) : '';
  const helper = denied ? COPY.remindDenied : !canRemind ? COPY.remindNeedsTime : null;

  return (
    <V2SheetModal visible={visible} onClose={() => onClose()} reduceMotion={reducedMotion} scrimColor="rgba(5, 8, 11, 0.6)" testID="chart-move-plan-sheet">
      <View style={styles.sheet} accessibilityViewIsModal>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" bounces={false}>
          <Text accessibilityRole="header" style={styles.title}>{COPY.sheetTitle}</Text>
          <Text style={styles.moveTitle} testID="chart-move-plan-move">{move.title}</Text>

          <View style={styles.group}>
            <Text style={styles.label}>{COPY.cueLabel}</Text>
            <View style={styles.chips}>
              {cueOptions.map((option) => (
                <Chip key={option} label={option} selected={!writingOwn && cue === option} onPress={() => { setWritingOwn(false); setCue(cue === option ? null : option); }} testID={`chart-plan-cue-${option}`} />
              ))}
              <Chip label={COPY.writeOwn} dashed selected={writingOwn} onPress={() => setWritingOwn(true)} testID="chart-plan-cue-own" />
            </View>
            {writingOwn ? (
              <TextInput
                testID="chart-plan-cue-input"
                value={ownCue}
                onChangeText={setOwnCue}
                maxLength={CUE_MAX}
                autoFocus
                returnKeyType="done"
                placeholder={COPY.cueDefaults[0]}
                placeholderTextColor="#6d7885"
                accessibilityLabel={COPY.writeOwn}
                style={styles.input}
              />
            ) : null}
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>{COPY.dayLabel}</Text>
            <View style={styles.chips}>
              {days.map((day) => (
                <Chip key={day.date} label={day.label} selected={date === day.date} onPress={() => pickDay(day.date)} testID={`chart-plan-day-${day.label}`} />
              ))}
            </View>
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>{COPY.timeLabel}</Text>
            <View style={styles.chips}>
              {timeOptions.map((option) => (
                <Chip key={option} label={formatPlanTime(option, use24h)} disabled={!date} selected={Boolean(date) && !otherTime && time === option} onPress={() => pickTime(option)} testID={`chart-plan-time-${option}`} />
              ))}
              <Chip label={otherTime && time ? `${COPY.otherTime} · ${previewTime}` : COPY.otherTime} disabled={!date} selected={Boolean(date) && otherTime} onPress={() => { setOtherTime(true); setTime(time ?? '09:00'); }} testID="chart-plan-time-other" />
              <Chip label={COPY.noTime} disabled={!date} selected={Boolean(date) && !otherTime && time === null} onPress={() => pickTime(null)} testID="chart-plan-time-none" />
            </View>
            {date && otherTime ? (
              <View style={styles.wheel} testID="chart-plan-time-wheel">
                <TimeWheel value={time ?? '09:00'} onChange={setTime} use24h={use24h} />
              </View>
            ) : null}
          </View>

          <View style={styles.remindRow}>
            <View style={styles.remindText}>
              <Text style={styles.remindLabel}>{COPY.remind}</Text>
              {helper ? <Text style={styles.helper} testID="chart-plan-remind-helper">{helper}</Text> : null}
            </View>
            <Switch
              testID="chart-plan-remind"
              accessibilityRole="switch"
              accessibilityLabel={COPY.remind}
              accessibilityState={{ checked: remindOn, disabled: !canRemind }}
              value={remindOn}
              disabled={!canRemind}
              onValueChange={(next) => void toggleRemind(next)}
              trackColor={{ false: '#3a4553', true: accent.fill }}
              thumbColor="#ffffff"
            />
          </View>

          {remindOn ? (
            <View style={styles.push} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="chart-plan-push-preview">
              <View style={styles.pushIcon}><Anchor size={15} color="#E9DDE6" strokeWidth={2} /></View>
              <View style={styles.pushText}>
                <Text style={styles.pushTitle}>{`Anchor · ${previewTime}`}</Text>
                <Text style={styles.pushBody}>{reminderBody(effectiveCue, move.title)}</Text>
              </View>
            </View>
          ) : null}

          {error ? <Text accessibilityLiveRegion="polite" style={styles.error} testID="chart-plan-error">{COPY.error}</Text> : null}
          <PanelButton label={COPY.save} variant="primary" accent={accent} loading={saving || busy} disabled={ownCueInvalid} onPress={() => void save()} testID="chart-plan-save" style={styles.primary} />
          {hasPlan(move.plan) ? (
            <PanelButton label={COPY.clear} variant="link" accent={accent} disabled={saving || busy} onPress={() => void clear()} testID="chart-plan-clear" style={styles.clear} />
          ) : null}
        </ScrollView>
      </View>
    </V2SheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: T.panel,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderTopColor: T.line,
    paddingBottom: V2_SHEET_SKIRT,
    marginBottom: -V2_SHEET_SKIRT,
    flexShrink: 1,
  },
  content: { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 22, gap: 14 },
  title: { fontFamily: T.serif, fontSize: 26, lineHeight: 29, color: T.light },
  moveTitle: { marginTop: -8, fontFamily: T.sans, fontSize: 14, lineHeight: 20, color: T.muted },
  group: { gap: 8 },
  label: { fontFamily: T.sansStrong, fontSize: 10.5, lineHeight: 14, letterSpacing: 1.6, color: T.muted, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, backgroundColor: '#202a36', borderWidth: 1, borderColor: 'transparent', maxWidth: '100%' },
  chipDashed: { borderStyle: 'dashed', borderColor: '#5d6977', backgroundColor: 'transparent' },
  chipSelected: { backgroundColor: 'rgba(239,234,223,.10)', borderColor: T.light, borderStyle: 'solid' },
  chipDisabled: { opacity: 0.38 },
  chipText: { fontFamily: T.sansStrong, fontSize: 13.5, lineHeight: 18, color: T.light, flexShrink: 1 },
  chipTextSelected: { color: '#ffffff' },
  input: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: T.line, backgroundColor: '#0d1319', color: T.light, fontFamily: T.sans, fontSize: 15, paddingHorizontal: 12, paddingVertical: 10 },
  wheel: { alignSelf: 'stretch' },
  remindRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
  remindText: { flex: 1, minWidth: 0 },
  remindLabel: { fontFamily: T.sansStrong, fontSize: 14.5, lineHeight: 20, color: T.light },
  helper: { marginTop: 2, fontFamily: T.sans, fontSize: 12.5, lineHeight: 17, color: T.muted },
  push: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: '#E9E5DE', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  pushIcon: { width: 26, height: 26, borderRadius: 7, backgroundColor: '#14162B', alignItems: 'center', justifyContent: 'center' },
  pushText: { flex: 1, minWidth: 0 },
  pushTitle: { fontFamily: T.sansStrong, fontSize: 13, lineHeight: 17, color: '#1b2430' },
  pushBody: { fontFamily: T.sans, fontSize: 12.5, lineHeight: 17, color: '#1b2430' },
  error: { fontFamily: T.sans, fontSize: 13, lineHeight: 18, color: '#E39B8E' },
  primary: { minHeight: 48, alignSelf: 'stretch' },
  clear: { alignSelf: 'center', minHeight: 44 },
});
