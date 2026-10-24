import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/button';
import { Composer } from '@/components/composer';
import { EdgeSwipe } from '@/components/edge-swipe';
import { MenuIcon, NewChatIcon } from '@/components/icons';
import { CenteredSpinner, MessageList } from '@/components/message-list';
import { Welcome } from '@/components/welcome';
import { getProject } from '@/lib/data';
import { useChat } from '@/state/use-chat';
import { fonts, useTheme } from '@/theme';

/** A conversation. `id` is "new" for a fresh chat, with the first message in `prompt`. */
export default function Chat() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { id, prompt, projectId } = useLocalSearchParams<{ id: string; prompt?: string; projectId?: string }>();
  const isNew = id === 'new';

  const chat = useChat(isNew ? null : id, (newId) => router.setParams({ id: newId, prompt: undefined }), 'text', projectId);
  const sentPrompt = useRef(false);
  const [projectName, setProjectName] = useState<string | null>(null);

  useEffect(() => {
    if (isNew && prompt && !sentPrompt.current) {
      sentPrompt.current = true;
      void chat.send(prompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!chat.projectId) return;
    let active = true;
    void getProject(chat.projectId).then((p) => active && setProjectName(p?.name ?? null));
    return () => {
      active = false;
    };
  }, [chat.projectId]);

  const empty = !chat.loading && chat.messages.length === 0;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.background }}>
      <EdgeSwipe current={chat.conversationId}>
        <View style={{ flex: 1, paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 16) + 4 }}>
          <View style={{ height: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 }}>
            <IconButton
              label="Open menu"
              onPress={() => router.push({ pathname: '/menu', params: chat.conversationId ? { current: chat.conversationId } : {} })}>
              <MenuIcon color={t.text} />
            </IconButton>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text numberOfLines={1} style={{ fontFamily: fonts.bodySemibold, fontSize: 16, color: t.text }}>
                {chat.title ?? (empty ? 'New chat' : '')}
              </Text>
              {projectName ? (
                <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 12, color: t.faint }}>
                  {projectName}
                </Text>
              ) : null}
            </View>
            <IconButton label="New chat" onPress={() => router.replace('/home')}>
              <NewChatIcon color={t.text} />
            </IconButton>
          </View>

          {chat.loading ? (
            <CenteredSpinner />
          ) : empty ? (
            <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 16 }}>
              <Welcome note={projectName ? `This chat will be saved in ${projectName}.` : undefined} />
            </View>
          ) : (
            <MessageList
              messages={chat.messages}
              conversationId={chat.conversationId}
              footer={
                chat.error ? (
                  <View accessibilityLiveRegion="polite" style={{ gap: 10, alignItems: 'flex-start' }}>
                    <Text
                      style={{ fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: t.scheme === 'light' ? '#B42318' : '#FF8A80' }}>
                      {chat.error}
                    </Text>
                    {!chat.streaming ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={chat.retry}
                        style={({ pressed }) => ({
                          height: 36,
                          paddingHorizontal: 16,
                          borderRadius: 18,
                          justifyContent: 'center',
                          backgroundColor: pressed ? t.bubble : t.tile,
                        })}>
                        <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 14, color: t.text }}>Try again</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : undefined
              }
            />
          )}

          <View style={{ paddingHorizontal: 16, paddingTop: 6 }}>
            <Composer
              onSend={chat.send}
              onStop={chat.stop}
              streaming={chat.streaming}
              // Replace rather than push: closing voice mode reopens this chat with the new turns.
              onVoice={() => router.replace({ pathname: '/voice-mode', params: chat.conversationId ? { id: chat.conversationId } : {} })}
            />
          </View>
        </View>
      </EdgeSwipe>
    </KeyboardAvoidingView>
  );
}
