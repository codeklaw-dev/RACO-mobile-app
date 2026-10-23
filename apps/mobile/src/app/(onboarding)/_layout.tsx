import { Stack } from 'expo-router';
import { OnboardingProvider } from '@/state/onboarding';
import { useTheme } from '@/theme';

export const unstable_settings = { initialRouteName: 'face-id' };

export default function OnboardingLayout() {
  const t = useTheme();
  return (
    <OnboardingProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.background } }} />
    </OnboardingProvider>
  );
}
