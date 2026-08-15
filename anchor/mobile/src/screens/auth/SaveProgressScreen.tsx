import React, { useEffect } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import Svg, { Circle, Path, SvgXml } from 'react-native-svg';
import { AuthService } from '@/services/AuthService';
import { useAuthStore } from '@/stores/authStore';
import type { Anchor, RootStackParamList } from '@/types';
import { colors, typography } from '@/theme';
import { withAlpha } from '@/utils/color';
import { logger } from '@/utils/logger';
import { useFirstAnchorFlowStore } from '@/stores/firstAnchorFlowStore';
import { AnalyticsService } from '@/services/AnalyticsService';

type NavigationProp = StackNavigationProp<RootStackParamList, 'SaveProgress'>;
type SaveProgressRouteProp = RouteProp<RootStackParamList, 'SaveProgress'>;

const DISC_SIZE = 168;
const DISC_ARTWORK_SIZE = 148;
const BONE = colors.anchor15.bone;

const FallbackAnchorMark = ({ size }: { size: number }) => (
  <Svg width={size} height={size} viewBox="0 0 200 200" testID="save-progress-fallback-artwork">
    {[24, 42, 60, 78].map((radius) => (
      <Circle key={radius} cx="100" cy="100" r={radius} fill="none" stroke={withAlpha(colors.anchor15.classicGold, 0.14)} strokeWidth="0.8" />
    ))}
    <Path d="M58 62 L142 62 L72 148" stroke={colors.anchor15.classicGold} strokeWidth="6.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Path d="M58 62 Q62 74 66 84" stroke={colors.anchor15.classicGold} strokeWidth="2.8" strokeLinecap="round" opacity={0.72} fill="none" />
    <Circle cx="100" cy="100" r="13" stroke={colors.anchor15.giltBright} strokeWidth="1.6" opacity={0.55} fill="none" />
  </Svg>
);

const LoggedFallbackAnchorMark = ({ anchorId }: { anchorId: string }) => {
  useEffect(() => {
    logger.warn('[SaveProgress] Missing forged sigil artwork; rendering fallback mark', { anchorId });
  }, [anchorId]);
  return <FallbackAnchorMark size={DISC_ARTWORK_SIZE} />;
};

const AnchorDisc = ({ anchor }: { anchor: Anchor }) => {
  const sigilXml = anchor.reinforcedSigilSvg || anchor.baseSigilSvg;
  return (
    <View style={styles.disc} testID="save-progress-anchor-artwork">
      <View style={styles.discRingOuter} />
      <View style={styles.discRingInner} />
      {anchor.enhancedImageUrl ? (
        <View style={styles.artworkClip}><Image source={{ uri: anchor.enhancedImageUrl }} style={styles.artworkImage} resizeMode="cover" /></View>
      ) : sigilXml ? (
        <SvgXml xml={sigilXml} width={DISC_ARTWORK_SIZE} height={DISC_ARTWORK_SIZE} />
      ) : (
        <LoggedFallbackAnchorMark anchorId={anchor.id} />
      )}
    </View>
  );
};

