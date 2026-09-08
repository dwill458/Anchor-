import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { V2EmptyState, V2Screen, V2SegmentedControl, V2TopBar } from '@/components/v2';
import { V2AnchorGalleryGrid } from '@/components/v2/anchors';
import { useV2AnchorLibrary, type AnchorLibraryFilter } from '@/hooks/v2/anchors';
import { spacing } from '@/theme/v2';
import { AnalyticsService } from '@/services/AnalyticsService';
import type { V2DailyShellParamList } from '@/screens/v2/home/dailyShell';

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
  const navigation = useNavigation<Nav>();
  const { filter, setFilter, entries, hasReleased } = useV2AnchorLibrary();

  useEffect(() => {
    track('v2_anchor_library_viewed');
  }, []);

  const options = hasReleased ? FILTERS : FILTERS.filter((f) => f.value !== 'released');

  return (
    <V2Screen scroll testID="v2-anchor-library-screen">
      <V2TopBar title="Your Anchors" onBackPress={() => navigation.goBack()} />
      <View style={styles.filter}>
        <V2SegmentedControl
          accessibilityLabel="Filter Anchors"
          value={filter}
          onChange={(value) => setFilter(value as AnchorLibraryFilter)}
          options={options}
        />
      </View>
      {entries.length === 0 ? (
        <V2EmptyState
          title="No Anchors here"
          message={
            filter === 'released'
              ? 'Released Anchors will appear here. Nothing has been released yet.'
              : 'Create an Anchor to start your collection.'
          }
        />
      ) : (
        <V2AnchorGalleryGrid
          entries={entries}
          onSelectAnchor={(anchorId) => {
            track('v2_anchor_details_viewed', { from: 'library' });
            navigation.navigate('V2AnchorDetails', { anchorId });
          }}
        />
      )}
    </V2Screen>
  );
}

const styles = StyleSheet.create({
  filter: { marginTop: spacing[4], marginBottom: spacing[6] },
});
