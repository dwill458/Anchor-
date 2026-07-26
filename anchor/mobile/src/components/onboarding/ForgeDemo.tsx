import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Animated,
  StyleSheet,
} from 'react-native';

const forgeRevealAsset = require('../../../assets/onboarding_anchor.png') as number;

interface ForgeDemoProps {
  isActive: boolean;
  onForgeComplete?: () => void;
}

type Phase = 'idle' | 'forging' | 'complete';

export const ForgeDemo: React.FC<ForgeDemoProps> = ({ isActive, onForgeComplete }) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const intentionOpacity = useRef(new Animated.Value(1)).current;
  const anchorOpacity = useRef(new Animated.Value(0)).current;
  const anchorGlow = useRef(new Animated.Value(0)).current;
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const reset = useCallback(() => {
    clearAllTimers();
    setPhase('idle');
    intentionOpacity.setValue(1);
    anchorOpacity.setValue(0);
    anchorGlow.setValue(0);
  }, [anchorGlow, anchorOpacity, clearAllTimers, intentionOpacity]);

  useEffect(() => {
    if (isActive) {
      reset();
    }
  }, [isActive, reset]);

  useEffect(() => () => clearAllTimers(), [clearAllTimers]);

  const handleForge = useCallback(() => {
    if (phase !== 'idle') return;
    setPhase('forging');

    Animated.timing(intentionOpacity, {
      toValue: 0,
      duration: 700,
      useNativeDriver: true,
    }).start();

    const t1 = setTimeout(() => {
      Animated.sequence([
        Animated.timing(anchorOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(anchorGlow, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
      setPhase('complete');
      onForgeComplete?.();
    }, 900);

    timersRef.current.push(t1);
  }, [anchorGlow, anchorOpacity, phase, intentionOpacity, onForgeComplete]);

  const btnLabel = phase === 'idle' ? '⚡ FORGE' : phase === 'forging' ? 'Forging...' : '✓ Your Anchor';
  const btnActive = phase === 'idle';

  return (
    <View style={styles.container}>
      <View style={styles.forge}>
        <Animated.Text style={[styles.intentionText, { opacity: intentionOpacity }]}>
          "Deep work for 4 hours"
        </Animated.Text>

        <Animated.View style={[styles.anchorWrap, { opacity: anchorOpacity }]}>
          <Image
            source={forgeRevealAsset}
            style={styles.anchor}
            resizeMode="contain"
            accessible={false}
          />
        </Animated.View>

        <View style={styles.confirmationBadge} accessible={false}>
          <Text style={styles.confirmationBadgeText}>✓ YOUR ANCHOR</Text>
        </View>

        <TouchableOpacity
          onPress={handleForge}
          activeOpacity={0.75}
          style={[styles.forgeBtn, !btnActive && styles.forgeBtnDone]}
          disabled={!btnActive}
        >
          <Text style={[styles.forgeBtnText, !btnActive && styles.forgeBtnTextDone]}>
            {btnLabel}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 320,
    height: 320,
    borderRadius: 4,
    overflow: 'hidden',
  },
  forge: {
    flex: 1,
    backgroundColor: 'rgba(15, 20, 25, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intentionText: {
    position: 'absolute',
    top: 24,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: 'Georgia',
    fontSize: 14,
    fontStyle: 'italic',
    color: '#C0C0C0',
    letterSpacing: 0.7,
  },
  anchorWrap: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anchor: {
    width: 200,
    height: 200,
  },
  confirmationBadge: {
    position: 'absolute',
    bottom: 62,
    backgroundColor: 'rgba(62,44,91,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  confirmationBadgeText: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 8,
    letterSpacing: 1.1,
    color: '#D4AF37',
  },
  forgeBtn: {
    position: 'absolute',
    bottom: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#D4AF37',
    borderRadius: 6,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  forgeBtnDone: {
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    shadowOpacity: 0,
    elevation: 0,
  },
  forgeBtnText: {
    fontFamily: 'Georgia',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
    color: '#0F1419',
    textTransform: 'uppercase',
  },
  forgeBtnTextDone: {
    color: '#D4AF37',
  },
});
