import React, { createContext, useContext, useEffect } from 'react';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { BookOpen, Check, ChevronDown, ChevronRight, Star, X } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import type { MoveSummary } from '@/types/chart';
import { CHART_MAP_REDUCED_FADE, CHART_MAP_TIMING } from '../chartMotion';
import { CHART_PANEL_COPY as COPY } from '../map/chartRhythm';
import { CHART_MAP_TOKENS as T } from '../map/chartMapTokens';
import type { PanelAccent } from './chartPanelColors';

export const ChartPanelDensity = createContext<'regular' | 'peek'>('regular');

/**
 * Presentational cards of the ink panel (prototype .card family). No data
 * access, no navigation: ChartWaypointContent owns state and passes handlers.
 * Every control is at least 44pt and carries a role and a label.
 */

export function PanelCard({ children, borderColor, style, testID }: {
  children: React.ReactNode;
  borderColor?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View testID={testID} style={[styles.card, borderColor ? { borderColor } : null, style]}>
      {children}
    </View>
  );
}

export function CardKey({ children, color }: { children: React.ReactNode; color: string }) {
  return <Text style={[styles.key, { color }]}>{children}</Text>;
}

export function PanelButton({ label, onPress, variant = 'outline', accent, loading, disabled, testID, accessibilityLabel, style }: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'link';
  accent: PanelAccent;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const inactive = Boolean(loading || disabled);
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: Boolean(loading) }}
      style={({ pressed }) => [
        variant === 'link' ? styles.link : styles.button,
        variant === 'primary' && { backgroundColor: accent.fill, borderColor: accent.fill },
        inactive && { opacity: 0.55 },
        pressed && !inactive && { opacity: 0.8 },
        style,
      ]}
    >
      <Text
        style={[
          variant === 'link' ? styles.linkText : styles.buttonText,
          variant === 'primary' && { color: accent.onFill },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* ONE MOVE                                                            */
/* ------------------------------------------------------------------ */

export function MountainFlagIcon({ size = 20, color = T.light }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 20L12 5L21 20H3Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 5V2L16 3.5L12 5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function OneMoveCard({
  accent,
  variant,
  title,
  emptyLabel,
  checked,
  busy,
  expanded,
  onCheck,
  onToggle,
  otherMovesCount = 0,
  children,
  reducedMotion = false,
}: {
  reducedMotion?: boolean;
  accent: PanelAccent;
  variant: 'move' | 'empty' | 'allDone';
  title: string | null;
  emptyLabel: string;
  checked: boolean;
  busy: boolean;
  expanded: boolean;
  onCheck: () => void;
  onToggle: () => void;
  otherMovesCount?: number;
  children?: React.ReactNode;
}) {
  const compact = useContext(ChartPanelDensity) === 'peek';
  return (
    <PanelCard testID="chart-one-move" style={compact ? styles.compactCard : undefined}>
      {!compact ? <CardKey color={accent.text}>{variant === 'allDone' ? 'MOVES' : COPY.oneMove}</CardKey> : null}
      {variant === 'move' && title ? (
        <View style={styles.heroMoveRow}>
          <CheckButton
            accent={accent}
            checked={checked}
            busy={busy}
            reducedMotion={reducedMotion}
            label={`Complete: ${title}`}
            onPress={onCheck}
            testID="chart-one-move-check"
          />
          <Text accessibilityLabel={`One Move: ${title}`} numberOfLines={compact ? 1 : undefined} style={[styles.heroMoveSerifText, compact && styles.compactMove, checked && styles.moveDone]}>{title}</Text>
          {compact ? <Pressable accessibilityRole="button" accessibilityLabel={`Show other moves, ${otherMovesCount} remaining`} onPress={onToggle} style={styles.compactToggle} testID="chart-one-move-toggle"><ChevronDown size={18} color={T.muted} /></Pressable> : <ChevronRight size={18} color={T.muted} style={styles.heroChevron} />}
        </View>
      ) : (
        <View style={styles.moveRow}>
          <Text style={[styles.moveText, styles.moveStatic]} testID={variant === 'empty' ? 'chart-one-move-empty' : 'chart-moves-all-done'}>
            {variant === 'allDone' ? COPY.movesAllDone : emptyLabel}
          </Text>
          {compact ? <Pressable accessibilityRole="button" accessibilityLabel={`Show other moves, ${otherMovesCount} remaining`} onPress={onToggle} style={styles.compactToggle} testID="chart-one-move-toggle"><ChevronDown size={18} color={T.muted} /></Pressable> : null}
        </View>
      )}

      {!compact ? <Pressable
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Hide other moves' : `Show other moves, ${otherMovesCount} remaining`}
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={styles.otherMovesRow}
        testID="chart-one-move-toggle"
      >
        <Text style={styles.otherMovesText}>
          Other moves{otherMovesCount > 0 ? ` · ${otherMovesCount}` : ''}
        </Text>
        <View style={expanded ? styles.flipped : undefined}>
          <ChevronDown size={18} color={T.muted} />
        </View>
      </Pressable> : null}

      {expanded ? <View style={styles.list}>{children}</View> : null}
    </PanelCard>
  );
}

export function CheckButton({ accent, checked, busy, label, onPress, testID, disabled, reducedMotion = false }: {
  accent: PanelAccent;
  checked: boolean;
  busy?: boolean;
  label: string;
  onPress: () => void;
  testID?: string;
  disabled?: boolean;
  reducedMotion?: boolean;
}) {
  // The category fill inks in over 200 ms (a 180 ms fade under reduced motion).
  const fill = useSharedValue(checked ? 1 : 0);
  useEffect(() => {
    fill.value = withTiming(checked ? 1 : 0, {
      duration: reducedMotion ? CHART_MAP_REDUCED_FADE : CHART_MAP_TIMING.moveCheck.checkFill,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.Never,
    });
  }, [checked, reducedMotion, fill]);
  const fillStyle = useAnimatedStyle(() => ({ opacity: fill.value }));
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, busy: Boolean(busy), disabled: Boolean(disabled) }}
      disabled={disabled || checked}
      onPress={onPress}
      style={styles.checkHit}
    >
      <View style={[styles.checkRing, { borderColor: accent.fill }]}>
        <Animated.View style={[styles.checkFill, { backgroundColor: accent.fill }, fillStyle]}>
          <Check size={16} color={accent.onFill} strokeWidth={3} />
        </Animated.View>
      </View>
    </Pressable>
  );
}

