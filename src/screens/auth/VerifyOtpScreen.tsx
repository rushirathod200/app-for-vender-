import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { AppTextField } from '../../components/AppTextField';
import { SectionCard } from '../../components/SectionCard';
import { theme } from '../../config/theme';
import { useAuth } from '../../context/AuthContext';

interface VerifyOtpScreenProps {
  mobile: string;
  devOtp?: string;
  onBack: () => void;
}

export function VerifyOtpScreen({ mobile, devOtp, onBack }: VerifyOtpScreenProps) {
  const { verifyOtpCode, sendOtpCode } = useAuth();

  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const isOtpValid = useMemo(() => otpCode.length === 6, [otpCode]);

  const verify = async (): Promise<void> => {
    if (!isOtpValid) {
      setError('Enter the 6 digit OTP.');
      return;
    }

    setVerifying(true);
    setError(null);
    setInfoMessage(null);

    try {
      await verifyOtpCode(mobile, otpCode);
    } catch (verifyError) {
      const message = verifyError instanceof Error ? verifyError.message : 'OTP verification failed.';
      setError(message);
    } finally {
      setVerifying(false);
    }
  };

  const resendOtp = async (): Promise<void> => {
    setResending(true);
    setError(null);

    try {
      const result = await sendOtpCode(mobile);
      setInfoMessage(result.message);
    } catch (resendError) {
      const message = resendError instanceof Error ? resendError.message : 'Could not resend OTP.';
      setError(message);
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.heading}>Verify OTP</Text>
        <Text style={styles.subheading}>Code sent to {mobile}</Text>

        <SectionCard>
          <AppTextField
            label="OTP"
            keyboardType="number-pad"
            maxLength={6}
            value={otpCode}
            onChangeText={(value) => {
              setOtpCode(value.replace(/\D/g, '').slice(0, 6));
              if (error) {
                setError(null);
              }
            }}
            placeholder="Enter 6 digit OTP"
            error={error}
          />

          {devOtp ? (
            <View style={styles.devOtpBox}>
              <Text style={styles.devOtpLabel}>Dev OTP: {devOtp}</Text>
              <AppButton title="Use Dev OTP" onPress={() => setOtpCode(devOtp)} variant="ghost" />
            </View>
          ) : null}

          <AppButton title="Verify & Login" onPress={verify} loading={verifying} />

          <View style={styles.rowButtons}>
            <AppButton title="Resend OTP" onPress={resendOtp} loading={resending} variant="outline" />
            <AppButton title="Change Number" onPress={onBack} variant="ghost" />
          </View>

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
  },
  rowButtons: {
    gap: theme.spacing.sm,
  },
  infoText: {
    color: theme.colors.success,
    fontSize: 13,
  },
  devOtpBox: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    backgroundColor: '#f8fafc',
    gap: theme.spacing.xs,
  },
  devOtpLabel: {
    color: theme.colors.subtext,
    fontSize: 12,
  },
});
