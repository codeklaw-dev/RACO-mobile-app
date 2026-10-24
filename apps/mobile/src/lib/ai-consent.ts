/**
 * App Review Guideline 5.1.2(i): before anything the user says or types is
 * sent to the AI service, say who receives it and ask explicitly. The answer
 * is saved on the profile and can be withdrawn in Settings; the API refuses
 * chat without it.
 */
import { useCallback } from 'react';
import { useSession } from '@/state/session';
import { config } from './config';
import { confirm } from './dialog';

export function aiDisclosure(agentName: string): string {
  return `To answer you, ${agentName} sends your messages, voice transcripts and the profile details you give it (your name and interests) to ${config.aiProvider}, an AI service, which generates the replies. You can turn this off at any time in Settings.`;
}

function ask(agentName: string): Promise<boolean> {
  return confirm('Allow AI processing?', aiDisclosure(agentName), 'Allow');
}

export function useAiConsent() {
  const { profile, updateProfile } = useSession();
  const consented = Boolean(profile?.aiConsentAt);

  /** True once the user has allowed AI processing, asking first if needed. */
  const ensure = useCallback(async () => {
    if (profile?.aiConsentAt) return true;
    if (!(await ask(profile?.agentName ?? 'Raco'))) return false;
    await updateProfile({ aiConsentAt: new Date().toISOString() });
    return true;
  }, [profile?.aiConsentAt, profile?.agentName, updateProfile]);

  const withdraw = useCallback(() => updateProfile({ aiConsentAt: null }), [updateProfile]);

  return { consented, ensure, withdraw };
}
