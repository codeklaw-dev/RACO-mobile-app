import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View, type TextInputInstance } from 'react-native';
import { Button } from '@/components/button';
import { ChevronRightIcon, MailIcon } from '@/components/icons';
import { Screen } from '@/components/screen';
import { surfaceStyle, useSurface } from '@/components/surface';
import { Body, Title } from '@/components/text';
import { sendEmailCode, verifyEmailCode } from '@/lib/auth';
import { accent, fonts, useTheme } from '@/theme';

const LENGTH = 6;
const RESEND_SECONDS = 30;

/** 03 Verify code. A successful verify signs the user in; the root layout then routes on. */
export default function Verify() {
  const t = useTheme();
  const field = useSurface('field');
  const glass = useSurface('glass');
  const { email } = useLocalSearchParams<{ email: string }>();
  const input = useRef<TextInputInstance>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [wait, setWait] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  async function verify(value = code) {
    if (value.length !== LENGTH || verifying) return;
    setVerifying(true);
    setError(null);
    try {
      await verifyEmailCode(email, value);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError((err as Error).message);
      setCode('');
      input.current?.focus();
    } finally {
      setVerifying(false);
    }
  }

  async function resend() {
    setWait(RESEND_SECONDS);
    try {
      await sendEmailCode(email);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const openMail = () => void Linking.openURL(Platform.OS === 'ios' ? 'message://' : 'mailto:').catch(() => {});

  return (
    <Screen
      header="back"
      footer={
        <>
          <Pressable
            accessibilityRole="button"
            onPress={openMail}
            style={[surfaceStyle(glass), { height: 54, borderRadius: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
            <MailIcon color={t.text} size={22} />
            <Text style={{ flex: 1, fontFamily: fonts.bodyMedium, fontSize: 16, color: t.text }}>Open Mail app</Text>
            <ChevronRightIcon color={t.text} />
          </Pressable>
          <Button label="Verify" loading={verifying} disabled={code.length !== LENGTH} onPress={() => verify()} />
        </>
      }>
      <View style={{ gap: 8, marginTop: 24 }}>
        <Title>Check your email</Title>
        <Body tone="sub">
          Enter the code we sent to <Text style={{ fontFamily: fonts.bodySemibold }}>{email}</Text>
        </Body>
      </View>

      <Pressable
        accessibilityLabel="6-digit code"
        onPress={() => input.current?.focus()}
        style={{ flexDirection: 'row', gap: 10, marginTop: 36 }}>
        {Array.from({ length: LENGTH }, (_, i) => {
          const active = i === Math.min(code.length, LENGTH - 1) && !verifying;
          return (
            <View
              key={i}
              style={[
                surfaceStyle(field),
                { width: 48, height: 60, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
                active ? { borderColor: accent, borderWidth: 1.5, boxShadow: '0 0 0 4px rgba(252,121,101,0.18)' } : null,
              ]}>
              <Text style={{ fontFamily: fonts.display, fontSize: 26, color: t.text }}>{code[i] ?? ''}</Text>
            </View>
          );
        })}
      </Pressable>
      {/* One hidden input drives the six boxes, so paste and SMS/email autofill work. */}
      <TextInput
        ref={input}
        value={code}
        onChangeText={(v) => {
          const digits = v.replace(/\D/g, '').slice(0, LENGTH);
          setCode(digits);
          if (error) setError(null);
          if (digits.length === LENGTH) void verify(digits);
        }}
        autoFocus
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={LENGTH}
        accessibilityLabel="Verification code"
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
      />

      {error ? (
        <Text accessibilityLiveRegion="polite" style={{ marginTop: 16, marginHorizontal: 4, fontFamily: fonts.bodyMedium, fontSize: 14, color: t.scheme === 'light' ? '#B42318' : '#FF8A80' }}>
          {error}
        </Text>
      ) : null}

      <Text style={{ marginTop: 22, marginHorizontal: 4, fontSize: 15, fontFamily: fonts.body, color: t.sub }}>
        Didn’t get it?{' '}
        {wait > 0 ? (
          <Text style={{ fontFamily: fonts.bodySemibold }}>Resend in 0:{String(wait).padStart(2, '0')}</Text>
        ) : (
          <Text accessibilityRole="button" onPress={resend} style={{ fontFamily: fonts.bodySemibold, color: t.text }}>
            Resend code
          </Text>
        )}
      </Text>
    </Screen>
  );
}
