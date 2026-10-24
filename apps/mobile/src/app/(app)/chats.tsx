import type { ConversationSummary } from '@raco/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActionSheet } from '@/components/action-sheet';
import { ICONS, PathIcon } from '@/components/icons';
import { EmptyState, ListRow, NavBar, SearchField } from '@/components/ui';
import { deleteChat, listChats, listProjects, matches, relativeDate, setChatPinned, useFocusData } from '@/lib/data';
import { useTheme } from '@/theme';

/** Every chat, newest first ("View all" in the menu). Long press for pin, rename and delete. */
export default function Chats() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const sheet = useActionSheet();
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const chats = useFocusData(listChats);
  const projects = useFocusData(listProjects);
  const projectName = useMemo(() => new Map((projects.data ?? []).map((p) => [p.id, p.name])), [projects.data]);
  const shown = (chats.data ?? []).filter((c) => matches(query, c.title, c.projectId ? projectName.get(c.projectId) : null));

  const actions = (c: ConversationSummary) =>
    sheet({
      title: c.title,
      options: [
        {
          label: c.pinnedAt ? 'Unpin' : 'Pin',
          icon: ICONS.pin,
          onPress: () => {
            const pinnedAt = c.pinnedAt ? null : new Date().toISOString();
            chats.set((list) => list?.map((x) => (x.id === c.id ? { ...x, pinnedAt } : x)) ?? null);
            void setChatPinned(c.id, !c.pinnedAt).catch(() => void chats.reload());
          },
        },
        {
          label: 'Rename',
          icon: ICONS.pencil,
          onPress: () => router.push({ pathname: '/rename-chat', params: { id: c.id, title: c.title } }),
        },
        {
          label: 'Delete',
          icon: ICONS.trash,
          destructive: true,
          onPress: () => {
            chats.set((list) => list?.filter((x) => x.id !== c.id) ?? null);
            deleteChat(c.id).catch(() => {
              Alert.alert("Couldn't delete the chat", 'Please try again.');
              void chats.reload();
            });
          },
        },
      ],
    });

  return (
    <View style={{ flex: 1, backgroundColor: t.background, paddingTop: insets.top + 8 }}>
      <View style={{ paddingHorizontal: 16, gap: 12, paddingBottom: 12 }}>
        <NavBar title="All chats" />
        <SearchField value={query} onChangeText={setQuery} placeholder="Search chats" />
      </View>
      <FlatList
        data={shown}
        keyExtractor={(c) => c.id}
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: insets.bottom + 24, gap: 2 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await chats.reload();
              setRefreshing(false);
            }}
          />
        }
        ListEmptyComponent={
          chats.data === null ? undefined : query ? (
            <EmptyState title="No matching chats" body={`Nothing matches “${query}”.`} />
          ) : (
            <EmptyState title="No chats yet" body="Start one from the home screen." />
          )
        }
        renderItem={({ item }) => (
          <ListRow
            title={item.title}
            detail={[item.projectId ? projectName.get(item.projectId) : null, relativeDate(item.updatedAt)].filter(Boolean).join(' · ')}
            trailing={item.pinnedAt ? <PathIcon d={ICONS.pin} color={t.faint} size={16} /> : undefined}
            accessibilityHint="Long press for pin, rename and delete"
            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id } })}
            onLongPress={() => actions(item)}
          />
        )}
      />
    </View>
  );
}
