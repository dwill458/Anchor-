/**
 * Anchor 2.0 Settings: grouped-card primitives.
 *
 * The 2026-10-25 settings redesign lays every sub-screen out as labelled cards of rows. These
 * primitives are the shared vocabulary for that layout: group label, card, row, switch,
 * segmented control, radio row, note and buttons.
 */

import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { IconChevron } from './SettingsIcons';
import { SettingsHeader } from './SettingsPrimitives';
import { T, settingsTypography } from './settingsTheme';

export const cardTheme = {
  card: '#FBF9F4',
  cardBorder: '#E4DDD0',
  ink: '#14162B',
  muted: '#655F54',
  glyph: '#8A8272',
  gold: '#7A5A0C',
  goldTint: '#F3E9C8',
  goldSelected: '#F7F0DA',
  goldEdge: '#C9A227',
  field: '#B3AA97',
  danger: '#A8451F',
  thin: '#B4532A',
  switchOff: '#EFE9DC',
} as const;

const C = cardTheme;

/* ── Screen frame ───────────────────────────────────────────────── */

interface SettingsScreenFrameProps {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
  /** Pinned below the scroll area (e.g. a primary button). */
  footer?: React.ReactNode;
  testID?: string;
}

export const SettingsScreenFrame: React.FC<SettingsScreenFrameProps> = ({
  title,
  onBack,
  children,
  footer,
  testID,
}) => (
  <View style={styles.frame} testID={testID}>
    <SafeAreaView edges={['top']} style={styles.frameSafe}>
      <SettingsHeader title={title} onBack={onBack} />
      <ScrollView
        style={styles.frameScroll}
        contentContainerStyle={styles.frameContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      {footer}
    </SafeAreaView>
  </View>
);

/* ── Labels, cards, notes ───────────────────────────────────────── */

export const GroupLabel: React.FC<{ children: string; first?: boolean }> = ({ children, first }) => (
  <Text style={[styles.groupLabel, first && styles.groupLabelFirst]} accessibilityRole="header">
    {children}
  </Text>
);

interface SettingsGroupProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityRole?: 'radiogroup';
  accessibilityLabel?: string;
  testID?: string;
}

/** A bordered card; direct children are separated by a hairline. */
export const SettingsGroup: React.FC<SettingsGroupProps> = ({
  children,
  style,
  accessibilityRole,
  accessibilityLabel,
  testID,
}) => {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View
      style={[styles.group, style]}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {items.map((child, index) => (
        <React.Fragment key={index}>
          {index > 0 ? <View style={styles.divider} /> : null}
          {child}
        </React.Fragment>
      ))}
    </View>
  );
};

export const SettingsNote: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({
  children,
  style,
}) => (
  <View style={style}>
    <Text style={styles.note}>{children}</Text>
  </View>
);

/* ── Icon tile & glyphs ─────────────────────────────────────────── */

export const IconTile: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.iconTile}>{children}</View>
);

export const ExternalGlyph: React.FC<{ color?: string }> = ({ color = C.glyph }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path
      d="M7 17L17 7M9 7h8v8"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const PlayGlyph: React.FC<{ color?: string }> = ({ color = C.ink }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M8 5l11 7-11 7V5z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
  </Svg>
);

export const StopGlyph: React.FC<{ color?: string }> = ({ color = C.ink }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M7 7h10v10H7z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
  </Svg>
);

export const MinusGlyph: React.FC<{ color?: string }> = ({ color = C.ink }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path d="M5 12h14" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);

export const PlusGlyph: React.FC<{ color?: string }> = ({ color = C.ink }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);

/* ── Row ────────────────────────────────────────────────────────── */

interface GroupRowProps {
  title: string;
  subtitle?: string | null;
  icon?: React.ReactNode;
  /** Gold/muted value shown before the chevron. */
  value?: string | null;
  valueTone?: 'muted' | 'gold';
  /** Extra element shown before the chevron (e.g. a status pill). */
  badge?: React.ReactNode;
  onPress?: () => void;
  chevron?: 'right' | 'external' | 'none';
  destructive?: boolean;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}

export const GroupRow: React.FC<GroupRowProps> = ({
  title,
  subtitle,
  icon,
  value,
  valueTone = 'muted',
  badge,
  onPress,
  chevron,
  destructive,
  disabled,
  testID,
  accessibilityLabel,
}) => {
  const resolvedChevron = chevron ?? (onPress ? 'right' : 'none');
  const body = (
    <>
      {icon ? <IconTile>{icon}</IconTile> : null}
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, destructive && { color: C.danger }]}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {value ? (
        <Text
          style={[styles.rowValue, valueTone === 'gold' && styles.rowValueGold]}
          numberOfLines={1}
        >
          {value}
        </Text>
      ) : null}
      {badge}
      {resolvedChevron === 'right' ? <IconChevron size={14} color={C.glyph} /> : null}
      {resolvedChevron === 'external' ? <ExternalGlyph /> : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.row, disabled && styles.disabled]} testID={testID}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.disabled]}
      testID={testID ?? `settings-row-${title}`}
    >
      {body}
    </Pressable>
  );
};

