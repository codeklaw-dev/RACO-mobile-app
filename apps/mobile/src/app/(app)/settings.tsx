import { RESPONSE_STYLES, type ResponseStyle } from '@raco/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { TextField, Toggle } from '@/components/fields';
import { Surface, surfaceStyle, useSurface } from '@/components/surface';
import { Caption, Title } from '@/components/text';
import { deleteAccount } from '@/lib/api';
import { signOut } from '@/lib/auth';
import { useAppLock } from '@/state/app-lock';
import { useSession } from '@/state/session';
import { fonts, useTheme } from '@/theme';

export default function Settings() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const primary = useSurface('primary');
  const { profile, session, updateProfile } = useSession();
  const lock = useAppLock();
  const [name, setName] = useState(profile?.displayName ?? '');
  const [agent, setAgent] = useState(profile?.agentName ?? 'Raco');
  const [saving, setSaving] = useState(false);
  const [biometrics, setBiometrics] = useState(false);

  useEffect(() => {
    void lock.available().then(setBiometrics);
  }, [lock]);

  const dirty = name.trim() !== (profile?.displayName ?? '') || agent.trim() !== profile?.agentName;

  async function save() {
    if (!name.trim() || !agent.trim()) return;
    setSaving(true);
    try {
      await updateProfile({ displayName: name.trim(), agentName: agent.trim() });
    } catch {
      Alert.alert("Couldn't save", 'Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  const setStyle = (style: ResponseStyle) =>
    updateProfile({ responseStyle: style }).catch(() => Alert.alert("Couldn't save", 'Please try again.'));

  const confirmDelete = () =>
    Alert.alert('Delete your account?', 'This permanently deletes your account and all your chats. It cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete account',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAccount();
            await lock.disable();
            await signOut();
          } catch (err) {
            Alert.alert('Something went wrong', (err as Error).message);
          }
        },
      },
    ]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 12 }}
      keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Title style={{ fontSize: 28, lineHeight: 34 }}>Settings</Title>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 17, color: t.text }}>Done</Text>
        </Pressable>
      </View>

      <Caption style={{ marginTop: 12 }}>Profile</Caption>
      <TextField label="Your first name" value={name} onChangeText={setName} maxLength={60} />
      <TextField label="Agent name" value={agent} onChangeText={setAgent} maxLength={40} autoCorrect={false} />
      {dirty ? <Button label="Save" loading={saving} onPress={save} /> : null}

      <Caption style={{ marginTop: 12 }}>Reply style</Caption>
      <Surface accessibilityRole="radiogroup" radius={14} style={{ flexDirection: 'row', padding: 4, gap: 4 }}>
        {RESPONSE_STYLES.map((o) => {
          const on = profile?.responseStyle === o.id;
          return (
            <Pressable
              key={o.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${o.title}. ${o.body}`}
              onPress={() => setStyle(o.id)}
              style={[on ? surfaceStyle(primary) : null, { flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 15, color: on ? primary.color : t.text }}>{o.title}</Text>
            </Pressable>
          );
        })}
      </Surface>

      {biometrics ? (
        <>
          <Caption style={{ marginTop: 12 }}>Security</Caption>
          <Surface radius={14} style={{ minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, fontFamily: fonts.bodyMedium, fontSize: 16, color: t.text }}>Lock with Face ID</Text>
            <Toggle
              label="Lock with Face ID"
              value={lock.enabled}
              onChange={(v) => void (v ? lock.enable() : lock.disable())}
            />
          </Surface>
        </>
      ) : null}

      <Caption style={{ marginTop: 12 }}>Account</Caption>
      <Text style={{ fontFamily: fonts.body, fontSize: 15, color: t.sub, marginHorizontal: 4 }}>{session?.user.email}</Text>
      <Button kind="glass" label="Sign out" onPress={() => void lock.disable().then(signOut)} />
      <Pressable accessibilityRole="button" onPress={confirmDelete} style={{ alignSelf: 'center', padding: 12 }}>
        <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 15, color: t.scheme === 'light' ? '#B42318' : '#FF8A80' }}>Delete account</Text>
      </Pressable>
    </ScrollView>
  );
}
