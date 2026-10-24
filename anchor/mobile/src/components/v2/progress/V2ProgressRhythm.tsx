import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, typography } from '@/theme/v2';
import { V2SegmentedControl } from '@/components/v2/primitives';
import type {
  V2ProgressDayCell,
  V2ProgressModel,
  V2ProgressRange,
} from '@/adapters/v2/progress/types';
import { V2ProgressWeekCard } from './V2ProgressWeek';
import { progressTokens } from './progressTokens';

export interface V2ProgressRhythmProps {
  model: V2ProgressModel;
  range: V2ProgressRange;
  onRangeChange: (range: V2ProgressRange) => void;
  onRangeMotionChange?: (moving: boolean) => void;
  testID?: string;
}

const RANGE_OPTIONS = [
  { value: 'Week', label: 'Week' },
  { value: 'Month', label: 'Month' },
  { value: 'Year', label: 'Year' },
];
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
/** Heatmap fills are ink at rising opacity. No hue. */
const LEVEL_ALPHA = [0.05, 0.18, 0.42, 1] as const;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const dayOfMonth = (dateKey: string) => Number(dateKey.slice(8, 10));
const monthIndex = (dateKey: string) => Number(dateKey.slice(5, 7)) - 1;
const shortDate = (dateKey: string) => `${MONTH_NAMES[monthIndex(dateKey)]} ${dayOfMonth(dateKey)}`;

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

