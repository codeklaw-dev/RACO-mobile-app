import type { Task } from '@raco/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddTask, Checkbox, EmptyState, ListRow, NavBar, SearchField, Segmented } from '@/components/ui';
import { createTask, deleteTask, listProjects, listTasks, matches, updateTask, useFocusData } from '@/lib/data';
import { useTheme } from '@/theme';

type Filter = 'open' | 'done';

/** Every task across projects. Tick to complete; tap to edit. */
export default function Tasks() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('open');
  const [refreshing, setRefreshing] = useState(false);
  const tasks = useFocusData(() => listTasks());
  const projects = useFocusData(listProjects);

  const projectName = useMemo(() => new Map((projects.data ?? []).map((p) => [p.id, p.name])), [projects.data]);
  const all = tasks.data ?? [];
  const shown = all.filter((task) => (filter === 'done') === !!task.doneAt && matches(query, task.title, task.notes, task.projectId ? projectName.get(task.projectId) : null));

  const toggle = (task: Task, done: boolean) => {
    tasks.set((list) => list?.map((x) => (x.id === task.id ? { ...x, doneAt: done ? new Date().toISOString() : null } : x)) ?? null);
    void updateTask(task.id, { done }).catch(() => {
      Alert.alert("Couldn't update the task", 'Please try again.');
      void tasks.reload();
    });
  };

  const remove = (task: Task) =>
    Alert.alert('Delete this task?', task.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          tasks.set((list) => list?.filter((x) => x.id !== task.id) ?? null);
          void deleteTask(task.id).catch(() => void tasks.reload());
        },
      },
    ]);

  const add = async (title: string) => {
    const task = await createTask(title);
    tasks.set((list) => [task, ...(list ?? [])]);
    setFilter('open');
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.background, paddingTop: insets.top + 8 }}>
      <View style={{ paddingHorizontal: 16, gap: 12, paddingBottom: 12 }}>
        <NavBar title="Tasks" />
        <SearchField value={query} onChangeText={setQuery} placeholder="Search tasks" />
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'open', label: `To do${tasks.data ? ` · ${all.filter((x) => !x.doneAt).length}` : ''}` },
            { id: 'done', label: 'Done' },
          ]}
        />
      </View>
      <FlatList
        data={shown}
        keyExtractor={(task) => task.id}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={filter === 'open' ? <AddTask onAdd={add} /> : undefined}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await Promise.all([tasks.reload(), projects.reload()]);
              setRefreshing(false);
            }}
          />
        }
        ListEmptyComponent={
          tasks.data === null ? undefined : query ? (
            <EmptyState title="No matching tasks" body={`Nothing matches “${query}”.`} />
          ) : filter === 'open' ? (
            <EmptyState title="All clear" body="Add a task above, or ask Raco to plan something with you." />
          ) : (
            <EmptyState title="Nothing done yet" body="Completed tasks show up here." />
          )
        }
        renderItem={({ item }) => (
          <ListRow
            title={item.title}
            detail={item.projectId ? projectName.get(item.projectId) : undefined}
            muted={!!item.doneAt}
            leading={<Checkbox checked={!!item.doneAt} onChange={(v) => toggle(item, v)} label={`Mark "${item.title}" ${item.doneAt ? 'not done' : 'done'}`} />}
            onPress={() => router.push({ pathname: '/task/[id]', params: { id: item.id } })}
            onLongPress={() => remove(item)}
            accessibilityHint="Opens the task. Long press to delete."
          />
        )}
      />
    </View>
  );
}
