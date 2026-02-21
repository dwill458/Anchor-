import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, spacing, typography } from '@/theme';

interface InfoSheetProps {
  visible: boolean;
  onClose: () => void;
}

export const InfoSheet: React.FC<InfoSheetProps> = ({ visible, onClose }) => {
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={36} tint="dark" style={StyleSheet.absoluteFillObject} />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, styles.androidFill]} />
          )}
          <View style={styles.handle} />
          <Text style={styles.title}>How the three modes work</Text>

          <View style={styles.block}>
            <Text style={styles.mode}>Charge</Text>
            <Text style={styles.copy}>Imprint the symbol into attention.</Text>
          </View>
          <View style={styles.block}>
            <Text style={styles.mode}>Stabilize</Text>
            <Text style={styles.copy}>Settle the intent. Make it steady.</Text>
          </View>
          <View style={styles.block}>
            <Text style={styles.mode}>Burn</Text>
            <Text style={styles.copy}>Close the loop. Release the hold.</Text>
          </View>

          <TouchableOpacity onPress={onClose} style={styles.cta} activeOpacity={0.85}>
            <Text style={styles.ctaText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderColor: 'rgba(212,175,55,0.22)',
    overflow: 'hidden',
    backgroundColor: 'rgba(11,15,23,0.95)',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  androidFill: {
    backgroundColor: 'rgba(11,15,23,0.98)',
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.26)',
    alignSelf: 'center',
  },
  title: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 22,
    color: colors.text.primary,
  },
  block: {
    marginTop: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  mode: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 12,
    color: colors.gold,
  },
  copy: {
    marginTop: 2,
    fontFamily: typography.fontFamily.sans,
    fontSize: 13,
    color: colors.text.secondary,
  },
  cta: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.36)',
    backgroundColor: 'rgba(212,175,55,0.14)',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: spacing.sm + 3,
  },
  ctaText: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 14,
    color: colors.gold,
  },
});
