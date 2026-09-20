import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  type DimensionValue,
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
let VideoView: any = null;
let useVideoPlayer: any = () => null;
let isExpoVideoNativeAvailable = false;

try {
  const expoModulesCore = require('expo-modules-core');
  if (typeof expoModulesCore.requireNativeModule === 'function') {
    expoModulesCore.requireNativeModule('ExpoVideo');
  }
  const expoVideo = require('expo-video');
  VideoView = expoVideo.VideoView;
  useVideoPlayer = expoVideo.useVideoPlayer;
  isExpoVideoNativeAvailable = Boolean(VideoView && useVideoPlayer);
} catch (_e) {
  // Safe fallback when native ExpoVideo module is not present in dev build
  isExpoVideoNativeAvailable = false;
}
import type { V2PracticeMode } from '@/constants/v2/practice';

export type PracticeHeroMediaItem = {
  image: ImageSourcePropType;
  video: any | null;
};

type ArtworkProps = {
  width?: DimensionValue;
  height?: number;
  variant?: 'card' | 'featured';
  style?: StyleProp<ViewStyle>;
  active?: boolean;
  reduceMotion?: boolean;
  completed?: boolean;
};

type Props = ArtworkProps & {
  mode: V2PracticeMode | string;
  testID?: string;
};

export function normalizePracticeMode(mode?: string | null): 'focus' | 'deep_prime' | 'visualize' | 'release' {
  if (!mode) return 'focus';
  const clean = mode.replace(/[\s_-]/g, '').toLowerCase();
  if (clean === 'deepprime') return 'deep_prime';
  if (clean === 'visualize') return 'visualize';
  if (clean === 'release') return 'release';
  return 'focus';
}

export const HERO_MEDIA_BY_PRACTICE: Record<string, PracticeHeroMediaItem> = {
  focus: {
    image: require('@/assets/practice/today/focus.png'),
    video: require('@/assets/practice/today/focus-loop.mp4'),
  },
  deep_prime: {
    image: require('@/assets/practice/today/deep-prime.png'),
    video: null,
  },
  visualize: {
    image: require('@/assets/practice/today/visualize.png'),
    video: null,
  },
  release: {
    image: require('@/assets/practice/today/release.png'),
    video: null,
  },
};

// Aliases for robustness
HERO_MEDIA_BY_PRACTICE['deepprime'] = HERO_MEDIA_BY_PRACTICE.deep_prime;
HERO_MEDIA_BY_PRACTICE['deep-prime'] = HERO_MEDIA_BY_PRACTICE.deep_prime;

// Backward-compatible image-only map export
export const HERO_ART_BY_PRACTICE: Record<string, ImageSourcePropType> = {
  focus: HERO_MEDIA_BY_PRACTICE.focus.image,
  deep_prime: HERO_MEDIA_BY_PRACTICE.deep_prime.image,
  visualize: HERO_MEDIA_BY_PRACTICE.visualize.image,
  release: HERO_MEDIA_BY_PRACTICE.release.image,
};
HERO_ART_BY_PRACTICE['deepprime'] = HERO_ART_BY_PRACTICE.deep_prime;
HERO_ART_BY_PRACTICE['deep-prime'] = HERO_ART_BY_PRACTICE.deep_prime;

export const GRID_ART_BY_PRACTICE: Record<string, ImageSourcePropType> = {
  focus: require('@/assets/practice/grid/focus.png'),
  deep_prime: require('@/assets/practice/grid/deep-prime.png'),
  visualize: require('@/assets/practice/grid/visualize.png'),
  release: require('@/assets/practice/grid/release.png'),
};
GRID_ART_BY_PRACTICE['deepprime'] = GRID_ART_BY_PRACTICE.deep_prime;
GRID_ART_BY_PRACTICE['deep-prime'] = GRID_ART_BY_PRACTICE.deep_prime;

export function FocusArtwork(props: ArtworkProps) {
  return <V2PracticeArtwork mode="focus" {...props} />;
}

export function DeepPrimeArtwork(props: ArtworkProps) {
  return <V2PracticeArtwork mode="deep_prime" {...props} />;
}

