import {
  DEFAULT_NOTIFICATION_PREFS,
  INTERESTS,
  RESPONSE_STYLES,
  voiceQuestion,
  type Interest,
  type NotificationPrefs,
  type VoiceStep,
} from '@raco/shared';
import * as Notifications from 'expo-notifications';
import { useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnswerBar } from '@/components/answer-bar';
import { Button } from '@/components/button';
import { Chip } from '@/components/fields';
import { ChevronRightIcon, FaceIdIcon, MicIcon, PathIcon, PHONE_PATH } from '@/components/icons';
import { SlideToStart } from '@/components/slide-to-start';
import { surfaceStyle, useSurface } from '@/components/surface';
import { VoiceStage, type VoiceStatus } from '@/components/voice-stage';
import { config } from '@/lib/config';
import { formatTime, humanList } from '@/lib/greeting';
import { useAiConsent } from '@/lib/ai-consent';
import { requestMicrophone, speak, speechRecognitionAvailable, stopSpeaking, useHoldToTalk, voiceTurn } from '@/lib/voice';
import { useAppLock } from '@/state/app-lock';
import { useOnboarding, type OnboardingDraft } from '@/state/onboarding';
import { useSession } from '@/state/session';
import { accent, fonts, useTheme } from '@/theme';

/**
 * The whole of onboarding happens on this one voice canvas (designs V1-V6
 * and 11): Raco talks the user through each question, then Face ID, a
 * summary they can edit in place, and "slide to start". Typing is a mode of
 * the canvas, never a separate screen.
 */
type Phase = 'intro' | VoiceStep | 'lock' | 'summary' | 'ready';

const CALLS_OFF: NotificationPrefs = {
  urgentCalls: false,
  dailyCheckIn: { enabled: false, time: '09:00' },
  inputNeededCalls: false,
  everydayReminders: true,
};

function questionFor(phase: Phase, d: OnboardingDraft): string {
  switch (phase) {
    case 'intro':
      return "Let's set up by talking. It takes about a minute.";
    case 'lock':
      return 'Want me to lock your chats with Face ID?';
    case 'summary':
      return `All set${d.displayName ? `, ${d.displayName}` : ''}. Here's what I've got.`;
    case 'ready':
      return 'Slide to begin.';
    default:
      return voiceQuestion(phase, d.agentName);
  }
}

