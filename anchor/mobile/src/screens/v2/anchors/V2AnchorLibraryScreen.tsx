import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Trash2 } from 'lucide-react-native';
import { V2Button, V2EmptyState, V2Screen, V2SegmentedControl, V2TopBar } from '@/components/v2';
import { V2AnchorGalleryGrid } from '@/components/v2/anchors';
import { Reveal } from '@/components/v2/motion';
import { useV2AnchorLibrary, type AnchorLibraryFilter } from '@/hooks/v2/anchors';
import { colors, spacing, typography } from '@/theme/v2';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import { del } from '@/services/ApiClient';
import type { V2DailyShellParamList } from '@/screens/v2/home/dailyShell';
import { countPerfRender, logAnchorBlob, perfLog } from '@/utils/perfDiagnostics';
import { useAnchorStore } from '@/stores/anchorStore';

type Nav = NativeStackNavigationProp<V2DailyShellParamList, 'V2AnchorLibrary'>;

const track = (name: string, properties: Record<string, unknown> = {}) => {
  try {
    AnalyticsService.track(name, properties);
  } catch {
    /* no-op */
  }
};

const FILTERS: Array<{ value: AnchorLibraryFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'released', label: 'Released' },
];

/** Standalone Your Anchors gallery — promoted from the legacy modal. */
export function V2AnchorLibraryScreen() {
  countPerfRender('V2AnchorLibraryScreen');
  const mountedAt = React.useRef(Date.now());
  const navigation = useNavigation<Nav>();
  const { filter, setFilter, entries, hasReleased } = useV2AnchorLibrary();
  const allAnchors = useAnchorStore((state) => state.anchors);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedAnchorIds, setSelectedAnchorIds] = useState<Set<string>>(() => new Set());
  // Keep the scrolling header mounted across filters. Only the first viewport
  // stages its arrival; filter changes and later rows appear immediately.
  const settled = useRef(false);
  const animateArrival = !settled.current;
  useEffect(() => {
    settled.current = true;
  }, []);

  useEffect(() => {
    perfLog('anchor-library-data', { filter, entries: entries.length, msSinceLibraryMount: Date.now() - mountedAt.current });
    logAnchorBlob('V2AnchorLibraryScreen', entries.map((entry) => entry.anchor));
  }, [entries, filter]);

  useEffect(() => {
    logAnchorBlob('V2AnchorLibraryScreen-all', allAnchors);
  }, [allAnchors]);

  useEffect(() => {
    track('v2_anchor_library_viewed');
  }, []);

  const options = hasReleased ? FILTERS : FILTERS.filter((f) => f.value !== 'released');
  const handleSelectAnchor = useCallback((anchorId: string) => {
    if (selectionMode) {
      setSelectedAnchorIds((previous) => {
        const next = new Set(previous);
        if (next.has(anchorId)) next.delete(anchorId);
        else next.add(anchorId);
        return next;
      });
      return;
    }
    const entry = entries.find((item) => item.anchor.id === anchorId || item.anchor.localId === anchorId);
    if (entry && !entry.released) useAnchorStore.getState().setCurrentAnchor(entry.anchor.id);
    track('v2_anchor_details_viewed', { from: 'library' });
    navigation.navigate('V2AnchorDetails', { anchorId });
  }, [entries, navigation, selectionMode]);

  const selectableAnchors = useMemo(
    () => allAnchors.filter((anchor) => anchor.isReleased || !anchor.archivedAt),
    [allAnchors],
  );
  const selectedEntries = useMemo(
    () => selectableAnchors.filter((anchor) => selectedAnchorIds.has(anchor.localId ?? anchor.id)),
    [selectableAnchors, selectedAnchorIds],
  );

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((current) => !current);
    setSelectedAnchorIds(new Set());
  }, []);

  const toggleAllSelection = useCallback(() => {
    setSelectedAnchorIds((current) => {
      if (current.size === selectableAnchors.length && selectableAnchors.length > 0) return new Set();
      return new Set(selectableAnchors.map((anchor) => anchor.localId ?? anchor.id));
    });
  }, [selectableAnchors]);

  const deleteSelectedAnchors = useCallback(() => {
    if (selectedEntries.length === 0) return;
    const anchorsToDelete = selectedEntries;
    // In this dev-only picker, pressing Delete is the explicit confirmation.
    // Remove locally now so a native prompt or slow request cannot block it.
    anchorsToDelete.forEach((anchor) => {
      useAnchorStore.getState().removeAnchor(anchor.id);
      track(AnalyticsEvents.ANCHOR_DELETED, {
        anchor_id: anchor.id,
        source: 'library_bulk',
      });
    });
    setSelectionMode(false);
    setSelectedAnchorIds(new Set());
    // Continue the server deletes in the background. The store's deletion
    // tombstones prevent pending sync work from restoring them.
    void Promise.allSettled(anchorsToDelete.map((anchor) => del(`/api/anchors/${anchor.id}`)));
  }, [selectedEntries]);

  return (
    <V2Screen testID="v2-anchor-library-screen">
      <V2AnchorGalleryGrid
        entries={entries}
        animateArrival={animateArrival}
        onSelectAnchor={handleSelectAnchor}
        selectionMode={selectionMode}
        selectedAnchorIds={selectedAnchorIds}
        header={
          <>
            <Reveal order={0}>
              <V2TopBar
                title={selectionMode ? 'Select Anchors' : 'Your Anchors'}
                onBackPress={() => navigation.goBack()}
                utility={__DEV__ ? (
                  <V2Button
                    size="compact"
                    variant="tertiary"
                    accessibilityLabel={selectionMode ? 'Cancel Anchor selection' : 'Select multiple Anchors'}
                    onPress={toggleSelectionMode}
                  >
                    {selectionMode ? 'Cancel' : 'Select'}
                  </V2Button>
                ) : undefined}
              />
            </Reveal>
            {selectionMode ? (
              <View style={styles.selectionHeader}>
                <Text style={styles.selectionCount}>{selectedEntries.length} selected</Text>
                <V2Button
                  size="compact"
                  variant="tertiary"
                  accessibilityLabel={selectedAnchorIds.size === selectableAnchors.length && selectableAnchors.length > 0 ? 'Deselect all Anchors' : 'Select all Anchors'}
                  onPress={toggleAllSelection}
                >
                  {selectedAnchorIds.size === selectableAnchors.length && selectableAnchors.length > 0 ? 'Deselect all' : 'Select all'}
                </V2Button>
              </View>
            ) : null}
            <Reveal order={1}>
              <View style={styles.filter}>
                <V2SegmentedControl
                  accessibilityLabel="Filter Anchors"
                  value={filter}
                  onChange={(value) => setFilter(value as AnchorLibraryFilter)}
                  options={options}
                />
              </View>
            </Reveal>
          </>
        }
        emptyState={
          <V2EmptyState
            title="No Anchors here"
            message={
              filter === 'released'
                ? 'Released Anchors will appear here. Nothing has been released yet.'
                : 'Create an Anchor to start your collection.'
            }
          />
        }
      />
      {selectionMode ? (
        <View style={styles.deleteBar}>
          <V2Button
            variant="destructive"
            size="large"
            disabled={selectedEntries.length === 0}
            testID="v2-anchor-bulk-delete-button"
            iconLeft={<Trash2 size={18} color={colors.text.inverse} />}
            accessibilityLabel={`Delete ${selectedEntries.length} selected Anchors`}
            onPress={deleteSelectedAnchors}
            style={styles.deleteButton}
          >
            Delete {selectedEntries.length}
          </V2Button>
        </View>
      ) : null}
    </V2Screen>
  );
}

const styles = StyleSheet.create({
  filter: { marginTop: spacing[4], marginBottom: spacing[7] },
  selectionHeader: { marginTop: spacing[2], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectionCount: { ...typography.labelMD, color: colors.text.secondary },
  // The global DEV pill floats 36dp above the safe-area bottom. Keep this
  // destructive action above it so the pill cannot intercept taps.
  deleteBar: { paddingTop: spacing[3], paddingBottom: spacing[3], marginBottom: spacing[9] },
  deleteButton: { width: '100%' },
});
