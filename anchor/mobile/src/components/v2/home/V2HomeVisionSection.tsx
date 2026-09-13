import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { RealVisionComposition } from '@/components/v2/vision';
import { colors, typography } from '@/theme/v2';
import type { HomeVisionState } from '@/adapters/v2/home';

type Props = {
  vision: HomeVisionState;
  category?: string | null;
  onOpenVision?: () => void;
};

function ScenePreview({
  imageUrl,
  prompt,
}: {
  imageUrl: string | null;
  prompt: string | null;
}) {
  if (!imageUrl && !prompt?.trim()) return null;
  return (
    <View style={styles.sceneCard}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.sceneImage} resizeMode="cover" />
      ) : (
        <Text numberOfLines={4} style={styles.scenePrompt}>{prompt}</Text>
      )}
    </View>
  );
}

/** A real Vision preview only. Missing Vision is intentionally omitted from Home. */
export function V2HomeVisionSection({ vision, category, onOpenVision }: Props) {
  if (vision.state === 'none') return null;

  if (vision.state === 'loading') {
    return (
      <View testID="v2-home-vision-loading" style={styles.statusContainer}>
        <Text style={styles.statusLabel}>VISION</Text>
        <ActivityIndicator color="#7C5CFA" accessibilityLabel="Loading Vision" />
      </View>
    );
  }

  if (vision.state === 'error') {
    return (
      <View testID="v2-home-vision-error" style={styles.statusContainer}>
        <Text style={styles.statusLabel}>VISION UNAVAILABLE</Text>
        <Text numberOfLines={2} style={styles.statusMessage}>{vision.message}</Text>
      </View>
    );
  }

  const title = vision.title?.trim() || '';
  const description = vision.previewText.trim();
  const secondaryScenes = (vision.tiles ?? []).slice(1, 3);

  return (
    <View testID="v2-home-vision" style={styles.container}>
      <View style={[styles.mosaic, secondaryScenes.length === 0 && styles.singleColumn]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View Vision"
          onPress={onOpenVision}
          style={({ pressed }) => [styles.storyCard, pressed && styles.pressed]}
        >
          {vision.tiles && vision.tiles.length > 0 ? (
            <RealVisionComposition
              tiles={vision.tiles}
              featuredTileId={vision.featuredTileId}
              category={category}
              height={115}
              gap={4}
              radius={10}
              radiusSmall={8}
            />
          ) : null}
          <View style={styles.storyCopy}>
            <Text style={styles.kicker}>VISION</Text>
            {title ? <Text numberOfLines={2} style={styles.headline}>{title}</Text> : null}
            {description ? <Text numberOfLines={3} style={styles.body}>{description}</Text> : null}
            <View style={styles.pillButton}>
              <Text style={styles.pillText}>View Vision</Text>
              <Text style={styles.pillChevron}>›</Text>
            </View>
          </View>
        </Pressable>

        {secondaryScenes.length > 0 ? (
          <View style={styles.rightColumn}>
            {secondaryScenes.map((scene) => (
              <Pressable
                key={scene.id}
                accessibilityRole="button"
                accessibilityLabel={scene.prompt || 'View Vision scene'}
                onPress={onOpenVision}
                style={({ pressed }) => [styles.detailCard, pressed && styles.pressed]}
              >
                <ScenePreview imageUrl={scene.imageUrl} prompt={scene.prompt} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginHorizontal: 22, marginTop: 26 },
  statusContainer: {
    marginHorizontal: 22,
    marginTop: 26,
    minHeight: 54,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#DAD6CD',
    backgroundColor: '#FBF9F4',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusLabel: { ...typography.utilitySemibold, fontSize: 10, letterSpacing: 1.2, color: '#63748C' },
  statusMessage: { ...typography.utility, flex: 1, fontSize: 12, color: '#62738B' },
  mosaic: { flexDirection: 'row', gap: 8 },
  singleColumn: { flexDirection: 'column' },
  storyCard: {
    flex: 1.46,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#DAD6CD',
    backgroundColor: '#FBF9F4',
    overflow: 'hidden',
  },
  storyCopy: { paddingHorizontal: 11, paddingTop: 8, paddingBottom: 13 },
  kicker: {
    fontFamily: typography.utilitySemibold.fontFamily,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.3,
    color: '#63748C',
  },
  headline: {
    fontFamily: typography.displayBold,
    fontSize: 21,
    lineHeight: 24,
    letterSpacing: -0.5,
    color: colors.text.primary,
    marginTop: 6,
    marginBottom: 4,
  },
  body: { fontFamily: typography.utility.fontFamily, fontSize: 13, lineHeight: 18, color: '#62738B' },
  pillButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EBE6FF',
    borderRadius: 22,
    paddingVertical: 6,
    paddingHorizontal: 11,
    marginTop: 10,
  },
  pillText: { fontFamily: typography.utilitySemibold.fontFamily, fontSize: 12, fontWeight: '600', color: '#253CC7' },
  pillChevron: { fontSize: 16, lineHeight: 14, color: '#253CC7', fontWeight: '600' },
  rightColumn: { flex: 1, gap: 8 },
  detailCard: {
    flex: 1,
    minHeight: 84,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#DAD6CD',
    backgroundColor: 'rgba(251, 249, 244, 0.45)',
    overflow: 'hidden',
  },
  sceneCard: { flex: 1, minHeight: 84, alignItems: 'center', justifyContent: 'center' },
  sceneImage: { width: '100%', height: '100%' },
  scenePrompt: { padding: 10, fontFamily: typography.utility.fontFamily, fontSize: 11, lineHeight: 15, color: '#62738B', textAlign: 'center' },
  pressed: { opacity: 0.78 },
});
