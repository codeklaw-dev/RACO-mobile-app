import {
  DEFAULT_NOTIFICATION_PREFS,
  INTERESTS,
  VOICE_STEPS,
  voiceQuestion,
  type Interest,
  type NotificationPrefs,
  type VoiceStep,
} from '@raco/shared';
import * as Notifications from 'expo-notifications';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, IconButton } from '@/components/button';
import { Chip } from '@/components/fields';
import { ChevronRightIcon, MicIcon, PathIcon, PHONE_PATH, SendIcon } from '@/components/icons';
import { surfaceStyle, useSurface } from '@/components/surface';
import { VoiceStage, type VoiceStatus } from '@/components/voice-stage';
import { formatTime, humanList } from '@/lib/greeting';
import { requestMicrophone, speak, speechRecognitionAvailable, stopSpeaking, useHoldToTalk, voiceTurn } from '@/lib/voice';
import { useOnboarding } from '@/state/onboarding';
import { accent, fonts, noWebOutline, useTheme } from '@/theme';

type Phase = 'intro' | VoiceStep | 'summary';

const CALLS_OFF: NotificationPrefs = {
  urgentCalls: false,
  dailyCheckIn: { enabled: false, time: '09:00' },
  inputNeededCalls: false,
  everydayReminders: true,
};

/**
 * Voice-led onboarding (designs V1-V6). Raco speaks each question, the user
 * holds to talk (or types), and the answer fills the same onboarding draft
 * the typed flow uses. Typing is always one tap away.
 */
