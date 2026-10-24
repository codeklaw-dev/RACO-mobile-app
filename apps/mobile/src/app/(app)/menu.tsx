import type { ConversationSummary } from '@raco/shared';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useActionSheet } from '@/components/action-sheet';
import { IconButton } from '@/components/button';
import { ICONS, Logo, NewChatIcon, PathIcon } from '@/components/icons';
import { deleteChat, listChats, setChatPinned, useFocusData } from '@/lib/data';
import { useSession } from '@/state/session';
import { accent, fonts, useTheme } from '@/theme';

const RECENT_LIMIT = 8;

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

  // 0 = closed, 1 = open; the panel slides and the backdrop fades with it.
  const progress = useSharedValue(0);
  const drag = useSharedValue(0);
  useEffect(() => {
    progress.set(withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) }));
  }, [progress]);

  const close = (then?: () => void) => {
    progress.set(withTiming(0, { duration: 180, easing: Easing.in(Easing.cubic) }, (done) => {
      if (done) scheduleOnRN(finish, then);
    }));
  };
  const finish = (then?: () => void) => {
    router.back();
    then?.();
  };
  const go = (href: Href) => close(() => router.push(href));

  const swipe = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate((e) => {
      drag.set(Math.min(0, e.translationX));
    })
    .onEnd((e) => {
      if (e.translationX < -width * 0.3 || e.velocityX < -600) {
        progress.set(withTiming(0, { duration: 160 }, (done) => {
          if (done) scheduleOnRN(finish, undefined);
        }));
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

  const navRow = (label: string, icon: string, href: Href) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      onPress={() => go(href)}
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
        style={[{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.3)' }, backdropStyle]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close menu" onPress={() => close()} style={{ flex: 1 }} />
      </Animated.View>

      <GestureDetector gesture={swipe}>
        <Animated.View
          style={[
            {
              width,
              flex: 1,
              backgroundColor: t.background,
              paddingTop: insets.top + 8,
              boxShadow: '0 0 40px rgba(0,0,0,0.12)',
            },
            panelStyle,
          ]}>
          <View
            style={{
              height: 48,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingLeft: 20,
              paddingRight: 12,
            }}>
            <Logo color={t.text} width={76} />
            <IconButton kind="plain" label="Search chats, projects and tasks" onPress={() => go('/search')}>
              <PathIcon d={ICONS.search} color={t.text} size={21} strokeWidth={1.8} />
            </IconButton>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 8, paddingBottom: 96 }}>
            {navRow('Projects', ICONS.projects, '/projects')}
            {navRow('Library', ICONS.library, '/library')}
            {navRow('Daily tasks', ICONS.sun, '/tasks')}

            {pinned.length ? (
              <>
                {section('pinned', 'Pinned')}
                {open.pinned ? pinned.map(chatRow) : null}
              </>
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
          </ScrollView>

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
              backgroundColor: t.background,
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
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 15, color: '#2A2A2B' }}>{name.charAt(0).toUpperCase()}</Text>
              </View>
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.bodyMedium, fontSize: 16, color: t.text }}>
                {name}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="New chat"
              onPress={() => (current ? close(() => router.replace('/home')) : close())}
              style={({ pressed }) => ({
                height: 48,
                paddingHorizontal: 18,
                borderRadius: 24,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: t.primary.backgroundColor,
                boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
                opacity: pressed ? 0.85 : 1,
              })}>
              <NewChatIcon color={t.primary.color} />
              <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 15, color: t.primary.color }}>New chat</Text>
            </Pressable>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