const BackgroundLayers = () => (
  <View pointerEvents="none" style={styles.background}>
    <LinearGradient colors={[colors.anchor15.creationTop, colors.anchor15.navy, colors.anchor15.ink]} locations={[0, 0.5, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
    <View style={styles.backgroundNavy} />
    <View style={styles.backgroundGold} />
    <View style={styles.grainOverlay} />
    <LinearGradient colors={['transparent', withAlpha(colors.anchor15.ink, 0.94)]} style={styles.floorVignette} />
  </View>
);

export const SaveProgressScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<SaveProgressRouteProp>();
  const insets = useSafeAreaInsets();
  const anchor = route.params.anchor;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const pendingFirstAnchorDraft = useAuthStore((state) => state.pendingFirstAnchorDraft);
  const isFinalizingPendingFirstAnchor = useAuthStore((state) => state.isFinalizingPendingFirstAnchor);
  const pendingFirstAnchorError = useAuthStore((state) => state.pendingFirstAnchorError);
  const finalizePendingFirstAnchorDraft = useAuthStore((state) => state.finalizePendingFirstAnchorDraft);
  const clearPendingFirstAnchorError = useAuthStore((state) => state.clearPendingFirstAnchorError);
  const signOut = useAuthStore((state) => state.signOut);
  const hasPng = Boolean(anchor.enhancedImageUrl);
  const hasSvg = Boolean(anchor.reinforcedSigilSvg || anchor.baseSigilSvg);
  const anchorCategory = String(anchor.category ?? 'Anchor').replace(/_/g, ' ');

  useEffect(() => {
    AnalyticsService.track('save_progress_viewed', { anchor_id: anchor.id, has_png: hasPng, has_svg: hasSvg });
  }, [anchor.id, hasPng, hasSvg]);

  useFocusEffect(
    React.useCallback(() => {
      if (!isAuthenticated) return;
      if (!pendingFirstAnchorDraft) {
        navigation.replace('PrimeYourAnchor', { anchorId: anchor.id });
        return;
      }
      if (isFinalizingPendingFirstAnchor || pendingFirstAnchorError) return;
      let cancelled = false;
      void (async () => {
        const didFinalize = await finalizePendingFirstAnchorDraft();
        if (!cancelled && didFinalize) {
          useFirstAnchorFlowStore.getState().clearDraft();
          navigation.replace('PrimeYourAnchor', { anchorId: anchor.id });
        }
      })();
      return () => { cancelled = true; };
    }, [anchor.id, finalizePendingFirstAnchorDraft, isAuthenticated, isFinalizingPendingFirstAnchor, navigation, pendingFirstAnchorDraft, pendingFirstAnchorError])
  );

  const handleCreateAccount = () => {
    AnalyticsService.track('save_progress_save_tapped', { anchor_id: anchor.id });
    navigation.navigate('SignUp', { context: 'save_progress', initialTab: 'signup', anchorId: anchor.id });
  };
  const handleSignIn = () => {
    AnalyticsService.track('save_progress_signin_tapped', { anchor_id: anchor.id });
    navigation.navigate('Login', { context: 'save_progress', anchorId: anchor.id });
  };
  const handleRetry = async () => {
    clearPendingFirstAnchorError();
    const didFinalize = await finalizePendingFirstAnchorDraft();
    if (didFinalize) {
      useFirstAnchorFlowStore.getState().clearDraft();
      navigation.replace('PrimeYourAnchor', { anchorId: anchor.id });
    }
  };
  const handleSwitchAccount = async () => {
    clearPendingFirstAnchorError();
    await AuthService.signOut().catch(() => undefined);
    await signOut();
  };

  const isFinalizationState = isAuthenticated && Boolean(pendingFirstAnchorDraft);
  const showError = isAuthenticated && Boolean(pendingFirstAnchorError);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <BackgroundLayers />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView style={styles.scrollView} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 28, 48) }]} showsVerticalScrollIndicator={false} bounces={false}>
          <View style={styles.header}>
            <View style={styles.eyebrow}><View style={styles.eyebrowLineLeft} /><Text style={styles.eyebrowText}>Keep Your Anchor</Text><View style={styles.eyebrowLineRight} /></View>
            <Text style={styles.title}>Your First Anchor</Text>
            <Text style={[styles.title, styles.titleSecond]}>Is <Text style={styles.titleGold}>Ready.</Text></Text>
            <Text style={styles.body}>Create a free account to keep this Anchor and continue your Practice.</Text>
          </View>
          <View style={styles.hero}>
            <View style={styles.medallion}><View style={styles.halo} /><View style={styles.orbit} /><View style={styles.orbitDot} /><View style={styles.ringInner} /><AnchorDisc anchor={anchor} /></View>
            <View style={styles.identity}>
              <Text style={styles.identityName} numberOfLines={2}>{anchor.intentionText}</Text>
              <Text style={styles.identityCategory} numberOfLines={1}>{anchorCategory}</Text>
              {isFinalizationState && !isFinalizingPendingFirstAnchor && !pendingFirstAnchorError ? <Text style={styles.savedLabel}>Anchor Saved</Text> : null}
            </View>
          </View>
          <View style={styles.bottom}>
            {!isFinalizationState ? <Text style={styles.reassure}>Your Anchor will be saved to your account.</Text> : null}
            {showError ? <View style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite" testID="save-progress-error"><View style={styles.errorDot} /><Text style={styles.errorText}>{pendingFirstAnchorError}</Text></View> : null}
            {isFinalizationState ? (
              <>
                <Pressable onPress={() => void handleRetry()} disabled={isFinalizingPendingFirstAnchor} accessibilityRole="button" accessibilityLabel={isFinalizingPendingFirstAnchor ? 'Saving your Anchor' : 'Finish saving your Anchor'} testID="save-progress-retry-cta" style={({ pressed }) => [styles.primaryCta, isFinalizingPendingFirstAnchor && styles.ctaDisabled, pressed && !isFinalizingPendingFirstAnchor && styles.pressed]}>
                  {isFinalizingPendingFirstAnchor ? <><ActivityIndicator color={colors.anchor15.ink} size="small" /><Text style={styles.primaryCtaText}>Saving your Anchor…</Text></> : <Text style={styles.primaryCtaText}>Finish Saving My Anchor</Text>}
                </Pressable>
                <Pressable onPress={() => void handleSwitchAccount()} accessibilityRole="button" accessibilityLabel="Use a different account" testID="save-progress-switch-account" style={({ pressed }) => [styles.secondaryPressable, pressed && styles.pressed]}><Text style={styles.secondary}>Use a different account</Text></Pressable>
              </>
            ) : (
              <>
                <Pressable onPress={handleCreateAccount} accessibilityRole="button" accessibilityLabel="Continue with email to save your Anchor" testID="save-progress-primary-cta" style={({ pressed }) => [styles.primaryCta, pressed && styles.pressed]}><Text style={styles.primaryCtaText}>Continue with Email</Text></Pressable>
                <Pressable onPress={handleSignIn} accessibilityRole="button" accessibilityLabel="I already have an account, sign in" testID="save-progress-sign-in" style={({ pressed }) => [styles.secondaryPressable, pressed && styles.pressed]}><Text style={styles.secondary}>I already have an <Text style={styles.secondaryUnderline}>account</Text></Text></Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.anchor15.ink }, safeArea: { flex: 1 }, background: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  backgroundNavy: { position: 'absolute', width: 270, height: 270, borderRadius: 135, top: -112, left: -84, backgroundColor: withAlpha(colors.anchor15.steel, 0.58) },
  backgroundGold: { position: 'absolute', width: 220, height: 220, borderRadius: 110, bottom: 58, right: -100, backgroundColor: withAlpha(colors.anchor15.classicGold, 0.055) },
  grainOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: withAlpha(colors.anchor15.bone, 0.012), opacity: 0.68 }, floorVignette: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 290 },
  scrollView: { flex: 1 }, content: { flexGrow: 1, justifyContent: 'space-between' }, header: { alignItems: 'center', paddingHorizontal: 30, paddingTop: 42 }, eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  eyebrowLineLeft: { width: 22, height: 1, backgroundColor: withAlpha(colors.anchor15.gilt, 0.42) }, eyebrowLineRight: { width: 22, height: 1, backgroundColor: withAlpha(colors.anchor15.gilt, 0.42) },
  eyebrowText: { fontFamily: typography.fonts.heading, fontSize: 10, letterSpacing: 2.7, color: colors.anchor15.classicGold, textTransform: 'uppercase', textAlign: 'center' },
  title: { fontFamily: typography.fonts.heading, fontSize: 27, lineHeight: 33.5, letterSpacing: 0.28, color: BONE, textAlign: 'center', marginTop: 18 }, titleSecond: { marginTop: 0 }, titleGold: { color: colors.anchor15.classicGold },
  body: { fontFamily: typography.fontFamily.voice, fontSize: 17, lineHeight: 24, color: withAlpha(BONE, 0.72), textAlign: 'center', marginTop: 14, maxWidth: 288 },
  hero: { alignItems: 'center', justifyContent: 'center', gap: 22, minHeight: 310, paddingVertical: 18 }, medallion: { width: 236, height: 236, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 226, height: 226, borderRadius: 113, backgroundColor: withAlpha(colors.anchor15.classicGold, 0.075) }, orbit: { position: 'absolute', width: 226, height: 226, borderRadius: 113, borderWidth: 1, borderStyle: 'dashed', borderColor: withAlpha(colors.anchor15.classicGold, 0.18) },
  orbitDot: { position: 'absolute', top: 4, width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.anchor15.classicGold }, ringInner: { position: 'absolute', width: 206, height: 206, borderRadius: 103, borderWidth: 1, borderColor: withAlpha(colors.anchor15.classicGold, 0.12) },
  disc: { width: DISC_SIZE, height: DISC_SIZE, borderRadius: DISC_SIZE / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.anchor15.navy }, discRingOuter: { position: 'absolute', width: DISC_SIZE - 2, height: DISC_SIZE - 2, borderRadius: (DISC_SIZE - 2) / 2, borderWidth: 1, borderColor: withAlpha(colors.anchor15.classicGold, 0.2) }, discRingInner: { position: 'absolute', width: 124, height: 124, borderRadius: 62, borderWidth: 1, borderColor: withAlpha(colors.anchor15.classicGold, 0.14) },
  artworkClip: { width: DISC_ARTWORK_SIZE, height: DISC_ARTWORK_SIZE, borderRadius: DISC_ARTWORK_SIZE / 2, overflow: 'hidden' }, artworkImage: { width: DISC_ARTWORK_SIZE, height: DISC_ARTWORK_SIZE },
  identity: { alignItems: 'center', gap: 7, paddingHorizontal: 28 }, identityName: { fontFamily: typography.fonts.headingSemiBold, fontSize: 19, lineHeight: 25, letterSpacing: 1.55, textTransform: 'uppercase', color: BONE, textAlign: 'center', maxWidth: 330 }, identityCategory: { fontFamily: typography.fonts.mono, fontSize: 10, letterSpacing: 2.35, textTransform: 'uppercase', color: withAlpha(BONE, 0.42), textAlign: 'center' }, savedLabel: { marginTop: 4, fontFamily: typography.fonts.mono, fontSize: 10, letterSpacing: 2.35, textTransform: 'uppercase', color: colors.anchor15.giltBright },
  bottom: { alignItems: 'center', gap: 12, paddingHorizontal: 26 }, reassure: { fontFamily: typography.fonts.body, fontSize: 12.5, lineHeight: 19.5, letterSpacing: 0.12, color: withAlpha(BONE, 0.42), textAlign: 'center', maxWidth: 270, marginBottom: 2 },
  error: { width: '100%', flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingHorizontal: 13, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(214,110,80,0.30)', backgroundColor: 'rgba(214,110,80,0.09)' }, errorDot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 6, backgroundColor: '#E8B7A4' }, errorText: { flex: 1, fontFamily: typography.fonts.body, fontSize: 12.5, lineHeight: 18, color: '#E8B7A4' },
  primaryCta: { width: '100%', minHeight: 54, borderRadius: 16, paddingHorizontal: 18, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: BONE }, ctaDisabled: { opacity: 0.72 }, primaryCtaText: { fontFamily: typography.fonts.bodyBold, fontSize: 15, color: colors.anchor15.ink, textAlign: 'center' }, secondaryPressable: { minHeight: 44, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }, secondary: { fontFamily: typography.fonts.body, fontSize: 14, color: withAlpha(BONE, 0.66), textAlign: 'center' }, secondaryUnderline: { color: BONE, textDecorationLine: 'underline', textDecorationColor: withAlpha(colors.anchor15.gilt, 0.42) }, pressed: { opacity: 0.72 },
});
