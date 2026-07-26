import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';

import { colors, typography } from '@/theme';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';

export interface PromptPresenterPrompt {
  id: string;
  text: string;
}

interface PromptPresenterProps {
  prompt: PromptPresenterPrompt | null;
  fallbackText: string;
  fallbackId: string;
}

/** Updates the instruction card in place while preserving its visual anchor. */
export const PromptPresenter: React.FC<PromptPresenterProps> = React.memo(
  ({ prompt, fallbackText, fallbackId }) => {
    const reduceMotion = useReduceMotionEnabled();
    const opacity = useRef(new Animated.Value(1)).current;
    const translateY = useRef(new Animated.Value(0)).current;
    const visibleKeyRef = useRef(prompt?.id ?? fallbackId);
    const [visibleText, setVisibleText] = useState(
      prompt?.text ?? fallbackText,
    );

    const nextKey = prompt?.id ?? fallbackId;
    const nextText = prompt?.text ?? fallbackText;

    useEffect(() => {
      if (visibleKeyRef.current === nextKey) return;
      visibleKeyRef.current = nextKey;
      opacity.stopAnimation();
      translateY.stopAnimation();

      if (reduceMotion) {
        setVisibleText(nextText);
        opacity.setValue(1);
        translateY.setValue(0);
        return;
      }

      let cancelled = false;
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -5,
          duration: 150,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished || cancelled) return;
        setVisibleText(nextText);
        translateY.setValue(5);
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 320,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: 360,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      });

      return () => {
        cancelled = true;
        opacity.stopAnimation();
        translateY.stopAnimation();
      };
    }, [fallbackText, nextKey, nextText, opacity, reduceMotion, translateY]);

    return (
      <Animated.Text
        accessibilityLiveRegion="polite"
        style={[styles.text, { opacity, transform: [{ translateY }] }]}
      >
        {visibleText}
      </Animated.Text>
    );
  },
);

const styles = StyleSheet.create({
  text: {
    color: colors.text.primary ?? '#F4EDD8',
    fontFamily: typography.fonts.body,
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
  },
});
