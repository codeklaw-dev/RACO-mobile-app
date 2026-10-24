import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/button';
import { Composer } from '@/components/composer';
import { ICONS, MenuIcon, NewChatIcon, PathIcon } from '@/components/icons';
import { SUGGESTIONS } from '@/lib/starters';
import { fonts, useTheme } from '@/theme';

const openChat = (prompt: string) => router.push({ pathname: '/chat/[id]', params: { id: 'new', prompt } });

/** A blank new chat: menu, new chat, a few suggestions above the prompt box. */
export default function Home() {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.background }}>
      <View style={{ flex: 1, paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 16) + 4, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <IconButton label="Open menu" onPress={() => router.push('/menu')}>
            <MenuIcon color={t.text} />
          </IconButton>
          <IconButton label="New chat" onPress={() => router.replace('/home')}>
            <NewChatIcon color={t.text} />
          </IconButton>
        </View>

        <View style={{ flex: 1 }} />

        <View style={{ paddingHorizontal: 8, paddingBottom: 12, gap: 2 }}>
          {SUGGESTIONS.map((s) => (
            <Pressable
              key={s.text}
              accessibilityRole="button"
              onPress={() => openChat(s.prompt)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 11, opacity: pressed ? 0.5 : 1 })}>
              <PathIcon d={ICONS[s.icon]} color={t.text} size={22} strokeWidth={1.6} />
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.body, fontSize: 17, color: t.sub }}>
                {s.text}
              </Text>
            </Pressable>
          ))}
        </View>
        <Composer onSend={openChat} onVoice={() => router.push('/voice-mode')} />
      </View>
    </KeyboardAvoidingView>
  );
}
