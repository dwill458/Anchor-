import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ArrowRight, Compass, Edit3, Eye } from 'lucide-react-native';
import {
  GhostVisionComposition,
  RealVisionComposition,
  V2VisionCreationFlow,
} from '@/components/v2/vision';
import { V2Button, V2EmptyState, V2Screen, V2TopBar } from '@/components/v2';
import { useV2Vision } from '@/hooks/v2/vision';
import { useAnchorStore } from '@/stores/anchorStore';
import { colors, getCategoryColor, radii, spacing, typography } from '@/theme/v2';
import type { V2VisualizeHandoff } from '@/adapters/v2/vision';

export interface V2VisionRouteParams {
  anchorId: string;
  initialMode?: 'view' | 'create' | 'ready';
}

export interface V2VisionScreenProps {
  anchorId?: string;
  initialMode?: 'view' | 'create' | 'ready';
  onBack?: () => void;
  onVisualize?: (handoff: V2VisualizeHandoff) => void;
  onChart?: (anchorId: string) => void;
  testID?: string;
}

export function V2VisionScreen(props: V2VisionScreenProps) {
  const route = useRoute<RouteProp<Record<string, V2VisionRouteParams>, string>>();
  const navigation = useNavigation();

  const anchorId = props.anchorId ?? route.params?.anchorId ?? '';
  const initialMode = props.initialMode ?? route.params?.initialMode ?? 'view';

  const anchor = useAnchorStore((s) => s.anchors.find((a) => a.id === anchorId || a.localId === anchorId));
  const categoryColor = getCategoryColor(anchor?.category);

  const {
    state,
    vision,
    tiles,
    description,
    seenToday,
    loading,
    error,
    visualizeHandoff,
    recordVisionView,
    createVision,
    uploadVisionAsset,
  } = useV2Vision(anchorId);

  const [mode, setMode] = useState<'view' | 'create' | 'ready'>(initialMode);

  const handleBack = () => {
    if (mode === 'create') {
      if (state.state === 'ready') {
        setMode('view');
        return;
      }
    }
    if (props.onBack) {
      props.onBack();
    } else if (navigation?.canGoBack && navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  // Crucial seen-today semantics: Mark seen on server ONLY when user genuinely views the Vision surface
  useEffect(() => {
    if (state.state === 'ready' && !seenToday && mode === 'view') {
      recordVisionView();
    }
  }, [state.state, seenToday, mode, recordVisionView]);

  if (loading && !vision) {
    return (
      <V2Screen testID="v2-vision-screen-loading">
        <V2TopBar title="Vision" onBackPress={handleBack} />
        <View style={styles.centerContainer}>
          <ActivityIndicator color={categoryColor} size="large" />
        </View>
      </V2Screen>
    );
  }

  // Creation or Empty flow
  if (mode === 'create' || mode === 'ready' || state.state === 'none') {
    return (
      <V2VisionCreationFlow
        anchorId={anchorId}
        anchorIntention={(anchor as any)?.intention ?? anchor?.intentionText ?? 'Your Anchor'}
        anchorCategory={anchor?.category}
        initialStep={mode === 'ready' ? 'ready' : state.state === 'none' ? 'empty' : 'prompt'}
        onBack={handleBack}
        onAssemble={async ({ description: desc, source, selectedAssets }) => {
          const uploaded = await Promise.all(
            selectedAssets.map(async asset => ({
              asset,
              uploaded: await uploadVisionAsset(asset.uri, asset.mimeType),
            })),
          );
          // Do not claim success or send a partial Vision if any private asset
          // registration failed. Retrying repeats only the failed request.
          if (uploaded.some(item => !item.uploaded)) return;
          const created = await createVision({
            description: desc,
            scenes: uploaded.map(({ asset, uploaded: registered }) => ({
              assetId: registered!.id,
              prompt: asset.prompt,
              sourceType: source,
            })),
          });
          if (created) setMode('view');
        }}
      />
    );
  }

  if (state.state === 'error' && !vision) {
    return (
      <V2Screen testID="v2-vision-screen-error">
        <V2TopBar title="Vision" onBackPress={handleBack} />
        <V2EmptyState
          title="Unable to load Vision"
          message={error ?? 'Please check your connection and try again.'}
        />
      </V2Screen>
    );
  }

  // Active Vision surface (SEE)
  return (
    <V2Screen testID={props.testID ?? 'v2-vision-screen'}>
      <V2TopBar
        title="Vision"
        onBackPress={handleBack}
        utility={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit Vision"
            onPress={() => setMode('create')}
            style={styles.headerAction}
          >
            <Edit3 size={18} color={colors.text.primary} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Anchor intention mini badge */}
        <View style={styles.anchorMiniBar}>
          <Text numberOfLines={1} style={styles.anchorIntention}>
            {(anchor as any)?.intention ?? anchor?.intentionText ?? 'Anchor Intention'}
          </Text>
          <View style={[styles.categoryPill, { borderColor: categoryColor }]}>
            <Text style={styles.categoryPillText}>{anchor?.category ?? 'Anchor'}</Text>
          </View>
        </View>

        {/* Locked ApertureGrid */}
        <View style={styles.compositionWrapper}>
          <RealVisionComposition
            tiles={tiles}
            category={anchor?.category}
            height={260}
          />
        </View>

        {/* Future Description Card */}
        <View style={styles.descriptionCard}>
          <Text style={styles.descriptionEyebrow}>WHAT THIS LOOKS LIKE IN FULL</Text>
          <Text style={styles.descriptionBody}>{description}</Text>
        </View>

        {/* Connected Movement Loops */}
        <View style={styles.actionSection}>
          {/* SEE -> REINFORCE: Visualize CTA */}
          <V2Button
            accessibilityLabel="Visualize your future"
            onPress={() => props.onVisualize?.(visualizeHandoff)}
          >
            <View style={styles.buttonInner}>
              <Eye size={18} color={colors.text.inverse} />
              <Text style={styles.buttonLabel}>Visualize this Future</Text>
              <ArrowRight size={16} color={colors.text.inverse} />
            </View>
          </V2Button>

          {/* SEE -> MOVE: Chart CTA */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open on Chart"
            onPress={() => props.onChart?.(anchorId)}
            style={styles.chartLink}
          >
            <View style={styles.chartLinkInner}>
              <Compass size={18} color={categoryColor} />
              <Text style={styles.chartLinkText}>Open on your Chart</Text>
              <ArrowRight size={16} color={categoryColor} />
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </V2Screen>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: spacing[4],
    gap: spacing[4],
    paddingBottom: spacing[8],
  },
  headerAction: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anchorMiniBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[1],
  },
  anchorIntention: {
    ...typography.headingSM,
    color: colors.text.primary,
    flex: 1,
    marginRight: 8,
  },
  categoryPill: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  categoryPillText: {
    ...typography.caption,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  compositionWrapper: {
    width: '100%',
  },
  descriptionCard: {
    padding: spacing[4],
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: spacing[2],
  },
  descriptionEyebrow: {
    ...typography.caption,
    color: colors.text.secondary,
    letterSpacing: 0.8,
  },
  descriptionBody: {
    ...typography.bodyMD,
    color: colors.text.primary,
    lineHeight: 22,
  },
  actionSection: {
    gap: spacing[3],
    marginTop: spacing[2],
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  buttonLabel: {
    ...typography.labelMD,
    color: colors.text.inverse,
    fontWeight: '700',
  },
  chartLink: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  chartLinkInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  chartLinkText: {
    ...typography.labelMD,
    color: colors.text.primary,
    fontWeight: '600',
  },
});
