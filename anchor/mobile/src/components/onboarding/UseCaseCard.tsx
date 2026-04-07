import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { SvgXml } from 'react-native-svg';

export interface UseCaseItem {
  label: string;
  description: string;
  iconType: 'code' | 'lift' | 'pitch';
}

/** Single use-case card with staggered entrance animation. */
interface UseCaseCardProps {
  item: UseCaseItem;
  /** Card index (0–2) controls the entrance stagger delay. */
  index: number;
  /** When this flips to true, the entrance animation triggers; false resets it. */
  isActive: boolean;
}

const ICON_SVGS: Record<UseCaseItem['iconType'], string> = {
  code: `<svg viewBox="0 0 18 18" fill="none" stroke="#D4AF37" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="3" width="14" height="10" rx="1.5"/>
    <line x1="6" y1="15" x2="12" y2="15"/>
    <line x1="9" y1="13" x2="9" y2="15"/>
    <line x1="5" y1="7" x2="8" y2="7"/>
    <line x1="5" y1="9" x2="11" y2="9"/>
  </svg>`,
  lift: `<svg viewBox="0 0 18 18" fill="none" stroke="#D4AF37" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg">
    <line x1="9" y1="14" x2="9" y2="4"/>
    <polyline points="5,8 9,4 13,8"/>
    <line x1="4" y1="14" x2="14" y2="14"/>
  </svg>`,
  pitch: `<svg viewBox="0 0 18 18" fill="none" stroke="#D4AF37" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg">
    <circle cx="9" cy="7" r="3"/>
    <path d="M4 15 C4 12 6.5 10 9 10 S14 12 14 15"/>
    <line x1="12" y1="4" x2="14.5" y2="1.5"/>
    <line x1="14" y1="5.5" x2="16.5" y2="4"/>
  </svg>`,
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ANCHOR_IMAGES: Record<UseCaseItem['iconType'], number> = {
  code: require('../../../assets/onboarding anchor.png') as number,
  lift: require('../../../assets/physical anchor onboarding.png') as number,
  pitch: require('../../../assets/high stakes onboarding anchor.png') as number,
};

/**
 * UseCaseCard displays a single use-case with icon, label, description, and anchor image.
 * Animates in from left on `isActive` with per-card stagger.
 */
export const UseCaseCard: React.FC<UseCaseCardProps> = ({ item, index, isActive }) => {
  const translateX = useRef(new Animated.Value(-16)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive) {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 300,
          delay: 200 + index * 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          delay: 200 + index * 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      translateX.setValue(-16);
      opacity.setValue(0);
    }
  }, [isActive, index, translateX, opacity]);

  return (
    <Animated.View style={[styles.card, { opacity, transform: [{ translateX }] }]}>
      <View style={styles.iconBox}>
        <SvgXml xml={ICON_SVGS[item.iconType]} width={18} height={18} />
      </View>
      <View style={styles.textBox}>
        <Text style={styles.label}>{item.label.toUpperCase()}</Text>
        <Text style={styles.description}>{item.description}</Text>
      </View>
      <View style={styles.sigilBox}>
        <Image source={ANCHOR_IMAGES[item.iconType]} style={styles.anchorImage} resizeMode="contain" />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.12)',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconBox: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textBox: {
    flex: 1,
  },
  label: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 11,
    letterSpacing: 1.5,
    color: '#D4AF37',
    marginBottom: 3,
  },
  description: {
    fontFamily: 'CrimsonPro-Regular',
    fontSize: 14,
    color: '#C0C0C0',
    lineHeight: 18,
  },
  sigilBox: {
    flexShrink: 0,
  },
  anchorImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
});
