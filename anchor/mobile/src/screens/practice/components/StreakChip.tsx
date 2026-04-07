import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    TouchableWithoutFeedback,
} from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { safeHaptics } from '@/utils/haptics';

interface StreakChipProps {
    currentStreak: number;
}

export const StreakChip: React.FC<StreakChipProps> = ({ currentStreak }) => {
    const [modalVisible, setModalVisible] = useState(false);

    const handlePress = () => {
        safeHaptics.selection();
        setModalVisible(true);
    };

    const handleClose = () => {
        safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
        setModalVisible(false);
    };

    if (currentStreak <= 0) return null;

    return (
        <>
            <TouchableOpacity
                style={styles.chip}
                onPress={handlePress}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Streak of ${currentStreak} days`}
            >
                <Text style={styles.chipText}>Day {currentStreak}</Text>
            </TouchableOpacity>

            <Modal
                visible={modalVisible}
                transparent
                animationType="slide"
                onRequestClose={handleClose}
            >
                <TouchableWithoutFeedback onPress={handleClose}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <BlurView intensity={30} tint="dark" style={styles.sheetContainer}>
                                <View style={styles.dragHandle} />
                                <Text style={styles.sheetTitle}>Streak</Text>
                                <Text style={styles.sheetBody}>
                                    Return once per day to keep the flame.
                                </Text>

                                <View style={styles.statsRow}>
                                    <View style={styles.statBox}>
                                        <Text style={styles.statLabel}>CURRENT</Text>
                                        <Text style={styles.statValue}>{currentStreak}</Text>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={styles.closeButton}
                                    onPress={handleClose}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.closeButtonText}>Got it</Text>
                                </TouchableOpacity>
                            </BlurView>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    chip: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(201,168,76,0.35)', // goldBorder
        backgroundColor: 'rgba(201,168,76,0.08)',
        alignSelf: 'flex-start',
        marginTop: 4,
    },
    chipText: {
        fontFamily: typography.fonts.bodyBold,
        fontSize: 10,
        color: colors.gold,
        letterSpacing: 0.5,
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheetContainer: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: spacing.xl,
        paddingBottom: spacing.xxxl,
        backgroundColor: 'rgba(26,16,48,0.85)', // dark purple tint
        borderTopWidth: 1,
        borderTopColor: colors.ritual.border,
        alignItems: 'center',
    },
    dragHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginBottom: spacing.lg,
    },
    sheetTitle: {
        fontFamily: typography.fonts.heading,
        fontSize: 22,
        color: colors.bone,
        marginBottom: spacing.sm,
    },
    sheetBody: {
        fontFamily: typography.fonts.body,
        fontSize: 15,
        color: colors.text.secondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
        lineHeight: 22,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: spacing.xl,
        width: '100%',
    },
    statBox: {
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.2)',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    statLabel: {
        fontFamily: typography.fonts.bodyBold,
        fontSize: 10,
        color: colors.text.tertiary,
        letterSpacing: 1.5,
        marginBottom: 4,
    },
    statValue: {
        fontFamily: typography.fonts.heading,
        fontSize: 24,
        color: colors.gold,
    },
    closeButton: {
        width: '100%',
        paddingVertical: 14,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        alignItems: 'center',
    },
    closeButtonText: {
        fontFamily: typography.fonts.bodyBold,
        fontSize: 16,
        color: colors.bone,
    },
});
