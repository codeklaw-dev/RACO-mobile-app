import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnswerBar } from '@/components/answer-bar';
import { Button, IconButton } from '@/components/button';
import { CloseIcon } from '@/components/icons';
import { VoiceStage, type VoiceStatus } from '@/components/voice-stage';
import { toPlainText } from '@/lib/markdown';
import { speak, speechRecognitionAvailable, stopSpeaking, useHoldToTalk } from '@/lib/voice';
import { useSession } from '@/state/session';
import { useChat } from '@/state/use-chat';
import { fonts, useTheme } from '@/theme';

/**
 * Voice mode: the same canvas as onboarding, for any conversation. Replies
 * come from the normal chat (asked to be short and spoken) and are read
 * aloud; closing drops you into that chat with the full transcript.
 */
export default function VoiceMode() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const chat = useChat(id ?? null, undefined, 'voice');
  const [speaking, setSpeaking] = useState(false);
  const [typing, setTyping] = useState(!speechRecognitionAvailable());
  const [heard, setHeard] = useState<string | null>(null);
  // Replies already read aloud (including history loaded when the canvas opens).
  const spoken = useRef(new Set<string>());
  const historyMarked = useRef(false);

  const agent = profile?.agentName ?? 'Raco';
  const last = chat.messages.at(-1);
  const reply = last?.role === 'assistant' ? last : null;

  useFocusEffect(useCallback(() => () => stopSpeaking(), []));

  // Don't read out old messages when continuing an existing chat.
  useEffect(() => {
    if (chat.loading || historyMarked.current) return;
    historyMarked.current = true;
    chat.messages.forEach((m) => spoken.current.add(m.id));
  }, [chat.loading, chat.messages]);

  // Read each finished reply aloud once.
  useEffect(() => {
    if (!reply || reply.pending || !reply.content || spoken.current.has(reply.id)) return;
    spoken.current.add(reply.id);
    let cancelled = false;
    setSpeaking(true);
    void speak(toPlainText(reply.content)).then(() => !cancelled && setSpeaking(false));
    return () => {
      cancelled = true;
    };
  }, [reply]);

  const send = useCallback(
    (text: string) => {
      stopSpeaking();
      setSpeaking(false);
      setHeard(text);
      void chat.send(text);
    },
    [chat],
  );

  const mic = useHoldToTalk(send);
  const typingMode = typing || mic.unavailable;

  const stop = () => {
    stopSpeaking();
    setSpeaking(false);
    chat.stop();
  };

  const close = () => {
    stop();
    if (chat.conversationId) router.replace({ pathname: '/chat/[id]', params: { id: chat.conversationId } });
    else router.back();
  };

  const status: VoiceStatus = mic.listening
    ? 'listening'
    : chat.streaming && !reply?.content
      ? 'thinking'
      : speaking || chat.streaming
        ? 'speaking'
        : 'idle';

  const said = reply?.content
    ? toPlainText(reply.content)
    : `Hi${profile?.displayName ? ` ${profile.displayName}` : ''}. What's on your mind?`;

  const busy = speaking || chat.streaming;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.background }}>
      <VoiceStage
        status={status}
        said={said}
        top={insets.top + 8}
        footnote={
          mic.partial || heard ? (
            <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 15, color: t.faint, textAlign: 'center' }}>
              {mic.partial ? '' : 'You said: '}
              <Text style={{ fontFamily: fonts.bodySemibold }}>“{mic.partial || heard}”</Text>
            </Text>
          ) : null
        }
      />
      <View style={{ position: 'absolute', top: insets.top + 22, right: 22 }}>
        <IconButton label={chat.conversationId ? 'Close voice mode and open the chat' : 'Close voice mode'} onPress={close}>
          <CloseIcon color={t.text} />
        </IconButton>
      </View>

      <View style={{ paddingTop: 16, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 16) + 12, gap: 14 }}>
        {chat.error ? (
          <Text
            accessibilityLiveRegion="polite"
            style={{ marginHorizontal: 4, fontFamily: fonts.bodyMedium, fontSize: 14, color: t.faint }}>
            {chat.error}
          </Text>
        ) : (
          <Text style={{ marginHorizontal: 4, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: t.sub }}>
            {busy
              ? chat.streaming
                ? `${agent} is answering…`
                : `${agent} is speaking. Hold to talk to interrupt.`
              : `Talk to ${agent} about anything. It only listens while you hold the button.`}
          </Text>
        )}
        {busy ? <Button kind="glass" label="Stop" onPress={stop} /> : null}
        <AnswerBar
          typing={typingMode}
          micUnavailable={mic.unavailable}
          onType={() => setTyping((v) => !v)}
          listening={mic.listening}
          disabled={chat.streaming}
          onPressIn={mic.start}
          onPressOut={mic.stop}
          onSubmit={send}
          placeholder={`Message ${agent}`}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
