/**
 * Anchor App - Physical Anchor CTA Component
 *
 * Subtle call-to-action for creating physical manifestations of anchors.
 * Only shown for charged anchors. Feels like preservation, not commerce.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme';

interface PhysicalAnchorCTAProps {
    onPress: () => void;
    isCharged: boolean;
}

export const PhysicalAnchorCTA: React.FC<PhysicalAnchorCTAProps> = ({
    onPress,
    isCharged,
}) => {
    if (!isCharged) return null;

    return (
        <TouchableOpacity
            style={styles.container}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <View style={styles.iconWrapper}>
                <Sparkles color={colors.gold} size={20} strokeWidth={1.5} />
            </View>

            <View style={styles.textContainer}>
                <Text style={styles.title}>Bring This Anchor Into the Physical World</Text>
                <Text style={styles.subtitle}>
                    Carry your intention with you
                </Text>
            </View>

            <View style={styles.arrow}>
                <Text style={styles.arrowText}>→</Text>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(212, 175, 55, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
        borderRadius: 12,
        padding: spacing.md,
        marginVertical: spacing.lg,
    },
    iconWrapper: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    textContainer: {
        flex: 1,
    },
    title: {
        fontFamily: typography.fonts.body,
        fontSize: typography.sizes.body2,
        color: colors.text.primary,
        marginBottom: 2,
        fontWeight: '600',
    },
    subtitle: {
        fontFamily: typography.fonts.body,
        fontSize: typography.sizes.caption,
        color: colors.text.tertiary,
        fontStyle: 'italic',
    },
    arrow: {
        marginLeft: spacing.sm,
    },
    arrowText: {
        color: colors.gold,
        fontSize: 20,
        fontWeight: '300',
    },
});
