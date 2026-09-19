import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { T, settingsTypography } from './settingsTheme';
import { IconBack, IconChevron } from './SettingsIcons';

/* ── Header ─────────────────────────────────────────────────────── */
interface SettingsHeaderProps {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
  backAriaLabel?: string;
}

export const SettingsHeader: React.FC<SettingsHeaderProps> = ({
  title,
  onBack,
  right,
  backAriaLabel = 'Back',
}) => (
  <View style={styles.header}>
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={backAriaLabel}
      onPress={onBack}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={styles.headerBackButton}
      activeOpacity={0.65}
    >
      <IconBack size={22} color={T.ink} />
    </TouchableOpacity>
    <Text
      style={styles.headerTitle}
      numberOfLines={1}
      ellipsizeMode="tail"
      adjustsFontSizeToFit
      minimumFontScale={0.8}
    >
      {title}
    </Text>
    {right ? <View style={styles.headerRight}>{right}</View> : null}
  </View>
);

/* ── Section Label & Rule ───────────────────────────────────────── */
interface SectionLabelProps {
  children: React.ReactNode;
  first?: boolean;
}

export const SectionLabel: React.FC<SectionLabelProps> = ({ children, first = false }) => (
  <Text style={[styles.sectionLabel, first && styles.sectionLabelFirst]}>{children}</Text>
);

export const SettingsRule: React.FC<{ mt?: number; mb?: number }> = ({ mt = 24, mb = 0 }) => (
  <View style={[styles.rule, { marginTop: mt, marginBottom: mb }]} />
);

/* ── Open Metric Display ────────────────────────────────────────── */
interface SettingsMetricProps {
  value: string | number;
  label: string;
}

