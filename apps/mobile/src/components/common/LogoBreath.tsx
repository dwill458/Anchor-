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

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/theme';
import { OptimizedImage } from './OptimizedImage';

interface LogoBreathProps {
    onComplete: () => void;
}

export const LogoBreath: React.FC<LogoBreathProps> = ({ onComplete }) => {
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const logoScale = useRef(new Animated.Value(0.96)).current;

    useEffect(() => {
        // Entrance: 0-300ms (fade in + micro-scale)
        Animated.parallel([
            Animated.timing(logoOpacity, {
                toValue: 1,
                duration: 300,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            }),
            Animated.timing(logoScale, {
                toValue: 1,
                duration: 300,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            }),
        ]).start(() => {
            // Hold: 100ms pause for stillness
            setTimeout(() => {
                // Dissolve: 100ms fade out
                Animated.timing(logoOpacity, {
                    toValue: 0,
                    duration: 100,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }).start(() => {
                    // Navigate to onboarding
                    onComplete();
                });
            }, 100);
        });
    }, [logoOpacity, logoScale, onComplete]);

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
                style={[
                    styles.logoContainer,
                    {
                        opacity: logoOpacity,
                        transform: [{ scale: logoScale }],
                    },
                ]}
            >
                {/* Official Logo */}
                <OptimizedImage
                    source={require('../../../assets/anchor-logo-official.jpg')}
                    style={styles.logoImage}
                    contentFit="contain"
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
