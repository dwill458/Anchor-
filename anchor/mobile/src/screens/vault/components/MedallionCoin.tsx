/**
 * MedallionCoin — Sanctuary Circular Medallion Coin Talisman.
 *
 * "Circular medallion coin, engraved gold linework symbol centered on an ivory/parchment disc,
 * thick aged-gold beveled rim, warm golden glow radiating outward and fading into a dark background,
 * soft bokeh, subtle marble/stone texture, moody dramatic lighting, ritual talisman style, no text"
 *
 * All sigils share the exact same glow, rim, and lighting, with each anchor's specific
 * mark engraved in gold linework at the center.
 */

import React, { useEffect, useState } from 'react';
import {
  Image,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
  SvgXml,
} from 'react-native-svg';
import { colors } from '@/theme';
import { withAlpha } from '@/utils/color';

export interface MedallionCoinProps {
  size?: number;
  imageUrl?: string | null;
  sigilXml?: string | null;
  reduceMotionEnabled?: boolean;
  testID?: string;
  showGlow?: boolean;
}

/** Default stylized Anchor 'A' mark with vertical dual-ended arrow */
const AnchorLetterAMark: React.FC<{ size: number }> = ({ size }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="gold-engrave" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#8A6225" />
          <Stop offset="30%" stopColor="#C49B48" />
          <Stop offset="60%" stopColor="#F5E4B5" />
          <Stop offset="85%" stopColor="#A87A2C" />
          <Stop offset="100%" stopColor="#5E3F12" />
        </LinearGradient>
      </Defs>

      {/* Engraved drop-shadow for etched relief */}
      <Path
        d="M50 14 L50 86 M50 14 L42 24 M50 14 L58 24 M50 86 L42 76 M50 86 L58 76 M32 72 L50 28 L68 72 M38 58 L62 58"
        stroke="rgba(40, 25, 8, 0.6)"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        transform="translate(0.8, 1)"
      />

      {/* Primary engraved gold linework */}
      <Path
        d="M50 14 L50 86 M50 14 L42 24 M50 14 L58 24 M50 86 L42 76 M50 86 L58 76 M32 72 L50 28 L68 72 M38 58 L62 58"
        stroke="url(#gold-engrave)"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Inner highlight accent */}
      <Circle
        cx="50"
        cy="50"
        r="34"
        stroke="rgba(196, 155, 72, 0.28)"
        strokeWidth="0.8"
        strokeDasharray="3 4"
        fill="none"
      />
    </Svg>
  );
};

