import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { ChevronRightIcon, ICONS, PathIcon } from '@/components/icons';
import { Surface } from '@/components/surface';
import { ListRow, NavBar, SectionTitle, Segmented } from '@/components/ui';
import { signOut } from '@/lib/auth';
import { config } from '@/lib/config';
import { sendFeedback } from '@/lib/feedback';
import { listChats, listProjects, listTasks, useFocusData } from '@/lib/data';
import { useAppLock } from '@/state/app-lock';
import { usePreferences, type AppearanceChoice } from '@/state/preferences';
import { useSession } from '@/state/session';
import { FONT_SETS, fonts, useTheme, type FontSetId } from '@/theme';

/** Who you are, what you've done, and the way to Settings. */
export default function Profile() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, session } = useSession();
  const lock = useAppLock();
  const prefs = usePreferences();
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
        <Avatar name={name} photo={profile?.avatar} size={72} />
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 22, color: t.text }}>{name}</Text>
          {email ? <Text style={{ fontFamily: fonts.body, fontSize: 14, color: t.sub }}>{email}</Text> : null}
        </View>
        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: t.tile }}>
          <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 12, color: t.text }}>Free plan</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/edit-profile')}
          style={({ pressed }) => ({ paddingHorizontal: 16, height: 34, borderRadius: 17, justifyContent: 'center', backgroundColor: pressed ? t.bubble : t.tile })}>
          <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 14, color: t.text }}>Edit profile</Text>
        </Pressable>
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

      <SectionTitle>Appearance</SectionTitle>
      <Segmented<AppearanceChoice>
        value={prefs.appearance}
        onChange={prefs.setAppearance}
        options={[
          { id: 'system', label: 'System' },
          { id: 'light', label: 'Light' },
          { id: 'dark', label: 'Dark' },
        ]}
      />

      <ListRow
        title="Background hue"
        detail={prefs.hue === 'off' ? 'Off · try the colours live' : `${prefs.hue[0]!.toUpperCase()}${prefs.hue.slice(1)} on Home`}
        leading={<PathIcon d={ICONS.sun} color={t.text} size={22} />}
        trailing={<ChevronRightIcon color={t.faint} />}
        onPress={() => router.push('/hue-lab')}
      />

      <SectionTitle>Font</SectionTitle>
      <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
        {(Object.keys(FONT_SETS) as FontSetId[]).map((id) => {
          const f = FONT_SETS[id];
          const on = prefs.font === id;
          return (
            <Pressable
              key={id}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${f.label}, ${f.detail}`}
              onPress={() => prefs.setFont(id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                padding: 14,
                borderRadius: 18,
                borderWidth: 1.5,
                borderColor: on ? t.text : 'transparent',
                backgroundColor: t.tile,
              }}>
              <Text style={{ fontFamily: f.set.display, fontSize: 26, color: t.text, width: 40, textAlign: 'center' }}>Aa</Text>
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={{ fontFamily: f.set.bodySemibold, fontSize: 16, color: t.text }}>{f.label}</Text>
                <Text style={{ fontFamily: f.set.body, fontSize: 13, color: t.faint }}>{f.detail}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={{ gap: 8, marginTop: 12 }}>
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
          title="Send feedback"
          detail="Tell us what to improve"
          leading={<PathIcon d={ICONS.mail} color={t.text} size={22} />}
          trailing={<ChevronRightIcon color={t.faint} />}
          onPress={() => void sendFeedback()}
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
