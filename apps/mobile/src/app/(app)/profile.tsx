import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Linking, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { ChevronRightIcon, ICONS, PathIcon } from '@/components/icons';
import { Surface } from '@/components/surface';
import { ListRow, NavBar } from '@/components/ui';
import { signOut } from '@/lib/auth';
import { config } from '@/lib/config';
import { listChats, listProjects, listTasks, useFocusData } from '@/lib/data';
import { useAppLock } from '@/state/app-lock';
import { useSession } from '@/state/session';
import { accent, fonts, useTheme } from '@/theme';

/** Who you are, what you've done, and the way to Settings. */
export default function Profile() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, session } = useSession();
  const lock = useAppLock();
  const stats = useFocusData(async () => {
    const [chats, projects, tasks] = await Promise.all([listChats(), listProjects(), listTasks()]);
    return { chats: chats.length, projects: projects.length, done: tasks.filter((x) => x.doneAt).length };
  });

  const email = session?.user.email ?? '';
  const name = profile?.displayName || email.split('@')[0] || 'You';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.background }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}>
      <NavBar title="Profile" />

      <Surface radius={20} style={{ padding: 20, alignItems: 'center', gap: 10 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 30, color: '#2A2A2B' }}>{name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 22, color: t.text }}>{name}</Text>
          {email ? <Text style={{ fontFamily: fonts.body, fontSize: 14, color: t.sub }}>{email}</Text> : null}
        </View>
        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: t.tile }}>
          <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 12, color: t.text }}>Free plan</Text>
        </View>
        <View style={{ flexDirection: 'row', alignSelf: 'stretch', marginTop: 6 }}>
          {[
            { label: 'Chats', value: stats.data?.chats },
            { label: 'Projects', value: stats.data?.projects },
            { label: 'Tasks done', value: stats.data?.done },
          ].map((s) => (
            <View key={s.label} accessible accessibilityLabel={`${s.value ?? 0} ${s.label}`} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 22, color: t.text }}>{s.value ?? '–'}</Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 13, color: t.faint }}>{s.label}</Text>
            </View>
          ))}
        </View>
      </Surface>

      <View style={{ gap: 8, marginTop: 4 }}>
        <ListRow
          title="Settings"
          detail="Profile, replies, privacy and security"
          leading={<PathIcon d={ICONS.settings} color={t.text} size={22} />}
          trailing={<ChevronRightIcon color={t.faint} />}
          onPress={() => router.push('/settings')}
        />
        <ListRow
          title="Help & support"
          detail={config.supportEmail}
          leading={<PathIcon d={ICONS.chats} color={t.text} size={22} />}
          trailing={<ChevronRightIcon color={t.faint} />}
          onPress={() => void Linking.openURL(`mailto:${config.supportEmail}`)}
        />
        <ListRow
          title="Privacy Policy"
          leading={<PathIcon d={ICONS.privacy} color={t.text} size={22} />}
          trailing={<ChevronRightIcon color={t.faint} />}
          onPress={() => void WebBrowser.openBrowserAsync(config.privacyUrl)}
        />
      </View>

      <Button kind="glass" label="Sign out" onPress={() => void lock.disable().then(signOut)} style={{ marginTop: 12 }} />
    </ScrollView>
  );
}
