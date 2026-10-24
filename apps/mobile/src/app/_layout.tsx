import { InstrumentSans_600SemiBold, InstrumentSans_700Bold } from '@expo-google-fonts/instrument-sans';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActionSheetProvider } from '@/components/action-sheet';
import { LockScreen } from '@/components/lock-screen';
import { AiConsentProvider } from '@/lib/ai-consent';
import { AppLockProvider, useAppLock } from '@/state/app-lock';
import { SessionProvider, useSession } from '@/state/session';
import { useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync();

export const unstable_settings = { initialRouteName: 'index' };

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <AppLockProvider>
            <AiConsentProvider>
              <ActionSheetProvider>{fontsLoaded ? <Navigator /> : null}</ActionSheetProvider>
            </AiConsentProvider>
          </AppLockProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Navigator() {
  const t = useTheme();
  const { ready, session, profile } = useSession();
  const lock = useAppLock();

  const signedIn = !!session;
  // Wait for the profile after sign-in so screens can greet by name.
  const loading = !ready || (signedIn && !profile);

  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null;

  return (
    <>
      <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.background } }}>
        <Stack.Screen name="index" />
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        {/* Voice onboarding is paused: signing in goes straight to the app. */}
        <Stack.Protected guard={false}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
      {signedIn && lock.locked ? <LockScreen /> : null}
    </>
  );
}
