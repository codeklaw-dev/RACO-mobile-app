/**
 * App Review Guideline 5.1.2(i): before anything the user says or types is
 * sent to the AI service, say who receives it and ask explicitly. The answer
 * is saved on the profile and can be withdrawn in Settings; the API refuses
 * chat without it.
 *
 * The question is an in-app sheet rather than a system dialog, so it looks
 * the same everywhere (web previews block browser dialogs).
 */
import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { useSession } from '@/state/session';
import { fonts, useTheme } from '@/theme';
import { config } from './config';

export function aiDisclosure(agentName: string): string {
  return `To answer you, ${agentName} sends your messages, voice transcripts and the profile details you give it (your name and interests) to ${config.aiProvider}, an AI service, which generates the replies. You can turn this off at any time in Settings.`;
}

const AskContext = createContext<() => Promise<boolean>>(async () => false);

/** Hosts the consent sheet; wrap the app in it, inside SessionProvider. */
export function AiConsentProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const ask = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false);
        resolver.current = resolve;
        setOpen(true);
      }),
    [],
  );

  const answer = (ok: boolean) => {
    setOpen(false);
    resolver.current?.(ok);
    resolver.current = null;
  };

  return (
    <AskContext.Provider value={ask}>
      {children}
      {open ? <ConsentSheet onAnswer={answer} /> : null}
    </AskContext.Provider>
  );
}

function ConsentSheet({ onAnswer }: { onAnswer: (ok: boolean) => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const agent = profile?.agentName ?? 'Raco';

  return (
    <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'flex-end' }}>
      <Animated.View entering={FadeIn.duration(200)} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.3)' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Not now" onPress={() => onAnswer(false)} style={{ flex: 1 }} />
      </Animated.View>
      <Animated.View
        entering={SlideInDown.duration(260)}
        accessibilityViewIsModal
        style={{
          backgroundColor: t.background,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingTop: 24,
          paddingHorizontal: 24,
          paddingBottom: Math.max(insets.bottom, 16) + 8,
          gap: 14,
          boxShadow: '0 -8px 40px rgba(0,0,0,0.15)',
        }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: t.text }}>
          Before you start
        </Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: t.sub }}>{aiDisclosure(agent)}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: t.sub }}>
          {agent} can make mistakes, so check anything important.{' '}
          <Text accessibilityRole="link" onPress={() => void WebBrowser.openBrowserAsync(config.privacyUrl)} style={{ color: t.text, textDecorationLine: 'underline' }}>
            Privacy Policy
          </Text>
        </Text>
        <View style={{ gap: 4, marginTop: 6 }}>
          <Button label="Agree and continue" onPress={() => onAnswer(true)} />
          <Pressable accessibilityRole="button" onPress={() => onAnswer(false)} style={{ alignSelf: 'center', padding: 12 }}>
            <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 16, color: t.text }}>Not now</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

export function useAiConsent() {
  const { profile, updateProfile } = useSession();
  const ask = useContext(AskContext);
  const consented = Boolean(profile?.aiConsentAt);

  /** True once the user has agreed to AI processing, asking first if needed. */
  const ensure = useCallback(async () => {
    if (profile?.aiConsentAt) return true;
    if (!(await ask())) return false;
    await updateProfile({ aiConsentAt: new Date().toISOString() });
    return true;
  }, [profile?.aiConsentAt, ask, updateProfile]);

  const withdraw = useCallback(() => updateProfile({ aiConsentAt: null }), [updateProfile]);

  return { consented, ensure, withdraw };
}
