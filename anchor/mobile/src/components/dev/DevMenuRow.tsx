import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { SettingsRow } from '@/components/settings/SettingsRow';
import { colors } from '@/theme/v2';
import { devMenuStyles } from './devMenuStyles';

type Props = Extract<React.ComponentProps<typeof SettingsRow>, { title: string }>;

export function DevMenuRow({ title, subtitle, type, toggleValue, onToggle, onPress, disabled, rightElement, testID }: Props) {
  const toggle = type === 'toggle';
  return (
    <Pressable
      testID={testID ?? `settings-row-${title}`}
      accessibilityRole={toggle ? 'switch' : 'button'}
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      accessibilityState={{ disabled: Boolean(disabled), ...(toggle ? { checked: Boolean(toggleValue) } : {}) }}
      onPress={toggle ? () => onToggle?.(!toggleValue) : onPress}
      disabled={disabled}
      style={({ pressed }) => [devMenuStyles.actionRow, styles.row, (pressed || disabled) && styles.dimmed]}
    >
      <View style={styles.copy}>
        <Text style={devMenuStyles.actionRowText}>{title}</Text>
        {subtitle ? <Text style={devMenuStyles.hint}>{subtitle}</Text> : null}
      </View>
      {toggle ? (
        <Switch
          accessible={false}
          value={Boolean(toggleValue)}
          onValueChange={onToggle}
          disabled={disabled}
          trackColor={{ false: '#D6CFC3', true: colors.ink.base }}
          thumbColor="#FAF7F2"
        />
      ) : rightElement}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  copy: { flex: 1 },
  dimmed: { opacity: 0.5 },
});
