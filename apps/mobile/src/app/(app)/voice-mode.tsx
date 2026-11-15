import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import { useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/button';
import { ICONS, PathIcon, SendIcon } from '@/components/icons';
import { VoiceOrb, type OrbState } from '@/components/voice-orb';
import { useAiConsent } from '@/lib/ai-consent';
import { toPlainText } from '@/lib/markdown';
import { speakQueued, stopSpeaking, useConversationMic } from '@/lib/voice';
import { takeSpeakable } from '@/lib/voice-activity';
import { SERVER_VOICE } from '@/lib/voice-server';
import { usePreferences } from '@/state/preferences';
import { useSession } from '@/state/session';
import { useChat } from '@/state/use-chat';
import { accent, fonts, noWebOutline, useTheme } from '@/theme';
import { HueGlow } from '@/vendor/voice-glow-native';

/**
 * Voice mode: a hands-free conversation. Raco listens until you pause (or
 * you tap the orb to send straight away), answers out loud while the reply
 * streams in, then listens again. Tap the orb while Raco thinks or talks to
 * interrupt. In Expo Go the AI service does the listening and talking, once
 * the user agrees to it; without that, or without speech recognition, you
 * type and Raco still answers out loud.
 */
export default function VoiceMode() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const chat = useChat(id ?? null, undefined, 'voice');
  const agent = profile?.agentName ?? 'Raco';
  const aiConsent = useAiConsent();
  // Expo Go hears through the AI service: ask once when voice mode opens.
  useEffect(() => {
    if (SERVER_VOICE) void aiConsent.ensure().catch(() => false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const level = useSharedValue(0);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [heard, setHeard] = useState('');
  const [typed, setTyped] = useState('');
  // Pieces of the reply queued to speak. A ref, so "is Raco still talking?"
  // is answered right now rather than at the next render.
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

  // Read the reply aloud as it streams: the first clause as soon as it's in,
  // then each finished sentence, then the rest.
  const reply = chat.messages.at(-1);
  useEffect(() => {
    if (!reply || reply.role !== 'assistant' || !historyIds.current || historyIds.current.has(reply.id)) return;
    if (replyId.current !== reply.id && reply.pending) {
      replyId.current = reply.id;
      spokenUpTo.current = 0;
    }
    if (reply.pending) {
      const [chunk, next] = takeSpeakable(reply.content, spokenUpTo.current);
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

  // Hands-free: listen again once Raco is quiet. The short wait lets the
  // reply's last words finish (and settle) before the mic opens, and the
  // check runs on refs, so a reply that's just been queued is never cut off.
  const streamingRef = useRef(chat.streaming);
  useEffect(() => {
    streamingRef.current = chat.streaming;
  }, [chat.streaming]);
  const quiet = !speaking && !chat.streaming && !mic.listening && !mic.transcribing;
  useEffect(() => {
    if (!handsFree || !quiet || muted || chat.loading || mic.failed) return;
    const timer = setTimeout(() => {
      if (queued.current === 0 && !streamingRef.current) void micRef.current.listen();
    }, 400);
    return () => clearTimeout(timer);
  }, [handsFree, quiet, muted, chat.loading, mic.failed]);

  // The background glow follows your voice while listening, and swells while
  // Raco thinks and talks.
  const { hue } = usePreferences();
  const glowBase = useSharedValue(0.25);
  useEffect(() => {
    glowBase.set(withTiming(speaking ? 0.75 : chat.streaming ? 0.55 : 0.25, { duration: 500 }));
  }, [speaking, chat.streaming, glowBase]);
  const glowLevel = useDerivedValue(() => Math.max(glowBase.value, level.value));

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

  const failed = mic.failed || (!!chat.error && !chat.streaming && !speaking);
  const state: OrbState =
    muted && !speaking && !chat.streaming
      ? 'muted'
      : mic.listening
        ? 'listening'
        : mic.transcribing || (chat.streaming && !reply?.content)
          ? 'thinking'
          : speaking || chat.streaming
            ? 'speaking'
            : 'idle';

  const status =
    state === 'listening'
      ? 'Listening · tap to send'
      : mic.transcribing
        ? 'Got it'
        : state === 'thinking'
          ? 'Thinking · tap to stop'
          : state === 'speaking'
            ? 'Tap to interrupt'
            : state === 'muted'
              ? 'Microphone off'
              : failed && handsFree
                ? 'Tap to try again'
                : handsFree
                  ? 'Starting…'
                  : `Type to talk to ${agent}`;

  const caption =
    state === 'listening'
      ? mic.partial || 'Go ahead, I’m listening.'
      : state === 'speaking' && reply?.role === 'assistant'
        ? lastSentences(toPlainText(reply.content))
        : mic.failed
          ? 'I couldn’t catch that. Check your connection and try again.'
          : (chat.error ?? (heard ? `“${heard}”` : `Hi${profile?.displayName ? ` ${profile.displayName}` : ''}. What’s on your mind?`));

  // The orb does the obvious thing for each state.
  const onOrb =
    state === 'listening'
      ? mic.sendNow
      : state === 'speaking' || state === 'thinking'
        ? interrupt
        : state === 'muted'
          ? toggleMute
          : failed && handsFree
            ? () => void mic.listen()
            : undefined;

  const submitTyped = () => {
    const text = typed.trim();
    if (!text || chat.streaming) return;
    setTyped('');
    send(text);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.background }}>
      {hue !== 'off' ? <HueGlow palette={hue} scheme={t.scheme} level={glowLevel} /> : null}
      <View style={{ flex: 1, paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
        <View style={{ height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
          <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 16, color: t.text }}>Voice</Text>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 28 }}>
          <VoiceOrb state={state} level={level} label={status} onPress={onOrb} />
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
            {SERVER_VOICE ? (
              <Text
                accessibilityRole="button"
                onPress={() => void aiConsent.ensure().catch(() => false)}
                style={{ textAlign: 'center', fontFamily: fonts.body, fontSize: 13, color: t.faint }}>
                To talk instead of typing, <Text style={{ color: t.text, textDecorationLine: 'underline' }}>allow {agent}’s AI service</Text>.
              </Text>
            ) : (
              <Text style={{ textAlign: 'center', fontFamily: fonts.body, fontSize: 13, color: t.faint }}>
                Talking needs the full Raco app. In Expo Go, type and {agent} answers out loud.
              </Text>
            )}
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
