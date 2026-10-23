import type { Session } from '@supabase/supabase-js';
import {
  DEFAULT_AGENT_NAME,
  DEFAULT_NOTIFICATION_PREFS,
  type Interest,
  type NotificationPrefs,
  type ResponseStyle,
} from '@raco/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

export interface Profile {
  displayName: string | null;
  agentName: string;
  interests: Interest[];
  responseStyle: ResponseStyle;
  notificationPrefs: NotificationPrefs;
  onboardedAt: string | null;
}

interface SessionState {
  /** False until the stored session (and profile) have been loaded. */
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  updateProfile(patch: Partial<Profile>): Promise<void>;
  refreshProfile(): Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, agent_name, interests, response_style, notification_prefs, onboarded_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    setProfile(data ? fromRow(data) : null);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!active) return;
        setSession(data.session);
        await loadProfile(data.session?.user.id).catch(() => {});
      })
      .finally(() => active && setReady(true));

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        void loadProfile(next?.user.id).catch(() => {});
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      const userId = session?.user.id;
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase.from('profiles').update(toRow(patch)).eq('user_id', userId);
      if (error) throw error;
      setProfile((p) => (p ? { ...p, ...patch } : p));
    },
    [session?.user.id],
  );

  const refreshProfile = useCallback(() => loadProfile(session?.user.id), [loadProfile, session?.user.id]);

  const value = useMemo(
    () => ({ ready, session, profile, updateProfile, refreshProfile }),
    [ready, session, profile, updateProfile, refreshProfile],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

interface ProfileRow {
  display_name: string | null;
  agent_name: string;
  interests: string[];
  response_style: ResponseStyle;
  notification_prefs: Partial<NotificationPrefs> | null;
  onboarded_at: string | null;
}

function fromRow(row: ProfileRow): Profile {
  return {
    displayName: row.display_name,
    agentName: row.agent_name || DEFAULT_AGENT_NAME,
    interests: row.interests as Interest[],
    responseStyle: row.response_style,
    notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS, ...(row.notification_prefs ?? {}) },
    onboardedAt: row.onboarded_at,
  };
}

function toRow(p: Partial<Profile>): Partial<ProfileRow> {
  const row: Partial<ProfileRow> = {};
  if (p.displayName !== undefined) row.display_name = p.displayName;
  if (p.agentName !== undefined) row.agent_name = p.agentName;
  if (p.interests !== undefined) row.interests = p.interests;
  if (p.responseStyle !== undefined) row.response_style = p.responseStyle;
  if (p.notificationPrefs !== undefined) row.notification_prefs = p.notificationPrefs;
  if (p.onboardedAt !== undefined) row.onboarded_at = p.onboardedAt;
  return row;
}