export function VisualizeArtwork(props: ArtworkProps) {
  return <V2PracticeArtwork mode="visualize" {...props} />;
}

export function ReleaseArtwork(props: ArtworkProps) {
  return <V2PracticeArtwork mode="release" {...props} />;
}

class HeroVideoErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    if (__DEV__) {
      console.warn(
        '[V2PracticeArtwork] HeroVideoPlayer native error captured, falling back to static image:',
        error?.message
      );
    }
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

function HeroVideoPlayer({
  videoSource,
  shouldPlay,
  testID,
}: {
  videoSource: any;
  shouldPlay: boolean;
  testID?: string;
}) {
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const opacityAnim = useRef(new Animated.Value(0)).current;

  let player: any = null;
  try {
    player = useVideoPlayer(videoSource, (p: any) => {
      p.loop = true;
      p.muted = true;
    });
  } catch (_e) {
    // If player creation fails, gracefully fall back to static image
  }

  useEffect(() => {
    if (!player) return;

    if (shouldPlay && !hasError) {
      try {
        player.play();
      } catch (_e) {
        setHasError(true);
      }
    } else {
      try {
        player.pause();
      } catch (_e) {
        // ignore
      }
    }
  }, [player, shouldPlay, hasError]);

  useEffect(() => {
    if (!player || typeof player.addListener !== 'function') return;

    const sub = player.addListener('statusChange', ({ status, error }: { status: string; error?: any }) => {
      if (error) {
        setHasError(true);
        return;
      }
      if (status === 'readyToPlay' && !isReady) {
        setIsReady(true);
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    });

    return () => {
      sub?.remove?.();
    };
  }, [player, isReady, opacityAnim]);

  if (hasError || !player || !isExpoVideoNativeAvailable) {
    return null;
  }

  return (
    <Animated.View
      testID={testID ?? 'v2-hero-video-container'}
      style={[StyleSheet.absoluteFill, { opacity: opacityAnim }]}
    >
      <VideoView
        player={player}
        style={styles.image}
        nativeControls={false}
        contentFit="cover"
        allowsFullscreen={false}
      />
    </Animated.View>
  );
}

export function V2PracticeArtwork({
  mode,
  width = '100%',
  height = 115,
  variant = 'card',
  active = true,
  reduceMotion,
  completed = false,
  style,
  testID,
}: Props) {
  const key = normalizePracticeMode(mode);

  const [isReducedMotionState, setIsReducedMotionState] = useState(false);
  const [appActive, setAppActive] = useState(true);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setIsReducedMotionState(enabled);
    }).catch(() => undefined);

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setIsReducedMotionState(enabled);
    });

    return () => {
      mounted = false;
      sub?.remove();
    };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      setAppActive(nextState === 'active');
    });
    return () => {
      sub.remove();
    };
  }, []);

  const isReducedMotion = reduceMotion ?? isReducedMotionState;

  if (variant === 'featured') {
    const mediaItem = HERO_MEDIA_BY_PRACTICE[key] ?? HERO_MEDIA_BY_PRACTICE.focus;
    const canPlayVideo = Boolean(mediaItem.video) && !isReducedMotion && !completed;
    const shouldPlay = canPlayVideo && active && appActive;

    return (
      <View
        testID={testID ?? `v2-practice-artwork-${key}-${variant}`}
        style={[styles.container, { width, height }, style]}
      >
        <Image
          source={mediaItem.image}
          style={styles.image}
          resizeMode="cover"
        />
        {canPlayVideo ? (
          <HeroVideoErrorBoundary>
            <HeroVideoPlayer
              videoSource={mediaItem.video}
              shouldPlay={shouldPlay}
              testID={`v2-hero-video-${key}`}
            />
          </HeroVideoErrorBoundary>
        ) : null}
      </View>
    );
  }

  // Grid card variant
  const source = GRID_ART_BY_PRACTICE[key] ?? GRID_ART_BY_PRACTICE.focus;

  return (
    <View
      testID={testID ?? `v2-practice-artwork-${key}-${variant}`}
      style={[styles.container, { width, height }, style]}
    >
      <Image
        source={source}
        style={styles.image}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    width: '100%',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