export const StatusPill: React.FC<{ label: string }> = ({ label }) => (
  <View style={styles.statusPill}>
    <Text style={styles.statusPillText}>{label}</Text>
  </View>
);

export const TierPill: React.FC<{ label: string }> = ({ label }) => (
  <View style={styles.tierPill}>
    <Text style={styles.tierPillText}>{label}</Text>
  </View>
);

/* ── Switch ─────────────────────────────────────────────────────── */

interface SwitchControlProps {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  testID?: string;
}

export const SwitchControl: React.FC<SwitchControlProps> = ({
  on,
  onChange,
  label,
  disabled,
  testID,
}) => (
  <Pressable
    accessibilityRole="switch"
    accessibilityLabel={label}
    accessibilityState={{ checked: on, disabled: !!disabled }}
    disabled={disabled}
    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
    onPress={() => onChange(!on)}
    style={[styles.switchTrack, on ? styles.switchOn : styles.switchOff, disabled && styles.disabled]}
    testID={testID}
  >
    <View style={[styles.switchKnob, on ? styles.knobOn : styles.knobOff]} />
  </Pressable>
);

interface SwitchRowProps {
  title: string;
  subtitle?: string | null;
  icon?: React.ReactNode;
  on: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  testID?: string;
  /** Accessible name for the switch itself; defaults to the title. */
  switchLabel?: string;
}

export const SwitchRow: React.FC<SwitchRowProps> = ({
  title,
  subtitle,
  icon,
  on,
  onChange,
  disabled,
  testID,
  switchLabel,
}) => (
  <View style={[styles.row, disabled && styles.disabled]} testID={testID ?? `settings-row-${title}`}>
    {icon ? <IconTile>{icon}</IconTile> : null}
    <View style={styles.rowText}>
      <Text style={styles.rowTitle}>{title}</Text>
      {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
    </View>
    <SwitchControl
      on={on}
      onChange={onChange}
      label={switchLabel ?? title}
      disabled={disabled}
      testID={testID ? `${testID}-switch` : undefined}
    />
  </View>
);

/* ── Segmented control ──────────────────────────────────────────── */

export interface SegmentedOption<V extends string | number> {
  label: string;
  value: V;
}

interface SegmentedProps<V extends string | number> {
  options: ReadonlyArray<SegmentedOption<V>>;
  value: V;
  onChange: (next: V) => void;
  label: string;
  /** Use "tab" for mode switchers; default is a radio group. */
  role?: 'radio' | 'tab';
  compact?: boolean;
  inset?: boolean;
  testIDPrefix?: string;
}

export function Segmented<V extends string | number>({
  options,
  value,
  onChange,
  label,
  role = 'radio',
  compact,
  inset = true,
  testIDPrefix,
}: SegmentedProps<V>) {
  return (
    <View
      style={[styles.segmented, inset && styles.segmentedInset]}
      accessibilityRole={role === 'tab' ? 'tablist' : 'radiogroup'}
      accessibilityLabel={label}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole={role === 'tab' ? 'tab' : 'radio'}
            accessibilityLabel={option.label}
            accessibilityState={role === 'tab' ? { selected } : { checked: selected }}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              compact && styles.segmentCompact,
              selected && styles.segmentOn,
            ]}
            testID={testIDPrefix ? `${testIDPrefix}-${option.value}` : undefined}
          >
            <Text style={styles.segmentText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ── Radio ──────────────────────────────────────────────────────── */

export const RadioMark: React.FC<{ selected: boolean }> = ({ selected }) => (
  <View style={[styles.radio, selected && styles.radioOn]}>
    {selected ? <View style={styles.radioDot} /> : null}
  </View>
);

interface RadioRowProps {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  /** Rendered under the subtitle, inside the pressable area. */
  children?: React.ReactNode;
  /** Sits to the right of the pressable area (e.g. a preview button). */
  trailing?: React.ReactNode;
  testID?: string;
  topAligned?: boolean;
}

export const RadioRow: React.FC<RadioRowProps> = ({
  title,
  subtitle,
  selected,
  onPress,
  children,
  trailing,
  testID,
  topAligned,
}) => (
  <View style={[styles.radioRow, selected && styles.radioRowOn]}>
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      accessibilityState={{ checked: selected, selected }}
      onPress={onPress}
      style={[styles.radioPress, topAligned && styles.radioPressTop]}
      testID={testID}
    >
      <RadioMark selected={selected} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
        {children}
      </View>
    </Pressable>
    {trailing}
  </View>
);

export const RoundIconButton: React.FC<{
  label: string;
  onPress: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
  testID?: string;
}> = ({ label, onPress, children, disabled, active, testID }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled: !!disabled }}
    disabled={disabled}
    onPress={onPress}
    style={[styles.roundButton, active && styles.roundButtonActive, disabled && styles.disabled]}
    testID={testID}
  >
    {children}
  </Pressable>
);

