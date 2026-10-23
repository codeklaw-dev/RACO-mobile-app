import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, type ReactElement } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import type { UiMessage } from '@/state/use-chat';
import { fonts, useTheme } from '@/theme';
import { Markdown } from './markdown';
import { surfaceStyle, useSurface } from './surface';

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
  const primary = useSurface('primary');
  return (
    <Pressable
      onLongPress={() => copy(message.content)}
      accessibilityHint="Long press to copy"
      style={[surfaceStyle(primary), { alignSelf: 'flex-end', maxWidth: '85%', borderRadius: 18, borderBottomRightRadius: 6, paddingVertical: 10, paddingHorizontal: 14 }]}>
      <Text selectable style={{ fontFamily: fonts.body, fontSize: 17, lineHeight: 24, color: t.primary.color }}>
        {message.content}
      </Text>
    </Pressable>
  );
}

function AssistantMessage({ message, agentName }: { message: UiMessage; agentName: string }) {
  const t = useTheme();
  return (
    <Pressable onLongPress={() => copy(message.content)} accessibilityHint="Long press to copy" style={{ gap: 8 }}>
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
