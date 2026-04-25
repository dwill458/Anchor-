import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { SvgXml } from 'react-native-svg';
import { colors, typography } from '@/theme';
import type { Anchor } from '@/types';
import { withAlpha } from '@/utils/color';

const { width } = Dimensions.get('window');
const MODAL_WIDTH = width - 32;
const GRID_PADDING = 20;
const COLUMN_GAP = 12;
const NUM_COLUMNS = 4;
const ITEM_SIZE = (MODAL_WIDTH - (GRID_PADDING * 2) - (COLUMN_GAP * (NUM_COLUMNS - 1))) / NUM_COLUMNS;

interface VaultGridModalProps {
  visible: boolean;
  onDismiss: () => void;
  anchors: Anchor[];
  onAnchorPress: (id: string) => void;
}

export const VaultGridModal: React.FC<VaultGridModalProps> = ({
  visible,
  onDismiss,
  anchors,
  onAnchorPress,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(20);
    }
  }, [visible, fadeAnim, slideAnim]);

  const renderItem = ({ item }: { item: Anchor }) => {
    const imageUrl = item.enhancedImageUrl;
    const sigilXml = item.reinforcedSigilSvg ?? item.baseSigilSvg;

    return (
      <TouchableOpacity
        style={styles.gridItem}
        onPress={() => {
          onAnchorPress(item.id);
          onDismiss();
        }}
        activeOpacity={0.7}
      >
        <View style={styles.sigilThumb}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.thumbImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.sigilFallback}>
              <SvgXml xml={sigilXml} width={ITEM_SIZE * 0.6} height={ITEM_SIZE * 0.6} />
            </View>
          )}
          <View style={[styles.statusDot, item.isCharged ? styles.dotCharged : styles.dotUncharged]} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss}>
          <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
        </Pressable>

        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>ALL ANCHORS</Text>
            <TouchableOpacity onPress={onDismiss} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={anchors}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            numColumns={NUM_COLUMNS}
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={styles.columnWrapper}
            showsVerticalScrollIndicator={false}
          />
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  content: {
    width: width - 32,
    maxHeight: '80%',
    backgroundColor: '#0F1419',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.15),
    overflow: 'hidden',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  title: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 12,
    letterSpacing: 2,
    color: colors.gold,
  },
  closeBtn: {
    padding: 4,
  },
  closeText: {
    fontSize: 18,
    color: withAlpha(colors.bone, 0.4),
  },
  listContent: {
    paddingHorizontal: GRID_PADDING,
    paddingTop: 8,
    paddingBottom: 8,
  },
  columnWrapper: {
    gap: COLUMN_GAP,
    marginBottom: COLUMN_GAP,
  },
  gridItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
  },
  sigilThumb: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.15),
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  sigilFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotCharged: {
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 4,
  },
  dotUncharged: {
    backgroundColor: 'rgba(192,192,192,0.4)',
  },
});
