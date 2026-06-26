import React, { useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { SvgXml } from 'react-native-svg';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/components/ToastProvider';
import {
  AnchorArtworkExportCanvas,
  AnchorArtworkExportCanvasHandle,
} from '@/components/common';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { exportAnchorArtwork } from '@/services/AnchorArtworkExportService';
import { colors, spacing, typography } from '@/theme';
import { isCompactPhoneViewport, isShortPhoneViewport } from '@/utils/layout';

type WallpaperPromptRouteProp = RouteProp<RootStackParamList, 'WallpaperPrompt'>;
type WallpaperPromptNavigationProp = StackNavigationProp<RootStackParamList, 'WallpaperPrompt'>;

export const WallpaperPromptScreen: React.FC = () => {
  const navigation = useNavigation<WallpaperPromptNavigationProp>();
  const route = useRoute<WallpaperPromptRouteProp>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const setWallpaperPromptSeen = useAuthStore((state) => state.setWallpaperPromptSeen);
  const toast = useToast();
  const exportCanvasRef = useRef<AnchorArtworkExportCanvasHandle | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const { anchorId, intentionText, enhancedImageUrl, sigilSvg, returnTo } = route.params;
  const isCompactLayout = isCompactPhoneViewport(width, height);
  const isShortLayout = isShortPhoneViewport(height);
  const phoneWidth = isCompactLayout ? 98 : 110;
  const phoneHeight = isCompactLayout ? 196 : 220;
  const sigilSize = isCompactLayout ? 64 : 72;

  const proceed = () => {
    if (returnTo === 'vault') {
      navigation.replace('Vault');
    } else {
      navigation.replace('ChargeSetup', {
        anchorId,
        autoStartOnSelection: true,
        returnTo: 'vault',
      });
    }
  };

  const handleSetWallpaper = async () => {
    setWallpaperPromptSeen(true);
    setIsExporting(true);
    try {
      await exportAnchorArtwork({
        anchor: {
          anchorName: 'Anchor',
          intentionText,
        },
        mode: 'wallpaper',
        captureArtwork: async () => {
          const uri = await exportCanvasRef.current?.capture();
          if (!uri) {
            throw new Error('Unable to generate your anchor artwork right now.');
          }
          return uri;
        },
      });
      toast.info('Save the image from the share sheet, then set it as your wallpaper in Settings');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to export this wallpaper right now.'
      );
    } finally {
      setIsExporting(false);
    }
    proceed();
  };

  const handleMaybeLater = () => {
    setWallpaperPromptSeen(true);
    proceed();
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(62,44,91,0.5)', 'transparent']}
        style={styles.radialOverlay}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Corner accents */}
      <View style={[styles.corner, styles.cornerTL]} />
      <View style={[styles.corner, styles.cornerTR]} />
      <View style={[styles.corner, styles.cornerBL]} />
      <View style={[styles.corner, styles.cornerBR]} />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scrollView}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            isCompactLayout && styles.scrollContentCompact,
            { paddingBottom: Math.max(insets.bottom, 16) + 20 },
          ]}
        >
          {/* Phone mockup */}
          <View style={[styles.visualArea, isCompactLayout && styles.visualAreaCompact]}>
            <View
              style={[
                styles.phoneMockup,
                isCompactLayout && styles.phoneMockupCompact,
                { width: phoneWidth, height: phoneHeight },
              ]}
            >
              <View style={styles.phoneNotch} />
              <Text style={[styles.phoneTime, isCompactLayout && styles.phoneTimeCompact]}>9:41</Text>
              <View style={styles.phoneScreen}>
                {enhancedImageUrl ? (
                  <View style={styles.phoneImageFrame}>
                    <OptimizedImage
                      uri={enhancedImageUrl}
                      style={styles.phoneImage}
                      resizeMode="contain"
                    />
                  </View>
                ) : sigilSvg ? (
                  <View style={styles.phoneImageFrame}>
                    <SvgXml xml={sigilSvg} width={sigilSize} height={sigilSize} color={colors.gold} />
                  </View>
                ) : (
                  <View style={styles.phoneSigilPlaceholder} />
                )}
                <View style={styles.phoneGlowOverlay} />
              </View>
              <Text style={styles.phoneLabel}>YOUR ANCHOR</Text>
            </View>
          </View>

          <View style={[styles.textArea, isCompactLayout && styles.textAreaCompact]}>
            <View style={styles.ornament}>
              <View style={styles.ornamentLine} />
              <View style={styles.ornamentDiamond} />
              <View style={styles.ornamentLine} />
            </View>

            <Text style={styles.eyebrow}>THIS ONLY WORKS IF YOU SEE IT.</Text>
            <Text style={[styles.headline, isCompactLayout && styles.headlineCompact]}>
              {'Set it as your '}
              <Text style={styles.headlineGold}>lock screen.</Text>
            </Text>
            <Text style={[styles.body, isCompactLayout && styles.bodyCompact]}>
              Every time you pick up your phone, it primes your next move. 100 exposures a day — that's the practice.
            </Text>
          </View>

          <View style={[styles.footer, isShortLayout && styles.footerCompact]}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleSetWallpaper}
              activeOpacity={0.85}
              disabled={isExporting}
            >
              <LinearGradient
                colors={[colors.gold, '#B8941F']}
                style={[styles.primaryGradient, isCompactLayout && styles.primaryGradientCompact]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.primaryText}>
                  {isExporting ? 'PREPARING...' : 'SET AS WALLPAPER'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.ghostBtn}
              onPress={handleMaybeLater}
              activeOpacity={0.7}
            >
              <Text style={styles.ghostText}>Maybe later</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>

      <AnchorArtworkExportCanvas
        ref={exportCanvasRef}
        anchorName="Anchor"
        intentionText={intentionText}
        enhancedImageUrl={enhancedImageUrl}
        sigilSvg={sigilSvg}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  radialOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  scrollContentCompact: {
    paddingTop: 4,
  },
  // Corner L-shapes
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    opacity: 0.3,
    zIndex: 5,
  },
  cornerTL: { top: 60, left: 20, borderTopWidth: 1, borderLeftWidth: 1, borderColor: colors.gold },
  cornerTR: { top: 60, right: 20, borderTopWidth: 1, borderRightWidth: 1, borderColor: colors.gold },
  cornerBL: { bottom: 120, left: 20, borderBottomWidth: 1, borderLeftWidth: 1, borderColor: colors.gold },
  cornerBR: { bottom: 120, right: 20, borderBottomWidth: 1, borderRightWidth: 1, borderColor: colors.gold },
  // Visual
  visualArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visualAreaCompact: {
    minHeight: 220,
    flexGrow: 0,
  },
  phoneMockup: {
    width: 110,
    height: 220,
    borderWidth: 2,
    borderColor: 'rgba(212,175,55,0.4)',
    borderRadius: 20,
    backgroundColor: colors.navy,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: colors.gold,
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  phoneMockupCompact: {
    borderRadius: 18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  phoneNotch: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    width: 40,
    height: 6,
    backgroundColor: '#161e27',
    borderRadius: 3,
    zIndex: 2,
  },
  phoneTime: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 18,
    color: '#F5F5DC',
    letterSpacing: 1,
    zIndex: 2,
  },
  phoneTimeCompact: {
    fontSize: 16,
  },
  phoneScreen: {
    position: 'absolute',
    inset: 8,
    top: 8,
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: colors.navy,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  phoneImage: {
    width: '100%',
    height: '100%',
    opacity: 0.9,
  },
  phoneImageFrame: {
    width: '88%',
    height: '88%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneSigilPlaceholder: {
    width: 80,
    height: 80,
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderRadius: 8,
  },
  phoneGlowOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
  },
  phoneLabel: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: 'CrimsonPro-Regular',
    fontSize: 9,
    letterSpacing: 1.5,
    color: 'rgba(245,245,220,0.5)',
    zIndex: 2,
  },
  // Text
  textArea: {
    paddingHorizontal: 36,
    paddingBottom: spacing.lg,
  },
  textAreaCompact: {
    paddingHorizontal: 24,
    paddingBottom: spacing.md,
  },
  ornament: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  ornamentLine: {
    flex: 1,
    height: 1,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.3)',
  },
  ornamentDiamond: {
    width: 5,
    height: 5,
    backgroundColor: '#D4AF37',
    opacity: 0.6,
    transform: [{ rotate: '45deg' }],
  },
  eyebrow: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 10,
    letterSpacing: 2.5,
    color: '#D4AF37',
    textTransform: 'uppercase',
    marginBottom: 14,
    opacity: 0.8,
  },
  headline: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 24,
    color: '#F5F5DC',
    lineHeight: 32,
    marginBottom: 18,
  },
  headlineCompact: {
    fontSize: 22,
    lineHeight: 28,
    marginBottom: 14,
  },
  headlineGold: {
    color: '#D4AF37',
    fontFamily: 'Cinzel-SemiBold',
  },
  body: {
    fontFamily: 'CrimsonPro-Regular',
    fontSize: 17,
    color: '#C0C0C0',
    lineHeight: 27,
    letterSpacing: 0.2,
  },
  bodyCompact: {
    fontSize: 15,
    lineHeight: 23,
  },
  // CTAs
  footer: {
    paddingHorizontal: 36,
    paddingBottom: Platform.OS === 'android' ? 24 : 12,
    gap: 12,
  },
  footerCompact: {
    paddingHorizontal: 24,
    gap: 10,
  },
  primaryBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: colors.gold,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  primaryGradient: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryGradientCompact: {
    height: 52,
  },
  primaryText: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 13,
    letterSpacing: 2,
    color: colors.navy,
    textTransform: 'uppercase',
  },
  ghostBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(192,192,192,0.2)',
    borderRadius: 12,
  },
  ghostText: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 11,
    letterSpacing: 1.5,
    color: 'rgba(192,192,192,0.4)',
    textTransform: 'uppercase',
  },
});