export default function VoiceOnboarding() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { draft, set } = useOnboarding();
  const { updateProfile } = useSession();
  const aiConsent = useAiConsent();
  const lock = useAppLock();
  const [phase, setPhase] = useState<Phase>('intro');
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [said, setSaid] = useState('Hi there.');
  const [heard, setHeard] = useState<string | null>(null);
  const [typing, setTyping] = useState(!speechRecognitionAvailable());
  const [choseTyping, setChoseTyping] = useState(false);
  // On steps with buttons (agent name, calls, Face ID) the text box only appears on request.
  const [renaming, setRenaming] = useState(false);
  const [callsAllowed, setCallsAllowed] = useState<boolean | null>(null);
  const [canLock, setCanLock] = useState(false);
  // Editing a row from the summary returns to the summary afterwards.
  const [editing, setEditing] = useState(false);
  const [starting, setStarting] = useState(false);
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    void lock.available().then(setCanLock);
  }, [lock]);

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
      setHeard(null);
      await say(acknowledgement, next === 'intro' ? undefined : questionFor(next, draftRef.current));
    },
    [say],
  );

  /** Where the conversation goes after a step is answered. */
  const nextAfter = useCallback(
    (step: VoiceStep | 'lock'): Phase => {
      if (editing) return 'summary';
      const order: Phase[] = ['name', 'agent', 'uses', 'calls', ...(canLock ? (['lock'] as const) : []), 'summary'];
      return order[order.indexOf(step) + 1] ?? 'summary';
    },
    [editing, canLock],
  );

  const advance = useCallback(
    (from: VoiceStep | 'lock', acknowledgement: string) => {
      const next = nextAfter(from);
      if (next === 'summary') setEditing(false);
      void goTo(next, acknowledgement);
    },
    [nextAfter, goTo],
  );

  async function chooseCalls(allowed: boolean, acknowledgement?: string) {
    setCallsAllowed(allowed);
    set({ notificationPrefs: allowed ? DEFAULT_NOTIFICATION_PREFS : CALLS_OFF });
    if (allowed && Platform.OS !== 'web') await Notifications.requestPermissionsAsync().catch(() => {});
    advance('calls', acknowledgement ?? (allowed ? "Done. I'll only call when it matters." : "No problem. I'll stick to notifications."));
  }

  async function chooseLock(on: boolean) {
    if (!on) {
      await lock.disable();
      advance('lock', 'No problem. You can turn it on later in Settings.');
      return;
    }
    const ok = await lock.enable();
    advance(
      'lock',
      ok ? "Done. I'll ask for Face ID when you open the app." : 'Face ID wasn’t turned on. You can do it later in Settings.',
    );
  }

  const answer = useCallback(
    async (transcript: string) => {
      const step = phase;
      if (step !== 'name' && step !== 'agent' && step !== 'uses' && step !== 'calls') return;
      setHeard(transcript);
      setStatus('thinking');
      const d = draftRef.current;
      const res = await voiceTurn({ step, transcript, agentName: d.agentName, displayName: d.displayName || undefined }, aiConsent.consented);

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
    // chooseCalls only reads refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase, say, set, advance, aiConsent.consented],
  );

  const mic = useHoldToTalk((transcript) => void answer(transcript));
  // If the mic can't be used here, answers are typed instead (no error shown).
  const typingMode = typing || mic.unavailable;

  async function begin(byVoice: boolean) {
    // Ask before any answer leaves the phone. If they decline, onboarding
    // still works with the on-device reader.
    await aiConsent.ensure().catch(() => false);
    if (byVoice) {
      if (!(await requestMicrophone())) setTyping(true);
    } else {
      setTyping(true);
      setChoseTyping(true);
    }
    await goTo('name', `Hi, I'm ${draft.agentName}. Let's get you set up.`);
  }

  function edit(target: Phase) {
    setEditing(true);
    void goTo(target, 'Sure, let’s change that.');
  }

  async function finish() {
    setStarting(true);
    setSaid('Here we go.');
    try {
      await updateProfile({ ...draftRef.current, onboardedAt: new Date().toISOString() });
    } catch {
      setStarting(false);
      setSaid(`Ready, ${draftRef.current.displayName}.`);
      Alert.alert("Couldn't save your settings", 'Check your connection and try again.');
    }
  }

  const question = questionFor(phase, draft);
  const answerStep = phase === 'name' || phase === 'agent' || phase === 'uses' || phase === 'calls';
  const buttonStep = phase === 'agent' || phase === 'calls';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.background }}>
      <VoiceStage
        status={mic.listening ? 'listening' : status}
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
      <View style={{ paddingTop: 16, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 16) + 12, gap: 14 }}>
        <Text
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          style={{ marginHorizontal: 4, fontFamily: fonts.display, fontSize: 25, lineHeight: 32, letterSpacing: -0.5, color: t.text }}>
          {question}
        </Text>

        {phase === 'intro' ? (
          <View style={{ gap: 12 }}>
            <Text style={{ textAlign: 'center', fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: t.sub }}>
              {draft.agentName} only listens while you hold the talk button.
            </Text>
            <Button label="Allow microphone" icon={<MicIcon color={t.primary.color} />} onPress={() => void begin(true)} />
            <Button kind="glass" label="I’d rather type" onPress={() => void begin(false)} />
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
        {phase === 'uses' ? <UsesCard onDone={() => advance('uses', "Great, that's sorted.")} /> : null}
        {phase === 'calls' ? <CallsCard busy={status === 'thinking'} onChoose={(v) => void chooseCalls(v)} /> : null}
        {phase === 'lock' ? <LockCard onChoose={(v) => void chooseLock(v)} /> : null}
        {phase === 'summary' ? (
          <Summary
            callsAllowed={callsAllowed}
            lockOn={canLock ? lock.enabled : null}
            onEdit={edit}
            onConfirm={() => void goTo('ready', `Ready, ${draft.displayName || 'friend'}.`)}
          />
        ) : null}
        {phase === 'ready' ? (
          <View style={{ gap: 14 }}>
            <Text style={{ marginHorizontal: 4, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: t.sub }}>
              Your chats are private to you, and you can delete them any time.{' '}
              {aiConsent.consented ? `Replies come from ${config.aiProvider}, an AI service, and can be wrong, so check anything important.` : `${draft.agentName} will ask before using its AI service.`}{' '}
              <Text
                accessibilityRole="link"
                onPress={() => WebBrowser.openBrowserAsync(config.privacyUrl)}
                style={{ color: t.text, textDecorationLine: 'underline' }}>
                Privacy Policy
              </Text>
            </Text>
            <SlideToStart label={starting ? 'Let’s go' : 'slide to start'} disabled={starting} onComplete={() => void finish()} />
          </View>
        ) : null}

        {answerStep && (!buttonStep || renaming || choseTyping || !typingMode) ? (
          <AnswerBar
            typing={typingMode}
            micUnavailable={mic.unavailable}
            onType={() => {
              setChoseTyping(!typingMode);
              setTyping((v) => !v);
            }}
            compact={buttonStep}
            listening={mic.listening}
            disabled={status === 'thinking'}
            onPressIn={mic.start}
            onPressOut={mic.stop}
            onSubmit={(text) => void answer(text)}
            placeholder={phase === 'agent' ? 'Type a new name, or "keep"' : 'Type your answer'}
          />
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

function CardIcon({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: t.tile, alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </View>
  );
}

function Card({ children, gap = 12 }: { children: ReactNode; gap?: number }) {
  const glass = useSurface('glass');
  return <View style={[surfaceStyle(glass), { borderRadius: 20, paddingVertical: 14, paddingHorizontal: 16, gap }]}>{children}</View>;
}

function TwoButtons({ left, right }: { left: { label: string; onPress: () => void }; right: { label: string; onPress: () => void } }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Button kind="glass" label={left.label} style={{ flex: 1, height: 46, borderRadius: 12 }} onPress={left.onPress} />
      <Button label={right.label} style={{ flex: 1, height: 46, borderRadius: 12 }} onPress={right.onPress} />
    </View>
  );
}

function AgentCard({ onKeep, onRename }: { onKeep: () => void; onRename: () => void }) {
  const t = useTheme();
  const { draft } = useOnboarding();
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <CardIcon>
          <PathIcon color={t.text} d="M10 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3.5 17.5a6.5 6.5 0 0 1 13 0" />
        </CardIcon>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 12, color: t.faint }}>Agent name</Text>
          <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 18, color: t.text }}>{draft.agentName}</Text>
        </View>
      </View>
      <TwoButtons left={{ label: 'Rename', onPress: onRename }} right={{ label: `Keep "${draft.agentName}"`, onPress: onKeep }} />
    </Card>
  );
}

