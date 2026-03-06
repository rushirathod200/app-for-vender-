import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { theme } from '../config/theme';

type Variant = 'primary' | 'outline' | 'danger' | 'ghost';

interface AppButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
}

const variantStyles: Record<Variant, { button: object; text: object; spinner: string }> = {
  primary: {
    button: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    text: { color: '#ffffff' },
    spinner: '#ffffff',
  },
  outline: {
    button: {
      backgroundColor: '#ffffff',
      borderColor: theme.colors.border,
    },
    text: { color: theme.colors.text },
    spinner: theme.colors.text,
  },
  danger: {
    button: {
      backgroundColor: theme.colors.danger,
      borderColor: theme.colors.danger,
    },
    text: { color: '#ffffff' },
    spinner: '#ffffff',
  },
  ghost: {
    button: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
    },
    text: { color: theme.colors.primary },
    spinner: theme.colors.primary,
  },
};

export function AppButton({ title, onPress, loading, disabled, variant = 'primary' }: AppButtonProps) {
  const state = variantStyles[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        state.button,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={state.spinner} />
      ) : (
        <Text style={[styles.text, state.text]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: theme.radius.md,
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
  },
});
