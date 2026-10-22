import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radii, typography } from '@/theme/v2';
import { progressTokens } from './progressTokens';

export interface V2ProgressGhostCardProps {
  title: string;
  body?: string;
  testID?: string;
}

/** A dashed placeholder for a section that has no evidence yet. It states what will appear; it never fills in sample data. */
export const V2ProgressGhostCard: React.FC<V2ProgressGhostCardProps> = ({ title, body, testID }) => (
  <View style={styles.card} testID={testID}>
    <Text style={styles.title}>{title}</Text>
    {body ? <Text style={styles.body}>{body}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: progressTokens.inkWash(0.22),
    borderRadius: radii.xl,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  title: {
    fontFamily: progressTokens.serif,
    fontSize: 18,
    lineHeight: 23,
    color: progressTokens.text,
    textAlign: 'center',
  },
  body: { ...typography.bodySM, color: progressTokens.muted, textAlign: 'center', marginTop: 5 },
});
