import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from '@/components/icons';
import { SlideToStart } from '@/components/slide-to-start';
import { Body } from '@/components/text';
import { useOnboarding } from '@/state/onboarding';
import { useSession } from '@/state/session';
import { fonts, useTheme } from '@/theme';

/**
 * 11 Slide to start. Saves the onboarding answers; once the profile is
 * marked onboarded the root layout swaps to the main app.
 */
export default function Start() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { draft } = useOnboarding();
  const { updateProfile } = useSession();
  const [starting, setStarting] = useState(false);

  async function start() {
    setStarting(true);
    try {
      await updateProfile({ ...draft, onboardedAt: new Date().toISOString() });
    } catch {
      setStarting(false);
      Alert.alert("Couldn't save your settings", 'Check your connection and try again.');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <View
        style={{
          flex: 1,
          marginTop: insets.top,
          marginHorizontal: 8,
          borderRadius: 38,
          overflow: 'hidden',
          paddingTop: 28,
          paddingHorizontal: 26,
          paddingBottom: 30,
          alignItems: 'center',
          backgroundImage: t.stageGradient,
          boxShadow:
            t.scheme === 'light'
              ? 'inset 0 0 0 1px rgba(255,255,255,0.55), 0 18px 40px rgba(42,42,43,0.14)'
              : 'inset 0 0 0 1px rgba(255,255,255,0.08), 0 18px 40px rgba(0,0,0,0.35)',
        }}>
        <Logo color={t.text} width={92} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <Text
            accessibilityRole="header"
            accessibilityLiveRegion="polite"
            style={{ fontFamily: fonts.display, fontSize: 40, lineHeight: 46, letterSpacing: -1, color: t.text, textAlign: 'center' }}>
            {starting ? 'Here we go.' : `Ready, ${draft.displayName}.`}
          </Text>
          <Body tone="sub" style={{ textAlign: 'center', maxWidth: 280 }}>
            {starting ? `Opening ${draft.agentName}…` : `${draft.agentName} is set up and ready for you. Slide to begin.`}
          </Body>
        </View>
      </View>
      <View style={{ paddingTop: 22, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 20) + 20 }}>
        <SlideToStart label={starting ? 'Let’s go' : 'slide to start'} disabled={starting} onComplete={start} />
      </View>
    </View>
  );
}
