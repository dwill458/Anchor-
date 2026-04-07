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

interface PracticeTeachingSheetProps {
  visible: boolean;
  onClose: () => void;
}

export const PracticeTeachingSheet: React.FC<PracticeTeachingSheetProps> = ({ visible, onClose }) => {
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, styles.androidFill]} />
          )}
          <View style={styles.drag} />
          <Text style={styles.title}>How the three modes work</Text>
          <View style={styles.block}>
            <Text style={styles.mode}>Charge</Text>
            <Text style={styles.copy}>Charge builds fast recall of your symbol.</Text>
          </View>
          <View style={styles.block}>
            <Text style={styles.mode}>Stabilize</Text>
            <Text style={styles.copy}>Stabilize settles attention so the state lasts.</Text>
          </View>
          <View style={styles.block}>
            <Text style={styles.mode}>Burn</Text>
            <Text style={styles.copy}>Burn closes completed work so you can move cleanly.</Text>
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
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  sheet: {
    maxHeight: '75%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    backgroundColor: 'rgba(10,14,20,0.96)',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  androidFill: {
    backgroundColor: 'rgba(10,14,20,0.98)',
  },
  drag: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  title: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 22,
    color: colors.text.primary,
  },
  block: {
    marginBottom: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  mode: {
    fontFamily: typography.fontFamily.sansBold,
    color: colors.gold,
    fontSize: 12,
  },
  copy: {
    marginTop: 2,
    fontFamily: typography.fontFamily.sans,
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
  cta: {
    marginTop: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.36)',
    backgroundColor: 'rgba(212,175,55,0.16)',
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
  },
  ctaText: {
    fontFamily: typography.fontFamily.sansBold,
    color: colors.gold,
    fontSize: 14,
  },
});
