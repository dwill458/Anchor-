import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

interface InfoCardProps {
  title: string;
  body: string;
}

export const InfoCard: React.FC<InfoCardProps> = ({ title, body }) => (
  <View style={styles.card}>
    <Text style={styles.icon}>ⓘ</Text>
    <View style={styles.content}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(212,175,55,0.15)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 16,
  },
  icon: {
    marginTop: 1,
    color: colors.gold,
    fontSize: 16,
    lineHeight: 16,
  },
  content: {
    flex: 1,
  },
  title: {
    marginBottom: 5,
    color: colors.gold,
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
  },
  body: {
    color: '#8896a8',
    fontSize: 14,
    fontFamily: 'CormorantGaramond-Regular',
    lineHeight: 22,
  },
});
