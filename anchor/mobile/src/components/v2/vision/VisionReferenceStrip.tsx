import { useRef, useState } from 'react';
import { Image, Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Camera, Images, MapPin, Package, Plus, Sparkles, Tag, UserRound, X } from 'lucide-react-native';
import { pickVisionPhoto, type VisionPhotoSource } from '@/hooks/v2/vision';
import { colors, radii, spacing, typography } from '@/theme/v2';
import type { VisionReferenceAttachment } from '@/types/visionConversation';
import { v2Haptics } from '@/hooks/v2';
import { VisionChoiceSheet, type VisionChoiceAction } from './VisionChoiceSheet';
import { VisionRoleChip } from './VisionRoleChip';
import { VISION_GOLD, VISION_SERIF } from './VisionPaperChrome';

const MAX_REFERENCES = 5;
const ROLE_NAMES: Record<VisionReferenceAttachment['role'], string> = {
  identity: 'Person', place: 'Place', object: 'Object', inspiration: 'Inspiration',
};
const SOURCE_ACTIONS: ReadonlyArray<VisionChoiceAction> = [
  { key: 'library', label: 'Choose from library', detail: 'Use a photo you already have', Icon: Images },
  { key: 'camera', label: 'Take photo', detail: 'Capture something right now', Icon: Camera },
];
const FULL_SLOT_ACTIONS: ReadonlyArray<VisionChoiceAction> = [
  { key: 'library', label: 'Replace from library', detail: 'Choose a different reference photo', Icon: Images },
  { key: 'camera', label: 'Take replacement photo', detail: 'Capture a new reference', Icon: Camera },
  { key: 'remove', label: 'Remove photo', detail: 'Take this reference out of the gallery', Icon: X, destructive: true },
];
const COMPACT_SLOT_ACTIONS: ReadonlyArray<VisionChoiceAction> = [
  { key: 'role', label: 'Change role', detail: 'Choose how this photo guides the scene', Icon: Tag },
  ...FULL_SLOT_ACTIONS,
];
const ROLE_ACTIONS: ReadonlyArray<VisionChoiceAction> = [
  { key: 'identity', label: 'Person', Icon: UserRound },
  { key: 'place', label: 'Place', Icon: MapPin },
  { key: 'object', label: 'Object', Icon: Package },
  { key: 'inspiration', label: 'Inspiration', Icon: Sparkles },
];

export interface VisionReferenceStripProps {
  references: readonly VisionReferenceAttachment[];
  onChange: (references: VisionReferenceAttachment[]) => void;
  onNotice?: (message: string | null) => void;
  disabled?: boolean;
  collapsed?: boolean;
  compact?: boolean;
  /** Denser full-gallery presentation for the refine sheet. */
  density?: 'default' | 'refine';
  testID?: string;
}

