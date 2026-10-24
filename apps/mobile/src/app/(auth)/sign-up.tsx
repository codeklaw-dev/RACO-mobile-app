import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/button';
import { TextField } from '@/components/fields';
import { Screen } from '@/components/screen';
import { Body, Caption, Title } from '@/components/text';
import { isValidEmail, sendEmailCode } from '@/lib/auth';
import { fonts } from '@/theme';

/** 02 Sign up: email, then a 6-digit code (no password to remember). */
export default function SignUp() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit() {
    const value = email.trim().toLowerCase();
    if (!isValidEmail(value)) {
      setError('Enter a valid email address.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await sendEmailCode(value);
      router.push({ pathname: '/verify', params: { email: value } });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen header="back" footer={<Button label="Continue" loading={sending} disabled={!email} onPress={submit} />}>
      <View style={{ gap: 8, marginTop: 24 }}>
        <Title>Create your account</Title>
        <Body tone="sub">We’ll send a 6-digit code to confirm it’s you.</Body>
      </View>
      <View style={{ marginTop: 32 }}>
        <TextField
          label="Email"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            if (error) setError(null);
          }}
          error={error}
          autoFocus
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
      </View>
      <Caption style={{ fontFamily: fonts.body, marginTop: 14, marginHorizontal: 4 }}>
        Use your work email to unlock team features later.
      </Caption>
    </Screen>
  );
}
