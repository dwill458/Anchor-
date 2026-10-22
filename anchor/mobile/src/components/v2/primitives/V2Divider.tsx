import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '@/theme/v2';
export function V2Divider({ style }: { style?: StyleProp<ViewStyle> }) { return <View accessibilityElementsHidden style={[styles.line, style]} />; }
const styles = StyleSheet.create({ line: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border.default } });
