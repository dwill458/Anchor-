import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert } from 'react-native';
import { V2SheetGrabZone, V2SheetModal, V2_SHEET_SKIRT, V2Button } from '@/components/v2/primitives';
import { useV2ReduceMotion, v2Haptics } from '@/hooks/v2';
import { colors, radii, spacing, typography } from '@/theme/v2';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import type { Anchor } from '@/types';

export interface Product {
  id: string;
  type: 'keychain' | 'art_print' | 'hoodie' | 'phone_case';
  title: string;
  description: string;
}

export const PRODUCTS: Product[] = [
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

export interface PhysicalAnchorModalProps {
  visible: boolean;
  onClose: () => void;
  anchor: Anchor;
}

/**
 * Anchor 2.0 Physical Anchor Form Sheet.
 *
 * Selection sheet for choosing physical anchor merchandise.
 * Built with Anchor 2.0 design language, paper surface, and spring physics.
 */
export const PhysicalAnchorModal: React.FC<PhysicalAnchorModalProps> = ({
  visible,
  onClose,
  anchor,
}) => {
  const reduceMotion = useV2ReduceMotion();

  const handleProductSelect = (product: Product) => {
    v2Haptics.selection();

    AnalyticsService.track(AnalyticsEvents.MERCH_PRODUCT_SELECTED, {
      anchor_id: anchor.id,
      product_type: product.type,
      product_title: product.title,
    });

    Alert.alert(
      product.title,
      `${product.description}\n\nPrintful integration coming soon!`,
      [{ text: 'Got it', onPress: () => onClose() }]
    );
  };

  const handleClose = () => {
    v2Haptics.selection();
    onClose();
  };

  return (
    <V2SheetModal
      visible={visible}
      onClose={handleClose}
      reduceMotion={reduceMotion}
      scrimAccessibilityLabel="Close form selection"
      testID="physical-anchor-modal"
    >
      <SafeAreaView edges={['bottom']} style={styles.sheet} accessibilityViewIsModal>
        <V2SheetGrabZone>
          <View style={styles.handle} />
          <Text style={styles.eyebrow} accessibilityRole="none">
            PHYSICAL ARTIFACT
          </Text>
          <Text accessibilityRole="header" style={styles.title}>
            Choose a form
          </Text>
          <Text style={styles.subtitle}>
            Your anchor will be mapped exactly as shown.
          </Text>
        </V2SheetGrabZone>

        <View style={styles.productGrid}>
          {PRODUCTS.map((product) => (
            <Pressable
              key={product.id}
              accessibilityRole="button"
              accessibilityLabel={`${product.title}: ${product.description}`}
              onPress={() => handleProductSelect(product)}
              style={({ pressed }) => [
                styles.productCard,
                pressed && styles.productCardPressed,
              ]}
            >
              <Text style={styles.productTitle}>{product.title}</Text>
              <Text style={styles.productDescription}>{product.description}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.footer}>
          <V2Button
            variant="secondary"
            onPress={handleClose}
            testID="physical-anchor-modal-cancel"
          >
            Cancel
          </V2Button>
        </View>
      </SafeAreaView>
    </V2SheetModal>
  );
};

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[4] + V2_SHEET_SKIRT,
    marginBottom: -V2_SHEET_SKIRT,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border.default,
    alignSelf: 'center',
    marginBottom: spacing[3],
  },
  eyebrow: {
    ...typography.labelSM,
    color: colors.text.secondary,
    letterSpacing: 1.2,
    marginBottom: spacing[1],
    textTransform: 'uppercase',
  },
  title: {
    ...typography.headingSM,
    color: colors.text.primary,
    marginBottom: spacing[1],
  },
  subtitle: {
    ...typography.bodySM,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing[4],
  },
  productGrid: {
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  productCard: {
    backgroundColor: colors.grouped,
    borderRadius: radii.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.subtle,
    minHeight: 56,
    justifyContent: 'center',
  },
  productCardPressed: {
    backgroundColor: colors.paper,
    borderColor: colors.border.strong,
  },
  productTitle: {
    ...typography.labelMD,
    color: colors.text.primary,
    marginBottom: 2,
  },
  productDescription: {
    ...typography.bodySM,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  footer: {
    paddingTop: spacing[1],
  },
});
