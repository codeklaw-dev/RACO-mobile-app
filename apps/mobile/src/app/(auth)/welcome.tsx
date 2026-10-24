import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Button } from '@/components/button';
import { AppleIcon, GoogleIcon, Logo, MailIcon } from '@/components/icons';
import { Screen } from '@/components/screen';
import { Body } from '@/components/text';
import { appleSignInAvailable, signInWithApple, signInWithGoogle } from '@/lib/auth';
import { config } from '@/lib/config';
import { supabase } from '@/lib/supabase';
import { fonts, useTheme } from '@/theme';

type Pending = 'apple' | 'google' | null;

/** 01 Welcome. */
export default function Welcome() {
  const t = useTheme();
  const [pending, setPending] = useState<Pending>(null);

  async function run(kind: Exclude<Pending, null>, action: () => Promise<unknown>) {
    setPending(kind);
    try {
      await action();
    } catch (err) {
      Alert.alert('Sign-in failed', (err as Error).message);
    } finally {
      setPending(null);
    }
  }

  const apple = () =>
    run('apple', async () => {
      const result = await signInWithApple();
      const givenName = result?.givenName;
      if (givenName) {
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          await supabase.from('profiles').update({ display_name: givenName }).eq('user_id', data.user.id).is('display_name', null);
        }
      }
    });

  return (
    <Screen
      scroll={false}
      footer={
        <>
          {appleSignInAvailable ? (
            <Button
              label="Continue with Apple"
              icon={<AppleIcon color={t.primary.color} />}
              loading={pending === 'apple'}
              disabled={!!pending}
              onPress={apple}
            />
          ) : null}
          <Button
            kind={appleSignInAvailable ? 'glass' : 'primary'}
            label="Continue with Google"
            icon={<GoogleIcon />}
            loading={pending === 'google'}
            disabled={!!pending}
            onPress={() => run('google', signInWithGoogle)}
          />
          <Button
            kind="glass"
            label="Sign up with email"
            icon={<MailIcon color={t.text} />}
            disabled={!!pending}
            onPress={() => router.push('/sign-up')}
          />
          <Text style={{ marginTop: 10, textAlign: 'center', fontSize: 15, fontFamily: fonts.body, color: t.sub }}>
            Already have an account?{' '}
            <Text accessibilityRole="link" onPress={() => router.push('/log-in')} style={{ fontFamily: fonts.bodySemibold, color: t.text }}>
              Log in
            </Text>
          </Text>
          <Text style={{ textAlign: 'center', fontSize: 12, lineHeight: 17, fontFamily: fonts.body, color: t.faint }}>
            By continuing you agree to the{' '}
            <Text accessibilityRole="link" style={{ textDecorationLine: 'underline' }} onPress={() => WebBrowser.openBrowserAsync(config.termsUrl)}>
              Terms
            </Text>{' '}
            and{' '}
            <Text accessibilityRole="link" style={{ textDecorationLine: 'underline' }} onPress={() => WebBrowser.openBrowserAsync(config.privacyUrl)}>
              Privacy Policy
            </Text>
            .
          </Text>
        </>
      }>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 }}>
        <Logo color={t.text} />
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Text
            accessibilityRole="header"
            style={{ fontFamily: fonts.display, fontSize: 32, lineHeight: 38, letterSpacing: -0.6, color: t.text, textAlign: 'center' }}>
            Think it. Ask it.{'\n'}Get it done.
          </Text>
          <Body tone="sub" style={{ textAlign: 'center', maxWidth: 290 }}>
            Your private AI assistant for work, study and everything in between.
          </Body>
        </View>
      </View>
    </Screen>
  );
}
