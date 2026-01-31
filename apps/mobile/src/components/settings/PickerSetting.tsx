/**
 * Anchor App - Picker Setting Component
 *
 * A single-select picker row for settings with multiple options.
 * Shows options in a bottom sheet modal.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Check, ChevronRight } from 'lucide-react-native';
import { LucideIcon } from 'lucide-react-native';
import { SettingsRow } from './SettingsRow';
import { colors, spacing, typography } from '@/theme';

interface PickerOption {
  label: string;
  value: string | number;
}

interface PickerSettingProps {
  label: string;
  description?: string;
  value: string | number;
  onValueChange: (value: string | number) => void;
  options: PickerOption[];
  icon?: LucideIcon;
  showDivider?: boolean;
}

export const PickerSetting: React.FC<PickerSettingProps> = ({
  label,
  description,
  value,
  onValueChange,
  options,
  icon,
  showDivider = true,
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayValue = selectedOption?.label || String(value);

  const handleSelectOption = (selectedValue: string | number) => {
    onValueChange(selectedValue);
    setModalVisible(false);
  };

  return (
    <>
      <SettingsRow
        icon={icon}
        label={label}
        description={description}
        onPress={() => setModalVisible(true)}
        rightElement={
          <View style={styles.valueContainer}>
            <Text style={styles.value} numberOfLines={1}>
              {displayValue}
            </Text>
            <ChevronRight color={colors.gold} size={16} />
          </View>
        }
        showDivider={showDivider}
      />

      {/* Picker Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          {Platform.OS === 'ios' && (
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          )}

          <View
            style={[
              styles.modalContent,
              Platform.OS === 'android' && styles.modalContentAndroid,
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCloseButton}>Done</Text>
              </TouchableOpacity>
            </View>

            {/* Options List */}
            <FlatList
              data={options}
              keyExtractor={(item) => String(item.value)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleSelectOption(item.value)}
                  style={styles.optionRow}
                  activeOpacity={0.6}
                >
                  <Text
                    style={[
                      styles.optionLabel,
                      value === item.value && styles.optionLabelSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {value === item.value && (
                    <Check color={colors.gold} size={20} />
                  )}
                </TouchableOpacity>
              )}
              scrollEnabled={false}
            />
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: 150,
  },
  value: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.gold,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'rgba(26, 26, 29, 0.95)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: spacing.lg,
    maxHeight: '80%',
  },
  modalContentAndroid: {
    backgroundColor: 'rgba(26, 26, 29, 0.95)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(192, 192, 192, 0.1)',
  },
  modalTitle: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    fontWeight: '600',
  },
  modalCloseButton: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.gold,
    fontWeight: '500',
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(192, 192, 192, 0.05)',
  },
  optionLabel: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.primary,
    flex: 1,
  },
  optionLabelSelected: {
    color: colors.gold,
    fontWeight: '600',
  },
});
