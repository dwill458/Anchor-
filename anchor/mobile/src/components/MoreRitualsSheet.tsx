import React, { useState } from 'react';
import {
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ScrollView,
    useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Zap, Wind, Flame } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme';
import { PRACTICE_COPY, ANCHOR_DETAILS_COPY } from '@/constants/copy';
import { safeHaptics } from '@/utils/haptics';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type RitualType = 'quickActivate' | 'charge' | 'stabilize' | 'burn';

interface MoreRitualsSheetProps {
    visible: boolean;
    onClose: () => void;
    onSelectRitual: (type: RitualType, durationSeconds?: number) => void;
    isCharged: boolean;
}

const RITUALS = [
    {
        type: 'quickActivate' as const,
        title: PRACTICE_COPY.rituals.quickActivate.title,
        desc: PRACTICE_COPY.rituals.quickActivate.meaning,
        duration: PRACTICE_COPY.rituals.quickActivate.duration,
        icon: Zap,
        presets: [10, 30, 60],
    },
    {
        type: 'charge' as const,
        title: PRACTICE_COPY.rituals.charge.title,
        desc: PRACTICE_COPY.rituals.charge.meaning,
        duration: PRACTICE_COPY.rituals.charge.duration,
        icon: Zap,
        presets: [60, 180, 300],
    },
    {
        type: 'stabilize' as const,
        title: PRACTICE_COPY.rituals.stabilize.title,
        desc: PRACTICE_COPY.rituals.stabilize.meaning,
        duration: PRACTICE_COPY.rituals.stabilize.duration,
        icon: Wind,
        presets: [30, 60, 120],
    },
    {
        type: 'burn' as const,
        title: PRACTICE_COPY.rituals.burn.title,
        desc: PRACTICE_COPY.rituals.burn.meaning,
        duration: PRACTICE_COPY.rituals.burn.duration,
        icon: Flame,
        presets: [],
    },
];