const MonthGrid: React.FC<{ cells: V2ProgressDayCell[]; testID: string }> = ({ cells, testID }) => {
  const rows = chunk(cells, 7);
  const lastPast = [...cells].reverse().find((c) => !c.isFuture);
  return (
    <View testID={`${testID}-month`}>
      <View style={styles.calHead}>
        <Text style={styles.calRange}>
          {shortDate(cells[0].dateKey)} – {shortDate((lastPast ?? cells[cells.length - 1]).dateKey)}
        </Text>
      </View>
      <View style={styles.calRow}>
        {DAY_LETTERS.map((letter, index) => (
          <Text key={`${letter}-${index}`} style={styles.calDayLetter}>
            {letter}
          </Text>
        ))}
      </View>
      {rows.map((row) => (
        <View key={row[0].dateKey} style={styles.calRow}>
          {row.map((cell) => (
            <View
              key={cell.dateKey}
              testID={`${testID}-cell-${cell.dateKey}`}
              style={[
                styles.calCell,
                cell.isFuture
                  ? null
                  : { backgroundColor: progressTokens.inkWash(LEVEL_ALPHA[cell.level]) },
                cell.isToday && styles.todayOutline,
              ]}
              accessible={!cell.isFuture}
              accessibilityLabel={
                cell.isFuture ? undefined : `${shortDate(cell.dateKey)}: ${cell.sessionCount} practices`
              }
            >
              {cell.isFuture ? null : (
                <Text style={[styles.calNumber, cell.level >= 2 && styles.calNumberOnInk]}>
                  {dayOfMonth(cell.dateKey)}
                </Text>
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
};

const YearGrid: React.FC<{ cells: V2ProgressDayCell[]; testID: string }> = ({ cells, testID }) => {
  const columns = chunk(cells, 7);
  return (
    <View testID={`${testID}-year`}>
      <View style={styles.yearGrid}>
        {columns.map((column) => (
          <View key={column[0].dateKey} style={styles.yearColumn}>
            {column.map((cell) => (
              <View
                key={cell.dateKey}
                style={[
                  styles.yearCell,
                  cell.isFuture ? null : { backgroundColor: progressTokens.inkWash(LEVEL_ALPHA[cell.level]) },
                  cell.isToday && styles.todayOutlineThin,
                ]}
              />
            ))}
          </View>
        ))}
      </View>
      <View style={styles.yearMonths}>
        {columns.map((column, index) => {
          const month = monthIndex(column[0].dateKey);
          const previous = index > 0 ? monthIndex(columns[index - 1][0].dateKey) : -1;
          const show = month !== previous && index <= columns.length - 3;
          return (
            <View key={column[0].dateKey} style={styles.yearMonthSlot}>
              {show ? (
                <Text style={styles.yearMonth} numberOfLines={1}>
                  {MONTH_NAMES[month]}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
};

/**
 * Rhythm: practices, minutes and active days from sessions the user actually
 * completed, drawn as practice marks (week), a calendar (month) or a contribution grid
 * (year). Descriptive only: nothing here is a target.
 */
export const V2ProgressRhythm: React.FC<V2ProgressRhythmProps> = ({
  model,
  range,
  onRangeChange,
  onRangeMotionChange,
  testID = 'v2-progress-rhythm',
}) => {
  const stats = model.rhythm?.[range];
  const cells = model.heatmap?.[range];
  if (!stats || !cells || cells.length === 0) return null;

  const statRow: Array<[string, string]> = [
    [stats.practices.toLocaleString('en-US'), 'PRACTICES'],
    [stats.minutes.toLocaleString('en-US'), 'MINUTES'],
    [stats.moves.toLocaleString('en-US'), 'MOVES'],
  ];

  return (
    <View style={styles.card} testID={testID}>
      <V2SegmentedControl
        onMotionChange={onRangeMotionChange}
        options={RANGE_OPTIONS}
        value={range}
        onChange={(value) => onRangeChange(value as V2ProgressRange)}
        accessibilityLabel="Rhythm range"
      />

      {range === 'Week' && model.week ? <V2ProgressWeekCard week={model.week} streak={model.streak} longestRhythm={model.rhythm?.Year.bestRun} embedded testID={`${testID}-week`} /> : null}
      {range === 'Month' ? <MonthGrid cells={cells} testID={testID} /> : null}
      {range === 'Year' ? <YearGrid cells={cells} testID={testID} /> : null}
      <View style={styles.stats}>
        {statRow.map(([value, label], index) => (
          <View key={label} style={[styles.stat, index > 0 && styles.statDivider]}>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>


    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: progressTokens.card,
    borderWidth: 1,
    borderColor: progressTokens.cardBorder,
    borderRadius: radii.xl,
    padding: 16,
  },
  stats: { flexDirection: 'row', marginTop: 10, marginBottom: 0 },
  stat: { flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: 2 },
  statDivider: { borderLeftWidth: 1, borderLeftColor: progressTokens.hairline },
  statValue: { fontFamily: progressTokens.serif, fontSize: 22, lineHeight: 26, letterSpacing: -0.26, color: progressTokens.text },
  statLabel: { textAlign: 'center', ...typography.labelSM, fontSize: 10, letterSpacing: 1, color: progressTokens.muted, marginTop: 2 },
  todayOutline: { borderWidth: 1.5, borderColor: progressTokens.gold },
  todayOutlineThin: { borderWidth: 1, borderColor: progressTokens.gold },

  calHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, marginTop: 10 },
  calRange: { fontFamily: progressTokens.serif, fontSize: 17, lineHeight: 21, color: progressTokens.text },
  calRow: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  calDayLetter: { flex: 1, textAlign: 'center', ...typography.labelMD, fontSize: 10, color: progressTokens.muted },
  calCell: { flex: 1, aspectRatio: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  calNumber: { ...typography.caption, fontSize: 11, color: progressTokens.inkWash(0.55) },
  calNumberOnInk: { color: colors.cream },

  yearGrid: { flexDirection: 'row', gap: 3 },
  yearColumn: { flex: 1, gap: 3 },
  yearCell: { width: '100%', aspectRatio: 1, borderRadius: 3 },
  yearMonths: { flexDirection: 'row', gap: 3, marginTop: 8 },
  yearMonthSlot: { flex: 1, height: 12 },
  yearMonth: { position: 'absolute', left: 0, width: 32, ...typography.labelMD, fontSize: 10, color: progressTokens.muted },
});
