/**
 * Physical Anchor Modal Component
 *
 * Product selection bottom sheet for choosing physical anchor merchandise.
 * Displays a curated list of 4 product types with calm, intentional design.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Anchor } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { safeHaptics } from '@/utils/haptics';
import { AnalyticsService, AnalyticsEvents } from '@/services/AnalyticsService';

const { width } = Dimensions.get('window');
const MODAL_WIDTH = Math.min(width * 0.85, 400);

interface Product {
  id: string;
  type: 'keychain' | 'art_print' | 'hoodie' | 'phone_case';
  title: string;
  description: string;
}

const PRODUCTS: Product[] = [
  {
    id: 'keychain',
    type: 'keychain',
    title: 'Keychain',
    description: 'Keep it close, wherever you go.',
  },
  {
    id: 'art_print',
    type: 'art_print',
    title: 'Art Print',
    description: 'Place it where focus begins.',
  },
  {
    id: 'hoodie',
    type: 'hoodie',
    title: 'Hoodie',
    description: 'Wear the intention.',
  },
  {
    id: 'phone_case',
    type: 'phone_case',
    title: 'Phone Case',
    description: "A reminder you can't ignore.",
  },
];

interface PhysicalAnchorModalProps {
  visible: boolean;
  onClose: () => void;
  anchor: Anchor;
}

export const PhysicalAnchorModal: React.FC<PhysicalAnchorModalProps> = ({
  visible,
  onClose,
  anchor,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const productAnimations = useRef(
    PRODUCTS.map(() => new Animated.Value(0))
  ).current;

  useEffect(() => {
    if (visible) {
      // Fade in modal
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
      ]).start();

      // Stagger product card animations
      Animated.stagger(
        50,
        productAnimations.map((anim) =>
          Animated.timing(anim, {
            toValue: 1,
            duration: 200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          })
        )
      ).start();
    } else {
      // Fade out modal
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();

      // Reset product animations
      productAnimations.forEach((anim) => anim.setValue(0));
    }
  }, [visible]);

  const handleProductSelect = (product: Product) => {
    safeHaptics.selection();

    // Track analytics
    AnalyticsService.track(AnalyticsEvents.MERCH_PRODUCT_SELECTED, {
      anchor_id: anchor.id,
      product_type: product.type,
      product_title: product.title,
    });

    // TODO: Navigate to product detail when API ready
    // For now, show alert placeholder
    Alert.alert(
      product.title,
      `${product.description}\n\nPrintful integration coming soon!`,
      [{ text: 'Got it', onPress: () => onClose() }]
    );
  };

  const handleBackdropPress = () => {
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={handleBackdropPress}
      >
        <Animated.View
          style={[
            styles.backdropOverlay,
            {
              opacity: fadeAnim,
            },
          ]}
        />

        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <Animated.View
            style={[
              styles.modalContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            {Platform.OS === 'ios' ? (
              <BlurView intensity={40} tint="dark" style={styles.blurContainer}>
                {renderModalContent()}
              </BlurView>
            ) : (
              <View style={styles.androidContainer}>
                {renderModalContent()}
              </View>
            )}
          </Animated.View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  function renderModalContent() {
    return (
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Choose a form</Text>
          <Text style={styles.subtitle}>
            Your anchor will be mapped exactly as shown.
          </Text>
        </View>

        {/* Product Grid */}
        <View style={styles.productGrid}>
          {PRODUCTS.map((product, index) => (
            <Animated.View
              key={product.id}
              style={[
                styles.productCardWrapper,
                {
                  opacity: productAnimations[index],
                  transform: [
                    {
                      translateY: productAnimations[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <TouchableOpacity
                style={styles.productCard}
                onPress={() => handleProductSelect(product)}
                activeOpacity={0.7}
              >
                <View style={styles.productCardInner}>
                  <Text style={styles.productTitle}>{product.title}</Text>
                  <Text style={styles.productDescription}>
                    {product.description}
                  </Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>

        {/* Footer Actions */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackdropPress}
            activeOpacity={0.7}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContainer: {
    width: MODAL_WIDTH,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.ritual.border,
  },
  blurContainer: {
    borderRadius: 20,
  },
  androidContainer: {
    backgroundColor: colors.ritual.glassStrong,
    borderRadius: 20,
  },
  content: {
    padding: spacing.xl,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  productGrid: {
    marginBottom: spacing.lg,
  },
  productCardWrapper: {
    marginBottom: spacing.md,
  },
  productCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    overflow: 'hidden',
  },
  productCardInner: {
    backgroundColor: 'rgba(15, 20, 25, 0.4)',
    padding: spacing.md,
  },
  productTitle: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: typography.sizes.body1,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  productDescription: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  footer: {
    alignItems: 'center',
  },
  backButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  backButtonText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.text.secondary,
  },
});
