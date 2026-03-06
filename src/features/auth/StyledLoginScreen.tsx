import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAppWorkflow } from '../../context/AppWorkflowContext';
import { ActionButton, Field, ModePill } from '../shared/ui';
import { tokens } from '../shared/tokens';

export function StyledLoginScreen() {
  const { login } = useAppWorkflow();

  const [email, setEmail] = useState('vendor@cafeconnect.com');
  const [password, setPassword] = useState('1234');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onLogin = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await login({ email, password });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <ModePill text="👜 Login Screen" />

        <View style={styles.heroCard}>
          <View style={styles.heroIconWrap}>
            <MaterialCommunityIcons name="shopping-outline" size={30} color="#ffffff" />
          </View>
          <Text style={styles.heroTitle}>CafeConnect</Text>
          <Text style={styles.heroSubtitle}>Vendor & Delivery Partner App</Text>
        </View>

        <View style={styles.formWrap}>
          <Text style={styles.formTitle}>Welcome Back! 👋</Text>
          <Text style={styles.formSubTitle}>Sign in to manage your orders</Text>

          <Field
            label="Email Address"
            value={email}
            onChangeText={setEmail}
            icon="mail-outline"
            autoCapitalize="none"
            placeholder="Enter your email"
          />

          <Text style={styles.tip}>Tip: Use `vendor@...` for Vendor or any email for Delivery Partner</Text>

          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            icon="lock-closed-outline"
            placeholder="Enter your password"
            secureTextEntry={!showPassword}
            rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
            onRightIconPress={() => setShowPassword((value) => !value)}
          />

          <ActionButton label={loading ? 'Logging in...' : 'Login'} onPress={() => void onLogin()} disabled={loading} />

          <View style={styles.roleInfoWrap}>
            <Ionicons name="bag-handle-outline" size={15} color={tokens.colors.vendorPrimary} />
            <Text style={styles.roleInfoText}>Your role is determined by your account type</Text>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 30,
    gap: 12,
  },
  heroCard: {
    backgroundColor: '#ece5dd',
    borderRadius: 28,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  heroIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
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
  tip: {
    color: '#9a9aa1',
    fontSize: 11,
    lineHeight: 16,
    marginTop: -6,
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
  errorText: {
    marginTop: -6,
    color: tokens.colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
});
