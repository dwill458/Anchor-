/**
 * Anchor App - Product Selection Screen
 *
 * Allows user to choose how to manifest their anchor physically.
 * Feels ceremonial, not commercial.
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SvgXml } from 'react-native-svg';
import { colors, spacing, typography } from '@/theme';
import { RootStackParamList } from '@/types';

type ProductSelectionRouteProp = RouteProp<RootStackParamList, 'ProductSelection'>;
type ProductSelectionNavigationProp = StackNavigationProp<RootStackParamList, 'ProductSelection'>;

const { width } = Dimensions.get('window');

type ProductType = 'print' | 'hoodie' | 'keychain' | 't-shirt' | 'phone-case';

interface Product {
    type: ProductType;
    name: string;
    description: string;
    emoji: string;
    startingPrice: number;
}

const PRODUCTS: Product[] = [
    {
        type: 'print',
        name: 'Sacred Print',
        description: 'Museum-quality archival print for your space',
        emoji: '🖼️',
        startingPrice: 35,
    },
    {
        type: 'keychain',
        name: 'Pocket Anchor',
        description: 'Carry this reminder everywhere you go',
        emoji: '🔑',
        startingPrice: 18,
    },
    {
        type: 'hoodie',
        name: 'Wearable Intention',
        description: 'Premium hoodie with your anchor on the back',
        emoji: '👕',
        startingPrice: 65,
    },
    {
        type: 't-shirt',
        name: 'Daily Reminder',
        description: 'Soft organic cotton with subtle anchor placement',
        emoji: '👔',
        startingPrice: 32,
    },
    {
        type: 'phone-case',
        name: 'Digital Guardian',
        description: 'See your anchor every time you reach for your phone',
        emoji: '📱',
        startingPrice: 28,
    },
];

export const ProductSelectionScreen: React.FC = () => {
    const route = useRoute<ProductSelectionRouteProp>();
    const navigation = useNavigation<ProductSelectionNavigationProp>();

    const { anchorId, sigilSvg, intentionText } = route.params;
    const [selectedProduct, setSelectedProduct] = useState<ProductType | null>(null);

    const handleProductSelect = (productType: ProductType) => {
        setSelectedProduct(productType);

        // Navigate to mockup preview
        navigation.navigate('ProductMockup', {
            anchorId,
            sigilSvg,
            intentionText,
            productType,
        });
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Choose Your Manifestation</Text>
                    <Text style={styles.subtitle}>
                        How will you carry this anchor with you?
                    </Text>
                </View>

                {/* Anchor Preview */}
                <View style={styles.previewContainer}>
                    <View style={styles.sigilWrapper}>
                        <SvgXml xml={sigilSvg} width={100} height={100} />
                    </View>
                    <Text style={styles.intentionText}>"{intentionText}"</Text>
                </View>

                {/* Product Grid */}
                <View style={styles.productsContainer}>
                    {PRODUCTS.map((product) => (
                        <TouchableOpacity
                            key={product.type}
                            style={[
                                styles.productCard,
                                selectedProduct === product.type && styles.productCardSelected,
                            ]}
                            onPress={() => handleProductSelect(product.type)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.productEmoji}>{product.emoji}</Text>
                            <Text style={styles.productName}>{product.name}</Text>
                            <Text style={styles.productDescription}>{product.description}</Text>
                            <Text style={styles.productPrice}>From ${product.startingPrice}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
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
        alignItems: 'center',
    },
    title: {
        fontFamily: typography.fonts.heading,
        fontSize: typography.sizes.h3,
        color: colors.gold,
        marginBottom: spacing.sm,
        textAlign: 'center',
    },
    subtitle: {
        fontFamily: typography.fonts.body,
        fontSize: typography.sizes.body2,
        color: colors.text.secondary,
        textAlign: 'center',
    },
    previewContainer: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(212, 175, 55, 0.1)',
        marginBottom: spacing.xl,
    },
    sigilWrapper: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(15, 20, 25, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
        marginBottom: spacing.md,
    },
    intentionText: {
        fontFamily: typography.fonts.body,
        fontSize: typography.sizes.body2,
        color: colors.text.tertiary,
        fontStyle: 'italic',
        textAlign: 'center',
        maxWidth: '80%',
    },
    productsContainer: {
        gap: spacing.md,
    },
    productCard: {
        backgroundColor: 'rgba(26, 26, 29, 0.6)',
        borderRadius: 12,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.15)',
    },
    productCardSelected: {
        borderColor: colors.gold,
        borderWidth: 2,
        backgroundColor: 'rgba(212, 175, 55, 0.08)',
    },
    productEmoji: {
        fontSize: 32,
        marginBottom: spacing.sm,
    },
    productName: {
        fontFamily: typography.fonts.body,
        fontSize: typography.sizes.h4,
        color: colors.text.primary,
        fontWeight: '600',
        marginBottom: spacing.xs,
    },
    productDescription: {
        fontFamily: typography.fonts.body,
        fontSize: typography.sizes.body2,
        color: colors.text.secondary,
        lineHeight: 20,
        marginBottom: spacing.md,
    },
    productPrice: {
        fontFamily: typography.fonts.body,
        fontSize: typography.sizes.caption,
        color: colors.gold,
        opacity: 0.7,
    },
});