/* ── Buttons ────────────────────────────────────────────────────── */

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline';
  disabled?: boolean;
  busy?: boolean;
  testID?: string;
  compactHeight?: boolean;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  disabled,
  testID,
  compactHeight,
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled: !!disabled }}
    disabled={disabled}
    onPress={onPress}
    style={[
      styles.button,
      compactHeight && styles.buttonCompact,
      variant === 'outline' && styles.buttonOutline,
      disabled && styles.buttonDisabled,
    ]}
    testID={testID}
  >
    <Text
      style={[
        styles.buttonText,
        variant === 'outline' && styles.buttonTextOutline,
        disabled && styles.buttonTextDisabled,
      ]}
    >
      {label}
    </Text>
  </Pressable>
);

export const TextAction: React.FC<{
  label: string;
  onPress: () => void;
  tone?: 'gold' | 'ink' | 'muted';
  testID?: string;
}> = ({ label, onPress, tone = 'gold', testID }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    style={styles.textAction}
    testID={testID}
  >
    <Text
      style={[
        styles.textActionText,
        tone === 'ink' && { color: C.ink },
        tone === 'muted' && { color: C.muted },
      ]}
    >
      {label}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  frame: { flex: 1, backgroundColor: T.bg },
  frameSafe: { flex: 1 },
  frameScroll: { flex: 1 },
  frameContent: { paddingBottom: 48 },

  groupLabel: {
    fontFamily: settingsTypography.bodySemiBold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: C.muted,
    marginTop: 28,
    marginBottom: 8,
    marginHorizontal: 20,
  },
  groupLabelFirst: { marginTop: 12 },
  group: {
    marginHorizontal: 16,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 18,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: C.cardBorder },
  note: {
    marginTop: 12,
    marginHorizontal: 20,
    fontFamily: settingsTypography.body,
    fontSize: 14,
    lineHeight: 20,
    color: C.muted,
  },

  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.goldTint,
    alignItems: 'center',
    justifyContent: 'center',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 66,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: {
    fontFamily: settingsTypography.bodySemiBold,
    fontSize: 16,
    color: C.ink,
  },
  rowSubtitle: {
    fontFamily: settingsTypography.body,
    fontSize: 14,
    lineHeight: 19,
    color: C.muted,
  },
  rowValue: {
    fontFamily: settingsTypography.body,
    fontSize: 15,
    color: C.muted,
    maxWidth: 150,
  },
  rowValueGold: {
    fontFamily: settingsTypography.bodyBold,
    fontSize: 16,
    color: C.gold,
  },

  statusPill: {
    backgroundColor: C.goldTint,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusPillText: {
    fontFamily: settingsTypography.bodySemiBold,
    fontSize: 13,
    color: C.gold,
  },
  tierPill: {
    backgroundColor: C.goldTint,
    borderColor: C.goldEdge,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  tierPillText: {
    fontFamily: settingsTypography.bodyBold,
    fontSize: 11,
    letterSpacing: 0.7,
    color: C.gold,
  },

  switchTrack: {
    width: 52,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
  },
  switchOn: { backgroundColor: C.ink, borderColor: C.ink },
  switchOff: { backgroundColor: C.switchOff, borderColor: C.glyph },
  switchKnob: { position: 'absolute', top: 2, width: 24, height: 24, borderRadius: 12 },
  knobOn: { left: 22, backgroundColor: C.card },
  knobOff: { left: 2, backgroundColor: C.glyph },

  segmented: { flexDirection: 'row', gap: 8 },
  segmentedInset: { marginHorizontal: 16 },
  segment: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.field,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  segmentCompact: { minHeight: 48 },
  segmentOn: { borderWidth: 2, borderColor: C.ink, backgroundColor: C.goldTint },
  segmentText: { fontFamily: settingsTypography.bodySemiBold, fontSize: 15, color: C.ink },

  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: C.glyph,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: C.ink },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.ink },
  radioRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 16 },
  radioRowOn: { backgroundColor: C.goldSelected },
  radioPress: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 72,
    paddingVertical: 12,
    paddingLeft: 16,
  },
  radioPressTop: { alignItems: 'flex-start', paddingVertical: 18 },

  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: C.field,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundButtonActive: { borderColor: C.ink, backgroundColor: C.goldTint },

  button: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  buttonCompact: { minHeight: 52 },
  buttonOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: C.ink },
  buttonDisabled: { backgroundColor: C.cardBorder, borderWidth: 0 },
  buttonText: { fontFamily: settingsTypography.bodySemiBold, fontSize: 16, color: '#F4F0E8' },
  buttonTextOutline: { color: C.ink },
  buttonTextDisabled: { color: C.muted },

  textAction: {
    minHeight: 48,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textActionText: { fontFamily: settingsTypography.bodySemiBold, fontSize: 15, color: C.gold },
});
