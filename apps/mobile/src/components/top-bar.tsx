import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { IconButton } from './button';
import { MenuIcon, NewChatIcon } from './icons';

/** Home/chat header: chats on the left, new chat on the right. */
export function TopBar({ center }: { center: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <IconButton label="Open chats" onPress={() => router.push('/chats')}>
        <MenuIcon color={t.text} />
      </IconButton>
      <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 8 }}>{center}</View>
      <IconButton label="New chat" onPress={() => router.dismissTo('/home')}>
        <NewChatIcon color={t.text} />
      </IconButton>
    </View>
  );
}
