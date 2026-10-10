import type { ImageSourcePropType } from 'react-native';

/** Shared visual assets for the Vision Notes preset surfaces. */
export const noteAssets = {
  tornPaper: require('./torn-paper.png') as ImageSourcePropType,
  handmadePaper: require('./handmade-paper.png') as ImageSourcePropType,
  botanicalShadow: require('./botanical-shadow.png') as ImageSourcePropType,
  coastalIllustration: require('./coastal-illustration.png') as ImageSourcePropType,
  atmosphericLandscape: require('./atmospheric-landscape.png') as ImageSourcePropType,
} as const;

export type NoteAssetKey = keyof typeof noteAssets;
