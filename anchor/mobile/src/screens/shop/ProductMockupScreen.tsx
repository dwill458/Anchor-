/**
 * Anchor App - Product Mockup Screen
 *
 * Live preview of the anchor on the selected product.
 * Allows customization (size, color) before checkout.
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Dimensions,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SvgXml } from 'react-native-svg';
import { colors, spacing, typography } from '@/theme';
import { RootStackParamList } from '@/types';

type ProductMockupRouteProp = RouteProp<RootStackParamList, 'ProductMockup'>;
type ProductMockupNavigationProp = StackNavigationProp<RootStackParamList, 'ProductMockup'>;

const { width } = Dimensions.get('window');

const SIZES = {
    print: ['8x10"', '16x20"', '24x36"'],
    hoodie: ['S', 'M', 'L', 'XL', 'XXL'],
    't-shirt': ['S', 'M', 'L', 'XL', 'XXL'],
    keychain: ['Standard'],
    'phone-case': ['iPhone 15 Pro', 'iPhone 15', 'iPhone 14 Pro', 'Samsung S24'],
};

const COLORS = {
    print: ['Black Frame', 'White Frame', 'Natural Wood'],
    hoodie: ['Charcoal', 'Navy', 'Black'],
    't-shirt': ['Bone White', 'Charcoal', 'Navy'],
    keychain: ['Brushed Metal'],
    'phone-case': ['Clear', 'Matte Black'],
};

export const ProductMockupScreen: React.FC = () => {
    const route = useRoute<ProductMockupRouteProp>();
    const navigation = useNavigation<ProductMockupNavigationProp>();

    const { anchorId, sigilSvg, intentionText, productType } = route.params;

    const [selectedSize, setSelectedSize] = useState(SIZES[productType][0]);
    const [selectedColor, setSelectedColor] = useState(COLORS[productType][0]);

    const handleContinue = () => {
        // Navigate to checkout
        navigation.navigate('Checkout', {
            anchorId,
            productType,
            size: selectedSize,
            color: selectedColor,
        });
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Mockup Preview */}
                <View style={styles.mockupContainer}>
                    <View style={styles.mockupWrapper}>
                        {/* Simple mockup - in production, this would be a real product image */}
                        <View style={styles.productMockup}>
                            <SvgXml xml={sigilSvg} width={200} height={200} />
                            <View style={styles.mockupOverlay}>
                                <Text style={styles.mockupLabel}>{productType.toUpperCase()}</Text>
                            </View>
                        </View>
                    </View>

                    <Text style={styles.mockupCaption}>
                        Live preview with your anchor
                    </Text>
                </View>

                {/* Customization Options */}
                <View style={styles.optionsContainer}>
                    {/* Size Selection */}
                    <View style={styles.optionSection}>
                        <Text style={styles.optionLabel}>Size</Text>
                        <View style={styles.optionButtons}>
                            {SIZES[productType].map((size) => (
                                <TouchableOpacity
                                    key={size}
                                    style={[
                                        styles.optionButton,
                                        selectedSize === size && styles.optionButtonSelected,
                                    ]}
                                    onPress={() => setSelectedSize(size)}
                                >
                                    <Text
                                        style={[
                                            styles.optionButtonText,
                                            selectedSize === size && styles.optionButtonTextSelected,
                                        ]}
                                    >
                                        {size}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Color/Variant Selection */}
                    <View style={styles.optionSection}>
                        <Text style={styles.optionLabel}>Finish</Text>
                        <View style={styles.optionButtons}>
                            {COLORS[productType].map((color) => (
                                <TouchableOpacity
                                    key={color}
                                    style={[
                                        styles.optionButton,
                                        selectedColor === color && styles.optionButtonSelected,
                                    ]}
                                    onPress={() => setSelectedColor(color)}
                                >
                                    <Text
                                        style={[
                                            styles.optionButtonText,
                                            selectedColor === color && styles.optionButtonTextSelected,
                                        ]}
                                    >
                                        {color}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </View>

                {/* Intention Reminder */}
                <View style={styles.reminderContainer}>
                    <Text style={styles.reminderText}>
                        "{intentionText}"
                    </Text>
                </View>

                {/* Continue Button */}
                <TouchableOpacity
                    style={styles.continueButton}
                    onPress={handleContinue}
                    activeOpacity={0.8}
                >
                    <Text style={styles.continueButtonText}>Continue to Details</Text>
                </TouchableOpacity>
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
        paddingBottom: spacing.xxxl,
    },
    mockupContainer: {
        paddingTop: spacing.xl,
        paddingBottom: spacing.xxl,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(212, 175, 55, 0.1)',
    },
    mockupWrapper: {
        width: width * 0.8,
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    productMockup: {
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(26, 26, 29, 0.6)',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
        position: 'relative',
    },
    mockupOverlay: {
        position: 'absolute',
        bottom: spacing.md,
        right: spacing.md,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 4,
    },
    mockupLabel: {
        fontFamily: typography.fonts.body,
        fontSize: typography.sizes.caption,
        color: colors.gold,
        letterSpacing: 1,
    },
    mockupCaption: {
        fontFamily: typography.fonts.body,
        fontSize: typography.sizes.caption,
        color: colors.text.tertiary,
        marginTop: spacing.md,
        fontStyle: 'italic',
    },
    optionsContainer: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xl,
    },
    optionSection: {
        marginBottom: spacing.xl,
    },
    optionLabel: {
        fontFamily: typography.fonts.body,
        fontSize: typography.sizes.body2,
        color: colors.text.primary,
        fontWeight: '600',
        marginBottom: spacing.md,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    optionButtons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    optionButton: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
        backgroundColor: 'transparent',
    },
    optionButtonSelected: {
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
        borderColor: colors.gold,
        borderWidth: 1.5,
    },
    optionButtonText: {
        fontFamily: typography.fonts.body,
        fontSize: typography.sizes.body2,
        color: colors.text.secondary,
    },
    optionButtonTextSelected: {
        color: colors.gold,
        fontWeight: '600',
    },
    reminderContainer: {
        marginHorizontal: spacing.lg,
        marginVertical: spacing.xl,
        padding: spacing.md,
        backgroundColor: 'rgba(212, 175, 55, 0.05)',
        borderLeftWidth: 3,
        borderLeftColor: colors.gold,
        borderRadius: 4,
    },
    reminderText: {
        fontFamily: typography.fonts.body,
        fontSize: typography.sizes.body2,
        color: colors.text.primary,
        fontStyle: 'italic',
        lineHeight: 22,
    },
    continueButton: {
        marginHorizontal: spacing.lg,
        backgroundColor: colors.gold,
        paddingVertical: spacing.lg,
        borderRadius: 8,
        alignItems: 'center',
        shadowColor: colors.gold,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    continueButtonText: {
        fontFamily: typography.fonts.body,
        fontSize: typography.sizes.button,
        color: colors.navy,
        fontWeight: '700',
        letterSpacing: 1,
    },
});
