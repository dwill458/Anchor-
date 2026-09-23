import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowDown, ArrowRight, ArrowUp, Eye, Image as ImageIcon, MoreHorizontal, Pencil, RefreshCw, Trash2 } from 'lucide-react-native';
import { V2Button } from '@/components/v2';
import { colors, getCategoryColor, radii, spacing, typography } from '@/theme/v2';
import { practiceColors } from '@/theme/v2/practiceColors';
import { useV2ReduceMotion, v2Haptics } from '@/hooks/v2';
import type { V2VisionTile } from '@/adapters/v2/vision';
import type { ChartSummary } from '@/adapters/v2/chart/chartV2Model';
import { VisionHeaderRow, VisionIdentity, VisionInkBand, type VisionAnchorArt } from './VisionChrome';
import { VISION_DESCRIPTION_MAX_CHARS, VISION_DESCRIPTION_MIN_CHARS, visionDetailHint } from './visionGuidance';

type Props = {
  anchorIntention: string;
  anchorCategory?: string | null;
  anchorImageUrl?: string | null;
  anchorArt?: VisionAnchorArt | null;
  description: string;
  tiles: V2VisionTile[];
  error?: string | null;
  onBack: () => void;
  onVisualize: () => void;
  onChart: () => void;
  /** Real Chart state for this Anchor; null when there is no route. */
  chartSummary?: ChartSummary | null;
  onUpdateDescription: (description: string) => Promise<boolean>;
  onReorder: (sceneOrders: Array<{ id: string; sortOrder: number }>) => Promise<boolean>;
  onRemove: (sceneId: string) => Promise<boolean>;
  onAddOwn: () => Promise<void>;
  onGenerateMore: () => void;
  canGenerateMore: boolean;
  onArchive: () => Promise<boolean>;
  testID?: string;
};

const PAGE_GUTTER = spacing[5];

