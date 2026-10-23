import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Composer } from '@/components/composer';
import { ArrowUpRightIcon, Logo } from '@/components/icons';
import { surfaceStyle, useSurface } from '@/components/surface';
import { TopBar } from '@/components/top-bar';
import { greeting, humanList } from '@/lib/greeting';
import { SUGGESTIONS, startersFor } from '@/lib/starters';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/state/session';
import { fonts, useTheme } from '@/theme';

const openChat = (prompt: string) => router.push({ pathname: '/chat/[id]', params: { id: 'new', prompt } });

/**
 * 12 Welcome home. On the very first visit (no chats yet) it shows the
 * 13 First message intro instead, with starters from onboarding picks.
 */
export default function Home() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const [firstRun, setFirstRun] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      void supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .then(({ count }) => setFirstRun((count ?? 0) === 0));
    }, []),
  );

  const agent = profile?.agentName ?? 'Raco';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.background }}>
      <View style={{ flex: 1, paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) + 8, paddingHorizontal: 16 }}>
        <TopBar
          center={
            firstRun ? (
              <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 17, color: t.text }}>Welcome to {agent}</Text>
            ) : (
              <Logo color={t.text} width={76} />
            )
          }
        />
        {firstRun ? <FirstRunIntro agent={agent} /> : firstRun === false ? <Greeting /> : <View style={{ flex: 1 }} />}
        <Composer onSend={openChat} />
      </View>
    </KeyboardAvoidingView>
  );
}

function Greeting() {
  const t = useTheme();
  const glass = useSurface('glass');
  const { profile } = useSession();
  const display = { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, letterSpacing: -0.6 } as const;

  return (
    <>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 8, gap: 8 }}>
        <Text accessibilityRole="header" style={[display, { color: t.text }]}>
          {greeting(profile?.displayName)}
        </Text>
        <Text style={[display, { color: t.faint }]}>How can I help today?</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        {SUGGESTIONS.map((s) => (
          <Pressable
            key={s.title}
            accessibilityRole="button"
            accessibilityLabel={`${s.title}. ${s.body}`}
            onPress={() => openChat(s.prompt)}
            style={({ pressed }) => [
              surfaceStyle(glass),
              { flexBasis: '48%', flexGrow: 1, minHeight: 76, borderRadius: 16, padding: 14, gap: 3, opacity: pressed ? 0.8 : 1 },
            ]}>
            <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 15, color: t.text }}>{s.title}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 13, lineHeight: 17, color: t.sub }}>{s.body}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

function FirstRunIntro({ agent }: { agent: string }) {
  const t = useTheme();
  const glass = useSurface('glass');
  const { profile } = useSession();
  const interests = profile?.interests ?? [];
  const body = { fontFamily: fonts.body, fontSize: 17, lineHeight: 25, color: t.text } as const;

  return (
    <View style={{ flex: 1, paddingTop: 24, paddingHorizontal: 4, paddingBottom: 16, gap: 18 }}>
      <View style={{ gap: 10 }}>
        <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 14, color: t.text }}>{agent}</Text>
        <Text style={body}>
          Hi{profile?.displayName ? ` ${profile.displayName}` : ''}, I’m {agent}.
        </Text>
        <Text style={body}>
          I can help you write, research, study, plan and think things through. Ask me anything, or pick one of these to start.
        </Text>
        {interests.length ? (
          <Text style={body}>
            Since you picked{' '}
            <Text style={{ fontFamily: fonts.bodySemibold }}>{humanList(interests.map((i) => i.toLowerCase()))}</Text>, here are a
            few ways to start:
          </Text>
        ) : null}
      </View>
      <View style={{ gap: 8 }}>
        {startersFor(interests).map((q) => (
          <Pressable
            key={q}
            accessibilityRole="button"
            onPress={() => openChat(q)}
            style={({ pressed }) => [
              surfaceStyle(glass),
              { minHeight: 50, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.8 : 1 },
            ]}>
            <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 15, color: t.text }}>{q}</Text>
            <ArrowUpRightIcon color={t.text} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
