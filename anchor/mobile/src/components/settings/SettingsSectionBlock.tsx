import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

interface SettingsSectionBlockProps {
  children: React.ReactNode;
  isDev?: boolean;
  /** Editorial sections use hairlines rather than the legacy rounded-card treatment. */
  flat?: boolean;
  style?: ViewStyle;
}

export const SettingsSectionBlock: React.FC<SettingsSectionBlockProps> = ({
  children,
  isDev = false,
  flat = false,
  style,
}) => (
  <View
    style={[
      styles.base,
      flat ? styles.flatBlock : isDev ? styles.devBlock : styles.defaultBlock,
      style,
    ]}
  >
    {children}
  </View>
);

const styles = StyleSheet.create({
  base: {
    marginHorizontal: 16,
    marginBottom: 4,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 0.5,
  },
  defaultBlock: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(212,175,55,0.15)',
  },
  devBlock: {
    backgroundColor: 'rgba(74,222,128,0.04)',
    borderColor: 'rgba(74,222,128,0.2)',
  },
  flatBlock: {
    marginHorizontal: 0,
    marginBottom: 0,
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
});
