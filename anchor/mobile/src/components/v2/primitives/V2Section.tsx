import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { spacing } from '@/theme/v2';
export function V2Section({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) { return <View testID={testID} style={[styles.section, style]}>{children}</View>; }
export const V2ContentStack = ({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) => <View style={[styles.stack, style]}>{children}</View>;
const styles = StyleSheet.create({ section: { gap: spacing[3], marginBottom: spacing[8] }, stack: { gap: spacing[4] } });
