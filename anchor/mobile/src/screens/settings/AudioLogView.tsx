import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { clearSfxLog, getSfxLog, isSfxLogEnabled } from '@/services/audio/sfxLog';

export function AudioLogView({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    if (!visible || !isSfxLogEnabled()) return undefined;
    const refresh = () => setLines(getSfxLog());
    refresh();
    const timer = setInterval(refresh, 250);
    return () => clearInterval(timer);
  }, [visible]);

  if (!isSfxLogEnabled()) return null;

  const handleShare = () => {
    void Share.share({ message: getSfxLog().join('\n') || 'No audio diagnostics recorded.' });
  };
  const handleClear = () => {
    clearSfxLog();
    setLines([]);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>Audio log</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close audio log" onPress={onClose} style={styles.action}>
            <Text style={styles.actionText}>Close</Text>
          </Pressable>
        </View>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={handleShare} style={styles.action}>
            <Text style={styles.actionText}>Share</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={handleClear} style={styles.action}>
            <Text style={styles.actionText}>Clear</Text>
          </Pressable>
        </View>
        <ScrollView testID="audio-log-scroll" contentContainerStyle={styles.logContent}>
          <Text selectable style={styles.logText}>{lines.join('\n') || 'No audio diagnostics recorded.'}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#11110F', paddingTop: 56 },
  header: { minHeight: 52, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#F6F0E4', fontSize: 20, fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingHorizontal: 20, paddingVertical: 12 },
  action: { minHeight: 40, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 8, backgroundColor: '#2C2B27' },
  actionText: { color: '#F6F0E4', fontSize: 14, fontWeight: '600' },
  logContent: { paddingHorizontal: 20, paddingBottom: 30 },
  logText: { color: '#E7DCC7', fontFamily: 'monospace', fontSize: 12, lineHeight: 18 },
});
