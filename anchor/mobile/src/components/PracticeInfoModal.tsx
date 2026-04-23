import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, spacing, typography } from '@/theme';

interface PracticeInfoModalProps {
  isVisible: boolean;
  onDismiss: () => void;
}

type ModeCard = {
  key: 'imprint' | 'deep-prime' | 'seal';
  title: string;
  action: string;
  description: string;
  accent: string;
  iconStroke: string;
  surface: string;
  border: string;
  iconSurface: string;
};

const SHEET_BACKGROUND = '#131920';
const SHEET_BORDER = 'rgba(212,175,55,0.15)';
const HANDLE_COLOR = 'rgba(192,192,192,0.25)';
const OVERLAY_COLOR = 'rgba(8,12,16,0.6)';
const GOLD_DIM = '#8A7020';
const SEAL_TEXT = '#9B89C4';

const MODE_CARDS: ModeCard[] = [
  {
    key: 'imprint',
    title: 'Imprint',
    action: 'Trace or hold. Active or still.',
    description:
      'Build the anchor into your visual memory. Focus Session: trace and lock in. Stabilize: sit with it and let it settle.',
    accent: colors.gold,
    iconStroke: colors.gold,
    surface: 'rgba(212,175,55,0.06)',
    border: 'rgba(212,175,55,0.2)',
    iconSurface: 'rgba(212,175,55,0.15)',
  },
  {
    key: 'deep-prime',
    title: 'Deep Prime',
    action: 'Extended focus. Customizable duration.',
    description:
      'When you have time and want to go deeper. Sustained attention builds thicker thread strength.',
    accent: colors.silver,
    iconStroke: colors.silver,
    surface: 'rgba(192,192,192,0.04)',
    border: 'rgba(192,192,192,0.15)',
    iconSurface: 'rgba(192,192,192,0.1)',
  },
  {
    key: 'seal',
    title: 'Seal',
    action: 'Close the loop. Release the hold.',
    description:
      'Finalize the session with release. The anchor locks deepest when you step back and let go.',
    accent: SEAL_TEXT,
    iconStroke: SEAL_TEXT,
    surface: 'rgba(62,44,91,0.2)',
    border: 'rgba(62,44,91,0.5)',
    iconSurface: 'rgba(62,44,91,0.4)',
  },
];

function ModeGlyph({ mode, stroke }: { mode: ModeCard['key']; stroke: string }) {
  if (mode === 'deep-prime') {
    return (
      <View style={styles.glyphFrame}>
        <View style={[styles.boltSegment, styles.boltTop, { backgroundColor: stroke }]} />
        <View style={[styles.boltSegment, styles.boltMid, { backgroundColor: stroke }]} />
        <View style={[styles.boltSegment, styles.boltBottom, { backgroundColor: stroke }]} />
      </View>
    );
  }

  if (mode === 'seal') {
    return (
      <View style={styles.glyphFrame}>
        <View style={[styles.sealArc, styles.sealArcLeft, { borderColor: stroke }]} />
        <View style={[styles.sealArc, styles.sealArcRight, { borderColor: stroke }]} />
        <View style={[styles.sealStem, { backgroundColor: stroke }]} />
      </View>
    );
  }

  return (
    <View style={styles.glyphFrame}>
      <View style={[styles.ringOuter, { borderColor: stroke }]} />
      <View style={[styles.ringInner, { borderColor: stroke }]} />
      <View style={[styles.rayVertical, { backgroundColor: stroke }]} />
      <View style={[styles.rayHorizontal, { backgroundColor: stroke }]} />
      <View style={[styles.rayDiagonalLeft, { backgroundColor: stroke }]} />
      <View style={[styles.rayDiagonalRight, { backgroundColor: stroke }]} />
    </View>
  );
}

