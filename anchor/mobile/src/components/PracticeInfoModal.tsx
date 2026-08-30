import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, ChevronRight, Eye, Flame, Zap } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme';
import { safeHaptics } from '@/utils/haptics';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface PracticeInfoModalProps {
  isVisible: boolean;
  onDismiss: () => void;
}

type PracticeModeKey = 'deep-prime' | 'visualize' | 'focus' | 'release';

interface PracticeModeInfo {
  key: PracticeModeKey;
  title: string;
  outcome: string;
  metadata: string;
  expandedTeaching: string;
  accent: string;
  iconSurface: string;
  iconBorder: string;
  icon: (color: string) => React.ReactNode;
}

const PRACTICE_MODES: PracticeModeInfo[] = [
  {
    key: 'deep-prime',
    title: 'DEEP PRIME',
    outcome: 'Stay with it longer.',
    metadata: '2–10 min · Build sustained attention',
    expandedTeaching:
      'Stay with your anchor long enough for the intention to settle and compound.',
    accent: '#D4AF37',
    iconSurface: 'rgba(212, 175, 55, 0.12)',
    iconBorder: 'rgba(212, 175, 55, 0.28)',
    icon: (color) => <Zap size={15} color={color} />,
  },
  {
    key: 'visualize',
    title: 'VISUALIZE',
    outcome: 'See the outcome before it happens.',
    metadata: '1–5 min · Mental rehearsal',
    expandedTeaching:
      'Picture a specific future moment where the intention is already real.',
    accent: '#78B4D1',
    iconSurface: 'rgba(120, 180, 209, 0.12)',
    iconBorder: 'rgba(120, 180, 209, 0.28)',
    icon: (color) => <Eye size={15} color={color} />,
  },
  {
    key: 'focus',
    title: 'FOCUS SESSION',
    outcome: 'Come back to what matters.',
    metadata: '10–60 sec · Quick reset',
    expandedTeaching:
      'Use a short session to return quickly to the anchor and the next step.',
    accent: '#AD99D2',
    iconSurface: 'rgba(173, 153, 210, 0.12)',
    iconBorder: 'rgba(173, 153, 210, 0.28)',
    icon: (color) => <Zap size={15} color={color} />,
  },
  {
    key: 'release',
    title: 'RELEASE',
    outcome: 'Close the loop.',
    metadata: 'Completed intentions · Let go',
    expandedTeaching:
      'Let go when an intention has completed its work while preserving its history.',
    accent: '#C8875A',
    iconSurface: 'rgba(200, 135, 90, 0.12)',
    iconBorder: 'rgba(200, 135, 90, 0.28)',
    icon: (color) => <Flame size={15} color={color} />,
  },
];

