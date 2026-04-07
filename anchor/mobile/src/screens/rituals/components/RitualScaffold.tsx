import React from 'react';
import {
  View,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme';
import { ZenBackground } from '@/components/common';

interface RitualScaffoldProps {
  children: React.ReactNode;
  showOrbs?: boolean;
  overlayOpacity?: number;
  contentStyle?: StyleProp<ViewStyle>;
}

export const RitualScaffold: React.FC<RitualScaffoldProps> = ({
  children,
  showOrbs = true,
  overlayOpacity = 0.45,
  contentStyle,
}) => {
  return (
    <View style={styles.container}>
      <ZenBackground showOrbs={showOrbs} orbOpacity={0.12} animationDuration={700} />
      <View
        pointerEvents="none"
        style={[styles.overlay, { opacity: overlayOpacity }]}
      />

      <SafeAreaView style={[styles.safeArea, contentStyle]} edges={['top', 'bottom']}>
        {children}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.ritual.overlay,
  },
  safeArea: {
    flex: 1,
  },
});
