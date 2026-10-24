import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, SlideInLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/button';
import { ICONS, NewChatIcon, PathIcon } from '@/components/icons';
import { goBack } from '@/components/ui';
import { listChats, useFocusData } from '@/lib/data';
import { useSession } from '@/state/session';
import { accent, fonts, useTheme } from '@/theme';

/** Close the menu, then open the destination. */
function go(href: Href) {
  router.back();
  router.push(href);
}

/** Sidebar: search, new chat, projects, tasks, recent chats and the profile. */
export default function Menu() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, session } = useSession();
  const chats = useFocusData(listChats);
  const name = profile?.displayName || session?.user.email?.split('@')[0] || 'You';

  const row = (label: string, icon: string, href: Href) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      onPress={() => go(href)}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, height: 48, paddingHorizontal: 12, borderRadius: 24, backgroundColor: pressed ? t.tile : 'transparent' })}>
      <PathIcon d={icon} color={t.text} size={22} />
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 17, color: t.text }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <Animated.View
        entering={SlideInLeft.duration(220)}
        style={{
          width: '84%',
          maxWidth: 360,
          backgroundColor: t.background,
          paddingTop: insets.top + 8,
          paddingBottom: Math.max(insets.bottom, 12),
          boxShadow: '0 0 40px rgba(0,0,0,0.12)',
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 }}>
          <Pressable
            accessibilityRole="search"
            accessibilityLabel="Search"
            onPress={() => go('/search')}
            style={{ flex: 1, height: 44, borderRadius: 22, backgroundColor: t.tile, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 }}>
            <PathIcon d={ICONS.search} color={t.faint} size={18} strokeWidth={1.8} />
            <Text style={{ fontFamily: fonts.body, fontSize: 16, color: t.faint }}>Search</Text>
          </Pressable>
          <IconButton label="New chat" onPress={() => go('/home')}>
            <NewChatIcon color={t.text} />
          </IconButton>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 16, paddingBottom: 16 }}>
          {row('New chat', ICONS.chats, '/home')}
          {row('Projects', ICONS.projects, '/projects')}
          {row('Tasks', ICONS.tasks, '/tasks')}

          {chats.data?.length ? (
            <Text style={{ marginTop: 20, marginBottom: 4, paddingHorizontal: 12, fontFamily: fonts.bodyMedium, fontSize: 14, color: t.faint }}>Chats</Text>
          ) : null}
          {(chats.data ?? []).map((c) => (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              onPress={() => go({ pathname: '/chat/[id]', params: { id: c.id } })}
              style={({ pressed }) => ({ height: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 22, backgroundColor: pressed ? t.tile : 'transparent' })}>
              <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 16, color: t.text }}>
                {c.title}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${name}, profile and settings`}
          onPress={() => go('/profile')}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 8, padding: 8, borderRadius: 28, backgroundColor: pressed ? t.tile : 'transparent' })}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 16, color: '#2A2A2B' }}>{name.charAt(0).toUpperCase()}</Text>
          </View>
          <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.bodyMedium, fontSize: 16, color: t.text }}>
            {name}
          </Text>
          <PathIcon d={ICONS.settings} color={t.faint} size={20} />
        </Pressable>
      </Animated.View>

      <Animated.View entering={FadeIn.duration(220)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close menu" onPress={goBack} style={{ flex: 1 }} />
      </Animated.View>
    </View>
  );
}
