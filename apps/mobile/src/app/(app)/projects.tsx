import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/button';
import { ChevronRightIcon, ICONS, PathIcon, PlusIcon } from '@/components/icons';
import { EmptyState, ListRow, NavBar, SearchField, TextButton } from '@/components/ui';
import { listProjects, listTasks, matches, useFocusData } from '@/lib/data';
import { useTheme } from '@/theme';

/** Projects group related chats and tasks. */
export default function Projects() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const projects = useFocusData(listProjects);
  const tasks = useFocusData(() => listTasks());

  const openTasks = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of tasks.data ?? []) if (task.projectId && !task.doneAt) counts.set(task.projectId, (counts.get(task.projectId) ?? 0) + 1);
    return counts;
  }, [tasks.data]);

  const shown = (projects.data ?? []).filter((p) => matches(query, p.name, p.description));
  const create = () => router.push('/project/new');

  return (
    <View style={{ flex: 1, backgroundColor: t.background, paddingTop: insets.top + 8 }}>
      <View style={{ paddingHorizontal: 16, gap: 12, paddingBottom: 12 }}>
        <NavBar title="Projects">
          <IconButton label="New project" onPress={create}>
            <PlusIcon color={t.text} />
          </IconButton>
        </NavBar>
        <SearchField value={query} onChangeText={setQuery} placeholder="Search projects" />
      </View>
      <FlatList
        data={shown}
        keyExtractor={(p) => p.id}
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await Promise.all([projects.reload(), tasks.reload()]);
              setRefreshing(false);
            }}
          />
        }
        ListEmptyComponent={
          projects.data === null ? undefined : query ? (
            <EmptyState title="No matching projects" body={`Nothing matches “${query}”.`} />
          ) : (
            <EmptyState
              title="No projects yet"
              body="Use a project to keep the chats and tasks for one piece of work together."
              action={<TextButton label="Create a project" onPress={create} />}
            />
          )
        }
        renderItem={({ item }) => {
          const open = openTasks.get(item.id) ?? 0;
          return (
            <ListRow
              title={item.name}
              detail={item.description || (open ? undefined : 'No open tasks')}
              leading={<PathIcon d={ICONS.projects} color={t.text} size={22} />}
              trailing={<ChevronRightIcon color={t.faint} />}
              onPress={() => router.push({ pathname: '/project/[id]', params: { id: item.id } })}
              accessibilityHint={open ? `${open} open ${open === 1 ? 'task' : 'tasks'}` : undefined}
            />
          );
        }}
      />
    </View>
  );
}
