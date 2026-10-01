import { memo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { colors, typography } from '@/theme/v2';
import { VisionImageEdge } from './VisionImageEdge';

type Props = {
  tiles: readonly { id: string; imageUrl?: string | null }[];
  statement?: string; variant?: 'home' | 'details'; accent?: string; onPress?: () => void;
  accessibilityLabel?: string; testID?: string; imageTestID?: string; statementTestID?: string;
};
/** Shared lightweight photographic preview. Compatibility export keeps entry points stable. */
export const VisionBoardPreview = memo(function VisionBoardPreview({ tiles, statement, variant = 'home', onPress,
  accessibilityLabel = 'Open Vision', testID = 'vision-board-preview', imageTestID, statementTestID, accent }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const [width, setWidth] = useState(Math.max(1, windowWidth - 48));
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const hero = tiles[0]?.imageUrl?.trim();
  const height = width * (variant === 'home' ? 0.35 : 0.48);
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel}
    onPress={onPress} disabled={!onPress} onLayout={event => setWidth(Math.max(1, event.nativeEvent.layout.width))}
    style={({ pressed }) => [styles.preview, { height: height + (statement ? 44 : 0), backgroundColor: variant === 'home' ? colors.ink.base : colors.canvas }, pressed && styles.pressed]}>
    <View style={{ height, overflow: 'hidden' }}>
    {hero && hero !== failedUrl ? <Image testID={imageTestID ?? `${testID}-image-0`} source={{ uri: hero }}
      onError={() => setFailedUrl(hero)} resizeMode="cover" accessibilityIgnoresInvertColors style={StyleSheet.absoluteFill} /> :
      <View style={styles.unavailable}><Text style={styles.message}>{hero ? 'Image unavailable' : 'Your Vision has no images yet'}</Text></View>}
    <VisionImageEdge color={variant === 'home' ? colors.ink.base : colors.canvas} />
    </View>
    {statement ? <View pointerEvents="none" style={styles.caption}>
      {accent ? <View style={[styles.categoryDot, { backgroundColor: accent }]} /> : null}
      <Text testID={statementTestID} numberOfLines={2} style={[styles.statement, { color: variant === 'home' ? colors.paper : colors.text.primary }]}>{statement}</Text>
    </View> : null}
  </Pressable>;
});
const styles = StyleSheet.create({
  preview: { overflow: 'hidden', backgroundColor: colors.ink.base },
  unavailable: { flex: 1, justifyContent: 'center', padding: 16 },
  message: { ...typography.caption, color: colors.ink.text.secondary },
  caption: { height: 44, paddingHorizontal: 2, flexDirection: 'row', alignItems: 'center', gap: 7 },
  categoryDot: { width: 5, height: 5, borderRadius: 3 },
  statement: { ...typography.bodySM, color: colors.paper, flex: 1 },
  pressed: { opacity: 0.88 },
});
