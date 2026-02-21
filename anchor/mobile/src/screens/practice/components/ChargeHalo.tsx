/**
 * ChargeHalo — subtle circular progress indicator wrapping the anchor sigil.
 *
 * Replaces ChargeRing on PracticeScreen. Sized to wrap the anchor thumbnail.
 * Includes a gentle breath pulse when charged.
 */
import React, { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
    useSharedValue,
    useAnimatedProps,
    withTiming,
    Easing,
    withRepeat,
    withSequence,
    useAnimatedStyle,
    interpolate,
} from 'react-native-reanimated';
import { colors } from '@/theme';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const IS_ANDROID = Platform.OS === 'android';

interface ChargeHaloProps {
    /** 0–1 float representing completion (today sessions / goal). */
    progress: number;
    /** Whether the anchor is fully charged today. */
    isCharged: boolean;
    /** The size of the halo (should be slightly larger than the thumbnail). */
    size?: number;
    /** The thickness of the progress stroke. */
    strokeWidth?: number;
    /** Whether a rapid pulse is actively happening (during session activation). */
    isActivating?: boolean;
}

export const ChargeHalo: React.FC<ChargeHaloProps> = ({
    progress,
    isCharged,
    size = 64, // Default thumb is 48, so 64 gives a nice gap
    strokeWidth = 2,
    isActivating = false,
}) => {
    const reduceMotion = useReduceMotionEnabled();
    const clampedProgress = Math.max(0, Math.min(1, progress));

    // Provide enough padding to ensure the blur/glow doesn't clip
    const padding = 8;
    const svgSize = size + padding * 2;
    const radius = (size - strokeWidth * 2) / 2;
    const circumference = 2 * Math.PI * radius;
    const cx = svgSize / 2;
    const cy = svgSize / 2;

    // ── Progress Animation ──
    const progressValue = useSharedValue(0);

    useEffect(() => {
        progressValue.value = withTiming(clampedProgress, {
            duration: 1000,
            easing: Easing.out(Easing.cubic),
        });
    }, [clampedProgress, progressValue]);

    const animatedProps = useAnimatedProps(() => ({
        strokeDashoffset: circumference * (1 - progressValue.value),
    }));

    // ── Breath/Glow Animation ──
    const breathValue = useSharedValue(0);

    useEffect(() => {
        if (reduceMotion) {
            breathValue.value = isCharged || isActivating ? 1 : 0;
            return;
        }

        if (isActivating) {
            // Rapid heartbeat pulse during activation
            breathValue.value = withRepeat(
                withSequence(
                    withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
                    withTiming(0.4, { duration: 400, easing: Easing.inOut(Easing.ease) })
                ),
                -1, // infinite
                true // reverse
            );
        } else if (isCharged) {
            // Slow breath when charged
            breathValue.value = withRepeat(
                withSequence(
                    withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
                    withTiming(0.2, { duration: 2500, easing: Easing.inOut(Easing.sin) })
                ),
                -1,
                true
            );
        } else {
            // Dormant
            breathValue.value = withTiming(0, { duration: 1000 });
        }
    }, [isCharged, isActivating, reduceMotion, breathValue]);

    // Apply subtle scaling and opacity variations based on breath
    const containerAnimatedStyle = useAnimatedStyle(() => {
        if (reduceMotion) {
            return {
                opacity: isCharged || isActivating || clampedProgress > 0 ? 1 : 0.6,
            };
        }

        return {
            opacity: clampedProgress === 0 && !isCharged && !isActivating
                ? 0.4
                : interpolate(breathValue.value, [0, 1], [0.85, 1]),
            transform: [
                { scale: interpolate(breathValue.value, [0, 1], [1, 1.02]) },
            ],
        };
    });

    // Halo Glow Animation
    const glowAnimatedProps = useAnimatedProps(() => {
        if (reduceMotion) return { opacity: 0 };
        return {
            opacity: interpolate(breathValue.value, [0, 1], [0.1, 0.4]),
        };
    });

    return (
        <Animated.View
            style={[
                styles.container,
                { width: svgSize, height: svgSize },
                containerAnimatedStyle
            ]}
            pointerEvents="none"
        >
            <Svg width={svgSize} height={svgSize} style={StyleSheet.absoluteFill}>
                <Defs>
                    <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
                        <Stop offset="80%" stopColor={colors.gold} stopOpacity="1" />
                        <Stop offset="100%" stopColor={colors.gold} stopOpacity="0" />
                    </RadialGradient>
                </Defs>

                {/* Outer Glow (active/charged state only, disabled on Android to prevent overdraw if simple stroke works) */}
                {!IS_ANDROID && (isCharged || isActivating) && (
                    <AnimatedCircle
                        cx={cx}
                        cy={cy}
                        r={radius}
                        stroke="url(#glow)"
                        strokeWidth={strokeWidth * 3}
                        fill="none"
                        animatedProps={glowAnimatedProps}
                    />
                )}

                {/* Track (dormant ring) */}
                <Circle
                    cx={cx}
                    cy={cy}
                    r={radius}
                    stroke={`${colors.gold}20`}
                    strokeWidth={strokeWidth}
                    fill="none"
                />

                {/* Progress arc */}
                <AnimatedCircle
                    cx={cx}
                    cy={cy}
                    r={radius}
                    stroke={colors.gold}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeDasharray={circumference}
                    animatedProps={animatedProps}
                    strokeLinecap="round"
                    rotation="-90"
                    origin={`${cx}, ${cy}`}
                />
            </Svg>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10, // Must sit above the thumbnail
    },
});
