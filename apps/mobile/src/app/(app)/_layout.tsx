import { Stack } from 'expo-router';
import { useTheme } from '@/theme';

export const unstable_settings = { initialRouteName: 'home' };

export default function AppLayout() {
  const t = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.background } }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen name="chats" options={{ presentation: 'modal' }} />
      <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
