import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { logger } from '@/utils/logger';
import { reloadCurrentApp } from '@/services/reloadCurrentApp';

export function StartupRestoreFailure() {
  const [retryFailed, setRetryFailed] = useState(false);

  const retry = async () => {
    setRetryFailed(false);
    try {
      await reloadCurrentApp();
    } catch (error) {
      logger.error('[Startup] App restart failed after local restore error', error);
      setRetryFailed(true);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Unable to restore saved data</Text>
      <Text style={styles.message}>
        {retryFailed
          ? 'Restart did not begin. Close and reopen Anchor to try again.'
          : 'Anchor could not finish restoring local account data. Restart to try again.'}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Restart Anchor and try again"
        onPress={() => { void retry(); }}
        style={styles.button}
      >
        <Text style={styles.buttonText}>Restart and try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#08111F',
  },
  title: {
    color: '#F5F0E8',
    fontSize: 21,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    color: '#D1D5DB',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#C7A64A',
  },
  buttonText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
  },
});
