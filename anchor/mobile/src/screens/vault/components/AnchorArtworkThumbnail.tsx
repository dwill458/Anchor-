import React from 'react';
import { Image, type ImageStyle, type StyleProp, type ViewStyle, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

interface AnchorArtworkThumbnailProps {
  imageUrl?: string;
  sigilXml?: string;
  imageStyle: StyleProp<ImageStyle>;
  fallbackStyle: StyleProp<ViewStyle>;
  fallbackSize: number;
  testID?: string;
}

/**
 * Renders an enhanced anchor image when it is reachable, otherwise its
 * persisted sigil SVG. The failed URL is remembered until the URL changes so
 * recycled FlatList cells do not keep retrying a known-bad legacy URL.
 */
export const AnchorArtworkThumbnail = React.memo<AnchorArtworkThumbnailProps>(({
  imageUrl,
  sigilXml,
  imageStyle,
  fallbackStyle,
  fallbackSize,
  testID,
}) => {
  const [failedImageUrl, setFailedImageUrl] = React.useState<string | null>(null);
  const showImage = Boolean(imageUrl) && failedImageUrl !== imageUrl;

  if (showImage) {
    return (
      <Image
        testID={testID ? `${testID}-image` : undefined}
        source={{ uri: imageUrl }}
        style={imageStyle}
        resizeMode="cover"
        onError={() => setFailedImageUrl(imageUrl ?? null)}
      />
    );
  }

  return (
    <View testID={testID ? `${testID}-fallback` : undefined} style={fallbackStyle}>
      <SvgXml xml={sigilXml ?? ''} width={fallbackSize} height={fallbackSize} />
    </View>
  );
});
