import { PROJECT_NAME_MAX } from '@raco/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { TextField } from '@/components/fields';
import { PageHeader, TextButton, goBack } from '@/components/ui';
import { createProject, getProject, updateProject } from '@/lib/data';
import { useTheme } from '@/theme';

/** Create a project, or edit one when opened with `id`. */
export default function ProjectForm() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    void getProject(id).then((p) => {
      if (!p) return;
      setName(p.name);
      setDescription(p.description);
    });
  }, [id]);

  const save = async () => {
    const n = name.trim();
    if (!n) return;
    setSaving(true);
    try {
      if (id) {
        await updateProject(id, { name: n, description: description.trim() });
        goBack();
      } else {
        const project = await createProject(n, description.trim());
        router.replace({ pathname: '/project/[id]', params: { id: project.id } });
      }
    } catch {
      setSaving(false);
      Alert.alert("Couldn't save the project", 'Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 20, paddingBottom: insets.bottom + 24, gap: 16 }} keyboardShouldPersistTaps="handled">
        <PageHeader title={id ? 'Edit project' : 'New project'}>
          <TextButton label="Cancel" onPress={goBack} />
        </PageHeader>
        <TextField label="Name" value={name} onChangeText={setName} maxLength={PROJECT_NAME_MAX} autoFocus={!id} placeholder="e.g. Product launch" />
        <TextField
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          maxLength={500}
          multiline
          placeholder="What is this project about?"
          style={{ height: 110, paddingTop: 14, textAlignVertical: 'top' }}
        />
        <View style={{ marginTop: 8 }}>
          <Button label={id ? 'Save' : 'Create project'} loading={saving} disabled={!name.trim()} onPress={() => void save()} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
