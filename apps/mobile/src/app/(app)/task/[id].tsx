import type { Project, Task } from '@raco/shared';
import { TASK_TITLE_MAX } from '@raco/shared';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { Chip, TextField } from '@/components/fields';
import { Surface } from '@/components/surface';
import { Checkbox, PageHeader, SectionTitle, TextButton, goBack } from '@/components/ui';
import { deleteTask, getTask, listProjects, updateTask } from '@/lib/data';
import { fonts, useTheme } from '@/theme';

/** Edit one task: title, notes, project, done. */
export default function TaskScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void Promise.all([getTask(id), listProjects()]).then(([found, all]) => {
      setTask(found);
      setProjects(all);
    });
  }, [id]);

  if (!task) return <View style={{ flex: 1, backgroundColor: t.background }} />;

  const patch = (p: Partial<Task>) => setTask({ ...task, ...p });

  const save = async () => {
    if (!task.title.trim()) return;
    setSaving(true);
    try {
      await updateTask(task.id, { title: task.title.trim(), notes: task.notes.trim(), projectId: task.projectId, done: !!task.doneAt });
      goBack();
    } catch {
      setSaving(false);
      Alert.alert("Couldn't save the task", 'Please try again.');
    }
  };

  const remove = () =>
    Alert.alert('Delete this task?', task.title, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteTask(task.id).then(goBack) },
    ]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24, gap: 16 }} keyboardShouldPersistTaps="handled">
        <PageHeader title="Task">
          <TextButton label="Cancel" onPress={goBack} />
        </PageHeader>
        <Surface radius={28} style={{ minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Checkbox checked={!!task.doneAt} onChange={(v) => patch({ doneAt: v ? new Date().toISOString() : null })} label="Done" />
          <Text style={{ flex: 1, fontFamily: fonts.bodyMedium, fontSize: 16, color: t.text }}>{task.doneAt ? 'Done' : 'To do'}</Text>
        </Surface>
        <TextField label="Title" value={task.title} onChangeText={(title) => patch({ title })} maxLength={TASK_TITLE_MAX} />
        <TextField
          label="Notes"
          value={task.notes}
          onChangeText={(notes) => patch({ notes })}
          maxLength={2000}
          multiline
          placeholder="Add details"
          style={{ height: 120, paddingTop: 14, textAlignVertical: 'top' }}
        />
        <SectionTitle>Project</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label="None" selected={!task.projectId} onToggle={() => patch({ projectId: null })} />
          {projects.map((p) => (
            <Chip key={p.id} label={p.name} selected={task.projectId === p.id} onToggle={() => patch({ projectId: p.id })} />
          ))}
        </View>
        <View style={{ marginTop: 8, gap: 4 }}>
          <Button label="Save" loading={saving} disabled={!task.title.trim()} onPress={() => void save()} />
          <Pressable accessibilityRole="button" onPress={remove} style={{ alignSelf: 'center', padding: 12 }}>
            <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 15, color: t.scheme === 'light' ? '#B42318' : '#FF8A80' }}>Delete task</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