/** A local-only, five-photo reference gallery. References are never routed through Photo Fit. */
export function VisionReferenceStrip({
  references,
  onChange,
  onNotice,
  disabled = false,
  collapsed = false,
  compact = false,
  density = 'default',
  testID = 'vision-reference-strip',
}: VisionReferenceStripProps) {
  const [sheetTarget, setSheetTarget] = useState<number | null>(null);
  const [roleTarget, setRoleTarget] = useState<number | null>(null);
  const [inlineRoleEditorId, setInlineRoleEditorId] = useState<string | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const nextId = useRef(1);
  const shownReferences = references.slice(0, MAX_REFERENCES);
  const isFull = shownReferences.length >= MAX_REFERENCES;
  const tileWidth = compact ? 48 : density === 'refine' ? 65 : shownReferences.length >= 4 ? 65 : 78;
  const tileHeight = compact ? 48 : density === 'refine' ? 77 : shownReferences.length >= 4 ? 92 : 98;

  const openAdd = () => {
    if (disabled || isPicking || isFull) return;
    v2Haptics.selection();
    Keyboard.dismiss();
    setSheetTarget(-1);
  };

  const openFullSlot = (index: number) => {
    if (disabled || isPicking) return;
    v2Haptics.selection();
    Keyboard.dismiss();
    setSheetTarget(index);
  };

  const removeAt = (index: number) => {
    if (disabled) return;
    v2Haptics.selection();
    onChange(references.filter((_, itemIndex) => itemIndex !== index));
    onNotice?.(null);
  };

  const choosePhoto = async (source: VisionPhotoSource, targetIndex: number | null) => {
    if (disabled || isPicking) return;
    setIsPicking(true);
    try {
      const result = await pickVisionPhoto(source, 0.6);
      if (result.status === 'picked') {
        const existing = targetIndex === null ? undefined : shownReferences[targetIndex];
        const attachment: VisionReferenceAttachment = {
          id: existing?.id ?? `vision-reference-${Date.now()}-${nextId.current++}`,
          uri: result.photo.uri,
          mimeType: result.photo.mimeType,
          role: existing?.role ?? 'inspiration',
          ...(existing?.label ? { label: existing.label } : {}),
        };
        onChange(targetIndex === null
          ? [...shownReferences, attachment]
          : references.map((reference, index) => index === targetIndex ? attachment : reference));
        onNotice?.(null);
      } else if (result.status === 'denied' || result.status === 'error') {
        onNotice?.(result.message);
      }
    } finally {
      setIsPicking(false);
    }
  };

  const onSourceChoose = (key: string) => {
    if (key === 'role' && sheetTarget !== null && sheetTarget >= 0) {
      setRoleTarget(sheetTarget);
      return;
    }
    if (key === 'remove' && sheetTarget !== null && sheetTarget >= 0) {
      removeAt(sheetTarget);
      return;
    }
    if (key === 'library' || key === 'camera') void choosePhoto(key, sheetTarget === -1 ? null : sheetTarget);
  };

  const sourceActions = sheetTarget === null || sheetTarget === -1 ? SOURCE_ACTIONS : collapsed ? FULL_SLOT_ACTIONS : compact ? COMPACT_SLOT_ACTIONS : FULL_SLOT_ACTIONS;
  const sheetVisible = sheetTarget !== null;
  const roleSummary = shownReferences.map(reference => ROLE_NAMES[reference.role]).join(' · ');
  const inlineRoleEditorIndex = inlineRoleEditorId === null
    ? -1
    : shownReferences.findIndex(reference => reference.id === inlineRoleEditorId);

  if (collapsed) {
    return (
      <View testID={testID} style={[styles.collapsed, disabled && styles.disabled]}>
        <View style={styles.miniThumbs} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {shownReferences.slice(0, 3).map(reference => (
            <Image key={reference.id} source={{ uri: reference.uri }} style={styles.miniThumb} resizeMode="cover" resizeMethod="resize" />
          ))}
        </View>
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryTitle}>{shownReferences.length} {shownReferences.length === 1 ? 'reference' : 'references'} attached</Text>
          {roleSummary ? <Text numberOfLines={1} style={styles.summaryRoles}>{roleSummary}</Text> : null}
        </View>
        {!isFull ? (
          <Pressable testID={`${testID}-add`} accessibilityRole="button" accessibilityLabel="Add reference photo" disabled={disabled || isPicking}
            onPress={openAdd} style={({ pressed }) => [styles.compactAdd, pressed && styles.pressed, disabled && styles.disabled]}>
            <Text style={styles.compactAddLabel}>+ Add</Text>
          </Pressable>
        ) : (
          <Pressable testID={`${testID}-manage`} accessibilityRole="button" accessibilityLabel="Replace or remove a reference photo" disabled={disabled || isPicking}
            onPress={() => openFullSlot(0)} style={({ pressed }) => [styles.compactAdd, pressed && styles.pressed, disabled && styles.disabled]}>
            <Text style={styles.compactAddLabel}>Manage</Text>
          </Pressable>
        )}
        <VisionChoiceSheet visible={sheetVisible} onClose={() => setSheetTarget(null)} title="Reference photo"
          subtitle={sheetTarget === null || sheetTarget === -1 ? 'Add a photo to this scene.' : 'Replace this photo or remove it from the scene.'}
          actions={sourceActions} onChoose={onSourceChoose} testID={`${testID}-choices`} />
      </View>
    );
  }

  return (
    <View testID={testID}>
      {!compact ? <View style={[styles.heading, density === 'refine' && styles.refineHeading]}>
        <Text style={styles.headingTitle}>{shownReferences.length === 0 ? 'Add reference photos' : 'Reference photos'}</Text>
        <Text style={[styles.count, isFull && styles.countFull]}>
          {shownReferences.length === 0 ? 'Optional · Up to 5' : `${shownReferences.length} of ${MAX_REFERENCES} · ${isFull ? 'Maximum reached' : 'Roles are optional'}`}
        </Text>
      </View> : null}
      {!compact && shownReferences.length === 0 ? (
        <Pressable testID={`${testID}-add`} accessibilityRole="button" accessibilityLabel="Add reference photo" disabled={disabled || isPicking}
          onPress={openAdd} style={({ pressed }) => [styles.emptyAddTile, pressed && styles.pressed, disabled && styles.disabled]}>
          <View style={styles.emptyAddIcon}>
            <Images size={22} color={VISION_GOLD} strokeWidth={1.6} />
          </View>
          <View style={styles.emptyAddCopy}>
            <Text style={styles.emptyAddTitle}>Add photos from library or camera</Text>
            <Text style={styles.emptyAddHint}>Include yourself, a place, a vehicle, or visual inspiration</Text>
          </View>
        </Pressable>
      ) : (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
        {!isFull && !compact && shownReferences.length > 0 ? (
          <Pressable testID={`${testID}-add`} accessibilityRole="button" accessibilityLabel="Add reference photo" disabled={disabled || isPicking}
            onPress={openAdd} style={({ pressed }) => [styles.addTile, { width: tileWidth, height: tileHeight }, pressed && styles.pressed, disabled && styles.disabled]}>
            <Plus size={22} color={VISION_GOLD} strokeWidth={1.6} />
            <Text style={styles.addLabel}>Add{!compact ? '\nphoto' : ''}</Text>
          </Pressable>
        ) : null}
        {shownReferences.map((reference, index) => compact ? (
          <Pressable key={reference.id} testID={`${testID}-select-${index}`} accessibilityRole="button"
            accessibilityLabel={`${ROLE_NAMES[reference.role]} reference photo ${index + 1}. Change role, replace, or remove`}
            disabled={disabled || isPicking} onPress={() => openFullSlot(index)}
            style={({ pressed }) => [styles.thumbCard, styles.compactThumb, { width: tileWidth, height: tileHeight }, sheetTarget === index && styles.selectedCard, pressed && styles.pressed, disabled && styles.disabled]}>
            <Image source={{ uri: reference.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" resizeMethod="resize" accessibilityLabel={`${ROLE_NAMES[reference.role]} reference photo`} />
          </Pressable>
        ) : (
          <View key={reference.id} testID={`${testID}-item-${index}`} style={[
            styles.thumbCard,
            { width: tileWidth, height: tileHeight },
            sheetTarget === index && styles.selectedCard,
            disabled && styles.disabled,
          ]}>
            <Pressable testID={`${testID}-select-${index}`} accessibilityRole="button"
              accessibilityLabel={isFull ? `${ROLE_NAMES[reference.role]} reference photo ${index + 1}. Replace or remove` : `${ROLE_NAMES[reference.role]} reference photo ${index + 1}`}
              disabled={disabled || isPicking} onPress={() => isFull && openFullSlot(index)} style={StyleSheet.absoluteFill}>
              <Image source={{ uri: reference.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" resizeMethod="resize"
                accessibilityLabel={`${ROLE_NAMES[reference.role]} reference photo`} />
            </Pressable>
            <View pointerEvents="box-none" style={styles.rolePosition}>
              <VisionRoleChip role={reference.role}
                onChange={role => onChange(references.map((item, itemIndex) => itemIndex === index ? { ...item, role } : item))}
                onPress={() => {
                  if (disabled || isPicking) return;
                  v2Haptics.selection();
                  setInlineRoleEditorId(current => current === reference.id ? null : reference.id);
                }}
                disabled={disabled || isPicking} testID={`${testID}-role-${index}`} />
            </View>
            <Pressable testID={`${testID}-remove-${index}`} accessibilityRole="button"
              accessibilityLabel={`Remove reference photo ${index + 1}`} accessibilityHint="Removes this photo from the scene"
              disabled={disabled || isPicking} onPress={() => removeAt(index)} style={({ pressed }) => [styles.removeHit, pressed && styles.pressed]}>
              <View testID={`${testID}-remove-visual-${index}`} style={styles.removeVisual}>
                <X size={12} color={colors.paper} strokeWidth={2} />
              </View>
            </Pressable>
          </View>
        ))}
        {!isFull && compact ? (
          <Pressable testID={`${testID}-add`} accessibilityRole="button" accessibilityLabel="Add reference photo" disabled={disabled || isPicking}
            onPress={openAdd} style={({ pressed }) => [styles.compactAdd, pressed && styles.pressed, disabled && styles.disabled]}>
            <Text style={styles.compactAddLabel}>+ Add ({shownReferences.length}/{MAX_REFERENCES})</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      )}
      {!compact && inlineRoleEditorIndex >= 0 ? (
        <View testID={`${testID}-role-editor`} style={styles.inlineRoleEditor}>
          <Text style={styles.inlineRoleTitle}>Photo {inlineRoleEditorIndex + 1} role:</Text>
          {Object.entries(ROLE_NAMES).map(([role, label]) => {
            const selected = shownReferences[inlineRoleEditorIndex].role === role;
            return (
              <Pressable key={role} testID={`${testID}-set-role-${role}`} accessibilityRole="button"
                accessibilityLabel={`Set photo ${inlineRoleEditorIndex + 1} role to ${label}`}
                accessibilityState={{ selected, disabled: disabled || isPicking }} disabled={disabled || isPicking}
                onPress={() => {
                  const targetId = inlineRoleEditorId;
                  if (!targetId) return;
                  v2Haptics.selection();
                  onChange(references.map(reference => reference.id === targetId ? { ...reference, role: role as VisionReferenceAttachment['role'] } : reference));
                }}
                style={({ pressed }) => [styles.inlineRoleOption, selected && styles.inlineRoleOptionSelected, pressed && styles.pressed, disabled && styles.disabled]}>
                <Text style={[styles.inlineRoleLabel, selected && styles.inlineRoleLabelSelected]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <VisionChoiceSheet visible={sheetVisible} onClose={() => setSheetTarget(null)} title="Reference photo"
        subtitle={sheetTarget === null || sheetTarget === -1 ? 'Add a photo to this scene.' : 'Replace this photo or remove it from the scene.'}
        actions={sourceActions} onChoose={onSourceChoose} testID={`${testID}-choices`} />
      <VisionChoiceSheet visible={roleTarget !== null} onClose={() => setRoleTarget(null)} title="How should this photo help?"
        subtitle="Choose the role that best describes this reference." actions={ROLE_ACTIONS}
        onChoose={key => {
          if (roleTarget !== null && key in ROLE_NAMES) {
            onChange(references.map((reference, index) => index === roleTarget ? { ...reference, role: key as VisionReferenceAttachment['role'] } : reference));
          }
        }} testID={`${testID}-role-chooser`} />
    </View>
  );
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.78 },
  heading: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2], marginBottom: spacing[2] },
  refineHeading: { minHeight: 20, marginBottom: spacing[1] },
  headingTitle: { color: colors.text.primary, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  count: { color: colors.text.secondary, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  countFull: { color: VISION_GOLD, fontFamily: typography.bodySemiBold },
  gallery: { alignItems: 'center', gap: spacing[2], paddingRight: spacing[2] },
  emptyAddTile: { width: '100%', minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderWidth: 1.5, borderStyle: 'dashed', borderColor: VISION_GOLD, borderRadius: radii.lg, backgroundColor: colors.surface },
  emptyAddIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border.default, backgroundColor: colors.grouped },
  emptyAddCopy: { flex: 1, gap: spacing[1] },
  emptyAddTitle: { color: colors.text.primary, fontFamily: VISION_SERIF, fontSize: 17, lineHeight: 22 },
  emptyAddHint: { color: colors.text.secondary, fontFamily: typography.body, fontSize: 14, lineHeight: 20 },
  inlineRoleEditor: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[1], paddingHorizontal: spacing[2], paddingVertical: spacing[1], borderRadius: radii.lg, borderWidth: 1, borderColor: VISION_GOLD, backgroundColor: colors.surface },
  inlineRoleTitle: { flexShrink: 0, color: colors.text.primary, fontFamily: typography.bodySemiBold, fontSize: 12, lineHeight: 16 },
  inlineRoleOption: { minWidth: 44, minHeight: 44, flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[1], borderRadius: radii.round },
  inlineRoleOptionSelected: { backgroundColor: colors.ink.deep },
  inlineRoleLabel: { color: colors.text.secondary, fontFamily: typography.body, fontSize: 12, lineHeight: 16 },
  inlineRoleLabelSelected: { color: colors.paper, fontFamily: typography.bodySemiBold },
  addTile: { flexShrink: 0, alignItems: 'center', justifyContent: 'center', gap: 2, borderWidth: 1.5, borderStyle: 'dashed', borderColor: VISION_GOLD, borderRadius: radii.lg, backgroundColor: colors.surface },
  addLabel: { color: colors.text.primary, fontFamily: typography.bodySemiBold, fontSize: 12, lineHeight: 15, textAlign: 'center' },
  thumbCard: { flexShrink: 0, overflow: 'hidden', position: 'relative', borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border.strong, backgroundColor: colors.grouped },
  selectedCard: { borderColor: VISION_GOLD, borderWidth: 1.5 },
  rolePosition: { position: 'absolute', left: 2, right: 2, bottom: 1, alignItems: 'center' },
  removeHit: { position: 'absolute', top: 0, right: 0, width: 44, height: 44, alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: 4, paddingRight: 4, backgroundColor: 'transparent' },
  removeVisual: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(14, 21, 28, 0.76)' },
  collapsed: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border.default, backgroundColor: colors.grouped },
  miniThumbs: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  miniThumb: { width: 34, height: 42, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border.strong, backgroundColor: colors.surface },
  compactThumb: { width: 48, height: 48, borderRadius: radii.sm },
  summaryCopy: { minWidth: 0, flex: 1 },
  summaryTitle: { color: colors.text.primary, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 18 },
  summaryRoles: { color: colors.text.secondary, fontFamily: typography.body, fontSize: 12, lineHeight: 17, marginTop: 1 },
  compactAdd: { minHeight: 44, minWidth: 68, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing[2], borderRadius: radii.round, borderWidth: 1, borderStyle: 'dashed', borderColor: VISION_GOLD, backgroundColor: colors.surface },
  compactAddLabel: { color: colors.text.primary, fontFamily: typography.bodySemiBold, fontSize: 12, lineHeight: 16 },
});