export function V2SavedVision({
  chartSummary = null,
  anchorIntention, anchorCategory, anchorImageUrl, anchorArt, description, tiles, error,
  onBack, onVisualize, onChart, onUpdateDescription, onReorder, onRemove,
  onAddOwn, onGenerateMore, canGenerateMore, onArchive, testID = 'v2-vision-screen',
}: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useV2ReduceMotion();
  const heroWidth = width - PAGE_GUTTER * 2;
  // Square generated scenes; never taller than half the screen on short phones.
  const heroHeight = Math.round(Math.min(heroWidth * 1.02, height * 0.5));
  const carouselRef = useRef<ScrollView>(null);
  const [mode, setMode] = useState<'view' | 'edit' | 'manage'>('view');
  const [activeIndex, setActiveIndex] = useState(0);
  const [draft, setDraft] = useState(description);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const categoryColor = getCategoryColor(anchorCategory);
  const showImage = (index: number) => {
    v2Haptics.selection();
    setActiveIndex(index);
    carouselRef.current?.scrollTo({ x: index * heroWidth, animated: !reduceMotion });
  };

  useEffect(() => { setDraft(description); }, [description]);
  useEffect(() => { if (activeIndex >= tiles.length) setActiveIndex(Math.max(0, tiles.length - 1)); }, [activeIndex, tiles.length]);

  const saveText = async () => {
    if (draft.trim().length < VISION_DESCRIPTION_MIN_CHARS || busy) { setNotice(`Describe your Vision in at least ${VISION_DESCRIPTION_MIN_CHARS} characters.`); return; }
    setBusy(true);
    const success = await onUpdateDescription(draft.trim());
    setBusy(false);
    if (success) { setNotice(null); setMode('view'); }
    else setNotice('Vision could not be updated. Please try again.');
  };
  const move = async (index: number, direction: -1 | 1) => {
    const next = index + direction;
    if (next < 0 || next >= tiles.length || busy) return;
    const ordered = [...tiles];
    [ordered[index], ordered[next]] = [ordered[next], ordered[index]];
    setBusy(true);
    const success = await onReorder(ordered.map((tile, sortOrder) => ({ id: tile.sceneId, sortOrder })));
    setBusy(false);
    if (!success) setNotice('Image order could not be saved.');
    else setActiveIndex(next);
  };
  const remove = (tile: V2VisionTile) => {
    if (tiles.length <= 1) { setNotice('Keep at least one image in your Vision.'); return; }
    Alert.alert('Remove image?', 'This image will be removed from your Vision.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => {
        setBusy(true);
        void onRemove(tile.sceneId).then(success => {
          if (!success) setNotice('Image could not be removed.');
        }).finally(() => setBusy(false));
      } },
    ]);
  };
  const archive = () => {
    setMenuOpen(false);
    Alert.alert('Archive Vision?', 'Your Vision and images will be kept in your account but removed from this Anchor.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', style: 'destructive', onPress: () => {
        setBusy(true);
        void onArchive().then(success => {
          if (!success) setNotice('Vision could not be archived.');
        }).finally(() => setBusy(false));
      } },
    ]);
  };

  const title = mode === 'edit' ? 'Edit Vision' : mode === 'manage' ? 'Manage Images' : 'Vision';
  const header = (
    <VisionHeaderRow title={title}
      onBack={mode === 'view' ? onBack : () => { setMode('view'); setNotice(null); }}
      utility={mode === 'view' ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Vision options" hitSlop={8} onPress={() => setMenuOpen(value => !value)} style={styles.menuButton}>
          <MoreHorizontal size={22} color={colors.ink.text.primary} />
        </Pressable>
      ) : undefined} />
  );
  const identity = <VisionIdentity intention={anchorIntention} category={anchorCategory} art={anchorArt} imageUrl={anchorImageUrl} />;

  return (
    <View testID={testID} style={styles.root}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing[6] }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <VisionInkBand>
            <View style={styles.bandContent}>
              {header}
              {identity}
              {mode === 'view' ? (
                <View style={[styles.hero, { height: heroHeight }]}>
                  <ScrollView ref={carouselRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                    accessibilityLabel="Vision images"
                    onMomentumScrollEnd={event => setActiveIndex(Math.round(event.nativeEvent.contentOffset.x / heroWidth))}>
                    {tiles.map((tile, index) => (
                      <View key={tile.id} style={{ width: heroWidth, height: heroHeight }}
                        accessible accessibilityRole="image" accessibilityLabel={`Vision image ${index + 1} of ${tiles.length}`}>
                        {tile.imageUrl ? <Image source={{ uri: tile.imageUrl }} style={styles.fill} resizeMode="cover" />
                          : <View style={styles.unavailable}><Text style={styles.unavailableText}>Image unavailable</Text></View>}
                      </View>
                    ))}
                  </ScrollView>
                  {tiles.length > 1 ? (
                    <View pointerEvents="none" style={styles.countBadge}><Text style={styles.countText}>{activeIndex + 1}/{tiles.length}</Text></View>
                  ) : null}
                </View>
              ) : <View style={styles.bandTail} />}
            </View>
          </VisionInkBand>

          <View style={styles.body}>
            {mode === 'edit' ? (
              <>
                <Text style={styles.heading}>My Vision</Text>
                <TextInput testID="vision-edit-description" accessibilityLabel="Edit Vision description" multiline maxLength={VISION_DESCRIPTION_MAX_CHARS}
                  value={draft} onChangeText={setDraft} style={styles.textInput} textAlignVertical="top" />
                <View style={styles.meter}>
                  <Text style={styles.meterHint}>{visionDetailHint(draft) ?? ''}</Text>
                  <Text style={styles.counter}>{draft.length}/{VISION_DESCRIPTION_MAX_CHARS}</Text>
                </View>
                <V2Button size="large" disabled={busy || draft.trim().length < VISION_DESCRIPTION_MIN_CHARS} onPress={() => { void saveText(); }}>Save Vision</V2Button>
              </>
            ) : mode === 'manage' ? (
              <>
                <Text style={styles.heading}>Your images</Text>
                <Text style={styles.bodyText}>The first image is your Vision cover. Use the arrows to change the order.</Text>
                {tiles.map((tile, index) => (
                  <View key={tile.id} testID={`vision-manage-${tile.id}`} style={styles.manageRow}>
                    {tile.imageUrl ? <Image source={{ uri: tile.imageUrl }} style={styles.manageImage} /> : <View style={styles.manageImage} />}
                    <Text style={[styles.manageLabel, index === 0 && styles.manageCover]}>{index === 0 ? 'Cover image' : `Image ${index + 1}`}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Move image ${index + 1} up`} disabled={index === 0 || busy} onPress={() => { void move(index, -1); }} style={[styles.iconButton, (index === 0 || busy) && styles.dim]}><ArrowUp size={17} color={colors.text.primary} /></Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Move image ${index + 1} down`} disabled={index === tiles.length - 1 || busy} onPress={() => { void move(index, 1); }} style={[styles.iconButton, (index === tiles.length - 1 || busy) && styles.dim]}><ArrowDown size={17} color={colors.text.primary} /></Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Remove image ${index + 1}`} disabled={busy} onPress={() => remove(tile)} style={styles.iconButton}><Trash2 size={17} color={colors.semantic.error} /></Pressable>
                  </View>
                ))}
                {tiles.length < 5 && (
                  <View style={styles.manageActions}>
                    <V2Button variant="secondary" iconLeft={<ImageIcon size={16} color={colors.text.primary} />} onPress={() => { void onAddOwn(); }}>Add my own</V2Button>
                    {canGenerateMore && <V2Button variant="secondary" iconLeft={<RefreshCw size={16} color={colors.text.primary} />} onPress={onGenerateMore}>Generate more</V2Button>}
                  </View>
                )}
              </>
            ) : (
              <>
                {tiles.length > 1 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnails}>
                    {tiles.map((tile, index) => (
                      <Pressable key={tile.id} accessibilityRole="button" accessibilityLabel={`Show Vision image ${index + 1}`}
                        accessibilityState={{ selected: index === activeIndex }}
                        onPress={() => showImage(index)} style={[styles.thumb, index === activeIndex ? { borderColor: categoryColor, borderWidth: 2 } : styles.thumbIdle]}>
                        {tile.imageUrl ? <Image source={{ uri: tile.imageUrl }} style={styles.fill} /> : <View style={styles.unavailable} />}
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : null}
                <Text style={styles.heading}>My Vision</Text>
                <Text style={styles.description}>{description}</Text>
                <V2Button size="large" accessibilityLabel="Begin Visualize" onPress={onVisualize}
                  iconLeft={<Eye size={18} color={practiceColors.visualize} />} iconRight={<ArrowRight size={17} color={colors.paper} />}>
                  Begin Visualize
                </V2Button>
                <View style={styles.actions}>
                  <Pressable accessibilityRole="button" accessibilityLabel="Edit Vision" onPress={() => setMode('edit')} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><Pencil size={18} color={colors.text.primary} /><Text style={styles.actionText}>Edit Vision</Text></Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="Manage Images" onPress={() => setMode('manage')} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><ImageIcon size={18} color={colors.text.primary} /><Text style={styles.actionText}>Manage Images</Text></Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={chartSummary ? 'View on Chart' : 'Create a Chart'} onPress={onChart} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><ArrowRight size={18} color={colors.text.primary} /><Text style={styles.actionText}>{chartSummary ? 'View on Chart' : 'Create a Chart'}</Text></Pressable>
                </View>
                {chartSummary ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`On your Chart: ${chartSummary.isFinished ? 'destination reached' : `waypoint ${chartSummary.waypointNumber} of ${chartSummary.total}, ${chartSummary.waypointTitle}`}. View Chart.`}
                    onPress={onChart}
                    testID="vision-on-your-chart"
                    style={({ pressed }) => [styles.chartCard, pressed && styles.pressed]}
                  >
                    <Text style={styles.chartEyebrow}>ON YOUR CHART</Text>
                    <Text style={styles.chartPosition}>
                      {chartSummary.isFinished ? 'Destination reached' : `Waypoint ${chartSummary.waypointNumber} of ${chartSummary.total}`}
                    </Text>
                    <Text style={styles.chartTitle}>{chartSummary.waypointTitle}</Text>
                    <View style={styles.chartLink}>
                      <Text style={styles.chartLinkText}>View Chart</Text>
                      <ArrowRight size={15} color={colors.text.primary} />
                    </View>
                  </Pressable>
                ) : null}
              </>
            )}
            {(notice || error) && <Text style={styles.error}>{notice || error}</Text>}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {menuOpen && mode === 'view' && (
        <Pressable accessibilityRole="button" accessibilityLabel="Archive Vision" onPress={archive} style={[styles.menu, { top: insets.top + 50 }]}>
          <Text style={styles.archiveText}>Archive Vision</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  bandContent: { paddingHorizontal: PAGE_GUTTER, gap: spacing[4] },
  bandTail: { height: spacing[5] },
  menuButton: { width: 40, height: 40, alignItems: 'flex-end', justifyContent: 'center' },
  menu: { position: 'absolute', right: 18, zIndex: 5, padding: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border.default, borderRadius: radii.md },
  archiveText: { ...typography.labelMD, color: colors.semantic.error },
  hero: { width: '100%', overflow: 'hidden', borderRadius: radii.lg, backgroundColor: colors.ink.raised },
  fill: { width: '100%', height: '100%' },
  unavailable: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink.raised },
  unavailableText: { ...typography.caption, color: colors.ink.text.tertiary },
  countBadge: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 11, paddingVertical: 4, borderRadius: 14, backgroundColor: 'rgba(14,21,28,0.62)' },
  countText: { ...typography.caption, color: colors.paper },
  body: { paddingHorizontal: PAGE_GUTTER, paddingTop: spacing[3], gap: spacing[3] },
  thumbnails: { gap: 6 },
  thumb: { width: 52, height: 52, borderRadius: 8, overflow: 'hidden' },
  thumbIdle: { opacity: 0.6, borderWidth: 1, borderColor: colors.border.subtle },
  heading: { ...typography.headingSM, color: colors.text.primary, marginTop: spacing[2] },
  description: { ...typography.bodyMD, color: colors.text.primary, lineHeight: 23 },
  actions: { flexDirection: 'row', gap: spacing[2] },
  action: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 4, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border.subtle, backgroundColor: colors.surface },
  pressed: { opacity: 0.72 },
  actionText: { ...typography.caption, color: colors.text.primary, textAlign: 'center' },
  bodyText: { ...typography.bodyMD, color: colors.text.secondary },
  textInput: { ...typography.bodyMD, color: colors.text.primary, minHeight: 168, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border.default, backgroundColor: colors.surface, padding: spacing[4] },
  meter: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[3] },
  meterHint: { ...typography.caption, color: colors.text.secondary, flex: 1 },
  counter: { ...typography.caption, color: colors.text.tertiary },
  manageRow: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 7, borderRadius: radii.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border.subtle },
  manageImage: { width: 52, height: 52, borderRadius: 6, backgroundColor: colors.grouped },
  manageLabel: { ...typography.caption, color: colors.text.secondary, flex: 1, marginLeft: 6 },
  manageCover: { color: colors.text.primary },
  iconButton: { width: 34, height: 40, alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.35 },
  manageActions: { gap: spacing[2], marginTop: spacing[2] },
  error: { ...typography.caption, color: colors.semantic.error },
  chartCard: {
    marginTop: spacing[4],
    padding: spacing[4],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.surface,
    gap: 4,
  },
  chartEyebrow: { ...typography.labelSM, color: colors.text.secondary, letterSpacing: 1.1 },
  chartPosition: { ...typography.labelMD, color: colors.text.secondary, marginTop: spacing[1] },
  chartTitle: { ...typography.headingSM, color: colors.text.primary },
  chartLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing[2] },
  chartLinkText: { ...typography.labelMD, color: colors.text.primary },
});
