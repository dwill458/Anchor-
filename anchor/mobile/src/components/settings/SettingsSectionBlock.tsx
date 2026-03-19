import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

interface SettingsSectionBlockProps {
  children: React.ReactNode;
  isDev?: boolean;
  style?: ViewStyle;
}

export const SettingsSectionBlock: React.FC<SettingsSectionBlockProps> = ({
  children,
  isDev = false,
  style,
}) => (
  <View
    style={[
      styles.base,
      isDev ? styles.devBlock : styles.defaultBlock,
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
});
