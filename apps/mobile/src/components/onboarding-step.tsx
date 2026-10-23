import type { ReactNode } from 'react';
import { View } from 'react-native';
import { StepBar } from './fields';
import { Screen } from './screen';
import { Body, Caption, Title } from './text';

export const ONBOARDING_STEPS = 4;

interface Props {
  step: number;
  title: string;
  subtitle?: string;
  footer: ReactNode;
  children: ReactNode;
}

/** Shared frame for onboarding steps 1-4: progress bar, step label and title. */
export function OnboardingStep({ step, title, subtitle, footer, children }: Props) {
  return (
    <Screen header={<StepBar step={step} total={ONBOARDING_STEPS} />} footer={footer}>
      <Caption style={{ marginTop: 20 }}>
        Step {step} of {ONBOARDING_STEPS}
      </Caption>
      <View style={{ gap: 8, marginTop: 6 }}>
        <Title>{title}</Title>
        {subtitle ? <Body tone="sub">{subtitle}</Body> : null}
      </View>
      {children}
    </Screen>
  );
}