/** One row of the expanded list. Checks only exist for moves of the current waypoint. */
export function MoveListRow({ move, accent, isOneMove, canComplete, canPromote, busy, onComplete, onPromote, onRemove }: {
  move: MoveSummary;
  accent: PanelAccent;
  isOneMove: boolean;
  canComplete: boolean;
  canPromote: boolean;
  busy: boolean;
  onComplete: () => void;
  onPromote: () => void;
  onRemove: () => void;
}) {
  const done = move.status === 'COMPLETED';
  return (
    <View style={[styles.moveRow, styles.listRow]}>
      {canComplete || done ? (
        <CheckButton
          accent={accent}
          checked={done}
          busy={busy}
          disabled={!canComplete || busy}
          label={`${done ? 'Done' : 'Complete'}: ${move.title}`}
          onPress={onComplete}
        />
      ) : (
        <View style={styles.checkSpacer} />
      )}
      <Text style={[styles.moveText, done && styles.moveDone]}>{move.title}</Text>
      {canPromote ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isOneMove ? `One Move: ${move.title}` : `Make this the One Move: ${move.title}`}
          accessibilityState={{ selected: isOneMove, disabled: isOneMove }}
          disabled={isOneMove}
          onPress={onPromote}
          style={styles.iconHit}
        >
          <Star size={20} color={isOneMove ? accent.text : T.muted} fill={isOneMove ? accent.text : 'none'} />
        </Pressable>
      ) : null}
      {!done && canComplete ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove move: ${move.title}`} onPress={onRemove} style={styles.iconHit}>
          <X size={16} color={T.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Day closed                                                          */
/* ------------------------------------------------------------------ */

export function DayClosedCard({ accent, practiced, hasNext, onFocus, onDeepFocus, onAnother }: {
  accent: PanelAccent;
  practiced: boolean;
  hasNext: boolean;
  onFocus: () => void;
  onDeepFocus: () => void;
  onAnother: () => void;
}) {
  const compact = useContext(ChartPanelDensity) === 'peek';
  if (compact) return <PanelCard testID="chart-day-closed" style={styles.compactCard}><View style={styles.row}><Text style={[styles.body, { flex: 1 }]} numberOfLines={1}>{COPY.dayClosedTitle}</Text>{!practiced ? <PanelButton label={COPY.focus} accent={accent} onPress={onFocus} testID="chart-practice-focus" /> : hasNext ? <PanelButton label={COPY.another} accent={accent} onPress={onAnother} testID="chart-do-another" /> : null}</View></PanelCard>;
  return (
    <PanelCard testID="chart-day-closed">
      <CardKey color={accent.text}>TODAY</CardKey>
      <Text accessibilityRole="header" style={styles.h3}>{COPY.dayClosedTitle}</Text>
      <Text style={styles.body}>{COPY.dayClosedSub}</Text>
      {practiced ? (
        <Text style={[styles.body, styles.gapTop]}>{COPY.practicedToo}</Text>
      ) : (
        <>
          <Text style={[styles.body, styles.gapTop]}>{COPY.practiceOffer}</Text>
          <View style={styles.row}>
            <PanelButton label={COPY.focus} variant="primary" accent={accent} onPress={onFocus} testID="chart-practice-focus" />
            <PanelButton label={COPY.deepFocus} accent={accent} onPress={onDeepFocus} testID="chart-practice-deep-focus" />
          </View>
        </>
      )}
      {hasNext ? (
        <View style={styles.row}>
          <PanelButton label={COPY.another} variant="link" accent={accent} onPress={onAnother} testID="chart-do-another" />
        </View>
      ) : null}
    </PanelCard>
  );
}

/* ------------------------------------------------------------------ */
/* Commit, destination, arrival, log                                   */
/* ------------------------------------------------------------------ */

export function CommitCard({ accent, number, onCommit }: { accent: PanelAccent; number: number; onCommit: () => void }) {
  const compact = useContext(ChartPanelDensity) === 'peek';
  if (compact) return <PanelCard borderColor={accent.fill} testID="chart-waypoint-reached" style={styles.compactCard}><View style={styles.row}><Text style={[styles.body, { flex: 1 }]} numberOfLines={1}>{COPY.reachedTitle}</Text><PanelButton label={COPY.committed} accent={accent} onPress={onCommit} testID="chart-commit" /></View></PanelCard>;
  return (
    <PanelCard borderColor={accent.fill} testID="chart-waypoint-reached">
      <CardKey color={accent.text}>{`WAYPOINT ${number} REACHED`}</CardKey>
      <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.h3}>{COPY.reachedTitle}</Text>
      <Text style={styles.body}>{COPY.reachedSub}</Text>
      <View style={styles.row}>
        <PanelButton label={COPY.committed} variant="primary" accent={accent} onPress={onCommit} testID="chart-commit" />
      </View>
    </PanelCard>
  );
}

type VisionLike = { imageUrl: string | null; description: string | null } | null;

export function DestinationCard({
  accent,
  destination,
  vision,
  onOpenVision,
}: {
  accent: PanelAccent;
  destination: string;
  vision?: VisionLike;
  onOpenVision: () => void;
}) {
  const hasVision = Boolean(vision?.imageUrl || vision?.description);
  return (
    <PanelCard testID="chart-destination">
      <CardKey color={accent.text}>{COPY.destination}</CardKey>
      {hasVision ? (
        <Pressable
          testID="chart-view-vision"
          accessibilityRole="button"
          accessibilityLabel={`Destination: ${destination}. View Vision`}
          onPress={onOpenVision}
          style={styles.destSingleRow}
        >
          <View style={styles.destGlyphFrame}>
            {vision?.imageUrl ? <Image source={{ uri: vision.imageUrl }} style={{ width: 36, height: 36, borderRadius: 4 }} accessibilityIgnoresInvertColors /> : <MountainFlagIcon size={20} color={accent.text} />}
          </View>
          <Text style={styles.destSerifTitle} numberOfLines={2}>
            {destination}
          </Text>
          <ChevronRight size={18} color={T.muted} />
        </Pressable>
      ) : (
        <View style={styles.destSingleRow}>
          <View style={styles.destGlyphFrame}>
            <MountainFlagIcon size={20} color={accent.text} />
          </View>
          <Text style={styles.destSerifTitle} numberOfLines={2}>
            {destination}
          </Text>
        </View>
      )}
    </PanelCard>
  );
}

export function ArrivalCard({ accent, vision, onOpenVision, onRelease }: {
  accent: PanelAccent;
  vision: VisionLike;
  onOpenVision: () => void;
  onRelease: () => void;
}) {
  return (
    <PanelCard testID="chart-arrival-card">
      <CardKey color={accent.text}>YOUR VISION</CardKey>
      {vision?.imageUrl ? (
        <Image source={{ uri: vision.imageUrl }} style={styles.arrivalImage} accessibilityIgnoresInvertColors accessibilityLabel="Your Vision" testID="chart-reached-vision" />
      ) : null}
      {vision?.description ? <Text style={styles.body}>{vision.description}</Text> : null}
      <View style={styles.row}>
        <PanelButton label={COPY.viewVision} variant="primary" accent={accent} onPress={onOpenVision} testID="chart-view-vision" />
        <PanelButton label={COPY.release} accent={accent} onPress={onRelease} testID="chart-release-anchor" />
      </View>
    </PanelCard>
  );
}

export type ChartLogRow = { key: string; when: string; text: string };

export function CourseLogCard({
  days,
  rows,
  expanded,
  onToggle,
  onOpenLog,
  accent,
}: {
  days: number;
  rows?: ChartLogRow[];
  expanded?: boolean;
  onToggle?: () => void;
  onOpenLog: () => void;
  accent: PanelAccent;
}) {
  return (
    <PanelCard style={styles.logCard}>
      <Pressable
        testID="chart-course-log"
        accessibilityRole="button"
        accessibilityLabel={COPY.log(days)}
        onPress={onOpenLog}
        style={styles.courseLogSingleRow}
      >
        <View style={styles.destGlyphFrame}>
          <BookOpen size={20} color={accent.text} />
        </View>
        <Text style={styles.courseLogText}>{COPY.log(days)}</Text>
        <ChevronRight size={18} color={T.muted} />
      </Pressable>
    </PanelCard>
  );
}

/* ------------------------------------------------------------------ */
/* Update progress chips                                               */
/* ------------------------------------------------------------------ */

export function ProgressChips({ onBump }: { onBump: (delta: number) => void }) {
  return (
    <View style={styles.stepper} testID="chart-progress-chips">
      <Text style={styles.stepperKey}>{COPY.updateProgress}</Text>
      <View style={styles.chipRow}>
        {COPY.chips.map((chip) => (
          <Pressable
            key={chip.value}
            testID={`chart-chip-${chip.value}`}
            accessibilityRole="button"
            accessibilityLabel={`${chip.value < 0 ? 'Decrease' : 'Increase'} progress by ${Math.abs(chip.value)}`}
            onPress={() => onBump(chip.value)}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
          >
            <Text style={styles.chipText}>{chip.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  compactCard: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 14, gap: 0 },
  compactMove: { fontFamily: T.sans, fontSize: 15, lineHeight: 20 },
  compactToggle: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  card: { backgroundColor: T.panel, borderWidth: 1, borderColor: T.line, borderRadius: 16, padding: 14 },
  key: { fontFamily: T.sansStrong, fontSize: 11, letterSpacing: 1.8, marginBottom: 8 },
  h3: { fontFamily: T.serif, fontSize: 22, lineHeight: 26, color: T.light, marginBottom: 2 },
  body: { fontFamily: T.sans, fontSize: 14, lineHeight: 20, color: T.muted },
  gapTop: { marginTop: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  button: { minHeight: 44, paddingHorizontal: 18, borderRadius: 22, borderWidth: 1, borderColor: T.line, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: T.sansStrong, fontSize: 14, color: T.light },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontFamily: T.sans, fontSize: 13, color: T.muted, textDecorationLine: 'underline' },
  alignStart: { alignSelf: 'flex-start' },
  moveRow: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  moveText: { flex: 1, fontFamily: T.sans, fontSize: 15, lineHeight: 21, color: T.light, paddingVertical: 4 },
  moveStatic: { color: T.muted },
  moveDone: { color: T.muted, textDecorationLine: 'line-through', textDecorationColor: 'rgba(154,163,175,.5)' },
  toggle: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
  flipped: { transform: [{ rotate: '180deg' }] },
  list: { marginTop: 8, borderTopWidth: 1, borderTopColor: T.line },
  listRow: { borderBottomWidth: 1, borderBottomColor: T.line },
  checkHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -6 },
  checkFill: { ...StyleSheet.absoluteFillObject, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  checkRing: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkSpacer: { width: 38, height: 44 },
  iconHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  destRow: { flexDirection: 'row', gap: 12 },
  thumb: { width: 72, height: 72, borderRadius: 10, borderWidth: 1, borderColor: T.line },
  destTitle: { fontFamily: T.serif, fontSize: 19, lineHeight: 24, color: T.light, marginBottom: 6 },
  arrivalImage: { height: 160, borderRadius: 12, marginBottom: 10 },
  logCard: { paddingVertical: 2 },
  logRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logText: { fontFamily: T.sans, fontSize: 13, color: T.muted },
  logs: { paddingBottom: 6, gap: 8 },
  logEntry: { flexDirection: 'row', gap: 10 },
  logWhen: { width: 56, fontFamily: T.sans, fontSize: 13, color: T.light },
  logWhat: { flex: 1, fontFamily: T.sans, fontSize: 13, color: T.muted },
  stepper: { gap: 8 },
  stepperKey: { fontFamily: T.sansStrong, fontSize: 11, letterSpacing: 1.5, color: T.muted },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, minWidth: 64, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: T.line, backgroundColor: T.panel, alignItems: 'center', justifyContent: 'center' },
  chipPressed: { opacity: 0.8 },
  chipText: { fontFamily: T.sans, fontSize: 15, color: T.light },
  heroMoveRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: 10 },
  heroMoveSerifText: { flex: 1, fontFamily: T.serif, fontSize: 18, lineHeight: 24, color: T.light },
  heroChevron: { marginLeft: 4 },
  otherMovesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40, marginTop: 4, paddingTop: 4 },
  otherMovesText: { fontFamily: T.sans, fontSize: 14, color: T.muted },
  destSingleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  destGlyphFrame: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  destSerifTitle: { flex: 1, fontFamily: T.serif, fontSize: 18, lineHeight: 24, color: T.light },
  courseLogSingleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  courseLogText: { flex: 1, fontFamily: T.sans, fontSize: 15, color: T.light },
});
