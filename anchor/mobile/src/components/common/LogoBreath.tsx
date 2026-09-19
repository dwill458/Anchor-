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

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { EaseView } from 'react-native-ease';
import { colors } from '@/theme';

interface LogoBreathProps {
    onComplete: () => void;
}

export const LogoBreath: React.FC<LogoBreathProps> = ({ onComplete }) => {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        // Entrance: 0-300ms, hold: 300-400ms, dissolve: 400-500ms.
        const dissolveTimer = setTimeout(() => setVisible(false), 400);
        const completeTimer = setTimeout(onComplete, 500);
        return () => {
            clearTimeout(dissolveTimer);
            clearTimeout(completeTimer);
        };
    }, [onComplete]);

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
            <EaseView
                initialAnimate={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: visible ? 1 : 0, scale: visible ? 1 : 0.98 }}
                transition={visible
                    ? { type: 'timing', duration: 300, easing: 'easeOut' }
                    : { type: 'timing', duration: 100, easing: 'linear' }}
                style={styles.logoContainer}
            >
                {/* Official Logo */}
                <Image
                    source={require('../../assets/images/anchor-gold.png')}
                    style={styles.logoImage}
                    resizeMode="contain"
                />
            </EaseView>
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
