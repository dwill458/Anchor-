/**
 * Anchor App - Checkout Screen
 *
 * Final step: collect shipping info and complete order.
 * Maintains ceremonial tone throughout.
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { colors, spacing, typography } from '@/theme';
import { RootStackParamList } from '@/types';
import { post } from '@/services/ApiClient';
import * as Haptics from 'expo-haptics';

type CheckoutRouteProp = RouteProp<RootStackParamList, 'Checkout'>;
type CheckoutNavigationProp = StackNavigationProp<RootStackParamList, 'Checkout'>;

export const CheckoutScreen: React.FC = () => {
    const route = useRoute<CheckoutRouteProp>();
    const navigation = useNavigation<CheckoutNavigationProp>();

    const { anchorId, productType, size, color } = route.params;

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [zip, setZip] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleComplete = async () => {
        if (!name || !email || !address || !city || !state || !zip) {
            // Simple validation
            return;
        }

        setIsLoading(true);

        try {
            // Create order via API
            const orderData = {
                anchorId,
                productType,
                size,
                color,
                shippingInfo: {
                    name,
                    email,
                    address,
                    city,
                    state,
                    zip,
                },
            };

            await post('/api/orders', orderData);

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Navigate back to vault with success message
            navigation.reset({
                index: 0,
                routes: [{ name: 'Vault' }],
            });

        } catch (error) {
            console.error('Order error:', error);
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.title}>Your Anchor's Journey</Text>
                    <Text style={styles.subtitle}>
                        This manifestation will be crafted with intention and shipped to you
                    </Text>
                </View>

                <View style={styles.orderSummary}>
                    <Text style={styles.summaryLabel}>Your Selection</Text>
                    <Text style={styles.summaryProduct}>{productType.toUpperCase()}</Text>
                    <Text style={styles.summaryDetails}>{size} • {color}</Text>
                </View>

                <View style={styles.formContainer}>
                    <Text style={styles.formLabel}>Where should we send this anchor?</Text>

                    <TextInput
                        style={styles.input}
                        placeholder="Full Name"
                        placeholderTextColor="rgba(245, 245, 220, 0.3)"
                        value={name}
                        onChangeText={setName}
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor="rgba(245, 245, 220, 0.3)"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Street Address"
                        placeholderTextColor="rgba(245, 245, 220, 0.3)"
                        value={address}
                        onChangeText={setAddress}
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="City"
                        placeholderTextColor="rgba(245, 245, 220, 0.3)"
                        value={city}
                        onChangeText={setCity}
                    />

                    <View style={styles.row}>
                        <TextInput
                            style={[styles.input, styles.inputHalf]}
                            placeholder="State"
                            placeholderTextColor="rgba(245, 245, 220, 0.3)"
                            value={state}
                            onChangeText={setState}
                        />

                        <TextInput
                            style={[styles.input, styles.inputHalf]}
                            placeholder="Zip"
                            placeholderTextColor="rgba(245, 245, 220, 0.3)"
                            value={zip}
                            onChangeText={setZip}
                            keyboardType="numeric"
                        />
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.completeButton, isLoading && styles.completeButtonLoading]}
                    onPress={handleComplete}
                    disabled={isLoading}
                    activeOpacity={0.8}
                >
                    {isLoading ? (
                        <ActivityIndicator color={colors.navy} />
                    ) : (
                        <Text style={styles.completeButtonText}>Complete Order</Text>
                    )}
                </TouchableOpacity>

                <Text style={styles.footnote}>
                    Your anchor will be handcrafted and shipped within 5-7 business days
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.navy,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.xxxl,
    },
    header: {
        paddingTop: spacing.xl,
        paddingBottom: spacing.lg,
    },
    title: {
        fontFamily: typography.fonts.heading,
        fontSize: typography.sizes.h3,
        color: colors.gold,
        marginBottom: spacing.sm,
    },
    subtitle: {
        fontFamily: typography.fonts.body,
        fontSize: typography.sizes.body2,
        color: colors.text.secondary,
        lineHeight: 22,
    },
    orderSummary: {
        backgroundColor: 'rgba(212, 175, 55, 0.08)',
        borderRadius: 12,
        padding: spacing.lg,
        marginBottom: spacing.xl,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
    },
    summaryLabel: {
        fontFamily: typography.fonts.body,
        fontSize: typography.sizes.caption,
        color: colors.text.tertiary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: spacing.sm,
    },
    summaryProduct: {
        fontFamily: typography.fonts.heading,
        fontSize: typography.sizes.h4,
        color: colors.gold,
        marginBottom: spacing.xs,
    },
    summaryDetails: {
        fontFamily: typography.fonts.body,
        fontSize: typography.sizes.body2,
        color: colors.text.secondary,
    },
    formContainer: {
        marginBottom: spacing.xl,
    },
    formLabel: {
        fontFamily: typography.fonts.body,
        fontSize: typography.sizes.body1,
        color: colors.text.primary,
        marginBottom: spacing.lg,
    },
    input: {
        backgroundColor: 'rgba(26, 26, 29, 0.6)',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
        borderRadius: 8,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        fontFamily: typography.fonts.body,
        fontSize: typography.sizes.body1,
        color: colors.text.primary,
        marginBottom: spacing.md,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: spacing.md,
    },
    inputHalf: {
        flex: 1,
    },
    completeButton: {
        backgroundColor: colors.gold,
        paddingVertical: spacing.lg,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: spacing.md,
        shadowColor: colors.gold,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    completeButtonLoading: {
        opacity: 0.7,
    },
    completeButtonText: {
        fontFamily: typography.fonts.body,
        fontSize: typography.sizes.button,
        color: colors.navy,
        fontWeight: '700',
        letterSpacing: 1,
    },
    footnote: {
        fontFamily: typography.fonts.body,
        fontSize: typography.sizes.caption,
        color: colors.text.tertiary,
        textAlign: 'center',
        fontStyle: 'italic',
        lineHeight: 18,
    },
});