function UsesCard({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const glass = useSurface('glass');
  const { draft, set } = useOnboarding();
  const [all, setAll] = useState(false);
  const toggle = (i: Interest) =>
    set({ interests: draft.interests.includes(i) ? draft.interests.filter((x) => x !== i) : [...draft.interests, i] });
  const shown = all ? INTERESTS : draft.interests;
  return (
    <Card gap={10}>
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
              { height: 44, paddingHorizontal: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
            ]}>
            <PathIcon color={t.text} d="M10 4.5v11M4.5 10h11" size={16} strokeWidth={1.9} />
            <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: t.text }}>Add</Text>
          </Pressable>
        ) : null}
      </View>
      {all && draft.interests.length ? <Button label="Done" style={{ height: 46, borderRadius: 12 }} onPress={onDone} /> : null}
    </Card>
  );
}

function CallsCard({ onChoose, busy }: { onChoose: (allowed: boolean) => void; busy: boolean }) {
  const t = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <CardIcon>
          <PathIcon color={t.text} d={PHONE_PATH} strokeWidth={1.7} />
        </CardIcon>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 16, color: t.text }}>Calls and notifications</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: t.sub }}>
            Urgent reminders, a daily check-in at {formatTime(DEFAULT_NOTIFICATION_PREFS.dailyCheckIn.time)}, and a call when I need your
            input.
          </Text>
        </View>
      </View>
      <TwoButtons
        left={{ label: 'Not now', onPress: () => !busy && onChoose(false) }}
        right={{ label: 'Allow', onPress: () => !busy && onChoose(true) }}
      />
    </Card>
  );
}

