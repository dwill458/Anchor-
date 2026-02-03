import React, { useEffect, useRef, useLayoutEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/types';
import { colors } from '@/theme';
import { ScreenHeader, ZenBackground, OptimizedImage, SigilSvg } from '@/components/common';
import { BlurView } from 'expo-blur';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_SIZE = SCREEN_WIDTH - 64; // Large centered image

type AnchorRevealRouteProp = RouteProp<RootStackParamList, 'AnchorReveal'>;
type AnchorRevealNavigationProp = StackNavigationProp<RootStackParamList, 'AnchorReveal'>;

export const AnchorRevealScreen: React.FC = () => {
    const navigation = useNavigation<AnchorRevealNavigationProp>();
    const route = useRoute<AnchorRevealRouteProp>();

    const params = route.params as RootStackParamList['AnchorReveal'] | undefined;

    if (!params || !params.intentionText || !params.baseSigilSvg) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.content}>
                    <Text style={styles.label}>Anchor not found</Text>
                    <Text style={styles.subtitle}>Please go back and try again.</Text>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.continueButton}>
                        <LinearGradient
                            colors={[colors.gold, '#B8941F']}
                            style={styles.continueGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            <Text style={styles.continueText}>Go Back</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const {
        intentionText,
        category,
        distilledLetters,
        baseSigilSvg,
        reinforcedSigilSvg,
        structureVariant,
        enhancedImageUrl,
        reinforcementMetadata,
        enhancementMetadata,
    } = params;

    const imageUrl = typeof enhancedImageUrl === 'string' ? enhancedImageUrl : '';
    const isNavigatingRef = useRef(false);

    useEffect(() => {
        if (typeof navigation.addListener !== 'function') return;
        const unsubscribe = navigation.addListener('focus', () => {
            isNavigatingRef.current = false;
        });
        return unsubscribe;
    }, [navigation]);

    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.95)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    useLayoutEffect(() => {
        navigation.setOptions({
            headerShown: false,
        });
    }, [navigation]);

    const handleContinue = () => {
        if (isNavigatingRef.current) return;
        isNavigatingRef.current = true;
        navigation.navigate('MantraCreation', {
            intentionText,
            category,
            distilledLetters,
            baseSigilSvg,
            reinforcedSigilSvg,
            structureVariant,
            reinforcementMetadata,
            enhancementMetadata,
            finalImageUrl: enhancedImageUrl,
        });
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <ZenBackground orbOpacity={0.2} />

            <SafeAreaView style={styles.safeArea}>
                <ScreenHeader title="Your Anchor" />

                <View style={styles.content}>
                    <Animated.View
                        style={[
                            styles.imageContainer,
                            {
                                opacity: fadeAnim,
                                transform: [{ scale: scaleAnim }],
                            },
                        ]}
                    >
                        <View style={styles.imageCard}>
                            {imageUrl ? (
                                <OptimizedImage
                                    source={{ uri: imageUrl }}
                                    style={styles.image}
                                    contentFit="cover"
                                    priority="high"
                                    trackLoad
                                    perfLabel="anchor_reveal"
                                />
                            ) : (
                                <SigilSvg xml={baseSigilSvg} width="90%" height="90%" color={colors.gold} />
                            )}
                            <View style={styles.glowOverlay} />
                        </View>
                    </Animated.View>

                    <Animated.View
                        style={[
                            styles.textContainer,
                            {
                                opacity: fadeAnim,
                                transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
                            },
                        ]}
                    >
                        <Text style={styles.label}>ROOTED IN YOUR INTENTION</Text>
                        <BlurView intensity={20} tint="dark" style={styles.intentionCard}>
                            <View style={styles.intentionBorder} />
                            <Text style={styles.intentionText}>"{intentionText}"</Text>
                        </BlurView>
                    </Animated.View>
                </View>

                <Animated.View
                    style={[
                        styles.footer,
                        { opacity: fadeAnim },
                    ]}
                >
                    <TouchableOpacity
                        onPress={handleContinue}
                        activeOpacity={0.9}
                        style={styles.continueButton}
                    >
                        <LinearGradient
                            colors={[colors.gold, '#B8941F']}
                            style={styles.continueGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            <Text style={styles.continueText}>Begin Mantra</Text>
                            <Text style={styles.continueArrow}>→</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </Animated.View>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.navy,
    },
    safeArea: {
        flex: 1,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    imageContainer: {
        width: IMAGE_SIZE,
        height: IMAGE_SIZE,
        marginBottom: 40,
        shadowColor: colors.gold,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 30,
        elevation: 20,
    },
    imageCard: {
        width: '100%',
        height: '100%',
        borderRadius: 32,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
        backgroundColor: colors.charcoal,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    glowOverlay: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 32,
        borderWidth: 2,
        borderColor: 'rgba(212, 175, 55, 0.1)',
    },
    textContainer: {
        width: '100%',
    },
    label: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.silver,
        letterSpacing: 1.5,
        marginBottom: 12,
        textAlign: 'center',
        opacity: 0.8,
    },
    subtitle: {
        fontSize: 14,
        color: colors.silver,
        textAlign: 'center',
        marginBottom: 16,
        opacity: 0.8,
    },
    intentionCard: {
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
        backgroundColor: 'rgba(26, 26, 29, 0.4)',
        position: 'relative',
        overflow: 'hidden',
    },
    intentionBorder: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        backgroundColor: colors.gold,
    },
    intentionText: {
        fontSize: 18,
        fontStyle: 'italic',
        color: colors.bone,
        lineHeight: 28,
        textAlign: 'center',
    },
    footer: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    continueButton: {
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: colors.gold,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 10,
    },
    continueGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        paddingHorizontal: 32,
    },
    continueText: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.charcoal,
        letterSpacing: 0.5,
        marginRight: 8,
    },
    continueArrow: {
        fontSize: 20,
        color: colors.charcoal,
        fontWeight: '300',
    },
});
