import type { LibraryItem } from '@raco/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActionSheet } from '@/components/action-sheet';
import { ICONS } from '@/components/icons';
import { EmptyState, ListRow, NavBar, SearchField } from '@/components/ui';
import { listLibrary, matches, relativeDate, removeFromLibrary, useFocusData } from '@/lib/data';
import { toPlainText } from '@/lib/markdown';
import { fonts, useTheme } from '@/theme';

/** Replies you saved with the bookmark under a message. */
export default function Library() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const sheet = useActionSheet();
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const items = useFocusData(listLibrary);
  const shown = (items.data ?? []).filter((i) => matches(query, i.title, i.content));

  const actions = (item: LibraryItem) =>
    sheet({
      title: item.title,
      options: [
        ...(item.conversationId
          ? [
              {
                label: 'Open chat',
                icon: ICONS.chats,
                onPress: () => router.push({ pathname: '/chat/[id]', params: { id: item.conversationId! } }),
              },
            ]
          : []),
        {
          label: 'Remove from Library',
          icon: ICONS.trash,
          destructive: true,
          onPress: () => {
            items.set((list) => list?.filter((x) => x.id !== item.id) ?? null);
            removeFromLibrary(item.id).catch(() => {
              Alert.alert("Couldn't remove it", 'Please try again.');
              void items.reload();
            });
          },
        },
      ],
    });

  return (
    <View style={{ flex: 1, backgroundColor: t.background, paddingTop: insets.top + 8 }}>
      <View style={{ paddingHorizontal: 16, gap: 12, paddingBottom: 12 }}>
        <NavBar title="Library" />
        <SearchField value={query} onChangeText={setQuery} placeholder="Search your library" />
      </View>
      <FlatList
        data={shown}
        keyExtractor={(i) => i.id}
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: insets.bottom + 24, gap: 2 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await items.reload();
              setRefreshing(false);
            }}
          />
        }
        ListEmptyComponent={
          items.data === null ? undefined : query ? (
            <EmptyState title="Nothing matches" body={`No saved replies match “${query}”.`} />
          ) : (
            <EmptyState title="Your library is empty" body="Tap the bookmark under any reply to save it here." />
          )
        }
        renderItem={({ item }) => (
          <ListRow
            title={item.title}
            detail={`${relativeDate(item.createdAt)} · ${toPlainText(item.content).slice(0, 80)}`}
            onPress={() => actions(item)}
            onLongPress={() => actions(item)}
          />
        )}
        ListHeaderComponent={
          shown.length ? (
            <Text style={{ paddingHorizontal: 12, paddingBottom: 6, fontFamily: fonts.body, fontSize: 13, color: t.faint }}>
              {shown.length} saved {shown.length === 1 ? 'reply' : 'replies'}
            </Text>
          ) : undefined
        }
      />
    </View>
  );
}
