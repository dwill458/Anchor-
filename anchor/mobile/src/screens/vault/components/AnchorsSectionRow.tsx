import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

interface AnchorsSectionRowProps {
  anchorCount: number;
}

export const AnchorsSectionRow: React.FC<AnchorsSectionRowProps> = ({ anchorCount }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>YOUR ANCHORS</Text>
      <Text style={styles.count}>{`${anchorCount} Active`}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 14,
    paddingHorizontal: 22,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 10,
    letterSpacing: 2.4,
    color: 'rgba(180,165,135,0.5)',
  },
  count: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 9,
    letterSpacing: 1,
    color: 'rgba(180,165,135,0.52)',
    textTransform: 'uppercase',
  },
});
