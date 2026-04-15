import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop, SvgXml } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ZenBackground } from '@/components/common';
import { LockIcon } from '@/components/icons';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import type { RootStackParamList } from '@/types';
import { colors, typography } from '@/theme';
import { withAlpha } from '@/utils/color';

type AuthGateNavigationProp = StackNavigationProp<RootStackParamList, 'AuthGate'>;

const PREVIEW_FADE_ID = 'auth-gate-preview-fade';
const VOID_GLOW_ID = 'auth-gate-void-glow';

function VoidGlowBackdrop() {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={styles.voidGlowSvg}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient id={VOID_GLOW_ID} cx="50%" cy="45%" rx="50%" ry="52%">
          <Stop offset="0%" stopColor={colors.gold} stopOpacity="0.12" />
          <Stop offset="42%" stopColor={colors.deepPurple} stopOpacity="0.22" />
          <Stop offset="100%" stopColor={colors.black} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill={`url(#${VOID_GLOW_ID})`} />
      <Circle cx="50" cy="46" r="22" fill={withAlpha(colors.gold, 0.03)} />
      <Circle cx="50" cy="46" r="14" fill={withAlpha(colors.deepPurple, 0.08)} />
    </Svg>
  );
}

function PreviewFadeOverlay() {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={styles.previewFadeSvg}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient id={PREVIEW_FADE_ID} cx="50%" cy="100%" rx="62%" ry="70%">
          <Stop offset="0%" stopColor={colors.black} stopOpacity="0" />
          <Stop offset="48%" stopColor={colors.deepPurple} stopOpacity="0.7" />
          <Stop offset="100%" stopColor={colors.black} stopOpacity="1" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill={`url(#${PREVIEW_FADE_ID})`} />
    </Svg>
  );
}

export default function AuthGateScreen() {
  const navigation = useNavigation<AuthGateNavigationProp>();
  const { height } = useWindowDimensions();
  const anchors = useAnchorStore((state) => state.anchors);
  const clearPendingForgeIntent = useAuthStore((state) => state.clearPendingForgeIntent);
  const clearPendingForgeResumeTarget = useAuthStore((state) => state.clearPendingForgeResumeTarget);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 480, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 480, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleDismiss = () => {
    clearPendingForgeIntent();
    clearPendingForgeResumeTarget();
    navigation.goBack();
  };

  const handleCreateAccount = () => {
    navigation.navigate('SignUp');
  };

  const handleSignIn = () => {
    navigation.navigate('Login');
  };

  const latestAnchor = useMemo(() => {
    if (anchors.length === 0) {
      return null;
    }

    return [...anchors].sort((left, right) => {
      const leftTime = new Date(left.updatedAt ?? left.createdAt).getTime();
      const rightTime = new Date(right.updatedAt ?? right.createdAt).getTime();
      return rightTime - leftTime;
    })[0] ?? null;
  }, [anchors]);

  const sigilSource = latestAnchor?.enhancedImageUrl ?? null;
  const sigilSvg = latestAnchor?.reinforcedSigilSvg ?? latestAnchor?.baseSigilSvg ?? null;
  const previewHeight = Math.round(height * 0.48);

  return (
    <View style={styles.root}>
      <ZenBackground variant="creation" showOrbs showGrain showVignette />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <AnimatedScreen
          opacity={fadeAnim}
          translateY={slideAnim}
          previewHeight={previewHeight}
          sigilSource={sigilSource}
          sigilSvg={sigilSvg}
          onDismiss={handleDismiss}
          onCreateAccount={handleCreateAccount}
          onSignIn={handleSignIn}
        />
      </SafeAreaView>
    </View>
  );
}

type AnimatedScreenProps = {
  opacity: Animated.Value;
  translateY: Animated.Value;
  previewHeight: number;
  sigilSource: string | null;
  sigilSvg: string | null;
  onDismiss: () => void;
  onCreateAccount: () => void;
  onSignIn: () => void;
};