export const MoreRitualsSheet: React.FC<MoreRitualsSheetProps> = ({
    visible,
    onClose,
    onSelectRitual,
    isCharged,
}) => {
    const [expandedType, setExpandedType] = useState<RitualType | null>(null);
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();
    const sheetHeight = Math.round(windowHeight * 0.82);

    const handleCardPress = (type: RitualType) => {
        safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
        setExpandedType(expandedType === type ? null : type);
    };

    const handlePresetPress = (type: RitualType, preset: number) => {
        safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);
        onSelectRitual(type, preset);
    };

    const handleBurnConfirm = () => {
        safeHaptics.notification(Haptics.NotificationFeedbackType.Warning);
        onSelectRitual('burn');
    };

    if (!visible) return null;

    return (
        <View style={styles.root} pointerEvents="box-none">
            {/* Backdrop — tapping outside the sheet dismisses it */}
            <Pressable style={styles.backdrop} onPress={onClose} />

            {/* Sheet panel */}
            <View
                style={[
                    styles.sheetWrap,
                    {
                        height: sheetHeight,
                        paddingBottom: Math.max(insets.bottom, spacing.xl),
                    },
                ]}
            >
                {Platform.OS === 'ios' ? (
                    <BlurView intensity={42} tint="dark" style={StyleSheet.absoluteFill} />
                ) : (
                    <View style={[StyleSheet.absoluteFill, styles.androidSheetFill]} />
                )}

                {/* Gold handle */}
                <View style={styles.drag} />

                <Text style={styles.title}>{ANCHOR_DETAILS_COPY.moreRituals}</Text>

                <ScrollView
                    style={styles.list}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {RITUALS.map((ritual) => {
                        const Icon = ritual.icon;
                        const isExpanded = expandedType === ritual.type;

                        if (ritual.type === 'burn' && !isCharged) return null;

                        return (
                            <TouchableOpacity
                                key={ritual.type}
                                style={[styles.itemCard, isExpanded && styles.itemCardExpanded]}
                                activeOpacity={0.8}
                                onPress={() => handleCardPress(ritual.type)}
                            >
                                <View style={styles.itemHeader}>
                                    <View style={styles.iconWrap}>
                                        <Icon size={20} color={colors.gold} />
                                    </View>
                                    <View style={styles.itemCopy}>
                                        <Text style={styles.itemTitle}>{ritual.title}</Text>
                                        <Text style={styles.itemDesc}>{ritual.desc}</Text>
                                        <Text style={styles.itemDuration}>{ritual.duration}</Text>
                                    </View>
                                </View>

                                {isExpanded && (
                                    <View style={styles.expandedContent}>
                                        {ritual.type === 'burn' ? (
                                            <View style={styles.burnConfirmWrap}>
                                                <Text style={styles.burnConfirmText}>
                                                    {ANCHOR_DETAILS_COPY.burnConfirmation}
                                                </Text>
                                                <TouchableOpacity
                                                    style={styles.burnButton}
                                                    activeOpacity={0.85}
                                                    onPress={handleBurnConfirm}
                                                >
                                                    <Text style={styles.burnButtonText}>Confirm & Release</Text>
                                                </TouchableOpacity>
                                            </View>
                                        ) : (
                                            <View style={styles.presetRow}>
                                                {ritual.presets.map((preset) => (
                                                    <TouchableOpacity
                                                        key={preset}
                                                        style={styles.presetChip}
                                                        activeOpacity={0.8}
                                                        onPress={() => handlePresetPress(ritual.type, preset)}
                                                    >
                                                        <Text style={styles.presetChipText}>
                                                            {preset >= 60 ? `${Math.round(preset / 60)}m` : `${preset}s`}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 999,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    sheetWrap: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
        overflow: 'hidden',
        borderTopWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.24)',
        backgroundColor: 'rgba(12, 16, 24, 0.94)',
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
    },
    androidSheetFill: {
        backgroundColor: 'rgba(12, 16, 24, 0.96)',
    },
    drag: {
        width: 40,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center',
        backgroundColor: 'rgba(212, 175, 55, 0.4)',
        marginBottom: spacing.md,
    },
    title: {
        fontFamily: typography.fontFamily.serifSemiBold,
        fontSize: 22,
        color: colors.gold,
        marginBottom: spacing.md,
    },
    list: {
        flex: 1,
    },
    listContent: {
        paddingBottom: spacing.xl,
        gap: spacing.md,
    },
    itemCard: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(255,255,255,0.03)',
        padding: spacing.md,
    },
    itemCardExpanded: {
        borderColor: 'rgba(212,175,55,0.3)',
        backgroundColor: 'rgba(212,175,55,0.05)',
    },
    itemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    iconWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(212,175,55,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemCopy: {
        flex: 1,
    },
    itemTitle: {
        fontFamily: typography.fontFamily.sansBold,
        fontSize: 16,
        color: colors.text.primary,
    },
    itemDesc: {
        marginTop: 2,
        fontFamily: typography.fontFamily.sans,
        fontSize: 13,
        color: colors.text.secondary,
    },
    itemDuration: {
        marginTop: 4,
        fontFamily: typography.fontFamily.sans,
        fontSize: 12,
        color: colors.gold,
    },
    expandedContent: {
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
    },
    presetRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    presetChip: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.4)',
        backgroundColor: 'rgba(212,175,55,0.1)',
    },
    presetChipText: {
        fontFamily: typography.fontFamily.sansBold,
        fontSize: 14,
        color: colors.gold,
    },
    burnConfirmWrap: {
        alignItems: 'center',
    },
    burnConfirmText: {
        fontFamily: typography.fontFamily.sans,
        fontSize: 14,
        color: colors.text.secondary,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    burnButton: {
        paddingVertical: 12,
        paddingHorizontal: spacing.lg,
        borderRadius: 12,
        backgroundColor: '#8C3232',
    },
    burnButtonText: {
        fontFamily: typography.fontFamily.sansBold,
        fontSize: 14,
        color: '#fff',
    },
});
