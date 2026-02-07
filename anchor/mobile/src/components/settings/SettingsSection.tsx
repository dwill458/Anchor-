/**
 * Anchor App - Settings Section Component
 *
 * Collapsible section container for grouping settings.
 * Uses BlurView on iOS and solid background on Android.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { ChevronDown } from 'lucide-react-native';
import { LucideIcon } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme';

interface SettingsSectionProps {
  title: string;
  description?: string;
  icon: LucideIcon;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  style?: ViewStyle;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  description,
  icon: Icon,
  children,
  defaultExpanded = true,
  style,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const rotateAnim = React.useRef(new Animated.Value(defaultExpanded ? 1 : 0)).current;

  const handleToggle = () => {
    setExpanded(!expanded);
    Animated.timing(rotateAnim, {
      toValue: !expanded ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const chevronRotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={[styles.wrapper, style]}>
      {/* Section Header */}
      <TouchableOpacity
        onPress={handleToggle}
        activeOpacity={0.7}
        style={styles.headerTouchable}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Icon color={colors.gold} size={20} />
            <View style={styles.headerTextContainer}>
              <Text style={styles.title}>{title}</Text>
              {description && <Text style={styles.description}>{description}</Text>}
            </View>
          </View>
          <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
            <ChevronDown color={colors.silver} size={20} />
          </Animated.View>
        </View>
      </TouchableOpacity>

      {/* Section Content */}
      {expanded && (
        <View style={styles.content}>
          {Platform.OS === 'ios' && (
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          )}
          <View style={styles.contentInner}>{children}</View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
    backgroundColor:
      Platform.OS === 'android' ? 'rgba(26, 26, 29, 0.9)' : 'transparent',
  },
  headerTouchable: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor:
      Platform.OS === 'android' ? 'rgba(26, 26, 29, 0.9)' : 'transparent',
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: spacing.md,
  },
  title: {
    fontSize: typography.sizes.caption,
    fontWeight: '700',
    color: colors.gold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  description: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    lineHeight: typography.lineHeights.caption,
  },
  content: {
    backgroundColor:
      Platform.OS === 'android' ? 'rgba(26, 26, 29, 0.9)' : 'transparent',
    borderTopWidth: 1,
    borderTopColor: 'rgba(192, 192, 192, 0.1)',
  },
  contentInner: {
    overflow: 'hidden',
  },
});
