import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { View, type TextInputInstance } from 'react-native';
import { Button } from '@/components/button';
import { TextField } from '@/components/fields';
import { OnboardingStep } from '@/components/onboarding-step';
import { useOnboarding } from '@/state/onboarding';

/** 06 Names (step 1 of 4). */
export default function Name() {
  const { draft, set } = useOnboarding();
  const agentRef = useRef<TextInputInstance>(null);
  const [name, setName] = useState(draft.displayName);
  const [agent, setAgent] = useState(draft.agentName);

  const valid = name.trim().length > 0 && agent.trim().length > 0;
  const next = () => {
    if (!valid) return;
    set({ displayName: name.trim(), agentName: agent.trim() });
    router.push('/interests');
  };

  return (
    <OnboardingStep
      step={1}
      title="Let's get acquainted"
      subtitle="Tell us your name and give your assistant one. You can change both in Settings."
      footer={<Button label="Continue" disabled={!valid} onPress={next} />}>
      <View style={{ gap: 20, marginTop: 32 }}>
        <TextField
          label="Your first name"
          value={name}
          onChangeText={setName}
          autoFocus={!name}
          autoComplete="given-name"
          textContentType="givenName"
          maxLength={60}
          returnKeyType="next"
          onSubmitEditing={() => agentRef.current?.focus()}
        />
        <TextField
          ref={agentRef}
          label="Agent name"
          value={agent}
          onChangeText={setAgent}
          maxLength={40}
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={next}
          hint={'This is what your assistant will be called in chats. Keep "Raco" or pick your own.'}
        />
      </View>
    </OnboardingStep>
  );
}
