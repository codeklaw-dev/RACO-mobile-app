import { Stack } from 'expo-router';
import { useTheme } from '@/theme';

export const unstable_settings = { initialRouteName: 'home' };

export default function AppLayout() {
  const t = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.background } }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="menu" options={{ presentation: 'transparentModal', animation: 'none', contentStyle: { backgroundColor: 'transparent' } }} />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen name="projects" />
      <Stack.Screen name="project/[id]" />
      <Stack.Screen name="project/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="tasks" />
      <Stack.Screen name="task/[id]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="search" options={{ animation: 'fade' }} />
      <Stack.Screen name="profile" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="voice-mode" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
    </Stack>
  );
}
