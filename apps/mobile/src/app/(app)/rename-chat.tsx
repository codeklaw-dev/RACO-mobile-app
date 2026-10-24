import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { Button } from '@/components/button';
import { TextField } from '@/components/fields';
import { PageHeader, TextButton, goBack } from '@/components/ui';
import { renameChat } from '@/lib/data';
import { useTheme } from '@/theme';

/** Rename a chat (from a chat's long-press menu). */
export default function RenameChat() {
  const t = useTheme();
  const { id, title: initial } = useLocalSearchParams<{ id: string; title?: string }>();
  const [title, setTitle] = useState(initial ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const next = title.trim();
    if (!next) return;
    setSaving(true);
    try {
      await renameChat(id, next);
      goBack();
    } catch {
      setSaving(false);
      Alert.alert("Couldn't rename the chat", 'Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.background }}>
      <View style={{ padding: 20, gap: 16 }}>
        <PageHeader title="Rename chat">
          <TextButton label="Cancel" onPress={goBack} />
        </PageHeader>
        <TextField
          label="Name"
          value={title}
          onChangeText={setTitle}
          maxLength={120}
          autoFocus
          selectTextOnFocus
          onSubmitEditing={() => void save()}
          returnKeyType="done"
        />
        <Button label="Save" loading={saving} disabled={!title.trim()} onPress={() => void save()} />
      </View>
    </KeyboardAvoidingView>
  );
}
