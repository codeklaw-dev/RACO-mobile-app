import {
  DEFAULT_AGENT_NAME,
  DEFAULT_NOTIFICATION_PREFS,
  type Interest,
  type NotificationPrefs,
  type ResponseStyle,
} from '@raco/shared';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useSession } from './session';

export interface OnboardingDraft {
  displayName: string;
  agentName: string;
  interests: Interest[];
  responseStyle: ResponseStyle;
  notificationPrefs: NotificationPrefs;
}

interface OnboardingState {
  draft: OnboardingDraft;
  set(patch: Partial<OnboardingDraft>): void;
}

const OnboardingContext = createContext<OnboardingState | null>(null);

/**
 * Answers collected across the onboarding steps. They're saved to the
 * profile together at the end, so backing out mid-way leaves no half state.
 */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { profile } = useSession();
  const [draft, setDraft] = useState<OnboardingDraft>(() => ({
    displayName: profile?.displayName ?? '',
    agentName: profile?.agentName ?? DEFAULT_AGENT_NAME,
    interests: profile?.interests ?? [],
    responseStyle: profile?.responseStyle ?? 'balanced',
    notificationPrefs: profile?.notificationPrefs ?? DEFAULT_NOTIFICATION_PREFS,
  }));

  const value = useMemo(() => ({ draft, set: (patch: Partial<OnboardingDraft>) => setDraft((d) => ({ ...d, ...patch })) }), [draft]);
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingState {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used inside OnboardingProvider');
  return ctx;
}
