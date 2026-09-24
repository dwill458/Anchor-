import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme/v2';

type Props = { children: React.ReactNode; scroll?: boolean; keyboardAvoiding?: boolean; style?: StyleProp<ViewStyle>; contentContainerStyle?: ScrollViewProps['contentContainerStyle']; keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps']; keyboardDismissMode?: ScrollViewProps['keyboardDismissMode']; testID?: string; edges?: readonly ('top' | 'bottom' | 'left' | 'right')[] };

export function V2Screen({ children, scroll = false, keyboardAvoiding = false, style, contentContainerStyle, keyboardShouldPersistTaps, keyboardDismissMode, testID, edges = ['top', 'bottom'] }: Props) {
  const content = scroll ? <ScrollView testID={testID} keyboardShouldPersistTaps={keyboardShouldPersistTaps} keyboardDismissMode={keyboardDismissMode} contentContainerStyle={[styles.scrollContent, contentContainerStyle]} showsVerticalScrollIndicator={false}>{children}</ScrollView> : <View testID={testID} style={[styles.content, style]}>{children}</View>;
  const wrapped = keyboardAvoiding ? <KeyboardAvoidingView style={styles.flex} behavior={Platform.select({ ios: 'padding', android: undefined })}>{content}</KeyboardAvoidingView> : content;
  return <SafeAreaView style={[styles.safe, scroll && style]} edges={edges}>{wrapped}</SafeAreaView>;
}

const styles = StyleSheet.create({ flex: { flex: 1 }, safe: { flex: 1, backgroundColor: colors.canvas }, content: { flex: 1, paddingHorizontal: spacing[6] }, scrollContent: { paddingHorizontal: spacing[6], paddingTop: spacing[5], paddingBottom: spacing[9] } });
