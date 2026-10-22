import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { render } from '@testing-library/react-native';
import { VisionMaterialSurface } from '../VisionMaterialSurface';
import { visionMaterials, type VisionMaterialId } from '@/assets/vision/materials/manifest';

describe('photographed material bounds', () => {
  it.each(Object.keys(visionMaterials) as VisionMaterialId[])('%s overrides native intrinsic dimensions in every usage', material => {
    const asset = visionMaterials[material];
    const view = render(<View style={{ width: 84, height: 64 }}>
      <VisionMaterialSurface material={material} tint={{ color: '#F4E8CC', opacity: .2 }} />
    </View>);
    for (const image of view.UNSAFE_getAllByType(Image)) {
      // Native Image prepends bundled source dimensions before applying the supplied style.
      const nativeStyle = StyleSheet.flatten([{ width: asset.width, height: asset.height }, image.props.style]);
      expect(nativeStyle.width).toBe('100%');
      expect(nativeStyle.height).toBe('100%');
    }
  });
});