export const PracticeInfoModal: React.FC<PracticeInfoModalProps> = ({
  isVisible,
  onDismiss,
}) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotionEnabled();
  const [isMounted, setIsMounted] = useState(isVisible);
  const [expandedKey, setExpandedKey] = useState<PracticeModeKey | null>(null);

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(300)).current;

  const entranceEasing = useMemo(() => Easing.bezier(0.32, 0.72, 0, 1), []);

  useEffect(() => {
    if (isVisible) {
      setIsMounted(true);
      setExpandedKey(null);
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: 0,
          duration: reduceMotion ? 1 : 320,
          easing: entranceEasing,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 300,
        duration: reduceMotion ? 1 : 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setIsMounted(false);
      }
    });
  }, [entranceEasing, isVisible, overlayOpacity, reduceMotion, sheetTranslateY]);

  const handleToggleRow = useCallback(
    (key: PracticeModeKey) => {
      safeHaptics.selection();
      if (!reduceMotion) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
      setExpandedKey((prev) => (prev === key ? null : key));
    },
    [reduceMotion]
  );

  const handleDismiss = useCallback(() => {
    safeHaptics.selection();
    onDismiss();
  }, [onDismiss]);

  if (!isMounted) {
    return null;
  }

  return (
    <Modal
      transparent
      visible={isMounted}
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <View style={styles.root} pointerEvents="box-none">
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={handleDismiss} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(spacing.lg, insets.bottom + spacing.sm),
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
          accessibilityViewIsModal={true}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.heading}>CHOOSE WHAT YOU NEED</Text>
            <Text style={styles.supportingCopy}>
              Each practice strengthens your anchor differently.
            </Text>
          </View>

          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.rowsContainer}>
              {PRACTICE_MODES.map((mode, index) => {
                const isExpanded = expandedKey === mode.key;
                const isLast = index === PRACTICE_MODES.length - 1;

                return (
                  <View key={mode.key} style={styles.rowWrapper}>
                    <TouchableOpacity
                      activeOpacity={0.76}
                      onPress={() => handleToggleRow(mode.key)}
                      style={[
                        styles.row,
                        isExpanded && styles.rowExpanded,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`${mode.title}: ${mode.outcome}. ${mode.metadata}. ${
                        isExpanded ? 'Expanded. Tap to collapse.' : 'Tap to read more.'
                      }`}
                      accessibilityState={{ expanded: isExpanded }}
                    >
                      <View
                        style={[
                          styles.iconContainer,
                          {
                            backgroundColor: mode.iconSurface,
                            borderColor: mode.iconBorder,
                          },
                        ]}
                      >
                        {mode.icon(mode.accent)}
                      </View>

                      <View style={styles.rowCenter}>
                        <Text style={[styles.modeTitle, { color: mode.accent }]}>
                          {mode.title}
                        </Text>
                        <Text style={styles.modeOutcome}>{mode.outcome}</Text>
                        <Text style={styles.modeMetadata}>{mode.metadata}</Text>
                      </View>

                      <View style={styles.chevronWrap}>
                        {isExpanded ? (
                          <ChevronDown size={16} color={mode.accent} />
                        ) : (
                          <ChevronRight
                            size={16}
                            color="rgba(244, 239, 230, 0.35)"
                          />
                        )}
                      </View>
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.expandedContent}>
                        <Text style={styles.expandedText}>
                          {mode.expandedTeaching}
                        </Text>
                      </View>
                    )}

                    {!isLast && <View style={styles.rowDivider} />}
                  </View>
                );
              })}
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Got It"
              activeOpacity={0.84}
              onPress={handleDismiss}
              style={styles.cta}
            >
              <Text style={styles.ctaText}>Got It</Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 9, 13, 0.68)',
  },
  sheet: {
    maxHeight: '84%',
    backgroundColor: '#121820',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderColor: 'rgba(217, 179, 108, 0.22)',
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 18,
    backgroundColor: 'rgba(244, 239, 230, 0.22)',
  },
  header: {
    marginBottom: 16,
  },
  heading: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 18,
    letterSpacing: 1.4,
    color: colors.bone,
    textTransform: 'uppercase',
  },
  supportingCopy: {
    marginTop: 4,
    fontFamily: typography.fontFamily.sans,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(244, 239, 230, 0.58)',
  },
  scrollContent: {
    paddingBottom: spacing.sm,
  },
  rowsContainer: {
    borderRadius: 16,
    backgroundColor: 'rgba(244, 239, 230, 0.025)',
    borderWidth: 1,
    borderColor: 'rgba(244, 239, 230, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 20,
  },
  rowWrapper: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 13,
  },
  rowExpanded: {
    paddingBottom: 8,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowCenter: {
    flex: 1,
    minWidth: 0,
  },
  modeTitle: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  modeOutcome: {
    fontFamily: typography.fontFamily.bodySerif,
    fontSize: 16,
    lineHeight: 20,
    color: colors.bone,
  },
  modeMetadata: {
    marginTop: 3,
    fontFamily: typography.fontFamily.sans,
    fontSize: 11,
    color: 'rgba(244, 239, 230, 0.46)',
  },
  chevronWrap: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  expandedContent: {
    paddingLeft: 49,
    paddingRight: 12,
    paddingBottom: 12,
  },
  expandedText: {
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 13.5,
    lineHeight: 19,
    color: 'rgba(244, 239, 230, 0.82)',
  },
  rowDivider: {
    height: 1,
    backgroundColor: 'rgba(244, 239, 230, 0.05)',
  },
  cta: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(217, 179, 108, 0.32)',
    backgroundColor: 'rgba(217, 179, 108, 0.05)',
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: colors.gold,
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 13,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
});
