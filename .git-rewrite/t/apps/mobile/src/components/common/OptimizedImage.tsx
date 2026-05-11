/**
 * Optimized Image Component
 *
 * Uses React Native's built-in Image component
 * Note: react-native-fast-image requires a custom dev build with Expo
 */

import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

interface OptimizedImageProps {
    uri: string;
    style?: StyleProp<ImageStyle>;
    resizeMode?: 'contain' | 'cover' | 'stretch' | 'center';
    priority?: 'low' | 'normal' | 'high'; // kept for API compatibility
    onLoad?: () => void;
    onError?: () => void;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
    uri,
    style,
    resizeMode = 'cover',
    onLoad,
    onError,
}) => {
    return (
        <Image
            source={{ uri }}
            style={style}
            resizeMode={resizeMode}
            onLoad={onLoad}
            onError={onError}
        />
    );
};

// Stub cache utilities (no-op without FastImage)
export const clearImageCache = async () => {
    // No-op: standard Image doesn't have cache control
};

export const preloadImages = (uris: string[], priority?: 'low' | 'normal' | 'high') => {
    // Prefetch images using React Native's Image.prefetch
    uris.forEach(uri => {
        Image.prefetch(uri).catch(() => {
            // Silently ignore prefetch errors
        });
    });
};
