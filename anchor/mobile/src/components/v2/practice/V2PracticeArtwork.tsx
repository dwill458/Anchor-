import React from 'react';
import { Image, StyleSheet, View, type DimensionValue, type ImageSourcePropType, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
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
  /** Optional crop tuning for compact consumers of the shared artwork. */
  imageStyle?: StyleProp<ImageStyle>;
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
  if (clean === 'deepprime' || clean === 'deepfocus') return 'deep_prime';
  if (clean === 'visualize') return 'visualize';
  if (clean === 'release') return 'release';
  return 'focus';
}

/** One illustration per practice, shared by the hero and library cards. */
export const V2_PRACTICE_ARTWORK: Record<V2PracticeMode, ImageSourcePropType> = {
  focus: require('@/assets/practice/practice-focus.jpg'),
  deep_prime: require('@/assets/practice/practice-deepfocus.jpg'),
  visualize: require('@/assets/practice/practice-visualize.jpg'),
  release: require('@/assets/practice/practice-release.jpg'),
};

export const PRACTICE_ARTWORK = V2_PRACTICE_ARTWORK;

export function resolvePracticeArtwork(mode?: string | null): ImageSourcePropType {
  const key = normalizePracticeMode(mode);
  return V2_PRACTICE_ARTWORK[key] ?? V2_PRACTICE_ARTWORK.focus;
}

export const HERO_MEDIA_BY_PRACTICE: Record<string, PracticeHeroMediaItem> = {
  focus: {
    image: V2_PRACTICE_ARTWORK.focus,
    video: null,
  },
  deep_prime: {
    image: V2_PRACTICE_ARTWORK.deep_prime,
    video: null,
  },
  visualize: {
    image: V2_PRACTICE_ARTWORK.visualize,
    video: null,
  },
  release: {
    image: V2_PRACTICE_ARTWORK.release,
    video: null,
  },
};

// Aliases for robustness
HERO_MEDIA_BY_PRACTICE['deepprime'] = HERO_MEDIA_BY_PRACTICE.deep_prime;
HERO_MEDIA_BY_PRACTICE['deep-prime'] = HERO_MEDIA_BY_PRACTICE.deep_prime;
HERO_MEDIA_BY_PRACTICE['deepfocus'] = HERO_MEDIA_BY_PRACTICE.deep_prime;
HERO_MEDIA_BY_PRACTICE['deep-focus'] = HERO_MEDIA_BY_PRACTICE.deep_prime;

// Backward-compatible image-only map export
export const HERO_ART_BY_PRACTICE: Record<string, ImageSourcePropType> = {
  focus: HERO_MEDIA_BY_PRACTICE.focus.image,
  deep_prime: HERO_MEDIA_BY_PRACTICE.deep_prime.image,
  visualize: HERO_MEDIA_BY_PRACTICE.visualize.image,
  release: HERO_MEDIA_BY_PRACTICE.release.image,
};
HERO_ART_BY_PRACTICE['deepprime'] = HERO_ART_BY_PRACTICE.deep_prime;
HERO_ART_BY_PRACTICE['deep-prime'] = HERO_ART_BY_PRACTICE.deep_prime;
HERO_ART_BY_PRACTICE['deepfocus'] = HERO_ART_BY_PRACTICE.deep_prime;
HERO_ART_BY_PRACTICE['deep-focus'] = HERO_ART_BY_PRACTICE.deep_prime;

export const GRID_ART_BY_PRACTICE: Record<string, ImageSourcePropType> = {
  focus: V2_PRACTICE_ARTWORK.focus,
  deep_prime: V2_PRACTICE_ARTWORK.deep_prime,
  visualize: V2_PRACTICE_ARTWORK.visualize,
  release: V2_PRACTICE_ARTWORK.release,
};
GRID_ART_BY_PRACTICE['deepprime'] = GRID_ART_BY_PRACTICE.deep_prime;
GRID_ART_BY_PRACTICE['deep-prime'] = GRID_ART_BY_PRACTICE.deep_prime;
GRID_ART_BY_PRACTICE['deepfocus'] = GRID_ART_BY_PRACTICE.deep_prime;
GRID_ART_BY_PRACTICE['deep-focus'] = GRID_ART_BY_PRACTICE.deep_prime;

export function FocusArtwork(props: ArtworkProps) {
  return <V2PracticeArtwork mode="focus" {...props} />;
}

export function DeepPrimeArtwork(props: ArtworkProps) {
  return <V2PracticeArtwork mode="deep_prime" {...props} />;
}

export function DeepFocusArtwork(props: ArtworkProps) {
  return <V2PracticeArtwork mode="deep_prime" {...props} />;
}

export function VisualizeArtwork(props: ArtworkProps) {
  return <V2PracticeArtwork mode="visualize" {...props} />;
}

export function ReleaseArtwork(props: ArtworkProps) {
  return <V2PracticeArtwork mode="release" {...props} />;
}

/** The still is the artwork in every state; Practice no longer mounts a video player. */
export function V2PracticeArtwork({
  mode,
  width = '100%',
  height = 115,
  variant = 'card',
  style,
  imageStyle,
  testID,
}: Props) {
  const key = normalizePracticeMode(mode);
  const source = V2_PRACTICE_ARTWORK[key];

  return (
    <View
      testID={testID ?? `v2-practice-artwork-${key}-${variant}`}
      style={[styles.container, { width, height }, style]}
    >
      <Image source={source} style={[styles.image, imageStyle]} resizeMode="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', width: '100%', position: 'relative' },
  image: { width: '100%', height: '100%' },
});
