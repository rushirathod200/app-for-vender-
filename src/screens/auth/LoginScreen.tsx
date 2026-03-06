import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { AppTextField } from '../../components/AppTextField';
import { SectionCard } from '../../components/SectionCard';
import { theme } from '../../config/theme';
import { useAuth } from '../../context/AuthContext';
import { normalizeMobile } from '../../utils/format';

interface LoginScreenProps {
  onOtpSent: (mobile: string, devOtp?: string) => void;
}

export function LoginScreen({ onOtpSent }: LoginScreenProps) {
  const { sendOtpCode } = useAuth();

  const [mobile, setMobile] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (): Promise<void> => {
    const cleaned = normalizeMobile(mobile);

    if (cleaned.length !== 10) {
      setError('Enter a valid 10 digit mobile number.');
      return;
    }

    setLoading(true);
    setError(null);
    setInfoMessage(null);

    try {
      const result = await sendOtpCode(cleaned);
      setInfoMessage(result.message);
      onOtpSent(cleaned, result.devOtp);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Failed to send OTP.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.heading}>Vendor Login</Text>
        <Text style={styles.subheading}>Sign in with mobile OTP to manage menu stock and orders.</Text>

        <SectionCard>
          <AppTextField
            label="Mobile Number"
            keyboardType="number-pad"
            maxLength={10}
            value={mobile}
            onChangeText={(value) => {
              setMobile(normalizeMobile(value));
              if (error) {
                setError(null);
              }
            }}
            placeholder="Enter 10 digit mobile"
            error={error}
          />

          <AppButton title="Send OTP" loading={loading} onPress={submit} />

          {infoMessage ? <Text style={styles.infoText}>{infoMessage}</Text> : null}
        </SectionCard>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  content: {
    gap: theme.spacing.md,
  },
  heading: {
    fontSize: 28,
    color: theme.colors.text,
    fontWeight: '700',
  },
  subheading: {
    fontSize: 14,
    color: theme.colors.subtext,
    lineHeight: 20,
  },
  infoText: {
    color: theme.colors.success,
    fontSize: 13,
  },
});
