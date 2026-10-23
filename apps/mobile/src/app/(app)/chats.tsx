import type { ConversationSummary } from '@raco/shared';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/button';
import { ChevronRightIcon, NewChatIcon, PathIcon } from '@/components/icons';
import { surfaceStyle, useSurface } from '@/components/surface';
import { Body, Title } from '@/components/text';
import { supabase } from '@/lib/supabase';
import { fonts, useTheme } from '@/theme';

const SLIDERS = 'M3 6h9M16 6h1M3 14h1M8 14h9M14 4v4M6 12v4';

/** Chat history. Long press a chat to delete it. */
export default function Chats() {
  const t = useTheme();
  const glass = useSurface('glass');
  const insets = useSafeAreaInsets();
  const [chats, setChats] = useState<ConversationSummary[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => setChats(await fetchChats()), []);

  useEffect(() => {
    let active = true;
    void fetchChats().then((c) => active && setChats(c));
    return () => {
      active = false;
    };
  }, []);

  const remove = (c: ConversationSummary) =>
    Alert.alert('Delete this chat?', `"${c.title}" will be deleted for good.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('conversations').delete().eq('id', c.id);
          if (error) Alert.alert("Couldn't delete the chat", 'Please try again.');
          else setChats((all) => all?.filter((x) => x.id !== c.id) ?? null);
        },
      },
    ]);

  const open = (id: string) => {
    router.back();
    router.push({ pathname: '/chat/[id]', params: { id } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.background, paddingTop: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 }}>
        <Title style={{ fontSize: 28, lineHeight: 34 }}>Chats</Title>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton label="Settings" onPress={() => router.push('/settings')}>
            <PathIcon d={SLIDERS} strokeWidth={1.8} color={t.text} />
          </IconButton>
          <IconButton
            label="New chat"
            onPress={() => router.dismissTo('/home')}>
            <NewChatIcon color={t.text} />
          </IconButton>
        </View>
      </View>
      <FlatList
        data={chats ?? []}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, gap: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        ListEmptyComponent={
          chats === null ? undefined : (
            <Body tone="sub" style={{ textAlign: 'center', marginTop: 48 }}>
              No chats yet. Start one from the home screen.
            </Body>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Long press to delete"
            onPress={() => open(item.id)}
            onLongPress={() => remove(item)}
            style={({ pressed }) => [
              surfaceStyle(glass),
              { minHeight: 60, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.8 : 1 },
            ]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text numberOfLines={1} style={{ fontFamily: fonts.bodySemibold, fontSize: 16, color: t.text }}>
                {item.title}
              </Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 13, color: t.faint }}>{relativeDate(item.updatedAt)}</Text>
            </View>
            <ChevronRightIcon color={t.text} />
          </Pressable>
        )}
      />
    </View>
  );
}

async function fetchChats(): Promise<ConversationSummary[]> {
  const { data } = await supabase
    .from('conversations')
    .select('id, title, updated_at')
    .order('updated_at', { ascending: false })
    .limit(100);
  return (data ?? []).map((c) => ({ id: c.id, title: c.title, updatedAt: c.updated_at }));
}

function relativeDate(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (days < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}
