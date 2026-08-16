import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Plus, User } from 'lucide-react-native';
import { colors } from '@/theme';
import { withAlpha } from '@/utils/color';

interface SanctuaryHeaderProps {
  reduceMotionEnabled: boolean;
  /** Time-aware greeting, e.g. "Good evening, Deontrez" */
  greeting?: string;
  onCreateAnchor?: () => void;
}

export const SanctuaryHeader: React.FC<SanctuaryHeaderProps> = ({
  reduceMotionEnabled,
  greeting,
  onCreateAnchor,
}) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const handleOpenProfile = useCallback(() => {
    navigation.navigate('Settings');
  }, [navigation]);

  const handleCreate = useCallback(() => {
    if (onCreateAnchor) {
      onCreateAnchor();
    } else {
      navigation.navigate('CreateAnchor');
    }
  }, [onCreateAnchor, navigation]);

  return (
    <View style={[styles.container, { paddingRight: Math.max(20, insets.right + 6) }]}>
      {greeting ? (
        <Text style={styles.greeting} numberOfLines={1}>
          {greeting}
        </Text>
      ) : (
        <View style={styles.greetingSpacer} />
      )}
      <View style={styles.actionsRow}>
        {/* Create Anchor (+) Button */}
        <Pressable
          style={styles.iconButton}
          onPress={handleCreate}
          accessibilityRole="button"
          accessibilityLabel="Create anchor"
        >
          <View style={styles.buttonTarget}>
            <View style={styles.createInnerBorder} />
            <Plus size={16} color={colors.anchor15.gilt} strokeWidth={1.6} />
          </View>
        </Pressable>

        {/* Profile Button */}
        <Pressable
          style={styles.iconButton}
          onPress={handleOpenProfile}
          accessibilityRole="button"
          accessibilityLabel="Profile"
        >
          <View style={styles.buttonTarget}>
            <View style={styles.profileInnerBorder} />
            <User size={17} color={colors.anchor15.gilt} strokeWidth={1.5} />
          </View>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingLeft: 20,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    flex: 1,
    paddingRight: 8,
    fontFamily: 'EBGaramond-Regular',
    fontSize: 17,
    fontStyle: 'italic',
    color: withAlpha(colors.anchor15.bone, 0.68),
  },
  greetingSpacer: {
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonTarget: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  createInnerBorder: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: withAlpha(colors.anchor15.gilt, 0.28),
  },
  profileInnerBorder: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: withAlpha(colors.anchor15.gilt, 0.12),
  },
});
