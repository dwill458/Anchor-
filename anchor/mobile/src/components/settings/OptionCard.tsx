import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

interface OptionCardProps {
  icon: string;
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}

export const OptionCard: React.FC<OptionCardProps> = ({
  icon,
  title,
  description,
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
    <View style={[styles.iconContainer, selected ? styles.iconContainerSelected : null]}>
      <Text style={[styles.icon, selected ? styles.iconSelected : null]}>{icon}</Text>
    </View>
    <View style={styles.textContainer}>
      <Text style={[styles.title, selected ? styles.titleSelected : null]}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
    {selected ? <Text style={styles.checkmark}>✓</Text> : null}
  </Pressable>
);

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.15)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 16,
  },
  cardPressed: {
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  cardSelected: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(212,175,55,0.08)',
  },
  iconContainer: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#232d3f',
  },
  iconContainerSelected: {
    backgroundColor: 'rgba(212,175,55,0.15)',
  },
  icon: {
    color: colors.silver,
    fontSize: 16,
  },
  iconSelected: {
    color: colors.gold,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    marginBottom: 3,
    color: colors.bone,
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  titleSelected: {
    color: colors.gold,
  },
  description: {
    color: '#8896a8',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    lineHeight: 16,
  },
  checkmark: {
    color: colors.gold,
    fontSize: 16,
    lineHeight: 16,
  },
});