export const SettingsMetric: React.FC<SettingsMetricProps> = ({ value, label }) => (
  <View style={styles.metricContainer}>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

/* ── Rows ───────────────────────────────────────────────────────── */
interface SettingsRowProps {
  icon?: React.ReactNode;
  label: string;
  value?: string | null;
  desc?: string | null;
  onPress?: () => void;
  chevron?: boolean;
  disabled?: boolean;
  indent?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  titleColor?: string;
  showDivider?: boolean;
}

export const SettingsRow: React.FC<SettingsRowProps> = ({
  icon,
  label,
  value,
  desc,
  onPress,
  chevron = true,
  disabled = false,
  indent = false,
  testID,
  accessibilityLabel,
  titleColor,
  showDivider = true,
}) => {
  const content = (
    <>
      {icon ? <View style={styles.rowIcon}>{icon}</View> : null}
      <View style={styles.rowContent}>
        <Text
          style={[styles.rowLabel, titleColor ? { color: titleColor } : null]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {desc ? <Text style={styles.rowDesc}>{desc}</Text> : null}
      </View>
      {value ? (
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {chevron && onPress ? <IconChevron size={12} color={T.ink3} /> : null}
    </>
  );

  const containerStyle = [
    styles.row,
    indent && styles.rowIndent,
    disabled && styles.rowDisabled,
    showDivider && styles.rowDivider,
  ];

  if (onPress && !disabled) {
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label}
        accessibilityState={{ disabled }}
        onPress={onPress}
        activeOpacity={0.6}
        style={containerStyle}
        testID={testID || `settings-row-${label}`}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={containerStyle}
      testID={testID || `settings-row-${label}`}
      accessibilityLabel={accessibilityLabel || label}
    >
      {content}
    </View>
  );
};

/* ── Toggle Switch & ToggleRow ─────────────────────────────────── */
interface SettingsToggleProps {
  on: boolean;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessible?: boolean;
}

export const SettingsToggle: React.FC<SettingsToggleProps> = ({
  on,
  onToggle,
  disabled = false,
  accessibilityLabel,
  accessible = true,
}) => (
  <Pressable
    accessible={accessible}
    accessibilityRole={accessible ? 'switch' : undefined}
    accessibilityState={accessible ? { checked: on, disabled } : undefined}
    accessibilityLabel={accessible ? accessibilityLabel : undefined}
    disabled={disabled}
    onPress={() => onToggle(!on)}
    style={[
      styles.toggleTrack,
      on ? styles.toggleTrackOn : styles.toggleTrackOff,
      disabled && styles.toggleDisabled,
    ]}
  >
    <View style={[styles.toggleThumb, on ? styles.toggleThumbOn : styles.toggleThumbOff]} />
  </Pressable>
);

interface SettingsToggleRowProps {
  icon?: React.ReactNode;
  label: string;
  desc?: string | null;
  on: boolean;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
  indent?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  showDivider?: boolean;
}

export const SettingsToggleRow: React.FC<SettingsToggleRowProps> = ({
  icon,
  label,
  desc,
  on,
  onToggle,
  disabled = false,
  indent = false,
  testID,
  accessibilityLabel,
  showDivider = true,
}) => (
  <TouchableOpacity
    accessibilityRole="switch"
    accessibilityState={{ checked: on, disabled }}
    accessibilityLabel={accessibilityLabel || label}
    disabled={disabled}
    onPress={() => onToggle(!on)}
    activeOpacity={0.8}
    style={[
      styles.row,
      indent && styles.rowIndent,
      disabled && styles.rowDisabled,
      showDivider && styles.rowDivider,
    ]}
    testID={testID || `settings-row-${label}`}
  >
    {icon ? <View style={styles.rowIcon}>{icon}</View> : null}
    <View style={styles.rowContent}>
      <Text style={styles.rowLabel}>{label}</Text>
      {desc ? <Text style={styles.rowDesc}>{desc}</Text> : null}
    </View>
    <SettingsToggle
      on={on}
      onToggle={onToggle}
      disabled={disabled}
      accessible={false}
    />
  </TouchableOpacity>
);

/* ── Radio Choice Row ───────────────────────────────────────────── */
interface SettingsChoiceRowProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  desc?: string;
  tag?: string;
  testID?: string;
}

export const SettingsChoiceRow: React.FC<SettingsChoiceRowProps> = ({
  label,
  selected,
  onPress,
  desc,
  tag,
  testID,
}) => (
  <TouchableOpacity
    accessibilityRole="radio"
    accessibilityState={{ selected }}
    accessibilityLabel={label}
    accessibilityHint={desc}
    onPress={onPress}
    activeOpacity={0.65}
    style={styles.choiceRow}
    testID={testID}
  >
    <View style={[styles.radioCircle, selected && styles.radioCircleSelected]}>
      {selected ? <View style={styles.radioDot} /> : null}
    </View>
    <View style={styles.choiceContent}>
      <View style={styles.choiceLabelRow}>
        <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>{label}</Text>
        {tag ? (
          <View style={styles.choiceTag}>
            <Text style={styles.choiceTagText}>{tag}</Text>
          </View>
        ) : null}
      </View>
      {desc ? <Text style={styles.choiceDesc}>{desc}</Text> : null}
    </View>
  </TouchableOpacity>
);

/* ── Selection Chip ─────────────────────────────────────────────── */
interface SettingsChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  wide?: boolean;
  activeColor?: {
    tint: string;
    border: string;
    ink?: string;
  };
}

export const SettingsChip: React.FC<SettingsChipProps> = ({
  label,
  selected,
  onPress,
  wide = false,
  activeColor,
}) => {
  const chipCustomStyle = selected && activeColor
    ? {
        backgroundColor: activeColor.tint,
        borderColor: activeColor.border,
      }
    : null;

  const textCustomStyle = selected && activeColor?.ink
    ? {
        color: activeColor.ink,
      }
    : null;

  return (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.chip,
        wide ? styles.chipWide : styles.chipStandard,
        selected && styles.chipSelected,
        chipCustomStyle,
      ]}
    >
      <Text
        style={[
          styles.chipText,
          selected && styles.chipTextSelected,
          textCustomStyle,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

/* ── Compact Native Picker Sheet ────────────────────────────────── */
interface CompactPickerSheetProps {
  open: boolean;
  title: string;
  options: Array<{ label: string; value: string; desc?: string }>;
  value: string;
  onPick: (val: string) => void;
  onClose: () => void;
}

export const CompactPickerSheet: React.FC<CompactPickerSheetProps> = ({
  open,
  title,
  options,
  value,
  onPick,
  onClose,
}) => (
  <Modal
    visible={open}
    transparent
    animationType="fade"
    onRequestClose={onClose}
    accessibilityViewIsModal
  >
    <Pressable style={styles.sheetOverlay} onPress={onClose}>
      <Pressable style={styles.sheetContainer} onPress={(e) => e.stopPropagation()}>
        <SafeAreaView edges={['bottom']}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{title}</Text>
          <ScrollView
            style={styles.sheetScroll}
            accessibilityRole="radiogroup"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {options.map((opt, index) => (
              <SettingsChoiceRow
                key={opt.value}
                label={opt.label}
                desc={opt.desc}
                selected={opt.value === value}
                onPress={() => {
                  onPick(opt.value);
                  onClose();
                }}
              />
            ))}
          </ScrollView>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            onPress={onClose}
            style={styles.sheetCancelButton}
            activeOpacity={0.7}
          >
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Pressable>
    </Pressable>
  </Modal>
);

/* ── Compact Confirm Sheet ──────────────────────────────────────── */
interface CompactConfirmSheetProps {
  open: boolean;
  title: string;
  desc?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const CompactConfirmSheet: React.FC<CompactConfirmSheetProps> = ({
  open,
  title,
  desc,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onClose,
}) => (
  <Modal
    visible={open}
    transparent
    animationType="fade"
    onRequestClose={onClose}
    accessibilityViewIsModal
  >
    <Pressable style={styles.sheetOverlay} onPress={onClose}>
      <Pressable style={styles.sheetContainer} onPress={(e) => e.stopPropagation()}>
        <SafeAreaView edges={['bottom']}>
          <View style={styles.sheetHandle} />
          <Text style={styles.confirmTitle}>{title}</Text>
          {desc ? <Text style={styles.confirmDesc}>{desc}</Text> : null}
          <View style={styles.confirmActions}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
              onPress={onClose}
              style={styles.confirmCancelBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.confirmCancelText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              onPress={() => {
                onConfirm();
                onClose();
              }}
              style={[
                styles.confirmActionBtn,
                destructive ? styles.confirmActionBtnDestructive : styles.confirmActionBtnPrimary,
              ]}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmActionText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Pressable>
    </Pressable>
  </Modal>
);

/* ── Styles ─────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: T.bg,
  },
  headerBackButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontFamily: settingsTypography.displaySemiBold,
    fontSize: 20,
    color: T.ink,
    letterSpacing: -0.2,
  },
  headerRight: {
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerPlaceholder: {
    width: 44,
  },
  sectionLabel: {
    fontFamily: settingsTypography.bodyBold,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: T.ink2,
    marginTop: 32,
    marginBottom: 10,
  },
  sectionLabelFirst: {
    marginTop: 18,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: T.line,
  },
  metricContainer: {
    gap: 3,
  },
  metricValue: {
    fontFamily: settingsTypography.displayBold,
    fontSize: 22,
    color: T.ink,
  },
  metricLabel: {
    fontFamily: settingsTypography.body,
    fontSize: 12,
    color: T.ink2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 58,
    paddingVertical: 10,
  },
  rowIndent: {
    paddingLeft: 34,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.line,
  },
  rowIcon: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowLabel: {
    fontFamily: settingsTypography.bodyMedium,
    fontSize: 15.5,
    color: T.ink,
  },
  rowDesc: {
    fontFamily: settingsTypography.body,
    fontSize: 12.5,
    color: T.ink3,
    lineHeight: 17,
  },
  rowValue: {
    fontFamily: settingsTypography.body,
    fontSize: 14,
    color: T.ink3,
    maxWidth: 160,
  },
  toggleTrack: {
    width: 46,
    height: 27,
    borderRadius: 999,
    position: 'relative',
    justifyContent: 'center',
  },
  toggleTrackOn: {
    backgroundColor: T.ink,
  },
  toggleTrackOff: {
    backgroundColor: T.surface,
    borderWidth: 1.5,
    borderColor: T.line,
  },
  toggleDisabled: {
    opacity: 0.4,
  },
  toggleThumb: {
    width: 21,
    height: 21,
    borderRadius: 11,
    position: 'absolute',
  },
  toggleThumbOn: {
    left: 21,
    backgroundColor: T.surface,
  },
  toggleThumbOff: {
    left: 2,
    backgroundColor: T.ink3,
  },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.line,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
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
  choiceContent: {
    flex: 1,
    gap: 2,
  },
  choiceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  choiceLabel: {
    fontFamily: settingsTypography.bodyMedium,
    fontSize: 15.5,
    color: T.ink,
  },
  choiceLabelSelected: {
    fontFamily: settingsTypography.bodyBold,
  },
  choiceTag: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: T.line,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  choiceTagText: {
    fontFamily: settingsTypography.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    color: T.ink2,
  },
  choiceDesc: {
    fontFamily: settingsTypography.body,
    fontSize: 12.5,
    color: T.ink3,
    lineHeight: 16,
  },
  chip: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: T.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipWide: {
    flex: 1,
  },
  chipStandard: {
    paddingHorizontal: 18,
  },
  chipSelected: {
    borderColor: T.ink,
    backgroundColor: T.surface2,
  },
  chipText: {
    fontFamily: settingsTypography.bodyMedium,
    fontSize: 14,
    color: T.ink,
  },
  chipTextSelected: {
    fontFamily: settingsTypography.bodyBold,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 23, 20, 0.4)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: T.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 20,
    maxHeight: '75%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.line,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontFamily: settingsTypography.bodyBold,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: T.ink2,
    marginBottom: 10,
  },
  sheetScroll: {
    maxHeight: 340,
  },
  sheetCancelButton: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: T.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  sheetCancelText: {
    fontFamily: settingsTypography.bodySemiBold,
    fontSize: 15,
    color: T.ink,
  },
  confirmTitle: {
    fontFamily: settingsTypography.displaySemiBold,
    fontSize: 18,
    color: T.ink,
    marginBottom: 8,
  },
  confirmDesc: {
    fontFamily: settingsTypography.body,
    fontSize: 14,
    color: T.ink2,
    lineHeight: 20,
    marginBottom: 20,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmCancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: T.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCancelText: {
    fontFamily: settingsTypography.bodySemiBold,
    fontSize: 15,
    color: T.ink,
  },
  confirmActionBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmActionBtnPrimary: {
    backgroundColor: T.ink,
  },
  confirmActionBtnDestructive: {
    backgroundColor: T.danger,
  },
  confirmActionText: {
    fontFamily: settingsTypography.bodySemiBold,
    fontSize: 15,
    color: T.surface,
  },
});
