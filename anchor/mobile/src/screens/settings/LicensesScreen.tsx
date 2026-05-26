import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react-native';
import { colors, typography } from '@/theme';
import licensesDataRaw from '@/assets/licenses.json';

interface LicenseItem {
  key: string;
  name: string;
  version: string;
  licenses: string;
  repository?: string;
  licenseUrl?: string;
}

// Parse the raw licenses JSON data
const rawData = licensesDataRaw as Record<
  string,
  { licenses: string; repository?: string; licenseUrl?: string }
>;

const LICENSES: LicenseItem[] = Object.keys(rawData).map((key) => {
  const lastAtIndex = key.lastIndexOf('@');
  const name = lastAtIndex > 0 ? key.slice(0, lastAtIndex) : key;
  const version = lastAtIndex > 0 ? key.slice(lastAtIndex + 1) : '';
  const item = rawData[key];
  return {
    key,
    name,
    version,
    licenses: item.licenses,
    repository: item.repository,
    licenseUrl: item.licenseUrl,
  };
}).sort((a, b) => a.name.localeCompare(b.name));

export const LicensesScreen: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const filteredLicenses = useMemo(() => {
    if (!searchQuery) return LICENSES;
    const query = searchQuery.toLowerCase();
    return LICENSES.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.licenses.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const toggleExpand = (key: string) => {
    setExpandedKey(expandedKey === key ? null : key);
  };

  const handleOpenLink = async (url?: string) => {
    if (!url) return;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.warn('Could not open link:', error);
    }
  };

  const renderItem = ({ item }: { item: LicenseItem }) => {
    const isExpanded = expandedKey === item.key;

    return (
      <View style={[styles.card, isExpanded && styles.cardExpanded]}>
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => toggleExpand(item.key)}
          activeOpacity={0.7}
        >
          <View style={styles.headerInfo}>
            <Text style={styles.packageName} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.badgeRow}>
              <Text style={styles.versionText}>v{item.version}</Text>
              <View style={styles.licenseBadge}>
                <Text style={styles.licenseBadgeText}>{item.licenses}</Text>
              </View>
            </View>
          </View>
          <View style={styles.headerAction}>
            {isExpanded ? (
              <ChevronUp size={18} color={colors.gold} />
            ) : (
              <ChevronDown size={18} color={colors.text.secondary} />
            )}
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.cardBody}>
            <View style={styles.divider} />
            
            {item.repository && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Repository</Text>
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() => handleOpenLink(item.repository)}
                >
                  <Text style={styles.linkText} numberOfLines={1}>
                    {item.repository}
                  </Text>
                  <ExternalLink size={12} color={colors.gold} style={styles.linkIcon} />
                </TouchableOpacity>
              </View>
            )}

            {item.licenseUrl && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>License Terms</Text>
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() => handleOpenLink(item.licenseUrl)}
                >
                  <Text style={styles.linkText} numberOfLines={1}>
                    View License File
                  </Text>
                  <ExternalLink size={12} color={colors.gold} style={styles.linkIcon} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={18} color={colors.text.tertiary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search dependencies..."
            placeholderTextColor={colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <FlatList
        data={filteredLicenses}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No matching dependencies found.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080C10',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text.primary,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    height: '100%',
    padding: 0,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 10,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.08)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  cardExpanded: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(212, 175, 55, 0.22)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  headerInfo: {
    flex: 1,
    paddingRight: 8,
  },
  packageName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: colors.text.primary,
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  versionText: {
    fontFamily: 'RobotoMono-Regular',
    fontSize: 11,
    color: colors.text.tertiary,
  },
  licenseBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  licenseBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 9,
    color: colors.gold,
    letterSpacing: 0.5,
  },
  headerAction: {
    paddingLeft: 4,
  },
  cardBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    marginBottom: 12,
  },
  detailRow: {
    marginBottom: 10,
  },
  detailLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  linkText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: colors.gold,
    textDecorationLine: 'underline',
    flexShrink: 1,
  },
  linkIcon: {
    marginLeft: 4,
    flexShrink: 0,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.text.tertiary,
  },
});
