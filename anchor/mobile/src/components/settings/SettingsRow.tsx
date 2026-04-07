import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Switch,
  type ViewStyle,
} from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { colors } from '@/theme';

interface LegacySettingsRowProps {
  icon?: LucideIcon;
  label: string;
  description?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  disabled?: boolean;
  style?: ViewStyle;
  showDivider?: boolean;
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
  const accentColor = isDev ? '#4ade80' : colors.gold;
  const titleColor = modern ? props.titleColor ?? (isDev ? '#4ade80' : colors.bone) : colors.bone;
  const subtitleColor = isDev ? 'rgba(74,222,128,0.6)' : '#8896a8';
  const dividerColor = isDev ? 'rgba(74,222,128,0.2)' : 'rgba(212,175,55,0.15)';
  const onToggle = modern ? props.onToggle : undefined;
  const toggleValue = modern ? props.toggleValue ?? false : false;
  const onPress =
    modern && props.type === 'toggle' && onToggle
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
          <Text style={styles.chevron}>›</Text>
        </View>
      );
    }

    if (props.type === 'toggle') {
      return (
        <View style={styles.right}>
          <Switch
            value={toggleValue}
            onValueChange={onToggle}
            trackColor={{ false: '#232d3f', true: accentColor }}
            thumbColor={colors.bone}
            ios_backgroundColor="#232d3f"
          />
        </View>
      );
    }

    return null;
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      style={({ pressed }) => [
        styles.touchable,
        style,
        pressed && !disabled && onPress ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <View style={styles.container}>
        <View style={styles.left}>
          {Icon ? <Icon color={colors.gold} size={20} style={styles.icon} /> : null}
          <View style={styles.textContainer}>
            <Text style={[styles.title, { color: titleColor }]} numberOfLines={2}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: subtitleColor }]} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
            {value ? (
              <Text style={[styles.value, { color: accentColor }]} numberOfLines={2}>
                {value}
              </Text>
            ) : null}
          </View>
        </View>

        {renderRight()}
      </View>
      {showDivider ? <View style={[styles.divider, { backgroundColor: dividerColor }]} /> : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  touchable: {
    width: '100%',
  },
  pressed: {
    backgroundColor: 'rgba(255,255,255,0.04)',
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
  title: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    lineHeight: 18,
  },
  subtitle: {
    marginTop: 3,
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    lineHeight: 16,
  },
  value: {
    marginTop: 3,
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    lineHeight: 16,
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
});
