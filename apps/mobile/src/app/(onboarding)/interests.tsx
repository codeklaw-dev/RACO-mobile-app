import { INTERESTS, type Interest } from '@raco/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/button';
import { Chip } from '@/components/fields';
import { OnboardingStep } from '@/components/onboarding-step';
import { useOnboarding } from '@/state/onboarding';

/** 07 Use cases (step 2 of 4). */
export default function Interests() {
  const { draft, set } = useOnboarding();
  const [picked, setPicked] = useState<Interest[]>(draft.interests);

  const toggle = (i: Interest) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  const next = (interests: Interest[]) => {
    set({ interests });
    router.push('/style');
  };

  return (
    <OnboardingStep
      step={2}
      title={`What will you use ${draft.agentName} for?`}
      subtitle="Pick as many as you like. We'll tailor your suggestions."
      footer={
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Button kind="glass" label="Skip" style={{ width: 110 }} onPress={() => next([])} />
          <Button label="Continue" style={{ flex: 1 }} disabled={picked.length === 0} onPress={() => next(picked)} />
        </View>
      }>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 28 }}>
        {INTERESTS.map((i) => (
          <Chip key={i} label={i} selected={picked.includes(i)} onToggle={() => toggle(i)} />
        ))}
      </View>
    </OnboardingStep>
  );
}
