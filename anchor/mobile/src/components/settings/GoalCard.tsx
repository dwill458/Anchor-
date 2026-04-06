import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

interface GoalCardProps {
  label: string;
  value: number;
  selected: boolean;
  onPress: () => void;
}

export const GoalCard: React.FC<GoalCardProps> = ({
  label,
  value,
  selected,
  onPress,
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.card,
      selected ? styles.cardSelected : null,
      pressed && !selected ? styles.cardPressed : null,
    ]}
  >
    <Text style={[styles.label, selected ? styles.labelSelected : null]}>{label}</Text>
    <View style={styles.right}>
      {selected ? <Text style={styles.checkmark}>✓</Text> : null}
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.15)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  cardPressed: {
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  cardSelected: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(212,175,55,0.08)',
  },
  label: {
    color: colors.bone,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
  },
  labelSelected: {
    color: colors.gold,
  },
  right: {
    minWidth: 16,
    alignItems: 'flex-end',
  },
  checkmark: {
    color: colors.gold,
    fontSize: 16,
    lineHeight: 16,
  },
});