export default function VoiceOnboarding() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { draft, set } = useOnboarding();
  const [phase, setPhase] = useState<Phase>('intro');
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [said, setSaid] = useState('Hi there.');
  const [heard, setHeard] = useState<string | null>(null);
  const [typing, setTyping] = useState(!speechRecognitionAvailable());
  const [callsAllowed, setCallsAllowed] = useState<boolean | null>(null);
  // On steps with buttons (agent name, calls) the text box only appears on request.
  const [renaming, setRenaming] = useState(false);
  const [choseTyping, setChoseTyping] = useState(false);
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const step = phase !== 'intro' && phase !== 'summary' ? phase : null;
  const question =
    phase === 'intro'
      ? "Let's set up by talking. It takes about a minute."
      : phase === 'summary'
        ? `All set${draft.displayName ? `, ${draft.displayName}` : ''}. Here's what I've got.`
        : voiceQuestion(phase, draft.agentName);

  // Stop talking if the user leaves the screen.
  useFocusEffect(useCallback(() => () => stopSpeaking(), []));

  const say = useCallback(async (line: string, then?: string) => {
    setSaid(line);
    setStatus('speaking');
    await speak(then ? `${line} ${then}` : line);
    setStatus('idle');
  }, []);

  const goTo = useCallback(
    async (next: Phase, acknowledgement: string) => {
      setPhase(next);
      setRenaming(false);
      const nextQuestion =
        next === 'summary'
          ? `All set${draftRef.current.displayName ? `, ${draftRef.current.displayName}` : ''}. Here's what I've got.`
          : next === 'intro'
            ? undefined
            : voiceQuestion(next, draftRef.current.agentName);
      await say(acknowledgement, nextQuestion);
    },
    [say],
  );

  const advance = useCallback(
    (from: VoiceStep, acknowledgement: string) => {
      const i = VOICE_STEPS.indexOf(from);
      void goTo(VOICE_STEPS[i + 1] ?? 'summary', acknowledgement);
    },
    [goTo],
  );

  const answer = useCallback(
    async (transcript: string) => {
      if (!step) return;
      setHeard(transcript);
      setStatus('thinking');
      const d = draftRef.current;
      const res = await voiceTurn({
        step,
        transcript,
        agentName: d.agentName,
        displayName: d.displayName || undefined,
      });

      if (res.wantsTour) {
        await say(
          `${res.say} I can help you write, research, study and plan, read your files, and call you when something's urgent.`,
          voiceQuestion(step, d.agentName),
        );
        return;
      }
      if (!res.understood) {
        await say(res.say);
        return;
      }
      if (res.displayName) set({ displayName: res.displayName });
      if (res.agentName) set({ agentName: res.agentName });
      if (res.interests) set({ interests: res.interests });
      if (res.callsAllowed !== undefined) await chooseCalls(res.callsAllowed, res.say);
      else advance(step, res.say);
    },
    // chooseCalls is stable enough for this flow; it only reads refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step, say, set, advance],
  );

  const mic = useHoldToTalk((transcript) => void answer(transcript));

  async function start() {
    const ok = await requestMicrophone();
    if (!ok) setTyping(true);
    await goTo('name', `Hi, I'm ${draft.agentName}. Let's get you set up.`);
  }

  async function chooseCalls(allowed: boolean, acknowledgement?: string) {
    setCallsAllowed(allowed);
    set({
      notificationPrefs: allowed ? DEFAULT_NOTIFICATION_PREFS : CALLS_OFF,
    });
    if (allowed && Platform.OS !== 'web') await Notifications.requestPermissionsAsync().catch(() => {});
    advance('calls', acknowledgement ?? (allowed ? "Done. I'll only call when it matters." : "No problem. I'll stick to notifications."));
  }

  const top = insets.top + 8;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.background }}>
      <VoiceStage
        status={mic.listening ? 'listening' : status}
        said={said}
        top={top}
        footnote={
          mic.partial || heard ? (
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fonts.body,
                fontSize: 15,
                color: t.faint,
                textAlign: 'center',
              }}>
              {mic.partial ? '' : 'You said: '}
              <Text style={{ fontFamily: fonts.bodySemibold }}>“{mic.partial || heard}”</Text>
            </Text>
          ) : step === 'name' && status === 'idle' ? (
            <Text style={{ fontFamily: fonts.body, fontSize: 15, color: t.faint }}>Say your name</Text>
          ) : null
        }
      />
      <View
        style={{
          paddingTop: 12,
          paddingHorizontal: 20,
          paddingBottom: Math.max(insets.bottom, 16) + 12,
          gap: 14,
        }}>
        <Text
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          style={{
            marginHorizontal: 4,
            fontFamily: fonts.display,
            fontSize: 25,
            lineHeight: 32,
            letterSpacing: -0.5,
            color: t.text,
          }}>
          {question}
        </Text>

        {phase === 'intro' ? (
          <View style={{ gap: 12 }}>
            <Text
              style={{
                textAlign: 'center',
                fontFamily: fonts.body,
                fontSize: 14,
                lineHeight: 20,
                color: t.sub,
              }}>
              {draft.agentName} only listens while you hold the talk button.
            </Text>
            <Button label="Allow microphone" icon={<MicIcon color={t.primary.color} />} onPress={start} />
            <Button kind="glass" label="I’d rather type" onPress={() => router.replace('/name')} />
          </View>
        ) : null}

        {phase === 'agent' ? (
          <AgentCard
            onKeep={() => advance('agent', `Great, ${draft.agentName} it is.`)}
            onRename={() => {
              setRenaming(true);
              setTyping(true);
            }}
          />
        ) : null}
        {phase === 'uses' ? <UsesCard /> : null}
        {phase === 'calls' ? <CallsCard busy={status === 'thinking'} onChoose={(v) => void chooseCalls(v)} /> : null}
        {phase === 'summary' ? <Summary callsAllowed={callsAllowed} /> : null}

        {step && (!(step === 'agent' || step === 'calls') || renaming || choseTyping || !typing) ? (
          <AnswerBar
            typing={typing}
            onType={() => {
              setChoseTyping(!typing);
              setTyping((v) => !v);
            }}
            compact={step === 'agent' || step === 'calls'}
            listening={mic.listening}
            disabled={status === 'thinking'}
            onPressIn={mic.start}
            onPressOut={mic.stop}
            onSubmit={(text) => void answer(text)}
            placeholder={step === 'agent' ? 'Type a new name, or "keep"' : 'Type your answer'}
          />
        ) : null}
        {mic.error ? (
          <Text
            style={{
              textAlign: 'center',
              fontFamily: fonts.bodyMedium,
              fontSize: 14,
              color: t.faint,
            }}>
            {mic.error}
          </Text>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

function AgentCard({ onKeep, onRename }: { onKeep: () => void; onRename: () => void }) {
  const t = useTheme();
  const { draft } = useOnboarding();
  const glass = useSurface('glass');
  return (
    <View
      style={[
        surfaceStyle(glass),
        {
          borderRadius: 20,
          paddingVertical: 14,
          paddingHorizontal: 16,
          gap: 12,
        },
      ]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            backgroundColor: t.tile,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <PathIcon color={t.text} d="M10 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3.5 17.5a6.5 6.5 0 0 1 13 0" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              fontFamily: fonts.bodySemibold,
              fontSize: 12,
              color: t.faint,
            }}>
            Agent name
          </Text>
          <Text
            style={{
              fontFamily: fonts.bodySemibold,
              fontSize: 18,
              color: t.text,
            }}>
            {draft.agentName}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button kind="glass" label="Rename" style={{ flex: 1, height: 46, borderRadius: 12 }} onPress={onRename} />
        <Button label={`Keep "${draft.agentName}"`} style={{ flex: 1, height: 46, borderRadius: 12 }} onPress={onKeep} />
      </View>
    </View>
  );
}

function UsesCard() {
  const t = useTheme();
  const glass = useSurface('glass');
  const { draft, set } = useOnboarding();
  const [all, setAll] = useState(false);
  const toggle = (i: Interest) =>
    set({
      interests: draft.interests.includes(i) ? draft.interests.filter((x) => x !== i) : [...draft.interests, i],
    });
  const shown = all ? INTERESTS : draft.interests;
  return (
    <View
      style={[
        surfaceStyle(glass),
        {
          borderRadius: 20,
          paddingVertical: 14,
          paddingHorizontal: 16,
          gap: 10,
        },
      ]}>
      <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 12, color: t.faint }}>
        {draft.interests.length ? 'I’ll tailor suggestions for' : 'Say it, or tap to pick'}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {shown.map((i) => (
          <Chip key={i} label={i} selected={draft.interests.includes(i)} onToggle={() => toggle(i)} />
        ))}
        {!all ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setAll(true)}
            style={[
              surfaceStyle(glass),
              {
                height: 44,
                paddingHorizontal: 14,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              },
            ]}>
            <PathIcon color={t.text} d="M10 4.5v11M4.5 10h11" size={16} strokeWidth={1.9} />
            <Text
              style={{
                fontFamily: fonts.bodyMedium,
                fontSize: 15,
                color: t.text,
              }}>
              Add
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function CallsCard({ onChoose, busy }: { onChoose: (allowed: boolean) => void; busy: boolean }) {
  const t = useTheme();
  const glass = useSurface('glass');
  return (
    <View
      style={[
        surfaceStyle(glass),
        {
          borderRadius: 20,
          paddingVertical: 14,
          paddingHorizontal: 16,
          gap: 12,
        },
      ]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            backgroundColor: t.tile,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <PathIcon color={t.text} d={PHONE_PATH} strokeWidth={1.7} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text
            style={{
              fontFamily: fonts.bodySemibold,
              fontSize: 16,
              color: t.text,
            }}>
            Calls and notifications
          </Text>
          <Text
            style={{
              fontFamily: fonts.body,
              fontSize: 14,
              lineHeight: 19,
              color: t.sub,
            }}>
            Urgent reminders, a daily check-in at {formatTime(DEFAULT_NOTIFICATION_PREFS.dailyCheckIn.time)}, and a call when I need your
            input.
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button
          kind="glass"
          label="Not now"
          disabled={busy}
          style={{ flex: 1, height: 46, borderRadius: 12 }}
          onPress={() => onChoose(false)}
        />
        <Button label="Allow" disabled={busy} style={{ flex: 1, height: 46, borderRadius: 12 }} onPress={() => onChoose(true)} />
      </View>
    </View>
  );
}

function Summary({ callsAllowed }: { callsAllowed: boolean | null }) {
  const t = useTheme();
  const glass = useSurface('glass');
  const { draft } = useOnboarding();
  const rows = [
    ['Your name', draft.displayName || '—'],
    ['Agent name', draft.agentName],
    ['Focus', draft.interests.length ? humanList(draft.interests) : 'Anything'],
    ['Replies', draft.responseStyle[0]!.toUpperCase() + draft.responseStyle.slice(1)],
    ['Calls', callsAllowed ? `Urgent + ${formatTime(draft.notificationPrefs.dailyCheckIn.time)} check-in` : 'Notifications only'],
  ];
  return (
    <>
      <View style={[surfaceStyle(glass), { borderRadius: 20, paddingVertical: 4, paddingHorizontal: 14 }]}>
        {rows.map(([label, value], i) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${value}. Change`}
            onPress={() => router.push('/name')}
            style={{
              minHeight: 44,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              borderBottomWidth: i < rows.length - 1 ? 1 : 0,
              borderBottomColor: t.hairline,
            }}>
            <Text
              style={{
                width: 92,
                fontFamily: fonts.body,
                fontSize: 15,
                color: t.faint,
              }}>
              {label}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                fontFamily: fonts.bodySemibold,
                fontSize: 15,
                color: t.text,
              }}>
              {value}
            </Text>
            <ChevronRightIcon color={t.text} />
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Button kind="glass" label="Change" style={{ width: 116 }} onPress={() => router.push('/name')} />
        <Button label="Start chatting" style={{ flex: 1 }} onPress={() => router.push('/start')} />
      </View>
    </>
  );
}

interface AnswerBarProps {
  typing: boolean;
  onType: () => void;
  listening: boolean;
  disabled: boolean;
  onPressIn: () => void;
  onPressOut: () => void;
  onSubmit: (text: string) => void;
  placeholder: string;
  /** On steps that already have buttons, show only a quiet "Type instead" link. */
  compact?: boolean;
}

/** "Hold to talk", with a keyboard toggle for typing the answer instead. */
function AnswerBar({ typing, onType, listening, disabled, onPressIn, onPressOut, onSubmit, placeholder, compact }: AnswerBarProps) {
  const t = useTheme();
  const primary = useSurface('primary');
  const field = useSurface('field');
  const [text, setText] = useState('');
  const canTalk = speechRecognitionAvailable();

  const submit = () => {
    if (!text.trim() || disabled) return;
    onSubmit(text.trim());
    setText('');
  };

  if (typing) {
    return (
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={t.faint}
            accessibilityLabel="Your answer"
            autoFocus
            returnKeyType="send"
            onSubmitEditing={submit}
            selectionColor={accent}
            style={[
              surfaceStyle(field),
              {
                flex: 1,
                height: 56,
                borderRadius: 16,
                paddingHorizontal: 16,
                fontSize: 17,
                fontFamily: fonts.body,
                color: t.text,
              },
              noWebOutline,
            ]}
          />
          <IconButton kind="accent" size={56} radius={16} label="Send" disabled={!text.trim() || disabled} onPress={submit}>
            <SendIcon color="#2A2A2B" />
          </IconButton>
        </View>
        {canTalk ? (
          <Pressable accessibilityRole="button" onPress={onType} hitSlop={8} style={{ alignSelf: 'center', padding: 4 }}>
            <Text
              style={{
                fontFamily: fonts.bodySemibold,
                fontSize: 14,
                color: t.faint,
              }}>
              Talk instead
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (compact && !canTalk) return null;

  return (
    <View style={{ gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={listening ? 'Listening. Release to send' : 'Hold to talk'}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[
          surfaceStyle(primary),
          {
            height: 56,
            borderRadius: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            opacity: disabled ? 0.6 : 1,
          },
          listening ? { backgroundColor: accent, borderColor: 'rgba(255,255,255,0.35)' } : null,
        ]}>
        <MicIcon color={listening ? '#2A2A2B' : primary.color} />
        <Text
          style={{
            fontFamily: fonts.bodySemibold,
            fontSize: 17,
            color: listening ? '#2A2A2B' : primary.color,
          }}>
          {listening ? 'Listening… release to send' : 'Hold to talk'}
        </Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onType} hitSlop={8} style={{ alignSelf: 'center', padding: 4 }}>
        <Text
          style={{
            fontFamily: fonts.bodySemibold,
            fontSize: 14,
            color: t.faint,
          }}>
          Type instead
        </Text>
      </Pressable>
    </View>
  );
}
