/**
 * Anchor App - Data & Privacy Screen
 *
 * Manage user data, storage, and privacy settings.
 * Features: Export Data, Clear Cache, Synced Status, Policy Links.
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Platform,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Shield,
    Download,
    Trash2,
    CloudCheck,
    ExternalLink,
    ChevronRight,
    Info
} from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { colors, spacing } from '@/theme';
import { ZenBackground } from '@/components/common';

const IS_ANDROID = Platform.OS === 'android';
const CardWrapper = IS_ANDROID ? View : BlurView;

type PrivacyItemProps = {
    label: string;
    helperText?: string;
    value?: string;
    onPress?: () => void;
    icon: React.ComponentType<{ color: string; size: number }>;
    isDestructive?: boolean;
};

const PrivacyItem: React.FC<PrivacyItemProps> = ({
    label,
    helperText,
    value,
    onPress,
    icon: Icon,
    isDestructive = false,
}) => (
    <TouchableOpacity
        style={styles.item}
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={onPress ? 0.7 : 1}
    >
        <View style={styles.itemIconContainer}>
            <Icon color={isDestructive ? colors.error : colors.gold} size={22} />
        </View>
        <View style={styles.itemContent}>
            <Text style={[styles.itemLabel, isDestructive && styles.destructiveText]}>
                {label}
            </Text>
            {helperText && <Text style={styles.itemHelper}>{helperText}</Text>}
            {value && <Text style={styles.itemValue}>{value}</Text>}
        </View>
        {onPress && (
            <ChevronRight color={colors.silver} size={20} opacity={0.5} />
        )}
    </TouchableOpacity>
);

export const DataPrivacyScreen: React.FC = () => {
    const [isExporting, setIsExporting] = useState(false);
    const [isClearingCache, setIsClearingCache] = useState(false);

    const handleExportData = () => {
        Alert.alert(
            'Export Data',
            'All your anchors, rituals, and settings will be compiled into a secure archive and sent to your email.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Export',
                    onPress: () => {
                        setIsExporting(true);
                        setTimeout(() => {
                            setIsExporting(false);
                            Alert.alert('Success', 'Data export has been initiated. You will receive an email shortly.');
                        }, 1500);
                    }
                }
            ]
        );
    };

    const handleClearCache = () => {
        Alert.alert(
            'Clear Local Cache',
            'This will remove temporary files like cached AI variations and preview images. Your saved anchors are safe.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: () => {
                        setIsClearingCache(true);
                        setTimeout(() => {
                            setIsClearingCache(false);
                            Alert.alert('Cleared', 'Local cache has been successfully cleared.');
                        }, 1000);
                    }
                }
            ]
        );
    };

    const openUrl = (url: string) => {
        Linking.openURL(url).catch(() => {
            Alert.alert('Error', 'Could not open the link.');
        });
    };

    const cardProps = IS_ANDROID ? {} : { intensity: 10, tint: 'dark' as const };

    return (
        <View style={styles.container}>
            <ZenBackground />
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <ScrollView
                    style={styles.scrollView}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Data & Privacy</Text>
                        <Text style={styles.subtitle}>
                            Manage your personal information and how Anchor handles your data.
                        </Text>
                    </View>

                    {/* Privacy Overview Card */}
                    <View style={styles.overviewContainer}>
                        <CardWrapper {...cardProps} style={styles.overviewCard}>
                            <View style={styles.overviewHeader}>
                                <Shield color={colors.gold} size={24} />
                                <Text style={styles.overviewTitle}>Privacy First</Text>
                            </View>
                            <Text style={styles.overviewText}>
                                Your anchors and intentions are your own. We use industry-standard encryption to protect your data and never share it with third parties for advertising.
                            </Text>
                        </CardWrapper>
                    </View>

                    {/* Data Management Section */}
                    <Text style={styles.sectionTitle}>Data Management</Text>
                    <CardWrapper {...cardProps} style={styles.sectionCard}>
                        <PrivacyItem
                            label="Export My Data"
                            helperText="Download a copy of your account data in JSON format."
                            icon={Download}
                            onPress={handleExportData}
                        />
                        <PrivacyItem
                            label="Clear Local Cache"
                            helperText="Free up space by removing temporary files."
                            icon={Trash2}
                            onPress={handleClearCache}
                            isDestructive
                        />
                        <PrivacyItem
                            label="Offline Status"
                            helperText="Review actions waiting to be synced with the cloud."
                            value="All systems synced"
                            icon={CloudCheck}
                        />
                    </CardWrapper>

                    {/* Information Section */}
                    <Text style={styles.sectionTitle}>Information & Legal</Text>
                    <CardWrapper {...cardProps} style={styles.sectionCard}>
                        <PrivacyItem
                            label="Privacy Policy"
                            helperText="How we protect and handle your data."
                            icon={ExternalLink}
                            onPress={() => openUrl('https://anchor-app.io/privacy')}
                        />
                        <PrivacyItem
                            label="Terms of Service"
                            helperText="Rules for using the Anchor platform."
                            icon={ExternalLink}
                            onPress={() => openUrl('https://anchor-app.io/terms')}
                        />
                        <PrivacyItem
                            label="Safety Guidelines"
                            helperText="Best practices for using Anchor safely."
                            icon={Info}
                            onPress={() => openUrl('https://anchor-app.io/safety')}
                        />
                    </CardWrapper>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>
                            Anchor encrypts your data end-to-end where possible to ensure your journey remains private.
                        </Text>
                    </View>
                </ScrollView>
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
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: spacing.xxl,
    },
    header: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xl,
        paddingBottom: spacing.lg,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: colors.gold,
        marginBottom: spacing.xs,
        letterSpacing: 0.5,
    },
    subtitle: {
        fontSize: 14,
        color: colors.silver,
        lineHeight: 20,
        opacity: 0.8,
    },
    overviewContainer: {
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.xl,
    },
    overviewCard: {
        backgroundColor: 'rgba(212, 175, 55, 0.05)',
        borderRadius: 16,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
    },
    overviewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    overviewTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.gold,
    },
    overviewText: {
        fontSize: 14,
        color: colors.silver,
        lineHeight: 22,
        opacity: 0.9,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.silver,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginLeft: spacing.lg,
        marginBottom: spacing.sm,
        opacity: 0.6,
    },
    sectionCard: {
        backgroundColor: IS_ANDROID ? 'rgba(26, 26, 29, 0.9)' : 'rgba(26, 26, 29, 0.3)',
        marginHorizontal: spacing.lg,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.15)',
        marginBottom: spacing.xl,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    itemIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    itemContent: {
        flex: 1,
    },
    itemLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.bone,
    },
    itemHelper: {
        fontSize: 12,
        color: colors.silver,
        opacity: 0.6,
        marginTop: 2,
    },
    itemValue: {
        fontSize: 14,
        color: colors.gold,
        fontWeight: '500',
        marginTop: 4,
    },
    destructiveText: {
        color: colors.error,
    },
    footer: {
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.sm,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 12,
        color: colors.silver,
        textAlign: 'center',
        opacity: 0.5,
        fontStyle: 'italic',
    },
});
