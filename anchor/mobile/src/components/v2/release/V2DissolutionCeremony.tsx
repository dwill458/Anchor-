import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CircularAnchorRenderer } from '@/components/v2';
import { getCategoryColor, typography } from '@/theme/v2';
import {
  RELEASE_CEREMONY_CHAMBER_BG,
  RELEASE_CEREMONY_EMBER_COUNT,
  RELEASE_CEREMONY_TIMELINE_MS,
  RELEASE_CEREMONY_TIMELINE_REDUCED_MS,
  RELEASE_COPY,
} from '@/constants/v2/release';

type FullPhase = 'isolate' | 'ignite' | 'burnEarly' | 'burnLate' | 'finalEmber' | 'emptyPause';
type ReducedPhase = 'isolate' | 'fade' | 'emptyPause';

interface Props {
  artworkSvg: string;
  category?: string | null;
  reduceMotion?: boolean;
  /** Fired once the visual timeline (including the empty pause) has finished. */
  onDissolutionComplete: () => void;
  testID?: string;
}

/**
 * The consuming dissolution / burn ceremony inside the controlled dark
 * "Ceremony Chamber". Matched to the locked storyboard: a single lower-edge
 * ignition, an advancing edge, a few embers near the object, a 300ms empty
 * pause, then the contextual return.
 *
 * Reduced Motion keeps the same commitment but replaces combustion with an
 * immediate, respectful fade — no embers, no screen shake, no particle loops.
 */
export function V2DissolutionCeremony({
  artworkSvg,
  category,
  reduceMotion = false,
  onDissolutionComplete,
  testID,
}: Props) {
  const [phase, setPhase] = useState<FullPhase | ReducedPhase>('isolate');
  const artworkOpacity = useRef(new Animated.Value(1)).current;
  const emberDrift = useRef(new Animated.Value(0)).current;
  const completeRef = useRef(onDissolutionComplete);
  completeRef.current = onDissolutionComplete;

  const emberColor = getCategoryColor(category);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.(RELEASE_COPY.committedAnnouncement);
  }, []);

  useEffect(() => {
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

    if (reduceMotion) {
      const t = RELEASE_CEREMONY_TIMELINE_REDUCED_MS;
      at(t.fade, () => {
        setPhase('fade');
        Animated.timing(artworkOpacity, {
          toValue: 0,
          duration: Math.max(0, t.emptyPause - t.fade),
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
      });
      at(t.emptyPause, () => setPhase('emptyPause'));
      at(t.completion, () => completeRef.current());
    } else {
      const t = RELEASE_CEREMONY_TIMELINE_MS;
      at(t.ignite, () => setPhase('ignite'));
      at(t.burnEarly, () => {
        setPhase('burnEarly');
        Animated.timing(artworkOpacity, {
          toValue: 0.35,
          duration: Math.max(0, t.burnLate - t.burnEarly),
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }).start();
        Animated.loop(
          Animated.timing(emberDrift, {
            toValue: 1,
            duration: 900,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          { iterations: 3 },
        ).start();
      });
      at(t.burnLate, () => {
        setPhase('burnLate');
        Animated.timing(artworkOpacity, {
          toValue: 0,
          duration: Math.max(0, t.finalEmber - t.burnLate),
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
      });
      at(t.finalEmber, () => setPhase('finalEmber'));
      at(t.emptyPause, () => setPhase('emptyPause'));
      at(t.completion, () => completeRef.current());
    }

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [reduceMotion, artworkOpacity, emberDrift]);

  const showEmbers =
    !reduceMotion && (phase === 'burnEarly' || phase === 'burnLate' || phase === 'finalEmber');
  const emberCount = phase === 'finalEmber' ? 3 : RELEASE_CEREMONY_EMBER_COUNT;

  const embers = useMemo(
    () =>
      Array.from({ length: RELEASE_CEREMONY_EMBER_COUNT }, (_, i) => ({
        key: `ember-${i}`,
        left: 90 + ((i * 47) % 120),
        delay: (i % 4) * 40,
        size: 2 + (i % 2),
      })),
    [],
  );

  return (
    <View
      style={styles.chamber}
      accessibilityRole="progressbar"
      accessibilityLabel="Releasing this Anchor"
      testID={testID ?? 'v2-dissolution-ceremony'}
    >
      <View style={styles.stage} testID={`v2-dissolution-phase-${phase}`}>
        {phase !== 'emptyPause' && (
          <Animated.View style={{ opacity: artworkOpacity }}>
            <CircularAnchorRenderer
              svg={artworkSvg}
              category={category}
              size="hero"
              state="active"
              accessibilityLabel="Anchor artwork dissolving"
            />
          </Animated.View>
        )}

        {showEmbers &&
          embers.slice(0, emberCount).map((ember) => (
            <Animated.View
              key={ember.key}
              testID={ember.key}
              style={[
                styles.ember,
                {
                  left: ember.left,
                  width: ember.size,
                  height: ember.size,
                  backgroundColor: emberColor,
                  opacity: emberDrift.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.9, 0.5, 0],
                  }),
                  transform: [
                    {
                      translateY: emberDrift.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -80 - ember.delay],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
      </View>

      <Text style={styles.caption} testID="v2-dissolution-caption">
        {RELEASE_COPY.completionBody}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chamber: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: RELEASE_CEREMONY_CHAMBER_BG,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  stage: {
    width: 260,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ember: {
    position: 'absolute',
    bottom: 70,
    borderRadius: 999,
  },
  caption: {
    ...typography.bodySM,
    color: 'rgba(251, 249, 244, 0.55)',
    textAlign: 'center',
  },
});
