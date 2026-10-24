import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Button, IconButton } from '@/components/button';
import { EyeIcon } from '@/components/icons';
import { Screen } from '@/components/screen';
import { surfaceStyle, useSurface } from '@/components/surface';
import { Body, Title } from '@/components/text';
import { isValidEmail, sendEmailCode, signInWithPassword } from '@/lib/auth';
import { accent, fonts, noWebOutline, useTheme } from '@/theme';

/**
 * 04 Log in. Accounts made with an email code have no password, so
 * "Email me a code instead" covers them (and anyone who forgot theirs).
 */
export default function LogIn() {
  const t = useTheme();
  const field = useSurface('field');
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'password' | 'code' | null>(null);

  const cleanEmail = email.trim().toLowerCase();

  async function logIn() {
    if (!isValidEmail(cleanEmail) || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy('password');
    setError(null);
    try {
      await signInWithPassword(cleanEmail, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function emailCode() {
    if (!isValidEmail(cleanEmail)) {
      setError('Enter your email first, then we can send you a code.');
      return;
    }
    setBusy('code');
    setError(null);
    try {
      await sendEmailCode(cleanEmail);
      router.push({ pathname: '/verify', params: { email: cleanEmail } });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const inputStyle = { height: 26, padding: 0, fontSize: 17, fontFamily: fonts.body, color: t.text, ...noWebOutline };

  return (
    <Screen
      header="back"
      footer={
        <>
          <Button label="Log in" loading={busy === 'password'} disabled={!!busy} onPress={logIn} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 6 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: t.hairline }} />
            <Text style={{ fontSize: 13, fontFamily: fonts.body, color: t.faint }}>or</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: t.hairline }} />
          </View>
          <Button kind="glass" label="Email me a code instead" loading={busy === 'code'} disabled={!!busy} onPress={emailCode} />
        </>
      }>
      <View style={{ gap: 8, marginTop: 24 }}>
        <Title>Welcome back</Title>
        <Body tone="sub">Log in to pick up where you left off.</Body>
      </View>

      <View style={[surfaceStyle(field), { marginTop: 32, borderRadius: 14 }]}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 2 }}>
          <Text nativeID="li-email" style={{ fontSize: 12, fontFamily: fonts.bodySemibold, color: t.faint }}>
            Email
          </Text>
          <TextInput
            accessibilityLabelledBy="li-email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            selectionColor={accent}
            style={inputStyle}
          />
        </View>
        <View style={{ height: 1, marginLeft: 16, backgroundColor: t.hairline }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 6, paddingVertical: 10 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text nativeID="li-pass" style={{ fontSize: 12, fontFamily: fonts.bodySemibold, color: t.faint }}>
              Password
            </Text>
            <TextInput
              ref={passwordRef}
              accessibilityLabelledBy="li-pass"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!reveal}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={logIn}
              selectionColor={accent}
              style={inputStyle}
            />
          </View>
          <IconButton kind="plain" label={reveal ? 'Hide password' : 'Show password'} onPress={() => setReveal((r) => !r)}>
            <EyeIcon color={t.text} />
          </IconButton>
        </View>
      </View>

      {error ? (
        <Text accessibilityLiveRegion="polite" style={{ marginTop: 14, marginHorizontal: 4, fontFamily: fonts.bodyMedium, fontSize: 14, color: t.scheme === 'light' ? '#B42318' : '#FF8A80' }}>
          {error}
        </Text>
      ) : null}

    </Screen>
  );
}
