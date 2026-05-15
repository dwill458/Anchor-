import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SvgXml, Svg, Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import type { StackScreenProps } from '@react-navigation/stack';
import type { AuthStackParamList } from '@/navigation/AuthNavigator';
import { useAuthStore } from '@/stores/authStore';
import { AuthService } from '@/services/AuthService';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

// Design token not in colors.ts — rgba(245,245,220,0.55)
const BONE_DIM = 'rgba(245,245,220,0.55)';

type Props = StackScreenProps<AuthStackParamList, 'SaveProgress'>;

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const GoogleIcon: React.FC = () => (
  <Svg width={16} height={16} viewBox="0 0 18 18">
    <Path
      d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      fill="#4285F4"
    />
    <Path
      d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      fill="#34A853"
    />
    <Path
      d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
      fill="#FBBC05"
    />
    <Path
      d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"
      fill="#EA4335"
    />
  </Svg>
);

export const SaveProgressScreen: React.FC<Props> = ({ route, navigation }): React.ReactElement => {
  const { anchorIntention, anchorSvg } = route.params;

  const { setAuthenticated, setHasCompletedOnboarding, setIsGuest } = useAuthStore();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const shimmerAnim = useRef(new Animated.Value(-60)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 60,
          duration: 2800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: -60,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [shimmerAnim]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  const handleGoogleSignIn = async (): Promise<void> => {
    setIsLoading(true);
    setGoogleError(null);
    try {
      await AuthService.signInWithGoogle();
      setAuthenticated(true);
      setHasCompletedOnboarding(true);
    } catch (_error) {
      setGoogleError('Google sign-in failed. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = (): void => {
    setIsGuest(true);
    setHasCompletedOnboarding(true);
  };

  return (
    <View style={styles.root}>
      {/* Background layer — ghost home preview */}
      <View style={styles.homeBg} pointerEvents="none">
        <View style={styles.hbWide} />
        <View style={styles.hbNarrow} />
        <View style={styles.homeGrid}>
          <View style={styles.homeCard} />
          <View style={styles.homeCard} />
          <View style={styles.homeCard} />
          <View style={styles.homeCard} />
        </View>
      </View>

      {/* Backdrop */}
      <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
      <View style={styles.backdropOverlay} />

      {/* Sheet */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Handle bar */}
        <View style={styles.handle} />

        {/* Anchor row */}
        <View style={styles.anchorRow}>
          <LinearGradient
            colors={['rgba(212,175,55,0.1)', 'rgba(62,44,91,0.4)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.thumb}
          >
            {anchorSvg.length > 0 ? (
              <SvgXml xml={anchorSvg} width={26} height={26} />
            ) : (
              <Text style={styles.thumbPlaceholder}>⚓</Text>
            )}
            <Animated.View
              style={[
                styles.shimmer,
                { transform: [{ translateX: shimmerAnim }, { skewX: '-12deg' }] },
              ]}
            />
          </LinearGradient>
          <View style={styles.anchorMeta}>
            <Text style={styles.anchorLabel}>YOUR ANCHOR</Text>
            <Text style={styles.anchorIntention} numberOfLines={1} ellipsizeMode="tail">
              {anchorIntention.length > 0 ? anchorIntention : 'Your intention'}
            </Text>
            <View style={styles.statusRow}>
              <Animated.View style={[styles.pulseDot, { opacity: pulseAnim }]} />
              <Text style={styles.statusText}>Forged · unsaved</Text>
            </View>
          </View>
        </View>

        {/* Warning chip */}
        <View style={styles.warnChip}>
          <Text style={styles.warnIcon}>⚠</Text>
          <Text style={styles.warnText}>
            {'Lives on this device only. '}
            <Text style={styles.warnBold}>Delete the app and it's gone.</Text>
          </Text>
        </View>

        {/* Headline block */}
        <View style={styles.hedBlock}>
          <Text style={styles.h2}>
            {"Don't lose your "}
            <Text style={styles.h2Gold}>imprint.</Text>
          </Text>
          <Text style={styles.hedBody}>
            Back it up in 20 seconds — every device, forever.
          </Text>
        </View>

        {/* Props list */}
        <View style={styles.propsList}>
          <View style={styles.propRow}>
            <View style={styles.propIcon}>
              <Text>⚓</Text>
            </View>
            <Text style={styles.propText}>
              <Text style={styles.propBold}>Anchors sync</Text>
              {' — survives reinstalls & device switches'}
            </Text>
          </View>
          <View style={styles.propRow}>
            <View style={styles.propIcon}>
              <Text>⬡</Text>
            </View>
            <Text style={styles.propText}>
              <Text style={styles.propBold}>Thread Strength preserved</Text>
              {' — score never resets'}
            </Text>
          </View>
          <View style={styles.propRow}>
            <View style={styles.propIcon}>
              <Text>◎</Text>
            </View>
            <Text style={styles.propText}>
              <Text style={styles.propBold}>Session depth tracked</Text>
              {' — priming history backed up'}
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* CTA block */}
        <View
          style={[styles.ctaBlock, isLoading && styles.ctaBlockDisabled]}
          pointerEvents={isLoading ? 'none' : 'box-none'}
        >
          {/* Button 1 — SEAL MY PROGRESS */}
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={(): void => navigation.navigate('SignUp', undefined)}
            activeOpacity={0.85}
          >
            <Text style={styles.btnPrimaryText}>SEAL MY PROGRESS</Text>
          </TouchableOpacity>

          {/* Button 2 — Google sign-in */}
          <TouchableOpacity
            style={styles.btnGoogle}
            onPress={handleGoogleSignIn}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.gold} />
            ) : (
              <>
                <GoogleIcon />
                <Text style={styles.btnGoogleText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>
          {googleError !== null && (
            <Text style={styles.googleError}>{googleError}</Text>
          )}

          {/* Button 3 — Use Email Instead */}
          <TouchableOpacity
            style={styles.btnEmail}
            onPress={(): void => navigation.navigate('SignUp', undefined)}
            activeOpacity={0.85}
          >
            <Text style={styles.btnEmailText}>Use Email Instead</Text>
          </TouchableOpacity>

          {/* Skip link */}
          <View style={styles.skipWrap}>
            <TouchableOpacity onPress={handleSkip} activeOpacity={0.6}>
              <Text style={styles.skipText}>Skip — I know it won't be saved</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.navy,
  },

  // ── Home background (ghost skeleton) ──
  homeBg: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
    alignItems: 'center',
    paddingTop: 68,
    gap: 18,
  },
  hbWide: {
    height: 10,
    width: 130,
    borderRadius: 5,
    backgroundColor: 'rgba(245,245,220,0.06)',
  },
  hbNarrow: {
    height: 10,
    width: 88,
    borderRadius: 5,
    backgroundColor: 'rgba(245,245,220,0.06)',
    alignSelf: 'flex-start',
    marginLeft: 20,
  },
  homeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    width: '100%',
    paddingHorizontal: 20,
  },
  homeCard: {
    width: '47%',
    height: 88,
    borderRadius: 12,
    backgroundColor: 'rgba(245,245,220,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(245,245,220,0.055)',
  },

  // ── Backdrop ──
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,12,16,0.70)',
  },

  // ── Sheet ──
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    // gold + '38' hex = ~22% opacity
    borderTopColor: 'rgba(212,175,55,0.22)',
    backgroundColor: '#141c26',
    paddingBottom: 32,
  },

  // ── Handle bar ──
  handle: {
    width: 34,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(245,245,220,0.16)',
    alignSelf: 'center',
    marginTop: 12,
  },

  // ── Anchor row ──
  anchorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 17,
  },
  thumb: {
    width: 50,
    height: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.26)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbPlaceholder: {
    fontSize: 22,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 20,
    height: 50,
    backgroundColor: 'rgba(212,175,55,0.24)',
    opacity: 0.7,
  },
  anchorMeta: {
    flex: 1,
    minWidth: 0,
  },
  anchorLabel: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 8,
    letterSpacing: 2.5,
    color: colors.gold,
    opacity: 0.6,
    marginBottom: 2,
  },
  anchorIntention: {
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 14,
    color: colors.bone,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  pulseDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.gold,
  },
  statusText: {
    fontSize: 10,
    color: colors.gold,
    opacity: 0.68,
    letterSpacing: 0.4,
    fontFamily: typography.fontFamily.bodySerif,
  },

  // ── Warning chip ──
  warnChip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    marginHorizontal: 20,
    marginTop: 13,
    padding: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(212,175,55,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
    borderRadius: 9,
  },
  warnIcon: {
    fontSize: 12,
    lineHeight: 19,
  },
  warnText: {
    flex: 1,
    fontSize: 12.5,
    color: BONE_DIM,
    lineHeight: 18.75,
    fontFamily: typography.fontFamily.bodySerif,
  },
  warnBold: {
    fontWeight: '600',
    color: colors.gold,
  },

  // ── Headline block ──
  hedBlock: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  h2: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 20,
    fontWeight: '600',
    color: colors.bone,
    lineHeight: 25.6,
  },
  h2Gold: {
    color: colors.gold,
  },
  hedBody: {
    fontFamily: typography.fontFamily.bodySerif,
    fontSize: 14.5,
    color: BONE_DIM,
    marginTop: 7,
    lineHeight: 22.5,
  },

  // ── Props list ──
  propsList: {
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 8,
  },
  propRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  propIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: 'rgba(245,245,220,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(245,245,220,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  propText: {
    flex: 1,
    fontSize: 13,
    color: BONE_DIM,
    lineHeight: 18.2,
    fontFamily: typography.fontFamily.bodySerif,
  },
  propBold: {
    fontWeight: '500',
    color: colors.bone,
  },

  // ── Divider ──
  divider: {
    height: 1,
    backgroundColor: 'rgba(245,245,220,0.09)',
    marginHorizontal: 20,
    marginTop: 16,
  },

  // ── CTA block ──
  ctaBlock: {
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 9,
  },
  ctaBlockDisabled: {
    opacity: 0.5,
  },

  btnPrimary: {
    backgroundColor: colors.gold,
    borderRadius: 11,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 12,
    letterSpacing: 1.8,
    color: colors.navy,
    fontWeight: '600',
  },

  btnGoogle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
    borderRadius: 11,
  },
  btnGoogleText: {
    fontFamily: typography.fontFamily.bodySerif,
    fontSize: 14,
    color: colors.bone,
  },
  googleError: {
    color: colors.error,
    fontSize: 12,
    textAlign: 'center',
    fontFamily: typography.fontFamily.bodySerif,
  },

  btnEmail: {
    backgroundColor: 'rgba(245,245,220,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(245,245,220,0.12)',
    borderRadius: 11,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnEmailText: {
    fontFamily: typography.fontFamily.bodySerif,
    fontSize: 14,
    color: colors.bone,
  },

  skipWrap: {
    alignItems: 'center',
    paddingTop: 2,
  },
  skipText: {
    fontFamily: typography.fontFamily.bodySerif,
    fontSize: 11.5,
    color: BONE_DIM,
    opacity: 0.4,
  },
});
