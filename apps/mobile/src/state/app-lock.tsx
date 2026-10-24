import * as LocalAuthentication from 'expo-local-authentication';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { devicePrefs } from '@/lib/secure-storage';

const PREF_KEY = 'biometricLock';
/** Re-lock after the app has been in the background this long. */
const RELOCK_AFTER_MS = 60_000;

interface AppLockState {
  enabled: boolean;
  locked: boolean;
  /** Prompts for Face ID / fingerprint and turns the lock on if it passes. */
  enable(): Promise<boolean>;
  disable(): Promise<void>;
  unlock(): Promise<boolean>;
  /** Whether this device has enrolled biometrics at all. */
  available(): Promise<boolean>;
}

const AppLockContext = createContext<AppLockState | null>(null);

export function AppLockProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void devicePrefs.get(PREF_KEY).then((v) => {
      const on = v === 'on';
      setEnabled(on);
      setLocked(on);
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') backgroundedAt.current = Date.now();
      if (state === 'active' && backgroundedAt.current) {
        if (Date.now() - backgroundedAt.current > RELOCK_AFTER_MS) setLocked(true);
        backgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, [enabled]);

  const available = useCallback(async () => {
    if (Platform.OS === 'web') return false;
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  }, []);

  const authenticate = useCallback(async (promptMessage: string) => {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel: 'Cancel' });
    return result.success;
  }, []);

  const enable = useCallback(async () => {
    if (!(await available())) return false;
    if (!(await authenticate('Turn on Face ID for Raco'))) return false;
    await devicePrefs.set(PREF_KEY, 'on');
    setEnabled(true);
    return true;
  }, [available, authenticate]);

  const disable = useCallback(async () => {
    await devicePrefs.remove(PREF_KEY);
    setEnabled(false);
    setLocked(false);
  }, []);

  const unlock = useCallback(async () => {
    const ok = await authenticate('Unlock Raco');
    if (ok) setLocked(false);
    return ok;
  }, [authenticate]);

  const value = useMemo(
    () => ({ enabled, locked, enable, disable, unlock, available }),
    [enabled, locked, enable, disable, unlock, available],
  );
  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}

export function useAppLock(): AppLockState {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error('useAppLock must be used inside AppLockProvider');
  return ctx;
}
