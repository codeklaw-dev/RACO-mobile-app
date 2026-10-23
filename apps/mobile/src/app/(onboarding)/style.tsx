import { RESPONSE_STYLES, type ResponseStyle } from '@raco/shared';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button } from '@/components/button';
import { CheckIcon } from '@/components/icons';
import { OnboardingStep } from '@/components/onboarding-step';
import { Surface, surfaceStyle, useSurface } from '@/components/surface';
import { useOnboarding } from '@/state/onboarding';
import { accent, fonts, useTheme } from '@/theme';

/** 08 Response style (step 3 of 4). */
export default function Style() {
  const t = useTheme();
  const primary = useSurface('primary');
  const { draft, set } = useOnboarding();
  const [style, setStyle] = useState<ResponseStyle>(draft.responseStyle);

  return (
    <OnboardingStep
      step={3}
      title={`How should ${draft.agentName} reply?`}
      subtitle="Set the default. You can always ask for more or less."
      footer={
        <Button
          label="Continue"
          onPress={() => {
            set({ responseStyle: style });
            router.push('/privacy');
          }}
        />
      }>
      <Surface accessibilityRole="radiogroup" accessibilityLabel="Response style" radius={18} style={{ marginTop: 28, padding: 4, gap: 4 }}>
        {RESPONSE_STYLES.map((o) => {
          const on = o.id === style;
          const color = on ? primary.color : t.text;
          return (
            <Pressable
              key={o.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${o.title}. ${o.body}`}
              onPress={() => {
                void Haptics.selectionAsync();
                setStyle(o.id);
              }}
              style={[
                on ? surfaceStyle(primary) : { borderWidth: 1, borderColor: 'transparent' },
                { minHeight: 72, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
              ]}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 17, color }}>{o.title}</Text>
                <Text style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color, opacity: 0.8 }}>{o.body}</Text>
              </View>
              <View style={{ opacity: on ? 1 : 0 }}>
                <CheckIcon color={accent} />
              </View>
            </Pressable>
          );
        })}
      </Surface>
    </OnboardingStep>
  );
}
