import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/button';
import { Composer } from '@/components/composer';
import { EdgeSwipe } from '@/components/edge-swipe';
import { Logo, MenuIcon, NewChatIcon } from '@/components/icons';
import { Welcome } from '@/components/welcome';
import { useTheme } from '@/theme';

const openChat = (prompt: string) => router.push({ pathname: '/chat/[id]', params: { id: 'new', prompt } });

/** A blank new chat (design 12b): menu, logo and new chat, the rolling welcome, the prompt box. */
export default function Home() {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.background }}>
      <EdgeSwipe>
        <View style={{ flex: 1, paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 16) + 4, paddingHorizontal: 16 }}>
          <View style={{ height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <IconButton label="Open menu" onPress={() => router.push('/menu')}>
              <MenuIcon color={t.text} />
            </IconButton>
            <Logo color={t.text} width={76} />
            <IconButton label="New chat" onPress={() => router.replace('/home')}>
              <NewChatIcon color={t.text} />
            </IconButton>
          </View>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Welcome />
          </View>
          <Composer onSend={openChat} onVoice={() => router.push('/voice-mode')} />
        </View>
      </EdgeSwipe>
    </KeyboardAvoidingView>
  );
}
