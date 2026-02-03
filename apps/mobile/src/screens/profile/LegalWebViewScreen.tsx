/**
 * Anchor App - Legal WebView Screen
 *
 * Displays legal documents in-app when available.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useRoute, RouteProp } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import type { RootStackParamList } from '@/types';
import { ScreenHeader, ZenBackground } from '@/components/common';
import { colors, spacing, typography } from '@/theme';

const IS_ANDROID = Platform.OS === 'android';

type LegalWebViewRouteProp = RouteProp<RootStackParamList, 'LegalWebView'>;

export const LegalWebViewScreen: React.FC = () => {
  const route = useRoute<LegalWebViewRouteProp>();
  const { title, url } = route.params;

  const CardWrapper = IS_ANDROID ? View : BlurView;
  const cardProps = IS_ANDROID ? {} : { intensity: 10, tint: 'dark' as const };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ZenBackground />
      <View style={styles.container}>
        <ScreenHeader title={title} />
        {!url ? (
          <CardWrapper {...cardProps} style={styles.card}>
            <Text style={styles.cardTitle}>Link not available yet.</Text>
            <Text style={styles.cardText}>
              Please check back soon or contact support if you need a copy.
            </Text>
          </CardWrapper>
        ) : (
          <View style={styles.webviewContainer}>
            <WebView
              source={{ uri: url }}
              style={styles.webview}
              startInLoadingState
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  container: {
    flex: 1,
  },
  webviewContainer: {
    flex: 1,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    backgroundColor: 'rgba(26, 26, 29, 0.6)',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  card: {
    borderRadius: 18,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    backgroundColor: IS_ANDROID ? 'rgba(26, 26, 29, 0.85)' : 'rgba(26, 26, 29, 0.4)',
  },
  cardTitle: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
    marginBottom: spacing.sm,
  },
  cardText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    lineHeight: typography.lineHeights.body2,
  },
});
