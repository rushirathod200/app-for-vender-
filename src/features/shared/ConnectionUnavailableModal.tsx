import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { tokens } from './tokens';

interface ConnectionUnavailableModalProps {
  visible: boolean;
  isRetrying: boolean;
  onRetry: () => void;
}

export function ConnectionUnavailableModal({
  visible,
  isRetrying,
  onRetry,
}: ConnectionUnavailableModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => undefined}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="cloud-offline-outline" size={34} color={tokens.colors.vendorPrimary} />
          </View>

          <Text style={styles.title}>Unable to Reach DeskDrop</Text>
          <Text style={styles.message}>
            We’re having trouble connecting right now. Please check your internet connection and try again.
          </Text>

          <Pressable
            accessibilityRole="button"
            disabled={isRetrying}
            onPress={onRetry}
            style={({ pressed }) => [
              styles.retryButton,
              pressed && !isRetrying ? styles.retryButtonPressed : null,
              isRetrying ? styles.retryButtonDisabled : null,
            ]}
          >
            {isRetrying ? (
              <>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={styles.retryText}>Checking...</Text>
              </>
            ) : (
              <>
                <Ionicons name="refresh-outline" size={19} color="#ffffff" />
                <Text style={styles.retryText}>Retry</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(20, 20, 24, 0.58)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderRadius: 24,
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  iconWrap: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 34,
    backgroundColor: tokens.colors.vendorSoft,
    marginBottom: 18,
  },
  title: {
    color: tokens.colors.text,
    fontSize: 21,
    fontWeight: '900',
    textAlign: 'center',
  },
  message: {
    marginTop: 8,
    color: tokens.colors.muted,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
    textAlign: 'center',
  },
  retryButton: {
    width: '100%',
    minHeight: 50,
    marginTop: 22,
    borderRadius: 15,
    backgroundColor: tokens.colors.vendorPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  retryButtonPressed: {
    opacity: 0.86,
  },
  retryButtonDisabled: {
    opacity: 0.72,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
});
