import { Stack } from 'expo-router';
import { useOfferAppLock } from '@/state/app-lock';
import { useTheme } from '@/theme';

export const unstable_settings = { initialRouteName: 'home' };

export default function AppLayout() {
  const t = useTheme();
  useOfferAppLock();
  return (
    // Pages cross-fade quickly; sheets (presentation: 'modal') keep their native slide-up.
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.background }, animation: 'fade', animationDuration: 180 }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="menu" options={{ presentation: 'transparentModal', animation: 'none', contentStyle: { backgroundColor: 'transparent' } }} />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen name="projects" />
      <Stack.Screen name="project/[id]" />
      <Stack.Screen name="project/new" options={{ presentation: 'modal', animation: 'default' }} />
      <Stack.Screen name="tasks" />
      <Stack.Screen name="library" />
      <Stack.Screen name="chats" />
      <Stack.Screen name="rename-chat" options={{ presentation: 'modal', animation: 'default' }} />
      <Stack.Screen name="edit-profile" options={{ presentation: 'modal', animation: 'default' }} />
      <Stack.Screen name="hue-lab" />
      <Stack.Screen name="task/[id]" options={{ presentation: 'modal', animation: 'default' }} />
      <Stack.Screen name="search" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="voice-mode" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
    </Stack>
  );
}
