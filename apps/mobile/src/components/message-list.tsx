import { REPORT_REASONS, type ReportReason } from '@raco/shared';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { reportMessage } from '@/lib/api';
import { saveToLibrary } from '@/lib/data';
import { notify } from '@/lib/dialog';
import { toPlainText } from '@/lib/markdown';
import { speak, stopSpeaking } from '@/lib/voice';
import type { UiMessage } from '@/state/use-chat';
import { fonts, useTheme } from '@/theme';
import { useActionSheet } from './action-sheet';
import { IconButton } from './button';
import { ICONS, PathIcon } from './icons';
import { Markdown } from './markdown';

interface Props {
  messages: UiMessage[];
  /** For saving replies to the Library with a link back. */
  conversationId?: string | null;
  header?: ReactElement;
  footer?: ReactElement;
}

/** How close to the bottom (pt) still counts as "at the bottom". */
const NEAR_BOTTOM = 120;

/**
 * The conversation. Follows a streaming reply while you're at the bottom,
 * stops following when you scroll up, and offers a jump back down.
 */
export function MessageList({ messages, conversationId = null, header, footer }: Props) {
  const t = useTheme();
  const list = useRef<FlatList<UiMessage>>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const last = messages.at(-1);

  useEffect(() => {
    if (atBottom) list.current?.scrollToEnd({ animated: true });
    // Follow new messages and streamed text only while at the bottom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, last?.content]);

  useEffect(() => () => stopSpeaking(), []);

  const readAloud = (m: UiMessage) => {
    if (speakingId === m.id) {
      stopSpeaking();
      setSpeakingId(null);
      return;
    }
    setSpeakingId(m.id);
    void speak(toPlainText(m.content)).then(() => setSpeakingId((id) => (id === m.id ? null : id)));
  };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(m) => m.id}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, gap: 22 }}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          setAtBottom(contentSize.height - contentOffset.y - layoutMeasurement.height < NEAR_BOTTOM);
        }}
        scrollEventThrottle={64}
        renderItem={({ item }) =>
          item.role === 'user' ? (
            <UserBubble message={item} />
          ) : (
            <AssistantMessage
              message={item}
              conversationId={conversationId}
              speaking={speakingId === item.id}
              onReadAloud={() => readAloud(item)}
            />
          )
        }
      />
      {!atBottom ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 12, alignItems: 'center' }}>
          <IconButton label="Scroll to the latest message" size={38} onPress={() => list.current?.scrollToEnd({ animated: true })}>
            <PathIcon d={ICONS.arrowDown} color={t.text} size={18} strokeWidth={1.8} />
          </IconButton>
        </View>
      ) : null}
    </View>
  );
}

function UserBubble({ message }: { message: UiMessage }) {
  const t = useTheme();
  return (
    <Pressable
      onLongPress={() => copy(message.content)}
      accessibilityHint="Long press to copy"
      style={{
        alignSelf: 'flex-end',
        maxWidth: '82%',
        borderRadius: 22,
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: t.bubble,
      }}>
      <Text selectable style={{ fontFamily: fonts.body, fontSize: 17, lineHeight: 24, color: t.text }}>
        {message.content}
      </Text>
    </Pressable>
  );
}

function AssistantMessage({
  message,
  conversationId,
  speaking,
  onReadAloud,
}: {
  message: UiMessage;
  conversationId: string | null;
  speaking: boolean;
  onReadAloud: () => void;
}) {
  const t = useTheme();
  const sheet = useActionSheet();
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = () => {
    if (saved) return;
    setSaved(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    saveToLibrary(message.content, conversationId).catch(() => {
      setSaved(false);
      notify("Couldn't save to Library", 'Please try again.');
    });
  };

  const report = () =>
    sheet({
      title: 'Report this response',
      message: 'What’s wrong with it?',
      options: REPORT_REASONS.map((r) => ({ label: REASON_LABELS[r], onPress: () => void send(message, r) })),
    });

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  if (!message.content) return <ThinkingDot />;

  const action = (label: string, d: string, onPress: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? t.tile : 'transparent',
      })}>
      <PathIcon d={d} color={t.faint} size={18} strokeWidth={1.7} />
    </Pressable>
  );

  return (
    <View style={{ gap: 6 }}>
      <Markdown text={message.content} />
      {message.pending ? null : (
        <View style={{ flexDirection: 'row', marginLeft: -6 }}>
          {action(copied ? 'Copied' : 'Copy', copied ? ICONS.check : ICONS.copy, () => {
            copy(message.content);
            setCopied(true);
          })}
          {action(speaking ? 'Stop reading' : 'Read aloud', speaking ? ICONS.stopSquare : ICONS.speaker, onReadAloud)}
          {action(saved ? 'Saved to Library' : 'Save to Library', saved ? ICONS.check : ICONS.bookmark, save)}
          {action('More', ICONS.more, () =>
            sheet({ options: [{ label: 'Report response', icon: ICONS.flag, destructive: true, onPress: report }] }),
          )}
        </View>
      )}
    </View>
  );
}

/** A single pulsing dot while the reply hasn't started. */
function ThinkingDot() {
  const t = useTheme();
  const reduced = useReducedMotion();
  const scale = useSharedValue(0.7);
  useEffect(() => {
    if (!reduced) scale.value = withRepeat(withTiming(1, { duration: 650 }), -1, true);
  }, [scale, reduced]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View
      accessibilityLabel="Thinking"
      style={[
        { width: 14, height: 14, borderRadius: 7, marginVertical: 6, backgroundColor: t.scheme === 'light' ? '#2A2A2B' : '#F2F2F3' },
        style,
      ]}
    />
  );
}

function copy(text: string) {
  if (!text) return;
  void Clipboard.setStringAsync(text);
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

const REASON_LABELS: Record<ReportReason, string> = {
  harmful: 'Harmful or dangerous',
  sexual: 'Sexual content',
  hateful: 'Hateful or harassing',
  inaccurate: 'Wrong or misleading',
  other: 'Something else',
};

/** Report an AI response (App Review Guideline 1.2). */
function send(message: UiMessage, reason: ReportReason) {
  return reportMessage({ messageId: message.id, reason })
    .then(() => notify('Thanks for telling us', 'We review every report and use it to make replies safer.'))
    .catch((err: Error) => notify("Couldn't send the report", err.message));
}

export function CenteredSpinner() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={t.faint} />
    </View>
  );
}
