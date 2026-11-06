import type { ConversationSummary } from '@raco/shared';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, FadeIn, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useActionSheet } from '@/components/action-sheet';
import { Avatar } from '@/components/avatar';
import { IconButton } from '@/components/button';
import { ICONS, Logo, PathIcon } from '@/components/icons';
import { SearchField } from '@/components/ui';
import { deleteChat, listChats, setChatPinned, useFocusData } from '@/lib/data';
import { isEmpty, useSearch } from '@/lib/search';
import { useSession } from '@/state/session';
import { fonts, useTheme } from '@/theme';

const RECENT_LIMIT = 8;

// The whole panel is frosted glass: the screen and its hue show through, blurred.
const GLASS = { light: 'rgba(240,240,242,0.5)', dark: 'rgba(30,30,32,0.45)' };
// Just enough dimming to show the app behind is inactive, without darkening it.
const DIM = { light: 'rgba(0,0,0,0.06)', dark: 'rgba(0,0,0,0.18)' };
// Browsers blur what's behind with backdrop-filter; phones use BlurView.
const WEB_FROST =
  Platform.OS === 'web'
    ? ({ backdropFilter: 'blur(28px) saturate(1.6)', WebkitBackdropFilter: 'blur(28px) saturate(1.6)' } as object)
    : null;

// Remembered while the app is open, so sections stay as the user left them.
const collapsed = { pinned: false, recent: false };

/**
 * The left panel: Projects, Library and Daily tasks, then pinned and recent
 * chats, with the profile and a New chat button at the bottom. Swipe it left,
 * or tap outside it, to close.
 */
