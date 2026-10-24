import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, type ReactElement } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, FlatList, Platform, Pressable, Text, View } from 'react-native';
import { REPORT_REASONS, type ReportReason } from '@raco/shared';
import { reportMessage } from '@/lib/api';
import { confirm, notify } from '@/lib/dialog';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import type { UiMessage } from '@/state/use-chat';
import { fonts, useTheme } from '@/theme';
import { Markdown } from './markdown';

interface Props {
  messages: UiMessage[];
  agentName: string;
  header?: ReactElement;
}

export function MessageList({ messages, agentName, header }: Props) {
  const list = useRef<FlatList<UiMessage>>(null);
  const last = messages.at(-1);

  // Keep the newest text in view while a reply streams in.
  useEffect(() => {
    list.current?.scrollToEnd({ animated: true });
  }, [messages.length, last?.content]);

  return (
    <FlatList
      ref={list}
      data={messages}
      keyExtractor={(m) => m.id}
      ListHeaderComponent={header}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, gap: 18 }}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => (item.role === 'user' ? <UserBubble message={item} /> : <AssistantMessage message={item} agentName={agentName} />)}
    />
  );
}

function UserBubble({ message }: { message: UiMessage }) {
  const t = useTheme();
  return (
    <Pressable
      onLongPress={() => copy(message.content)}
      accessibilityHint="Long press to copy"
      style={{ alignSelf: 'flex-end', maxWidth: '85%', borderRadius: 20, borderBottomRightRadius: 6, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: t.bubble }}>
      <Text selectable style={{ fontFamily: fonts.body, fontSize: 17, lineHeight: 24, color: t.text }}>
        {message.content}
      </Text>
    </Pressable>
  );
}

function AssistantMessage({ message, agentName }: { message: UiMessage; agentName: string }) {
  const t = useTheme();
  return (
    <Pressable
      onLongPress={() => !message.pending && openActions(message)}
      accessibilityHint="Long press to copy or report"
      accessibilityActions={[{ name: 'copy', label: 'Copy' }, { name: 'report', label: 'Report response' }]}
      onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'copy' ? copy(message.content) : chooseReason(message))}
      style={{ gap: 8 }}>
      <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 14, color: t.text }}>{agentName}</Text>
      {message.content ? <Markdown text={message.content} /> : <TypingDots />}
    </Pressable>
  );
}

function TypingDots() {
  const t = useTheme();
  const phase = useSharedValue(0.3);
  useEffect(() => {
    phase.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [phase]);
  const style = useAnimatedStyle(() => ({ opacity: phase.value }));
  return (
    <Animated.View accessibilityLabel="Thinking" style={[{ flexDirection: 'row', gap: 6, paddingVertical: 8 }, style]}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: t.faint }} />
      ))}
    </Animated.View>
  );
}

function copy(text: string) {
  if (!text) return;
  void Clipboard.setStringAsync(text);
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export function CenteredSpinner() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={t.faint} />
    </View>
  );
}

const REASON_LABELS: Record<ReportReason, string> = {
  harmful: 'Harmful or dangerous',
  sexual: 'Sexual content',
  hateful: 'Hateful or harassing',
  inaccurate: 'Wrong or misleading',
  other: 'Something else',
};

/** Copy or report an AI response (App Review Guideline 1.2). */
function openActions(message: UiMessage) {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Copy', 'Report response', 'Cancel'], destructiveButtonIndex: 1, cancelButtonIndex: 2 },
      (i) => (i === 0 ? copy(message.content) : i === 1 ? chooseReason(message) : undefined),
    );
  } else if (Platform.OS === 'web') {
    chooseReason(message);
  } else {
    Alert.alert('Response', undefined, [
      { text: 'Copy', onPress: () => copy(message.content) },
      { text: 'Report response', style: 'destructive', onPress: () => chooseReason(message) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }
}

function send(message: UiMessage, reason: ReportReason) {
  return reportMessage({ messageId: message.id, reason })
    .then(() => notify('Thanks for telling us', 'We review every report and use it to make replies safer.'))
    .catch((err: Error) => notify("Couldn't send the report", err.message));
}

function chooseReason(message: UiMessage) {
  if (Platform.OS === 'web') {
    void confirm('Report this response?', 'We review every report.', 'Report', 'Cancel').then((ok) => {
      if (ok) void send(message, 'other');
    });
    return;
  }
  const labels = REPORT_REASONS.map((r) => REASON_LABELS[r]);
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { title: 'What’s wrong with this response?', options: [...labels, 'Cancel'], cancelButtonIndex: labels.length },
      (i) => i < labels.length && void send(message, REPORT_REASONS[i]!),
    );
  } else {
    Alert.alert('What’s wrong with this response?', undefined, [
      ...REPORT_REASONS.map((r) => ({ text: REASON_LABELS[r], onPress: () => void send(message, r) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }
}
