import type { ImageSourcePropType } from 'react-native';

/** Static Metro requires; only the selected surface is decoded at full resolution. */
export const visionMaterials = {
  'sticky-blush-pink': { source: require('./sticky-blush-pink.webp') as ImageSourcePropType, width: 600, height: 600, thumbnail: require('./thumbnails/sticky-blush-pink.webp') as ImageSourcePropType },
  'sticky-butter-yellow': { source: require('./sticky-butter-yellow.webp') as ImageSourcePropType, width: 600, height: 600, thumbnail: require('./thumbnails/sticky-butter-yellow.webp') as ImageSourcePropType },
  'sticky-sky-blue': { source: require('./sticky-sky-blue.webp') as ImageSourcePropType, width: 600, height: 600, thumbnail: require('./thumbnails/sticky-sky-blue.webp') as ImageSourcePropType },
  'sticky-sage-green': { source: require('./sticky-sage-green.webp') as ImageSourcePropType, width: 600, height: 600, thumbnail: require('./thumbnails/sticky-sage-green.webp') as ImageSourcePropType },
  'sticky-lavender': { source: require('./sticky-lavender.webp') as ImageSourcePropType, width: 600, height: 600, thumbnail: require('./thumbnails/sticky-lavender.webp') as ImageSourcePropType },
  'sticky-peach': { source: require('./sticky-peach.webp') as ImageSourcePropType, width: 600, height: 600, thumbnail: require('./thumbnails/sticky-peach.webp') as ImageSourcePropType },
  'sticky-warm-ivory': { source: require('./sticky-warm-ivory.webp') as ImageSourcePropType, width: 600, height: 600, thumbnail: require('./thumbnails/sticky-warm-ivory.webp') as ImageSourcePropType },
  'sticky-rose-lined': { source: require('./sticky-rose-lined.webp') as ImageSourcePropType, width: 600, height: 600, thumbnail: require('./thumbnails/sticky-rose-lined.webp') as ImageSourcePropType },
  'paper-ivory-rough': { source: require('./paper-ivory-rough.webp') as ImageSourcePropType, width: 600, height: 600, thumbnail: require('./thumbnails/paper-ivory-rough.webp') as ImageSourcePropType },
  'paper-cream-fiber': { source: require('./paper-cream-fiber.webp') as ImageSourcePropType, width: 600, height: 600, thumbnail: require('./thumbnails/paper-cream-fiber.webp') as ImageSourcePropType },
  'paper-warm-beige': { source: require('./paper-warm-beige.webp') as ImageSourcePropType, width: 600, height: 600, thumbnail: require('./thumbnails/paper-warm-beige.webp') as ImageSourcePropType },
  'paper-torn-edge': { source: require('./paper-torn-edge.webp') as ImageSourcePropType, width: 600, height: 600, thumbnail: require('./thumbnails/paper-torn-edge.webp') as ImageSourcePropType },
  'editorial-classic-ivory': { source: require('./editorial-classic-ivory.webp') as ImageSourcePropType, width: 600, height: 600, thumbnail: require('./thumbnails/editorial-classic-ivory.webp') as ImageSourcePropType },
  'editorial-warm-cream': { source: require('./editorial-warm-cream.webp') as ImageSourcePropType, width: 600, height: 600, thumbnail: require('./thumbnails/editorial-warm-cream.webp') as ImageSourcePropType },
  'editorial-oyster': { source: require('./editorial-oyster.webp') as ImageSourcePropType, width: 600, height: 600, thumbnail: require('./thumbnails/editorial-oyster.webp') as ImageSourcePropType },
  'editorial-soft-parchment': { source: require('./editorial-soft-parchment.webp') as ImageSourcePropType, width: 600, height: 600, thumbnail: require('./thumbnails/editorial-soft-parchment.webp') as ImageSourcePropType },
  'tape-cream': { source: require('./tape-cream.webp') as ImageSourcePropType, width: 512, height: 160 },
  'tape-muted-pink': { source: require('./tape-muted-pink.webp') as ImageSourcePropType, width: 512, height: 160 },
  'tape-beige': { source: require('./tape-beige.webp') as ImageSourcePropType, width: 512, height: 160 },
  'tape-translucent-clear': { source: require('./tape-translucent-clear.webp') as ImageSourcePropType, width: 512, height: 160 },
  'tape-textured-ivory': { source: require('./tape-textured-ivory.webp') as ImageSourcePropType, width: 512, height: 160 },
  'tape-torn-cream': { source: require('./tape-torn-cream.webp') as ImageSourcePropType, width: 512, height: 160 },
  'polaroid-classic': { source: require('./polaroid-classic.webp') as ImageSourcePropType, width: 600, height: 720 },
  'polaroid-torn-bottom': { source: require('./polaroid-torn-bottom.webp') as ImageSourcePropType, width: 600, height: 720 },
  'polaroid-rough-edge': { source: require('./polaroid-rough-edge.webp') as ImageSourcePropType, width: 600, height: 720 },
  'polaroid-wide-bottom': { source: require('./polaroid-wide-bottom.webp') as ImageSourcePropType, width: 600, height: 720 },
} as const;

export type VisionMaterialId = keyof typeof visionMaterials;
export type VisionPolaroidVariant = 'classic' | 'torn-bottom' | 'rough-edge' | 'wide-bottom';
export type VisionTapeVariant = 'cream' | 'muted-pink' | 'beige' | 'translucent-clear' | 'textured-ivory' | 'torn-cream';