export default function Menu() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screen } = useWindowDimensions();
  const width = Math.min(screen * 0.86, 340);
  const { current } = useLocalSearchParams<{ current?: string }>();
  const { profile, session } = useSession();
  const sheet = useActionSheet();
  const chats = useFocusData(listChats);
  const [open, setOpen] = useState({ pinned: !collapsed.pinned, recent: !collapsed.recent });
  const name = profile?.displayName || session?.user.email?.split('@')[0] || 'You';

  // Search happens in the panel: the field slides in under the logo and results take the list's place.
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const { results } = useSearch(query);
  const searchIn = useSharedValue(0);
  const startSearch = () => {
    setSearching(true);
    searchIn.set(withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }));
  };
  const endSearch = () => {
    setQuery('');
    searchIn.set(
      withTiming(0, { duration: 180, easing: Easing.in(Easing.cubic) }, (done) => {
        if (done) scheduleOnRN(setSearching, false);
      }),
    );
  };
  const searchBarStyle = useAnimatedStyle(() => ({
    height: searchIn.value * 56,
    opacity: searchIn.value,
    transform: [{ translateY: (searchIn.value - 1) * 12 }],
  }));

  // 0 = closed, 1 = open; the panel slides and the backdrop fades with it.
  const progress = useSharedValue(0);
  const drag = useSharedValue(0);
  useEffect(() => {
    progress.set(withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) }));
  }, [progress]);

  const close = (then?: () => void) => {
    progress.set(
      withTiming(0, { duration: 180, easing: Easing.in(Easing.cubic) }, (done) => {
        if (done) scheduleOnRN(finish, then);
      }),
    );
  };
  const finish = (then?: () => void) => {
    router.back();
    then?.();
  };
  const go = (href: Href) => close(() => router.push(href));
  const newChat = () => (current ? close(() => router.replace('/home')) : close());

  const swipe = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate((e) => {
      drag.set(Math.min(0, e.translationX));
    })
    .onEnd((e) => {
      if (e.translationX < -width * 0.3 || e.velocityX < -600) {
        progress.set(
          withTiming(0, { duration: 160 }, (done) => {
            if (done) scheduleOnRN(finish, undefined);
          }),
        );
      } else {
        drag.set(withSpring(0, { damping: 20, stiffness: 240 }));
      }
    });

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-width, 0]) + drag.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value * (1 + drag.value / width) }));

  const all = chats.data ?? [];
  const pinned = all.filter((c) => c.pinnedAt).sort((a, b) => b.pinnedAt!.localeCompare(a.pinnedAt!));
  const recent = all.filter((c) => !c.pinnedAt).slice(0, RECENT_LIMIT);

  const toggle = (key: 'pinned' | 'recent') =>
    setOpen((o) => {
      collapsed[key] = o[key];
      return { ...o, [key]: !o[key] };
    });

  const chatActions = (c: ConversationSummary) =>
    sheet({
      title: c.title,
      options: [
        {
          label: c.pinnedAt ? 'Unpin' : 'Pin',
          icon: ICONS.pin,
          onPress: () => {
            const pinnedAt = c.pinnedAt ? null : new Date().toISOString();
            chats.set((list) => list?.map((x) => (x.id === c.id ? { ...x, pinnedAt } : x)) ?? null);
            void setChatPinned(c.id, !c.pinnedAt).catch(() => void chats.reload());
          },
        },
        { label: 'Rename', icon: ICONS.pencil, onPress: () => go({ pathname: '/rename-chat', params: { id: c.id, title: c.title } }) },
        {
          label: 'Delete',
          icon: ICONS.trash,
          destructive: true,
          onPress: () => {
            chats.set((list) => list?.filter((x) => x.id !== c.id) ?? null);
            deleteChat(c.id).catch(() => {
              Alert.alert("Couldn't delete the chat", 'Please try again.');
              void chats.reload();
            });
            if (c.id === current) close(() => router.replace('/home'));
          },
        },
      ],
    });

  /** A main menu row: opens a page, or runs an action (Search). */
  const navRow = (label: string, icon: string, target: Href | (() => void)) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      onPress={() => (typeof target === 'function' ? target() : go(target))}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        height: 46,
        paddingHorizontal: 12,
        borderRadius: 23,
        backgroundColor: pressed ? t.tile : 'transparent',
      })}>
      <PathIcon d={icon} color={t.text} size={21} />
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 17, color: t.text }}>{label}</Text>
    </Pressable>
  );

  const chatRow = (c: ConversationSummary) => {
    const isCurrent = c.id === current;
    return (
      <Pressable
        key={c.id}
        accessibilityRole="button"
        accessibilityState={{ selected: isCurrent }}
        accessibilityHint="Long press for pin, rename and delete"
        onPress={() => (isCurrent ? close() : go({ pathname: '/chat/[id]', params: { id: c.id } }))}
        onLongPress={() => chatActions(c)}
        style={({ pressed }) => ({
          height: 42,
          justifyContent: 'center',
          paddingHorizontal: 12,
          borderRadius: 21,
          backgroundColor: isCurrent || pressed ? t.tile : 'transparent',
        })}>
        <Text numberOfLines={1} style={{ fontFamily: isCurrent ? fonts.bodyMedium : fonts.body, fontSize: 16, color: t.text }}>
          {c.title}
        </Text>
      </Pressable>
    );
  };

  const sectionLabel = (label: string) => (
    <Text
      key={label}
      style={{ paddingHorizontal: 12, marginTop: 12, marginBottom: 4, fontFamily: fonts.bodyMedium, fontSize: 14, color: t.faint }}>
      {label}
    </Text>
  );

  const resultRow = (id: string, title: string, icon: string, href: Href, detail?: string | null) => (
    <Pressable
      key={id}
      accessibilityRole="button"
      onPress={() => go(href)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 46,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 23,
        backgroundColor: pressed ? t.tile : 'transparent',
      })}>
      <PathIcon d={icon} color={t.text} size={19} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 16, color: t.text }}>
          {title}
        </Text>
        {detail ? (
          <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 13, color: t.faint }}>
            {detail}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );

  const section = (key: 'pinned' | 'recent', label: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open[key] }}
      accessibilityLabel={`${label}, ${open[key] ? 'collapse' : 'expand'}`}
      onPress={() => toggle(key)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingHorizontal: 12, marginTop: 12 }}>
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: t.faint }}>{label}</Text>
      <PathIcon d={open[key] ? ICONS.chevronDown : ICONS.chevronRight} color={t.faint} size={14} strokeWidth={2} />
    </Pressable>
  );

  return (
    <View style={{ flex: 1 }}>
      <Animated.View
        style={[{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: DIM[t.scheme] }, backdropStyle]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close menu" onPress={() => close()} style={{ flex: 1 }} />
      </Animated.View>

      <GestureDetector gesture={swipe}>
        <Animated.View
          style={[
            {
              width,
              flex: 1,
              backgroundColor: GLASS[t.scheme],
              ...WEB_FROST,
              overflow: 'hidden',
              paddingTop: insets.top + 8,
              boxShadow: '0 0 40px rgba(0,0,0,0.12)',
            },
            panelStyle,
          ]}>
          {Platform.OS !== 'web' ? (
            <BlurView
              intensity={80}
              tint={t.scheme === 'dark' ? 'systemMaterialDark' : 'systemMaterialLight'}
              style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
            />
          ) : null}
          <View
            style={{
              height: 48,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingLeft: 20,
              paddingRight: 12,
            }}>
            <Logo color={t.text} width={104} />
            {searching ? (
              <IconButton kind="plain" label="Close search" onPress={endSearch}>
                <PathIcon d={ICONS.close} color={t.text} size={20} strokeWidth={1.8} />
              </IconButton>
            ) : null}
          </View>

          {searching ? (
            <Animated.View style={[{ overflow: 'hidden', paddingHorizontal: 12, justifyContent: 'flex-end' }, searchBarStyle]}>
              <SearchField value={query} onChangeText={setQuery} placeholder="Search chats, projects and tasks" autoFocus />
            </Animated.View>
          ) : null}

          {searching ? (
            <Animated.ScrollView
              entering={FadeIn.duration(200)}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 12, paddingBottom: 32 }}>
              {!results ? (
                <Text style={{ paddingHorizontal: 12, paddingVertical: 8, fontFamily: fonts.body, fontSize: 15, color: t.faint }}>
                  Search the titles of your chats, projects and tasks.
                </Text>
              ) : isEmpty(results) ? (
                <Text style={{ paddingHorizontal: 12, paddingVertical: 8, fontFamily: fonts.body, fontSize: 15, color: t.faint }}>
                  Nothing matches “{query.trim()}”.
                </Text>
              ) : (
                <>
                  {results.chats.length ? sectionLabel('Chats') : null}
                  {results.chats.slice(0, 20).map(chatRow)}
                  {results.projects.length ? sectionLabel('Projects') : null}
                  {results.projects
                    .slice(0, 10)
                    .map((p) =>
                      resultRow(p.id, p.name, ICONS.projects, { pathname: '/project/[id]', params: { id: p.id } }, p.description),
                    )}
                  {results.tasks.length ? sectionLabel('Tasks') : null}
                  {results.tasks
                    .slice(0, 10)
                    .map((x) =>
                      resultRow(
                        x.id,
                        x.title,
                        ICONS.tasks,
                        { pathname: '/task/[id]', params: { id: x.id } },
                        x.projectId ? results.projectName.get(x.projectId) : undefined,
                      ),
                    )}
                </>
              )}
            </Animated.ScrollView>
          ) : (
            <Animated.ScrollView
              entering={FadeIn.duration(200)}
              contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 8, paddingBottom: 96 }}>
              {navRow('New chat', ICONS.newChat, newChat)}
              {navRow('Search', ICONS.search, startSearch)}
              {navRow('Projects', ICONS.projects, '/projects')}
              {navRow('Library', ICONS.library, '/library')}
              {navRow('Daily tasks', ICONS.sun, '/tasks')}

              {section('pinned', 'Pinned')}
              {open.pinned ? (
                pinned.length ? (
                  pinned.map(chatRow)
                ) : chats.data ? (
                  <Text style={{ paddingHorizontal: 12, paddingVertical: 8, fontFamily: fonts.body, fontSize: 15, color: t.faint }}>
                    Long-press a chat to pin it here
                  </Text>
                ) : null
              ) : null}

              {section('recent', 'Recent')}
              {open.recent ? (
                <>
                  {recent.length ? (
                    recent.map(chatRow)
                  ) : chats.data ? (
                    <Text style={{ paddingHorizontal: 12, paddingVertical: 8, fontFamily: fonts.body, fontSize: 15, color: t.faint }}>
                      No chats yet
                    </Text>
                  ) : null}
                  {all.length > pinned.length + RECENT_LIMIT || all.length > 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => go('/chats')}
                      style={({ pressed }) => ({
                        alignSelf: 'flex-start',
                        marginLeft: 12,
                        marginTop: 6,
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: 14,
                        backgroundColor: pressed ? t.bubble : t.tile,
                      })}>
                      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: t.sub }}>View all</Text>
                    </Pressable>
                  ) : null}
                </>
              ) : null}
            </Animated.ScrollView>
          )}

          {searching ? null : (
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                paddingTop: 10,
                paddingBottom: Math.max(insets.bottom, 12),
                paddingHorizontal: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${name}, profile and settings`}
                onPress={() => go('/profile')}
                style={({ pressed }) => ({
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  padding: 6,
                  borderRadius: 26,
                  backgroundColor: pressed ? t.tile : 'transparent',
                })}>
                <Avatar name={name} photo={profile?.avatar} size={34} />
                <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.bodyMedium, fontSize: 16, color: t.text }}>
                  {name}
                </Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