function AnimatedScreen({
  opacity,
  translateY,
  previewHeight,
  sigilSource,
  sigilSvg,
  onDismiss,
  onCreateAccount,
  onSignIn,
}: AnimatedScreenProps) {
  return (
    <View style={styles.screen}>
      <Animated.View
        style={[
          styles.animatedShell,
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={[styles.previewZone, { height: previewHeight }]}>
          <LinearGradient
            colors={[colors.navy, colors.deepPurple, colors.black]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.82, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />

          <View style={styles.previewAmbientOrbLeft} />
          <View style={styles.previewAmbientOrbRight} />

          <View style={styles.previewContentWrap} pointerEvents="none">
            {sigilSource ? (
              <Image
                source={{ uri: sigilSource }}
                style={styles.previewImage}
                blurRadius={2}
                resizeMode="cover"
              />
            ) : sigilSvg ? (
              <View style={styles.previewSvgWrap}>
                <SvgXml xml={sigilSvg} width="100%" height="100%" />
              </View>
            ) : (
              <View style={styles.previewVoidWrap}>
                <VoidGlowBackdrop />
              </View>
            )}

            <View style={styles.previewDesaturateWash} />
            <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFillObject} />
          </View>

          <View style={styles.closeRow}>
            <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>

          <View style={styles.lockBadge}>
            <LockIcon size={22} color={colors.gold} />
          </View>

          <PreviewFadeOverlay />
        </View>

        <View style={[styles.contentZone, { top: previewHeight - 4 }]}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <Text style={styles.eyebrow}>SAVE YOUR ANCHOR</Text>

            <Text style={styles.headline}>
              Your anchor is{'\n'}
              ready to forge.
            </Text>

            <Text style={styles.bodyCopy}>
              Create a free account to save your work, track your practice, and continue forging.
            </Text>

            <Pressable
              onPress={onCreateAccount}
              accessibilityRole="button"
              accessibilityLabel="Forge Free for 7 Days"
              style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaButtonPressed]}
            >
              <Text style={styles.ctaText}>Forge Free for 7 Days</Text>
            </Pressable>

            <Text style={styles.trialNote}>Cancel anytime</Text>

            <Pressable
              onPress={onSignIn}
              accessibilityRole="button"
              accessibilityLabel="Already forging? Sign in"
              style={({ pressed }) => [styles.signInButton, pressed && styles.signInPressed]}
            >
              <Text style={styles.signInText}>
                Already forging? <Text style={styles.signInLink}>Sign in</Text>
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.black,
  },
  safeArea: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.black,
  },
  animatedShell: {
    flex: 1,
    backgroundColor: colors.black,
  },
  previewZone: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  previewAmbientOrbLeft: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    left: -80,
    top: 24,
    backgroundColor: withAlpha(colors.deepPurple, 0.34),
  },
  previewAmbientOrbRight: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    right: -70,
    top: 110,
    backgroundColor: withAlpha(colors.gold, 0.06),
  },
  previewContentWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    opacity: 0.55,
  },
  previewSvgWrap: {
    width: '84%',
    height: '84%',
    opacity: 0.55,
  },
  previewVoidWrap: {
    width: '88%',
    height: '88%',
  },
  previewDesaturateWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(colors.black, 0.24),
  },
  previewFadeSvg: {
    ...StyleSheet.absoluteFillObject,
  },
  voidGlowSvg: {
    ...StyleSheet.absoluteFillObject,
  },
  closeRow: {
    position: 'absolute',
    top: 12,
    right: 20,
    zIndex: 6,
  },
  closeText: {
    fontFamily: typography.fonts.body,
    fontSize: 15,
    color: colors.silver,
  },
  lockBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 52,
    height: 52,
    marginLeft: -26,
    marginTop: -26,
    borderRadius: 26,
    backgroundColor: 'rgba(8,12,16,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 5,
    zIndex: 5,
  },
  contentZone: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 28,
    paddingBottom: 44,
    paddingTop: 12,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 12,
  },
  eyebrow: {
    fontFamily: typography.fonts.heading,
    fontSize: 10,
    letterSpacing: 2.2,
    color: colors.gold,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  headline: {
    fontFamily: typography.fonts.heading,
    fontSize: 32,
    lineHeight: 35,
    fontWeight: '400',
    color: colors.bone,
    marginBottom: 14,
    letterSpacing: 0.2,
  },
  bodyCopy: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 16,
    fontWeight: '300',
    lineHeight: 24,
    color: withAlpha(colors.bone, 0.6),
    marginBottom: 22,
  },
  ctaButton: {
    width: '100%',
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
    marginBottom: 14,
  },
  ctaButtonPressed: {
    transform: [{ scale: 0.995 }],
  },
  ctaText: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 13,
    color: colors.black,
    letterSpacing: 1.04,
    textTransform: 'uppercase',
  },
  trialNote: {
    textAlign: 'center',
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 12,
    color: withAlpha(colors.bone, 0.3),
    marginBottom: 14,
  },
  signInButton: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  signInPressed: {
    opacity: 0.85,
  },
  signInText: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 14,
    color: withAlpha(colors.bone, 0.4),
  },
  signInLink: {
    color: colors.gold,
    textDecorationLine: 'underline',
    textDecorationColor: withAlpha(colors.gold, 0.36),
  },
});
