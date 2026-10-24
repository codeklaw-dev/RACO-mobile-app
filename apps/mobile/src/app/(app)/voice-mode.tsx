import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/button';
import { ICONS, PathIcon, SendIcon } from '@/components/icons';
import { VoiceOrb, type OrbState } from '@/components/voice-orb';
import { toPlainText } from '@/lib/markdown';
import { speakQueued, stopSpeaking, useConversationMic } from '@/lib/voice';
import { useSession } from '@/state/session';
import { useChat } from '@/state/use-chat';
import { accent, fonts, noWebOutline, useTheme } from '@/theme';

/** Splits finished sentences off a reply that's still streaming in. */
function takeSentences(text: string, from: number): [string, number] {
  const rest = text.slice(from);
  const re = /[.!?…:](?=\s)|\n/g;
  let end = -1;
  for (let m = re.exec(rest); m; m = re.exec(rest)) end = m.index + 1;
  return end < 0 ? ['', from] : [rest.slice(0, end), from + end];
}

/**
 * Voice mode: a hands-free conversation. Raco listens until you pause,
 * answers out loud sentence by sentence while the reply streams in, then
 * listens again. Tap the orb to interrupt. In Expo Go, where speech
 * recognition isn't available, you type and Raco still answers out loud.
 */
export default function VoiceMode() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const chat = useChat(id ?? null, undefined, 'voice');
  const agent = profile?.agentName ?? 'Raco';

  const level = useSharedValue(0);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [heard, setHeard] = useState('');
  const [typed, setTyped] = useState('');
  const queued = useRef(0);
  const spokenUpTo = useRef(0);
  const replyId = useRef<string | null>(null);
  const historyIds = useRef<Set<string> | null>(null);

  const send = useCallback(
    (text: string) => {
      stopSpeaking();
      queued.current = 0;
      setSpeaking(false);
      setHeard(text);
      void chat.send(text);
    },
    [chat],
  );

  const mic = useConversationMic({ onFinal: send, onVolume: (v) => level.set(withTiming(v, { duration: 90 })) });
  const handsFree = mic.available;
  // Effects reach the mic through a ref; the hook's object is new every render.
  const micRef = useRef(mic);
  useEffect(() => {
    micRef.current = mic;
  });

  const say = useCallback((text: string) => {
    const plain = toPlainText(text);
    if (!plain) return;
    queued.current += 1;
    setSpeaking(true);
    void speakQueued(plain, () => {
      queued.current = Math.max(0, queued.current - 1);
      if (queued.current === 0) setSpeaking(false);
    });
  }, []);

  // Messages already in the chat when voice mode opens are never read out.
  useEffect(() => {
    if (!chat.loading && !historyIds.current) historyIds.current = new Set(chat.messages.map((m) => m.id));
  }, [chat.loading, chat.messages]);

  // Read the reply aloud as it streams: each finished sentence, then the rest.
  const reply = chat.messages.at(-1);
  useEffect(() => {
    if (!reply || reply.role !== 'assistant' || !historyIds.current || historyIds.current.has(reply.id)) return;
    if (replyId.current !== reply.id && reply.pending) {
      replyId.current = reply.id;
      spokenUpTo.current = 0;
    }
    if (reply.pending) {
      const [chunk, next] = takeSentences(reply.content, spokenUpTo.current);
      if (chunk) {
        spokenUpTo.current = next;
        say(chunk);
      }
    } else if (spokenUpTo.current < reply.content.length) {
      say(reply.content.slice(spokenUpTo.current));
      spokenUpTo.current = reply.content.length;
      historyIds.current.add(reply.id);
    }
  }, [reply, say]);

  // Hands-free: listen whenever Raco is quiet and the mic isn't muted.
  const quiet = !speaking && !chat.streaming && !mic.listening;
  useEffect(() => {
    if (handsFree && quiet && !muted && !chat.loading) void micRef.current.listen();
  }, [handsFree, quiet, muted, chat.loading]);

  useFocusEffect(
    useCallback(
      () => () => {
        stopSpeaking();
        micRef.current.cancel();
      },
      [],
    ),
  );

  const interrupt = () => {
    stopSpeaking();
    queued.current = 0;
    setSpeaking(false);
    if (chat.streaming) chat.stop();
  };

  const toggleMute = () => {
    if (!muted) mic.cancel();
    setMuted((m) => !m);
  };

  const close = () => {
    interrupt();
    mic.cancel();
    if (chat.conversationId) router.replace({ pathname: '/chat/[id]', params: { id: chat.conversationId } });
    else router.back();
  };

  const state: OrbState =
    muted && !speaking && !chat.streaming
      ? 'muted'
      : mic.listening
        ? 'listening'
        : chat.streaming && !reply?.content
          ? 'thinking'
          : speaking || chat.streaming
            ? 'speaking'
            : 'idle';

  const status = {
    idle: handsFree ? 'Starting…' : `Type to talk to ${agent}`,
    listening: 'Listening',
    thinking: 'Thinking',
    speaking: 'Tap to interrupt',
    muted: 'Microphone off',
  }[state];

  const caption =
    state === 'listening'
      ? mic.partial
      : state === 'speaking' && reply?.role === 'assistant'
        ? lastSentences(toPlainText(reply.content))
        : (chat.error ?? (heard ? `“${heard}”` : `Hi${profile?.displayName ? ` ${profile.displayName}` : ''}. What’s on your mind?`));

  const submitTyped = () => {
    const text = typed.trim();
    if (!text || chat.streaming) return;
    setTyped('');
    send(text);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.background }}>
      <View style={{ flex: 1, paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
        <View style={{ height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
          <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 16, color: t.text }}>Voice</Text>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 28 }}>
          <VoiceOrb
            state={state}
            level={level}
            label={state === 'speaking' || state === 'thinking' ? 'Interrupt' : status}
            onPress={state === 'speaking' || state === 'thinking' ? interrupt : undefined}
          />
          <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: t.faint }}>
            {status}
          </Text>
          <Text
            numberOfLines={4}
            accessibilityLiveRegion="polite"
            style={{
              minHeight: 84,
              fontFamily: fonts.display,
              fontSize: 21,
              lineHeight: 28,
              letterSpacing: -0.3,
              color: t.text,
              textAlign: 'center',
            }}>
            {caption}
          </Text>
        </View>

        {handsFree ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 40 }}>
            <IconButton label={muted ? 'Turn microphone on' : 'Turn microphone off'} size={64} onPress={toggleMute}>
              <PathIcon d={muted ? ICONS.micOff : ICONS.mic} color={muted ? accent : t.text} size={24} strokeWidth={1.8} />
            </IconButton>
            <IconButton label={chat.conversationId ? 'End voice and open the chat' : 'End voice'} size={64} onPress={close}>
              <PathIcon d={ICONS.close} color={t.text} size={22} strokeWidth={2} />
            </IconButton>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, gap: 10 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                borderRadius: 28,
                padding: 8,
                paddingLeft: 18,
                backgroundColor: t.tile,
              }}>
              <TextInput
                value={typed}
                onChangeText={setTyped}
                onSubmitEditing={submitTyped}
                placeholder={`Message ${agent}`}
                placeholderTextColor={t.faint}
                accessibilityLabel="Message"
                returnKeyType="send"
                selectionColor={accent}
                style={[{ flex: 1, height: 40, fontFamily: fonts.body, fontSize: 17, color: t.text }, noWebOutline]}
              />
              <IconButton kind="accent" size={40} label="Send" disabled={!typed.trim() || chat.streaming} onPress={submitTyped}>
                <SendIcon color="#2A2A2B" />
              </IconButton>
              <IconButton size={40} label={chat.conversationId ? 'End voice and open the chat' : 'End voice'} onPress={close}>
                <PathIcon d={ICONS.close} color={t.text} size={18} strokeWidth={2} />
              </IconButton>
            </View>
            <Text style={{ textAlign: 'center', fontFamily: fonts.body, fontSize: 13, color: t.faint }}>
              Talking needs the full Raco app. In Expo Go, type and {agent} answers out loud.
            </Text>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

/** The last couple of sentences, for the caption under the orb. */
function lastSentences(text: string): string {
  const parts = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  return parts.slice(-2).join('').trim();
}
