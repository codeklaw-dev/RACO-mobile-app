import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Text, View } from 'react-native';
import { Button } from '@/components/button';
import { PathIcon } from '@/components/icons';
import { OnboardingStep } from '@/components/onboarding-step';
import { Surface } from '@/components/surface';
import { Body } from '@/components/text';
import { config } from '@/lib/config';
import { useOnboarding } from '@/state/onboarding';
import { fonts, useTheme } from '@/theme';

/** 09 Privacy (step 4 of 4). */
export default function Privacy() {
  const t = useTheme();
  const { draft } = useOnboarding();

  const rows = [
    { title: 'Private by default', body: 'Your chats are only visible to you.', icon: 'M5 9V6.5a5 5 0 0 1 10 0V9M4 9h12v9H4zM10 12.5v2' },
    { title: 'You’re in control', body: 'Delete a chat, or your whole history, any time.', icon: 'M3 5h14M8 5V3h4v2M5 5l1 12h8l1-12' },
    {
      title: 'Check important answers',
      body: `${draft.agentName} can make mistakes. Verify facts that matter.`,
      icon: 'M10 2l8 15H2zM10 8v4M10 14.5v.5',
    },
  ];

  return (
    <OnboardingStep
      step={4}
      title="Your data stays yours"
      footer={
        <>
          <Button label="Agree and continue" onPress={() => router.push('/notifications')} />
          <Text
            accessibilityRole="link"
            onPress={() => WebBrowser.openBrowserAsync(config.privacyUrl)}
            style={{ marginTop: 2, textAlign: 'center', fontSize: 13, fontFamily: fonts.body, color: t.faint, textDecorationLine: 'underline' }}>
            Read the Privacy Policy
          </Text>
        </>
      }>
      <View style={{ gap: 22, marginTop: 28 }}>
        {rows.map((r) => (
          <View key={r.title} style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
            <Surface radius={12} style={{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }}>
              <PathIcon color={t.text} d={r.icon} />
            </Surface>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 17, color: t.text }}>{r.title}</Text>
              <Body tone="sub" style={{ fontSize: 15, lineHeight: 21 }}>
                {r.body}
              </Body>
            </View>
          </View>
        ))}
      </View>
    </OnboardingStep>
  );
}
