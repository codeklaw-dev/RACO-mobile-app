import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Composer } from '@/components/composer';
import { CenteredSpinner, MessageList } from '@/components/message-list';
import { TopBar } from '@/components/top-bar';
import { useSession } from '@/state/session';
import { useChat } from '@/state/use-chat';
import { fonts, useTheme } from '@/theme';

/** A conversation. `id` is "new" for a fresh chat, with the first message in `prompt`. */
export default function Chat() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const { id, prompt } = useLocalSearchParams<{ id: string; prompt?: string }>();
  const isNew = id === 'new';

  const chat = useChat(isNew ? null : id, (newId) => router.setParams({ id: newId, prompt: undefined }));
  const sentPrompt = useRef(false);

  useEffect(() => {
    if (isNew && prompt && !sentPrompt.current) {
      sentPrompt.current = true;
      void chat.send(prompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.background }}>
      <View style={{ flex: 1, paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
        <View style={{ paddingHorizontal: 16 }}>
          <TopBar center={null} />
        </View>
        {chat.loading ? (
          <CenteredSpinner />
        ) : (
          <View style={{ flex: 1 }}>
            <MessageList messages={chat.messages} agentName={profile?.agentName ?? 'Raco'} />
          </View>
        )}
        {chat.error ? (
          <Text
            accessibilityLiveRegion="polite"
            style={{ marginHorizontal: 20, marginBottom: 8, fontFamily: fonts.bodyMedium, fontSize: 14, color: t.scheme === 'light' ? '#B42318' : '#FF8A80' }}>
            {chat.error}
          </Text>
        ) : null}
        <View style={{ paddingHorizontal: 16 }}>
          <Composer onSend={chat.send} onStop={chat.stop} streaming={chat.streaming} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
