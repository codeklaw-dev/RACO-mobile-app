import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { TextField } from '@/components/fields';
import { PageHeader, TextButton, goBack } from '@/components/ui';
import { pickAvatar } from '@/lib/avatar';
import { notify } from '@/lib/dialog';
import { useSession } from '@/state/session';
import { fonts, useTheme } from '@/theme';

/** Change your name and profile photo (from Profile). */
export default function EditProfile() {
  const t = useTheme();
  const { profile, session, updateProfile } = useSession();
  const [name, setName] = useState(profile?.displayName ?? '');
  const [photo, setPhoto] = useState(profile?.avatar ?? null);
  const [saving, setSaving] = useState(false);
  const fallback = session?.user.email?.split('@')[0] || 'You';

  const choose = async () => {
    try {
      const picked = await pickAvatar();
      if (picked) setPhoto(picked);
    } catch {
      notify("Couldn't open that photo", 'Please try another one.');
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile({ displayName: name.trim() || null, avatar: photo });
      goBack();
    } catch {
      setSaving(false);
      notify("Couldn't save your profile", 'Please try again.');
    }
  };

  const link = (label: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8}>
      <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 15, color: t.text }}>{label}</Text>
    </Pressable>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.background }}>
      <View style={{ padding: 20, gap: 16 }}>
        <PageHeader title="Edit profile">
          <TextButton label="Cancel" onPress={goBack} />
        </PageHeader>
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 8 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Choose a profile photo" onPress={() => void choose()}>
            <Avatar name={name || fallback} photo={photo} size={96} />
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 20 }}>
            {link(photo ? 'Change photo' : 'Add photo', () => void choose())}
            {photo ? link('Remove', () => setPhoto(null)) : null}
          </View>
        </View>
        <TextField label="Name" value={name} onChangeText={setName} placeholder={fallback} maxLength={60} returnKeyType="done" />
        <Button label="Save" loading={saving} onPress={() => void save()} />
      </View>
    </KeyboardAvoidingView>
  );
}
