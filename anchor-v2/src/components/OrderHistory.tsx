/**
 * Anchor App - Order History Component
 *
 * Displays past orders in Profile screen.
 * Utility only - no browsing, no upsells.
 */

import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { Package, ExternalLink } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme';
import { get } from '@/services/ApiClient';
import { format } from 'date-fns';

interface Order {
    id: string;
    productType: string;
    productVariant: string;
    totalCents: number;
    status: string;
    createdAt: string;
    trackingNumber?: string;
}

export const OrderHistory: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            const response = await get<{ data: Order[] }>('/api/orders');
            setOrders(response.data);
        } catch (error) {
            console.error('Failed to fetch orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatPrice = (cents: number): string => {
        return `$${(cents / 100).toFixed(2)}`;
    };

    const getStatusColor = (status: string): string => {
        const colors: Record<string, string> = {
            pending: '#D4AF37',
            processing: '#4A90E2',
            shipped: '#27AE60',
            delivered: '#27AE60',
            cancelled: '#E74C3C',
        };
        return colors[status] || colors.text.tertiary;
    };

    const handleTrackingPress = (trackingNumber: string) => {
        // In production, open tracking link
        console.log('Open tracking:', trackingNumber);
    };

    const renderOrder = ({ item }: { item: Order }) => (
        <View style={styles.orderCard}>
            <View style={styles.orderHeader}>
                <View style={styles.iconWrapper}>
                    <Package color={colors.gold} size={20} strokeWidth={1.5} />
                </View>
                <View style={styles.orderInfo}>
                    <Text style={styles.orderProduct}>
                        {item.productType.toUpperCase()}
                    </Text>
                    <Text style={styles.orderVariant}>{item.productVariant}</Text>
                </View>
                <Text style={styles.orderPrice}>{formatPrice(item.totalCents)}</Text>
            </View>

            <View style={styles.orderFooter}>
                <View style={styles.statusContainer}>
                    <View
                        style={[
                            styles.statusDot,
                            { backgroundColor: getStatusColor(item.status) },
                        ]}
                    />
                    <Text style={styles.statusText}>
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </Text>
                </View>

                <Text style={styles.orderDate}>
                    {format(new Date(item.createdAt), 'MMM d, yyyy')}
                </Text>
            </View>

            {item.trackingNumber && (
                <TouchableOpacity
                    style={styles.trackingButton}
                    onPress={() => handleTrackingPress(item.trackingNumber!)}
                    activeOpacity={0.7}
                >
                    <ExternalLink color={colors.gold} size={14} strokeWidth={1.5} />
                    <Text style={styles.trackingText}>Track Shipment</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator color={colors.gold} />
            </View>
        );
    }

    if (orders.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Package color={colors.text.tertiary} size={48} strokeWidth={1} />
                <Text style={styles.emptyText}>No orders yet</Text>
                <Text style={styles.emptySubtext}>
                    Physical anchors you create will appear here
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Your Manifestations</Text>
            <FlatList
                data={orders}
                renderItem={renderOrder}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centerContainer: {
        padding: spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyContainer: {
        padding: spacing.xxl,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        fontFamily: typography.fonts.body,
        fontSize: typography.sizes.body1,
        color: colors.text.secondary,
        marginTop: spacing.md,
        marginBottom: spacing.xs,
    },
    emptySubtext: {
        fontFamily: typography.fonts.body,
        fontSize: typography.sizes.caption,
        color: colors.text.tertiary,
        textAlign: 'center',
        fontStyle: 'italic',
    },
    title: {
        fontFamily: typography.fonts.heading,
        fontSize: typography.sizes.h4,
        color: colors.gold,
        marginBottom: spacing.md,
        paddingHorizontal: spacing.lg,
    },
    listContent: {
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.xl,
    },
    orderCard: {
        backgroundColor: 'rgba(26, 26, 29, 0.6)',
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.15)',
    },
    orderHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    iconWrapper: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.sm,
    },
    orderInfo: {
        flex: 1,
    },
    orderProduct: {
        fontFamily: typography.fonts.body,
        fontSize: typography.sizes.body1,
        color: colors.text.primary,
        fontWeight: '600',
        marginBottom: 2,
    },
    orderVariant: {
        fontFamily: typography.fonts.body,
        fontSize: typography.sizes.caption,
        color: colors.text.tertiary,
    },
    orderPrice: {
        fontFamily: typography.fonts.body,
        fontSize: typography.sizes.body1,
        color: colors.gold,
        fontWeight: '600',
    },
    orderFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(212, 175, 55, 0.1)',
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: spacing.xs,
    },
    statusText: {
        fontFamily: typography.fonts.body,
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        fontWeight: '600',
    },
    orderDate: {
        fontFamily: typography.fonts.body,
        fontSize: typography.sizes.caption,
        color: colors.text.tertiary,
    },
    trackingButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.sm,
        paddingVertical: spacing.xs,
    },
    trackingText: {
        fontFamily: typography.fonts.body,
        fontSize: typography.sizes.caption,
        color: colors.gold,
        marginLeft: spacing.xs,
        fontWeight: '600',
    },
});
