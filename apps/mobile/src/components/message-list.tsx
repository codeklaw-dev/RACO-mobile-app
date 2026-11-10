import { REPORT_REASONS, splitAttachments, type ReportReason } from '@raco/shared';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from 'react-native';
import { reportMessage } from '@/lib/api';
import { saveToLibrary } from '@/lib/data';
import { notify } from '@/lib/dialog';
import { sendFeedback } from '@/lib/feedback';
import { forClipboard, toPlainText } from '@/lib/markdown';
import { speak, stopSpeaking } from '@/lib/voice';
import { usePreferences } from '@/state/preferences';
import type { UiMessage } from '@/state/use-chat';
import { ThinkingOrb } from '@/vendor/thinking-orbs-native';
import { fonts, gradient, useTheme } from '@/theme';
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
  /** Puts a sent message's text back in the composer to change and send again. */
  onEdit?: (text: string) => void;
}

/** How close to the bottom (pt) still counts as "at the bottom". */
const NEAR_BOTTOM = 120;

/**
 * The conversation. Follows a streaming reply while you're at the bottom,
 * stops following when you scroll up, and offers a jump back down.
 */
export function MessageList({ messages, conversationId = null, header, footer, onEdit }: Props) {
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

  const { hue } = usePreferences();
  const fade = (direction: string) => gradient(`linear-gradient(${direction}, ${t.background} 0%, ${t.background}00 100%)`);

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
            <UserMessage message={item} onEdit={onEdit} />
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
      {/* Text fades out under the header and above the composer instead of being cut off.
          The fades are in the page colour, so they're left out over a background hue. */}
      {hue === 'off' ? (
        <>
          <View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: 18 }, fade('180deg')]} />
          <View pointerEvents="none" style={[{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 18 }, fade('0deg')]} />
        </>
      ) : null}
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

/** Your message: any photos and files, the text in a bubble, then Copy and Edit. */
function UserMessage({ message, onEdit }: { message: UiMessage; onEdit?: (text: string) => void }) {
  const t = useTheme();
  const [copied, setCopied] = useState(false);
  const { text, attachments } = splitAttachments(message.content);
  // Photos sent in this session still have their pixels; older ones show as a chip.
  const photos = message.attachments?.filter((a) => a.kind === 'image') ?? [];
  const chips = attachments.filter((a) => a.kind === 'file' || !photos.some((p) => p.name === a.name));

  const action = (label: string, d: string, onPress: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? t.tile : 'transparent' })}>
      <PathIcon d={d} color={t.faint} size={17} strokeWidth={1.7} />
    </Pressable>
  );

  return (
    <View style={{ alignItems: 'flex-end', gap: 6 }}>
      {photos.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6, maxWidth: '82%' }}>
          {photos.map((p, i) =>
            p.kind === 'image' ? (
              <Image key={i} source={{ uri: `data:${p.mimeType};base64,${p.data}` }} accessibilityLabel={p.name} style={{ width: 120, height: 120, borderRadius: 18 }} />
            ) : null,
          )}
        </View>
      ) : null}
      {chips.map((a, i) => (
        <View key={i} style={{ maxWidth: '82%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18, backgroundColor: t.tile }}>
          <PathIcon d={a.kind === 'file' ? ICONS.document : ICONS.photo} color={t.text} size={18} />
          <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.bodyMedium, fontSize: 15, color: t.text }}>
            {a.name}
          </Text>
        </View>
      ))}
      {text ? (
        <View style={{ maxWidth: '82%', borderRadius: 22, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: t.bubble }}>
          <Text selectable style={{ fontFamily: fonts.body, fontSize: 17, lineHeight: 24, color: t.text }}>
            {text}
          </Text>
        </View>
      ) : null}
      {text ? (
        <View style={{ flexDirection: 'row', marginRight: -6 }}>
          {action(copied ? 'Copied' : 'Copy', copied ? ICONS.check : ICONS.copy, () => {
            copy(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })}
          {onEdit ? action('Edit', ICONS.pencil, () => onEdit(text)) : null}
        </View>
      ) : null}
    </View>
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
            copy(forClipboard(message.content));
            setCopied(true);
          })}
          {action(speaking ? 'Stop reading' : 'Read aloud', speaking ? ICONS.stopSquare : ICONS.speaker, onReadAloud)}
          {action(saved ? 'Saved to Library' : 'Save to Library', saved ? ICONS.check : ICONS.bookmark, save)}
          {action('More', ICONS.more, () =>
            sheet({
              options: [
                { label: 'Send feedback', icon: ICONS.mail, onPress: () => void sendFeedback(conversationId) },
                { label: 'Report response', icon: ICONS.flag, destructive: true, onPress: report },
              ],
            }),
          )}
        </View>
      )}
    </View>
  );
}

/** A small dotted orb while the reply hasn't started (thinking-orbs, "working"). */
function ThinkingDot() {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
      <ThinkingOrb state="working" size={20} displaySize={24} theme={t.scheme} accessibilityLabel="Thinking" />
      <Text style={{ fontFamily: fonts.body, fontSize: 15, color: t.faint }}>Thinking</Text>
    </View>
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
