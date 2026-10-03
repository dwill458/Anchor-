import type { ImageSourcePropType } from 'react-native';

export const STYLE_ASSETS: Record<string, ImageSourcePropType> = {
  'velvet-ember': require('./style-velvet-ember.jpg'),
  'velvet_ember': require('./style-velvet-ember.jpg'),
  'velvet_ember_v2': require('./style-velvet-ember.jpg'),

  'porcelain': require('./style-porcelain.jpg'),
  'porcelain_v2': require('./style-porcelain.jpg'),

  'prism-flow': require('./style-prism-flow.jpg'),
  'prism_flow': require('./style-prism-flow.jpg'),
  'prism_flow_v2': require('./style-prism-flow.jpg'),

  'joybrush': require('./style-joybrush.jpg'),
  'joybrush_v2': require('./style-joybrush.jpg'),

  'deep-cosmos': require('./style-deep-cosmos.jpg'),
  'deep_cosmos': require('./style-deep-cosmos.jpg'),
  'deep_cosmos_v2': require('./style-deep-cosmos.jpg'),

  'woven': require('./style-woven.jpg'),
  'woven_v2': require('./style-woven.jpg'),

  'paper': require('./style-paper.jpg'),
  'paper_v2': require('./style-paper.jpg'),

  'mineral-wash': require('./style-mineral-wash.jpg'),
  'mineral_wash': require('./style-mineral-wash.jpg'),
  'clay_v2': require('./style-mineral-wash.jpg'),
  'mineral_wash_v2': require('./style-mineral-wash.jpg'),

  'graphic': require('./style-graphic.jpg'),
  'graphic_v2': require('./style-graphic.jpg'),

  'plush': require('./style-plush.jpg'),
  'plush_v2': require('./style-plush.jpg'),

  'herbarium': require('./style-herbarium.jpg'),
  'herbarium_v2': require('./style-herbarium.jpg'),

  'alloy': require('./style-alloy.jpg'),
  'alloy_v2': require('./style-alloy.jpg'),

  'gilt': require('./style-gilt.jpg'),
  'gilt_v2': require('./style-gilt.jpg'),

  'flash': require('./style-flash.jpg'),
  'flash_v2': require('./style-flash.jpg'),

  'buff': require('./style-buff.jpg'),
  'buff_v2': require('./style-buff.jpg'),
};

export const getStyleAsset = (idOrKey: string | undefined): ImageSourcePropType | undefined => {
  if (!idOrKey) return undefined;
  return STYLE_ASSETS[idOrKey];
};
