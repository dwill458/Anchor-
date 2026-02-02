/**
 * Anchor App - Header Avatar Button
 *
 * Reusable circular avatar button for accessing profile/account
 * Used in header-right position across main screens
 */

import React from 'react';
import { Pressable, View, Text, StyleSheet, Platform } from 'react-native';
import { User } from 'lucide-react-native';
import { colors } from '@/theme';

interface HeaderAvatarButtonProps {
    onPress: () => void;
    imageUrl?: string;
    fallbackInitials?: string;
    size?: number;
}

export const HeaderAvatarButton: React.FC<HeaderAvatarButtonProps> = ({
    onPress,
    imageUrl,
    fallbackInitials,
    size = 36,
}) => {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.container,
                { width: size, height: size, borderRadius: size / 2 },
                pressed && styles.pressed,
            ]}
        >
            <View style={styles.innerRing}>
                {imageUrl ? (
                    // TODO: Add Image component when imageUrl is provided
                    <View style={styles.placeholder}>
                        <User color={colors.gold} size={size * 0.5} />
                    </View>
                ) : fallbackInitials ? (
                    <Text style={styles.initialsText}>{fallbackInitials}</Text>
                ) : (
                    <User color={colors.gold} size={size * 0.5} />
                )}
            </View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        // Glassmorphic background
        backgroundColor: 'rgba(26, 26, 29, 0.6)',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
        // Gold glow
        shadowColor: colors.gold,
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    pressed: {
        opacity: 0.7,
        transform: [{ scale: 0.95 }],
    },
    innerRing: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholder: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    initialsText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.gold,
        fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
    },
});