export const MedallionCoin: React.FC<MedallionCoinProps> = ({
  size = 176,
  imageUrl,
  sigilXml,
  reduceMotionEnabled = false,
  testID = 'medallion-coin',
  showGlow = true,
}) => {
  const breatheAnim = useSharedValue(1);
  const glowPulse = useSharedValue(0.88);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (reduceMotionEnabled) {
      breatheAnim.value = 1;
      glowPulse.value = 0.95;
      return;
    }

    breatheAnim.value = withRepeat(
      withTiming(1.018, {
        duration: 2750,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true
    );

    glowPulse.value = withRepeat(
      withTiming(1.0, {
        duration: 2750,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true
    );

    return () => {
      cancelAnimation(breatheAnim);
      cancelAnimation(glowPulse);
    };
  }, [reduceMotionEnabled, breatheAnim, glowPulse]);

  const breatheStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breatheAnim.value }],
    opacity: glowPulse.value,
  }));

  // The artwork is intentionally edge-to-edge inside the medallion.
  const symbolSize = size;
  const showImage = Boolean(imageUrl) && failedImageUrl !== imageUrl;

  return (
    <View style={[styles.wrapper, { width: size, height: size }]} testID={testID}>
      {/* Outer warm golden glow radiating outward */}
      {showGlow && (
        <View
          style={[
            styles.haloGlow,
            { width: size + 54, height: size + 54, borderRadius: (size + 54) / 2 },
          ]}
          pointerEvents="none"
        >
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id="halo-glow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#F2DFA8" stopOpacity="0.45" />
                <Stop offset="36%" stopColor="#D9B36C" stopOpacity="0.24" />
                <Stop offset="68%" stopColor="#18202A" stopOpacity="0.08" />
                <Stop offset="100%" stopColor="#080B0F" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx="50" cy="50" r="50" fill="url(#halo-glow)" />
          </Svg>
        </View>
      )}

      {/* Main Talisman Medallion Disc */}
      <Animated.View
        style={[
          styles.medallionDisc,
          { width: size, height: size, borderRadius: size / 2 },
          breatheStyle,
        ]}
      >
        <View style={[styles.proceduralMedallion, { width: size, height: size, borderRadius: size / 2 }]}>
          {/* Multi-layer aged-gold beveled rim and parchment disc */}
          <Svg width={size} height={size} viewBox="0 0 200 200" style={StyleSheet.absoluteFill}>
            <Defs>
              {/* Thick aged-gold beveled outer rim */}
              <LinearGradient id="gold-rim-bevel" x1="15%" y1="10%" x2="85%" y2="90%">
                <Stop offset="0%" stopColor="#FAF0D2" />
                <Stop offset="18%" stopColor="#D4AF37" />
                <Stop offset="42%" stopColor="#8A6827" />
                <Stop offset="70%" stopColor="#4A3410" />
                <Stop offset="90%" stopColor="#C8A246" />
                <Stop offset="100%" stopColor="#FAF0D2" />
              </LinearGradient>

              <LinearGradient id="gold-inner-ridge" x1="0%" y1="100%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor="#38250C" />
                <Stop offset="30%" stopColor="#8A6827" />
                <Stop offset="70%" stopColor="#F5E4B5" />
                <Stop offset="100%" stopColor="#5E3F12" />
              </LinearGradient>

              {/* Ivory / parchment disc with subtle warmth and marble aging */}
              <RadialGradient id="parchment-disc" cx="40%" cy="34%" r="68%">
                <Stop offset="0%" stopColor="#FAF5E8" />
                <Stop offset="45%" stopColor="#EADDC0" />
                <Stop offset="82%" stopColor="#D2BF96" />
                <Stop offset="100%" stopColor="#A88E58" />
              </RadialGradient>

              {/* Stone/marble depth vignette */}
              <RadialGradient id="disc-shadow" cx="50%" cy="50%" r="50%">
                <Stop offset="65%" stopColor="#4A3410" stopOpacity="0" />
                <Stop offset="90%" stopColor="#38250C" stopOpacity="0.28" />
                <Stop offset="100%" stopColor="#1E1405" stopOpacity="0.55" />
              </RadialGradient>
            </Defs>

            {/* 1. Outer rim bevel */}
            <Circle cx="100" cy="100" r="98" fill="url(#gold-rim-bevel)" />
            <Circle cx="100" cy="100" r="95" fill="none" stroke="#2A1B07" strokeWidth="1" opacity={0.6} />

            {/* 2. Stepped intermediate ridge */}
            <Circle cx="100" cy="100" r="88" fill="url(#gold-inner-ridge)" />

            {/* 3. Ivory/parchment disc */}
            <Circle cx="100" cy="100" r="81" fill="url(#parchment-disc)" />
            <Circle cx="100" cy="100" r="81" fill="url(#disc-shadow)" />

            {/* 4. Fine etched concentric calibration rings on parchment */}
            <Circle cx="100" cy="100" r="77" fill="none" stroke="#8A6827" strokeWidth="0.8" strokeDasharray="1.5 2.5" opacity={0.4} />
            <Circle cx="100" cy="100" r="69" fill="none" stroke="#8A6827" strokeWidth="0.5" opacity={0.28} />
            <Circle cx="100" cy="100" r="32" fill="none" stroke="#8A6827" strokeWidth="0.5" strokeDasharray="2 3" opacity={0.22} />
          </Svg>

          {/* Centered Engraved Gold Linework Mark */}
          <View style={[styles.symbolSlot, { width: symbolSize, height: symbolSize }]}>
            {showImage ? (
              <Image
                source={{ uri: imageUrl }}
                style={[styles.symbolImage, { width: symbolSize, height: symbolSize, borderRadius: symbolSize / 2 }]}
                resizeMode="cover"
                onError={() => setFailedImageUrl(imageUrl ?? null)}
              />
            ) : sigilXml ? (
              <SvgXml xml={sigilXml} width="100%" height="100%" />
            ) : (
              <AnchorLetterAMark size={symbolSize} />
            )}
          </View>

          {/* Subtle gloss sheen ring */}
          <View
            style={[styles.glossSheen, { width: size, height: size, borderRadius: size / 2 }]}
            pointerEvents="none"
          />
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  haloGlow: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
  medallionDisc: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: colors.anchor15.giltBright,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
    zIndex: 1,
  },
  proceduralMedallion: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: '#FAF5E8',
  },
  symbolSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  symbolImage: {
    opacity: 0.85,
  },
  glossSheen: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: withAlpha(colors.anchor15.gilt, 0.35),
  },
});
