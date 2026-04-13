/**
 * PaywallScreen
 *
 * Shown when a user's 7-day free trial has expired and they have no active subscription.
 * Blocks access to the main app until a plan is selected.
 *
 * Note: Purchase buttons are UI-only placeholders. RevenueCat integration is deferred.
 */

import React, { useRef, useEffect } from 'react';
import {
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme';

// ─── Plan definitions ──────────────────────────────────────────────────────────

const PLANS = [
  {
    id: 'annual',
    label: 'Annual',
    price: '$59.99',
    period: '/ year',
    subtext: 'Save 37% — best value',
    highlighted: true,
  },
  {
    id: 'monthly',
    label: 'Monthly',
    price: '$7.99',
    period: '/ month',
    subtext: 'Billed monthly',
    highlighted: false,
  },
  {
    id: 'lifetime',
    label: 'Lifetime',
    price: '$149',
    period: 'one-time',
    subtext: 'Pay once, own forever',
    highlighted: false,
  },
] as const;

// ─── Placeholder purchase handler ─────────────────────────────────────────────

function handlePurchase(planId: string) {
  // RevenueCat integration pending
  Alert.alert(
    'Coming Soon',
    `Subscription purchase for "${planId}" will be available when RevenueCat integration is complete.`,
    [{ text: 'OK' }]
  );
}

function handleRestorePurchase() {
  // RevenueCat integration pending
  Alert.alert(
    'Coming Soon',
    'Restore Purchase will be available when RevenueCat integration is complete.',
    [{ text: 'OK' }]
  );
}

// ─── PaywallScreen ─────────────────────────────────────────────────────────────

export const PaywallScreen: React.FC = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 480, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 480, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Animated.View
            style={[
              styles.content,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            {/* ── Wordmark ── */}
            <View style={styles.logoWrap}>
              <Text style={styles.logoText}>ANCHOR</Text>
              <View style={styles.logoDivider} />
            </View>

            {/* ── Headline ── */}
            <Text style={styles.headline}>
              Your free trial{'\n'}has ended.
            </Text>
            <Text style={styles.subheadline}>
              Continue your practice with a full membership.
            </Text>

            {/* ── Feature summary ── */}
            <View style={styles.featureList}>
              {[
                'Unlimited anchors',
                'All 12 refinement styles',
                'Manual forge tools',
                'HD export',
                'Advanced practice modes',
              ].map((feature) => (
                <View key={feature} style={styles.featureRow}>
                  <Text style={styles.featureDot}>·</Text>
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>

            {/* ── Plan cards ── */}
            <View style={styles.plansWrap}>
              {PLANS.map((plan) => (
                <TouchableOpacity
                  key={plan.id}
                  style={[styles.planCard, plan.highlighted && styles.planCardHighlighted]}
                  onPress={() => handlePurchase(plan.id)}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                  accessibilityLabel={`Subscribe ${plan.label} ${plan.price} ${plan.period}`}
                >
                  {plan.highlighted && (
                    <View style={styles.bestValueBadge}>
                      <Text style={styles.bestValueText}>BEST VALUE</Text>
                    </View>
                  )}
                  <View style={styles.planRow}>
                    <View>
                      <Text style={[styles.planLabel, plan.highlighted && styles.planLabelHighlighted]}>
                        {plan.label}
                      </Text>
                      <Text style={styles.planSubtext}>{plan.subtext}</Text>
                    </View>
                    <View style={styles.planPriceWrap}>
                      <Text style={[styles.planPrice, plan.highlighted && styles.planPriceHighlighted]}>
                        {plan.price}
                      </Text>
                      <Text style={styles.planPeriod}>{plan.period}</Text>
                    </View>
                  </View>

                  <View style={[styles.planCta, plan.highlighted && styles.planCtaHighlighted]}>
                    <Text style={[styles.planCtaText, plan.highlighted && styles.planCtaTextHighlighted]}>
                      {plan.highlighted ? 'Get Annual Access' : plan.id === 'lifetime' ? 'Get Lifetime Access' : 'Get Monthly Access'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Restore purchase ── */}
            <TouchableOpacity
              onPress={handleRestorePurchase}
              style={styles.restoreBtn}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={styles.restoreText}>Restore Purchase</Text>
            </TouchableOpacity>

            {/* ── Legal ── */}
            <Text style={styles.legal}>
              Subscriptions auto-renew unless cancelled. Cancel anytime in App Store settings.
            </Text>

            {/* DEFERRED: freemium — "Continue with limited access" link removed.
            // This would allow expired users to use a stripped-down free tier.
            // Restore when RevenueCat integration + free-tier feature set is defined.
            //
            // <TouchableOpacity onPress={handleContinueFree}>
            //   <Text>Continue with limited access</Text>
            // </TouchableOpacity>
            */}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080C10',
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingBottom: 32,
  },
  content: {
    flex: 1,
    alignItems: 'center',
  },
  logoWrap: {
    alignItems: 'center',
    marginTop: 36,
    marginBottom: 28,
  },
  logoText: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 16,
    letterSpacing: 5,
    color: colors.gold,
  },
  logoDivider: {
    marginTop: 10,
    width: 32,
    height: 1,
    backgroundColor: 'rgba(212,175,55,0.3)',
  },
  headline: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 26,
    lineHeight: 34,
    color: colors.bone,
    textAlign: 'center',
    letterSpacing: 0.3,
    marginBottom: 12,
  },
  subheadline: {
    fontFamily: 'CormorantGaramond-Regular',
    fontSize: 16,
    color: 'rgba(192,192,192,0.65)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  featureList: {
    alignSelf: 'stretch',
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  featureDot: {
    color: colors.gold,
    fontSize: 20,
    lineHeight: 20,
  },
  featureText: {
    fontFamily: 'CormorantGaramond-Regular',
    fontSize: 15,
    color: 'rgba(245,245,241,0.75)',
    lineHeight: 22,
  },
  plansWrap: {
    alignSelf: 'stretch',
    gap: 12,
    marginBottom: 20,
  },
  planCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 18,
    overflow: 'hidden',
  },
  planCardHighlighted: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(212,175,55,0.06)',
  },
  bestValueBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomLeftRadius: 8,
  },
  bestValueText: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 8,
    letterSpacing: 1.5,
    color: '#0D0D0D',
  },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  planLabel: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 15,
    color: colors.bone,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  planLabelHighlighted: {
    color: colors.gold,
  },
  planSubtext: {
    fontFamily: 'CormorantGaramond-Regular',
    fontSize: 12,
    color: 'rgba(192,192,192,0.5)',
  },
  planPriceWrap: {
    alignItems: 'flex-end',
  },
  planPrice: {
    fontFamily: 'Cinzel-Bold',
    fontSize: 22,
    color: colors.bone,
    letterSpacing: 0.2,
  },
  planPriceHighlighted: {
    color: colors.gold,
  },
  planPeriod: {
    fontFamily: 'CormorantGaramond-Regular',
    fontSize: 12,
    color: 'rgba(192,192,192,0.5)',
    marginTop: 2,
  },
  planCta: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planCtaHighlighted: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  planCtaText: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 12,
    letterSpacing: 1.5,
    color: colors.gold,
    textTransform: 'uppercase',
  },
  planCtaTextHighlighted: {
    color: '#0D0D0D',
  },
  restoreBtn: {
    paddingVertical: 12,
    marginBottom: 8,
  },
  restoreText: {
    fontFamily: 'CormorantGaramond-Regular',
    fontSize: 14,
    color: 'rgba(192,192,192,0.45)',
    textDecorationLine: 'underline',
  },
  legal: {
    fontFamily: 'CormorantGaramond-Regular',
    fontSize: 11,
    color: 'rgba(192,192,192,0.3)',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 8,
  },
});

export default PaywallScreen;
