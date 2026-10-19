import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Copy, Download, Image as ImageIcon, Upload } from 'lucide-react-native';
import { detailsFonts, detailsPalette, withAlpha } from '@/components/v2/anchors/anchorDetailsTokens';

export type AnchorOptionsMenuAction = 'share' | 'download' | 'wallpaper' | 'copy';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (action: AnchorOptionsMenuAction) => void;
  /** Distance from the window's top to the popover (below the three-dots button). */
  top: number;
  /** Disables the actions that are already running. */
  busy?: Partial<Record<AnchorOptionsMenuAction, boolean>>;
};

/**
 * The testIDs predate the menu: Share, Wallpaper and Download PNG used to be
 * buttons in the screen body, and tests and QA scripts still find them here.
 */
const ITEMS: Array<{ action: AnchorOptionsMenuAction; label: string; testID: string; Icon: typeof Upload }> = [
  { action: 'share', label: 'Share anchor', testID: 'anchor-detail-share-button', Icon: Upload },
  { action: 'download', label: 'Download PNG', testID: 'anchor-detail-download-png-button', Icon: Download },
  { action: 'wallpaper', label: 'Save as wallpaper', testID: 'anchor-detail-set-wallpaper-button', Icon: ImageIcon },
  { action: 'copy', label: 'Copy intention', testID: 'anchor-detail-copy-intention-button', Icon: Copy },
];

/** A popover under the three-dots button: ink, 248pt wide, 48pt rows, over a 28% ink scrim. */
export function AnchorOptionsMenu({ visible, onClose, onSelect, top, busy }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable
        style={styles.scrim}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close menu"
        testID="anchor-options-scrim"
      />
      <View accessibilityViewIsModal style={[styles.menu, { top }]} testID="anchor-options-menu">
        {ITEMS.map(({ action, label, testID, Icon }) => (
          <Pressable
            key={action}
            testID={testID}
            accessibilityRole="menuitem"
            accessibilityLabel={label}
            accessibilityState={{ disabled: Boolean(busy?.[action]) }}
            disabled={Boolean(busy?.[action])}
            onPress={() => onSelect(action)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed, busy?.[action] && styles.rowBusy]}
          >
            <Icon size={20} color={detailsPalette.cream} strokeWidth={1.8} />
            <Text style={styles.label}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: withAlpha(detailsPalette.ink, 0.28),
  },
  menu: {
    position: 'absolute',
    right: 16,
    width: 248,
    padding: 6,
    borderRadius: 18,
    backgroundColor: detailsPalette.ink,
    shadowColor: detailsPalette.ink,
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  row: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowPressed: { backgroundColor: withAlpha(detailsPalette.cream, 0.07) },
  rowBusy: { opacity: 0.5 },
  label: {
    fontFamily: detailsFonts.uiStrong,
    fontSize: 15,
    color: detailsPalette.cream,
  },
});
