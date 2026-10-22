import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Switch,
  type ViewStyle,
} from 'react-native';
import { ChevronRight, LucideIcon } from 'lucide-react-native';
import { settingsColors as v2Colors, settingsTypography as v2Typography } from './settingsTheme';

interface LegacySettingsRowProps {
  icon?: LucideIcon;
  label: string;
  description?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  disabled?: boolean;
  style?: ViewStyle;
  showDivider?: boolean;
  testID?: string;
}

interface ModernSettingsRowProps {
  title: string;
  subtitle?: string;
  value?: string;
  type: 'chevron' | 'toggle' | 'static' | 'none';
  titleColor?: string;
  onPress?: () => void;
  toggleValue?: boolean;
  onToggle?: (value: boolean) => void;
  disabled?: boolean;
  rightElement?: React.ReactNode;
  isDev?: boolean;
  style?: ViewStyle;
  showDivider?: boolean;
  testID?: string;
}

type SettingsRowProps = LegacySettingsRowProps | ModernSettingsRowProps;

const isModernRow = (props: SettingsRowProps): props is ModernSettingsRowProps =>
  'title' in props || 'type' in props;

export const SettingsRow: React.FC<SettingsRowProps> = (props) => {
  const modern = isModernRow(props);
  const Icon = modern ? undefined : props.icon;
  const title = modern ? props.title : props.label;
  const subtitle = modern ? props.subtitle : props.description;
  const value = modern ? props.value : undefined;
  const disabled = props.disabled ?? false;
  const style = props.style;
  const showDivider = props.showDivider ?? true;
  const isDev = modern ? props.isDev ?? false : false;
  const accentColor = isDev ? '#047857' : v2Colors.text.primary;
  const titleColor = modern
    ? props.titleColor ?? (isDev ? '#047857' : v2Colors.text.primary)
    : v2Colors.text.primary;
  const subtitleColor = isDev ? 'rgba(4,120,87,0.7)' : v2Colors.text.secondary;
  const dividerColor = isDev ? 'rgba(4,120,87,0.2)' : v2Colors.border.default;
  const onToggle = modern ? props.onToggle : undefined;
  const toggleValue = modern ? props.toggleValue ?? false : false;
  const rowType = modern ? props.type : 'none';
  const onPress =
    modern && rowType === 'toggle' && onToggle
      ? () => onToggle(!toggleValue)
      : props.onPress;

  const renderRight = () => {
    if (props.rightElement) {
      return <View style={styles.right}>{props.rightElement}</View>;
    }

    if (!modern) {
      return null;
    }

    if (props.type === 'chevron') {
      return (
        <View style={styles.right}>
          <ChevronRight color={v2Colors.text.secondary} size={16} strokeWidth={1.5} />
        </View>
      );
    }

    if (props.type === 'toggle') {
      return (
        <View style={styles.right}>
          <Switch
            value={toggleValue}
            onValueChange={onToggle}
            trackColor={{ false: v2Colors.border.default, true: isDev ? '#047857' : v2Colors.text.primary }}
            thumbColor={v2Colors.surface}
            ios_backgroundColor={v2Colors.border.default}
            disabled={disabled}
          />
        </View>
      );
    }

    return null;
  };

  const rowTestId = props.testID ?? `settings-row-${title}`;

  return (
    <Pressable
      testID={rowTestId}
      accessibilityRole={modern && props.type === 'toggle' ? 'switch' : onPress ? 'button' : undefined}
      accessibilityState={modern && props.type === 'toggle' ? { checked: toggleValue, disabled } : { disabled }}
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      accessibilityValue={value ? { text: value } : undefined}
      onPress={onPress}
      disabled={disabled || !onPress}
      style={({ pressed }) => [
        styles.touchable,
        style,
        pressed && !disabled && onPress ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <View style={[styles.container, modern && styles.modernContainer]}>
        <View style={styles.left}>
          {Icon ? <Icon color={v2Colors.text.primary} size={20} style={styles.icon} /> : null}
          <View style={[styles.textContainer, modern && styles.modernTextContainer]}>
            <Text style={[styles.title, modern && styles.modernTitle, { color: titleColor }]} numberOfLines={2}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[styles.subtitle, modern && styles.modernSubtitle, { color: subtitleColor }]} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
            {value && rowType !== 'chevron' ? (
              <Text style={[styles.value, modern && styles.modernValue, { color: accentColor }]} numberOfLines={2}>
                {value}
              </Text>
            ) : null}
          </View>
        </View>

        {value && rowType === 'chevron' ? (
          <Text style={[styles.chevronValue, { color: subtitleColor }]} numberOfLines={1}>
            {value}
          </Text>
        ) : null}

        {renderRight()}
      </View>
      {showDivider ? <View style={[styles.divider, modern && styles.modernDivider, { backgroundColor: dividerColor }]} /> : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  touchable: {
    width: '100%',
  },
  pressed: {
    backgroundColor: 'rgba(23,23,23,0.04)',
  },
  disabled: {
    opacity: 0.4,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  modernContainer: {
    minHeight: 52,
    paddingHorizontal: 0,
    paddingVertical: 10,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  icon: {
    marginRight: 12,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  modernTextContainer: {
    paddingRight: 6,
  },
  title: {
    fontSize: 14,
    fontFamily: v2Typography.body,
    lineHeight: 18,
  },
  modernTitle: {
    fontFamily: v2Typography.bodyMedium,
    fontSize: 15,
    lineHeight: 20,
  },
  subtitle: {
    marginTop: 3,
    fontSize: 12,
    fontFamily: v2Typography.body,
    lineHeight: 16,
  },
  modernSubtitle: {
    marginTop: 3,
    fontFamily: v2Typography.body,
    fontSize: 12.5,
    lineHeight: 17,
  },
  value: {
    marginTop: 3,
    fontSize: 12,
    fontFamily: v2Typography.body,
    lineHeight: 16,
  },
  modernValue: {
    marginTop: 3,
    fontFamily: v2Typography.body,
    fontSize: 13,
    lineHeight: 17,
  },
  chevronValue: {
    fontFamily: v2Typography.body,
    fontSize: 13.5,
    marginRight: 8,
  },
  right: {
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevron: {
    color: '#8896a8',
    fontSize: 18,
    lineHeight: 18,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 20,
    marginRight: 20,
  },
  modernDivider: {
    marginLeft: 0,
    marginRight: 0,
  },
});
