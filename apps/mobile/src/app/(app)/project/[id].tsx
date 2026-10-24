import type { Project, Task } from '@raco/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, IconButton } from '@/components/button';
import { ChevronRightIcon, ICONS, NewChatIcon, PathIcon } from '@/components/icons';
import { CenteredSpinner } from '@/components/message-list';
import { AddTask, Checkbox, EmptyState, ListRow, NavBar, SectionTitle, TextButton, goBack } from '@/components/ui';
import { createTask, deleteProject, getProject, listChats, listTasks, relativeDate, updateTask, useFocusData } from '@/lib/data';
import { fonts, useTheme } from '@/theme';

/** One project: its tasks and chats, and a way to start a chat inside it. */
export default function ProjectScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useFocusData(async () => {
    const [project, tasks, chats] = await Promise.all([getProject(id), listTasks(id), listChats(id)]);
    return { project, tasks, chats };
  });
  const project = data.data?.project;
  const tasks = useMemo(() => [...(data.data?.tasks ?? [])].sort((a, b) => Number(!!a.doneAt) - Number(!!b.doneAt)), [data.data?.tasks]);

  const setTasks = (fn: (list: Task[]) => Task[]) => data.set((d) => (d ? { ...d, tasks: fn(d.tasks) } : d));
  const toggle = (task: Task, done: boolean) => {
    setTasks((list) => list.map((x) => (x.id === task.id ? { ...x, doneAt: done ? new Date().toISOString() : null } : x)));
    void updateTask(task.id, { done }).catch(() => void data.reload());
  };

  const confirmDelete = (p: Project) =>
    Alert.alert(`Delete “${p.name}”?`, 'Its chats and tasks are kept and moved out of the project.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          void deleteProject(p.id)
            .then(goBack)
            .catch(() => Alert.alert("Couldn't delete the project", 'Please try again.')),
      },
    ]);

  const newChat = () => router.push({ pathname: '/chat/[id]', params: { id: 'new', projectId: id } });

  return (
    <View style={{ flex: 1, backgroundColor: t.background, paddingTop: insets.top + 12 }}>
      <View style={{ paddingHorizontal: 16 }}>
        <NavBar>
          {project ? (
            <>
              <TextButton label="Edit" onPress={() => router.push({ pathname: '/project/new', params: { id } })} />
              <IconButton label="Delete project" onPress={() => confirmDelete(project)}>
                <PathIcon d={ICONS.trash} color={t.text} />
              </IconButton>
            </>
          ) : null}
        </NavBar>
      </View>
      {data.data === null ? (
        <CenteredSpinner />
      ) : !project ? (
        <EmptyState title="Project not found" body="It may have been deleted." />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 10 }} keyboardShouldPersistTaps="handled">
          <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.6, color: t.text }}>
            {project.name}
          </Text>
          {project.description ? <Text style={{ fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: t.sub }}>{project.description}</Text> : null}
          <Button label="New chat in this project" icon={<NewChatIcon color={t.primary.color} />} onPress={newChat} style={{ marginTop: 8 }} />

          <SectionTitle>{`Tasks · ${tasks.filter((x) => !x.doneAt).length} open`}</SectionTitle>
          <AddTask
            placeholder="Add a task to this project"
            onAdd={async (title) => {
              const task = await createTask(title, id);
              setTasks((list) => [task, ...list]);
            }}
          />
          {tasks.map((task) => (
            <ListRow
              key={task.id}
              title={task.title}
              muted={!!task.doneAt}
              leading={<Checkbox checked={!!task.doneAt} onChange={(v) => toggle(task, v)} label={`Mark "${task.title}" ${task.doneAt ? 'not done' : 'done'}`} />}
              onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
            />
          ))}

          <SectionTitle>Chats</SectionTitle>
          {data.data.chats.length ? (
            data.data.chats.map((c) => (
              <ListRow
                key={c.id}
                title={c.title}
                detail={relativeDate(c.updatedAt)}
                trailing={<ChevronRightIcon color={t.faint} />}
                onPress={() => router.push({ pathname: '/chat/[id]', params: { id: c.id } })}
              />
            ))
          ) : (
            <Text style={{ fontFamily: fonts.body, fontSize: 15, color: t.faint, paddingHorizontal: 4 }}>No chats in this project yet.</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}
