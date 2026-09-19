/**
 * LogoBreath - Brief calming transition before onboarding
 *
 * A 500ms moment that prepares the user for focus.
 * Not a splash screen - a breath before the experience begins.
 *
 * Duration: 500ms total
 * - Entrance: 0-300ms (logo fades in + micro-scale)
 * - Hold: 300-400ms (brief stillness)
 * - Dissolve: 400-500ms (logo fades out, overlaps with next screen)
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { colors } from '@/theme';

interface LogoBreathProps {
    onComplete: () => void;
}

export const LogoBreath: React.FC<LogoBreathProps> = ({ onComplete }) => {
    const opacity = useSharedValue(0);
    const scale = useSharedValue(0.96);
    const logoStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }],
    }));

    useEffect(() => {
        // Entrance: 0-300ms, hold: 300-400ms, dissolve: 400-500ms. The
        // visual sequence stays on the UI thread; only navigation is timed in JS.
        opacity.value = withSequence(
            withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) }),
            withDelay(100, withTiming(0, { duration: 100, easing: Easing.linear })),
        );
        scale.value = withSequence(
            withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) }),
            withDelay(100, withTiming(0.98, { duration: 100, easing: Easing.linear })),
        );
        const completeTimer = setTimeout(onComplete, 500);
        return () => {
            clearTimeout(completeTimer);
        };
    }, [onComplete, opacity, scale]);

    return (
        <View style={styles.container}>
            {/* Same gradient as onboarding - continuous background */}
            <LinearGradient
                colors={[
                    colors.background.primary,
                    '#1A1625',
                    colors.background.primary
                ]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />

            {/* Logo mark */}
            <Animated.View
                style={[styles.logoContainer, logoStyle]}
            >
                {/* Official Logo */}
                <Image
                    source={require('../../assets/images/anchor-gold.png')}
                    style={styles.logoImage}
                    resizeMode="contain"
                />
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background.primary,
    },
    logoContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoImage: {
        width: 160,
        height: 160,
    },
});
