import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../context/AuthContext';
import { ActionButton, Field } from '../shared/ui';
import { tokens } from '../shared/tokens';

export function StyledLoginScreen() {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTabletWidth = width >= 768;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const showLoginAlert = (title: string, message: string): void => {
    Alert.alert(title, message);
  };

  const onLogin = async (): Promise<void> => {
    Keyboard.dismiss();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail.includes('@')) {
      showLoginAlert('Invalid Email', 'Enter a valid email address.');
      return;
    }

    if (password.trim().length < 6) {
      showLoginAlert('Invalid Password', 'Enter your password.');
      return;
    }

    setLoading(true);

    try {
      await login({ email: normalizedEmail, password });
    } catch (loginError) {
      showLoginAlert('Login Failed', loginError instanceof Error ? loginError.message : 'Could not login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + 10, 24),
            paddingBottom: Math.max(insets.bottom + 24, 34),
            paddingHorizontal: isTabletWidth ? 32 : 16,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.loginPanel, isTabletWidth ? styles.loginPanelTablet : null]}>
          <View style={styles.heroCard}>
            <View style={styles.heroIconWrap}>
              <MaterialCommunityIcons name="shopping-outline" size={30} color="#ffffff" />
            </View>
            <Text style={styles.heroTitle}>DeskDrop</Text>
            <Text style={styles.heroSubtitle}>Vendor & Delivery Partner App</Text>
          </View>

          <View style={styles.formWrap}>
            <Text style={styles.formTitle}>Welcome Back!</Text>
            <Text style={styles.formSubTitle}>Sign in with your vendor email and password</Text>

            <Field
              label="Email Address"
              value={email}
              onChangeText={setEmail}
              icon="mail-outline"
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="Enter your email"
              returnKeyType="next"
            />

            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              icon="lock-closed-outline"
              placeholder="Enter your password"
              secureTextEntry={!showPassword}
              rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
              onRightIconPress={() => setShowPassword((value) => !value)}
              returnKeyType="done"
              onSubmitEditing={() => {
                void onLogin();
              }}
            />

            <ActionButton label={loading ? 'Logging in...' : 'Login'} onPress={() => void onLogin()} disabled={loading} />

            <View style={styles.roleInfoWrap}>
              <Ionicons name="bag-handle-outline" size={15} color={tokens.colors.vendorPrimary} />
              <Text style={styles.roleInfoText}>Vendor and delivery accounts can sign in here</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.colors.appBg,
  },
  scrollContent: {
    gap: 12,
    alignItems: 'center',
  },
  loginPanel: {
    width: '100%',
    maxWidth: 460,
    gap: 12,
  },
  loginPanelTablet: {
    maxWidth: 520,
    paddingTop: 20,
  },
  heroCard: {
    backgroundColor: '#ece5dd',
    borderRadius: 28,
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: 'center',
    gap: 8,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: tokens.colors.vendorPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    marginTop: 4,
    color: '#1f1f24',
    fontSize: 20,
    fontWeight: '900',
  },
  heroSubtitle: {
    color: '#777781',
    fontSize: 13,
    fontWeight: '600',
  },
  formWrap: {
    backgroundColor: '#f8f8f9',
    borderRadius: 22,
    padding: 14,
    gap: 12,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#222226',
  },
  formSubTitle: {
    marginTop: -4,
    fontSize: 13,
    color: '#7f7f89',
    fontWeight: '600',
  },
  roleInfoWrap: {
    borderWidth: 1,
    borderColor: '#ffe2cc',
    borderRadius: 16,
    backgroundColor: '#fff7f0',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleInfoText: {
    color: tokens.colors.vendorPrimary,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
});