function LockCard({ onChoose }: { onChoose: (on: boolean) => void }) {
  const t = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <CardIcon>
          <FaceIdIcon color={accent} size={20} strokeWidth={1.6} />
        </CardIcon>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 16, color: t.text }}>Unlock with Face ID</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: t.sub }}>
            Keep your chats private. I’ll ask for Face ID each time you open the app.
          </Text>
        </View>
      </View>
      <TwoButtons left={{ label: 'Not now', onPress: () => onChoose(false) }} right={{ label: 'Turn on', onPress: () => onChoose(true) }} />
    </Card>
  );
}

interface SummaryProps {
  callsAllowed: boolean | null;
  /** null when this device has no Face ID / fingerprint. */
  lockOn: boolean | null;
  onEdit: (phase: Phase) => void;
  onConfirm: () => void;
}

function Summary({ callsAllowed, lockOn, onEdit, onConfirm }: SummaryProps) {
  const t = useTheme();
  const glass = useSurface('glass');
  const { draft, set } = useOnboarding();
  const style = RESPONSE_STYLES.find((s) => s.id === draft.responseStyle) ?? RESPONSE_STYLES[1];
  const cycleStyle = () => {
    const i = RESPONSE_STYLES.findIndex((s) => s.id === draft.responseStyle);
    set({ responseStyle: RESPONSE_STYLES[(i + 1) % RESPONSE_STYLES.length]!.id });
  };

  const rows: { label: string; value: string; onPress: () => void; hint: string }[] = [
    { label: 'Your name', value: draft.displayName || '—', onPress: () => onEdit('name'), hint: 'Change' },
    { label: 'Agent name', value: draft.agentName, onPress: () => onEdit('agent'), hint: 'Change' },
    {
      label: 'Focus',
      value: draft.interests.length ? humanList(draft.interests) : 'Anything',
      onPress: () => onEdit('uses'),
      hint: 'Change',
    },
    { label: 'Replies', value: style.title, onPress: cycleStyle, hint: 'Switches between concise, balanced and detailed' },
    {
      label: 'Calls',
      value: callsAllowed ? `Urgent + ${formatTime(draft.notificationPrefs.dailyCheckIn.time)} check-in` : 'Notifications only',
      onPress: () => onEdit('calls'),
      hint: 'Change',
    },
    ...(lockOn === null ? [] : [{ label: 'Face ID', value: lockOn ? 'On' : 'Off', onPress: () => onEdit('lock'), hint: 'Change' }]),
  ];

  return (
    <>
      <View style={[surfaceStyle(glass), { borderRadius: 20, paddingVertical: 4, paddingHorizontal: 14 }]}>
        {rows.map((r, i) => (
          <Pressable
            key={r.label}
            accessibilityRole="button"
            accessibilityLabel={`${r.label}: ${r.value}`}
            accessibilityHint={r.hint}
            onPress={r.onPress}
            style={{
              minHeight: 44,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              borderBottomWidth: i < rows.length - 1 ? 1 : 0,
              borderBottomColor: t.hairline,
            }}>
            <Text style={{ width: 92, fontFamily: fonts.body, fontSize: 15, color: t.faint }}>{r.label}</Text>
            <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.bodySemibold, fontSize: 15, color: t.text }}>
              {r.value}
            </Text>
            <ChevronRightIcon color={t.text} />
          </Pressable>
        ))}
      </View>
      <Button label="Looks good" onPress={onConfirm} />
    </>
  );
}