export const PracticeInfoModal: React.FC<PracticeInfoModalProps> = ({
  isVisible,
  onDismiss,
}) => {
  const [isMounted, setIsMounted] = useState(isVisible);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(320)).current;

  const entranceEasing = useMemo(() => Easing.bezier(0.32, 0.72, 0, 1), []);

  useEffect(() => {
    if (isVisible) {
      setIsMounted(true);
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: 0,
          duration: 380,
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
        toValue: 320,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setIsMounted(false);
      }
    });
  }, [entranceEasing, isVisible, overlayOpacity, sheetTranslateY]);

  if (!isMounted) {
    return null;
  }

  return (
    <Modal
      transparent
      visible={isMounted}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.root} pointerEvents="box-none">
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={onDismiss} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
          accessibilityViewIsModal={true}
        >
          <View style={styles.handle} />

          <Text style={styles.title}>Three Modes to Prime</Text>
          <Text style={styles.subtitle}>
            Three core priming modes. Four ways to practice them. Build thread strength
            however you have time.
          </Text>

          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.cards}>
              {MODE_CARDS.map((card) => (
                <View
                  key={card.key}
                  style={[
                    styles.card,
                    {
                      backgroundColor: card.surface,
                      borderColor: card.border,
                    },
                  ]}
                >
                  <View style={[styles.iconWrap, { backgroundColor: card.iconSurface }]}>
                    <ModeGlyph mode={card.key} stroke={card.iconStroke} />
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={[styles.cardTitle, { color: card.accent }]}>{card.title}</Text>
                    <Text style={styles.cardAction}>{card.action}</Text>
                    <Text style={styles.cardDescription}>{card.description}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.divider} />

            <View style={styles.note}>
              <Text style={styles.noteIcon}>⬡</Text>
              <Text style={styles.noteText}>
                Every session type, regardless of length, adds to your{' '}
                <Text style={styles.noteStrong}>thread strength</Text>. The goal isn&apos;t
                volume. It&apos;s return.
              </Text>
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.86}
              onPress={onDismiss}
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
    backgroundColor: OVERLAY_COLOR,
  },
  sheet: {
    maxHeight: '86%',
    backgroundColor: SHEET_BACKGROUND,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: SHEET_BORDER,
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 24,
    backgroundColor: HANDLE_COLOR,
  },
  title: {
    color: colors.bone,
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 18,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  subtitle: {
    color: colors.silver,
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 24,
  },
  scrollContent: {
    paddingBottom: spacing.xs,
  },
  cards: {
    gap: 10,
    marginBottom: 28,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    gap: 14,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  glyphFrame: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOuter: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  ringInner: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    borderWidth: 1.5,
  },
  rayVertical: {
    position: 'absolute',
    width: 1.5,
    height: 18,
    borderRadius: 2,
  },
  rayHorizontal: {
    position: 'absolute',
    width: 18,
    height: 1.5,
    borderRadius: 2,
  },
  rayDiagonalLeft: {
    position: 'absolute',
    width: 1.5,
    height: 18,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  rayDiagonalRight: {
    position: 'absolute',
    width: 1.5,
    height: 18,
    borderRadius: 2,
    transform: [{ rotate: '-45deg' }],
  },
  boltSegment: {
    position: 'absolute',
    borderRadius: 1,
  },
  boltTop: {
    width: 7,
    height: 2,
    top: 2,
    left: 7,
    transform: [{ rotate: '-22deg' }],
  },
  boltMid: {
    width: 10,
    height: 2,
    top: 8,
    left: 4,
    transform: [{ rotate: '55deg' }],
  },
  boltBottom: {
    width: 7,
    height: 2,
    bottom: 2,
    left: 7,
    transform: [{ rotate: '-22deg' }],
  },
  sealArc: {
    position: 'absolute',
    width: 9,
    height: 11,
    borderWidth: 1.5,
    borderTopColor: 'transparent',
    borderBottomLeftRadius: 9,
    borderBottomRightRadius: 9,
  },
  sealArcLeft: {
    left: 1,
    borderRightColor: 'transparent',
    transform: [{ rotate: '18deg' }],
  },
  sealArcRight: {
    right: 1,
    borderLeftColor: 'transparent',
    transform: [{ rotate: '-18deg' }],
  },
  sealStem: {
    position: 'absolute',
    width: 1.5,
    height: 9,
    bottom: 1,
    borderRadius: 2,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 13,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  cardAction: {
    color: colors.bone,
    fontFamily: typography.fontFamily.bodySerif,
    fontSize: 18,
    lineHeight: 23,
    marginBottom: 5,
  },
  cardDescription: {
    color: colors.silver,
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 14,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    marginBottom: 20,
    backgroundColor: 'transparent',
    borderTopWidth: 1,
    borderColor: SHEET_BORDER,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(212,175,55,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.1)',
  },
  noteIcon: {
    color: GOLD_DIM,
    fontSize: 16,
    lineHeight: 20,
    fontFamily: typography.fontFamily.serif,
  },
  noteText: {
    flex: 1,
    color: colors.silver,
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 14,
    lineHeight: 22,
  },
  noteStrong: {
    color: colors.gold,
    fontFamily: typography.fontFamily.bodySerif,
  },
  cta: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  ctaText: {
    color: colors.gold,
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 14,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
  },
});
