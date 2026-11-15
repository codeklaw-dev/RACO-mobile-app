import * as LocalAuthentication from 'expo-local-authentication';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import { devicePrefs } from '@/lib/secure-storage';

const PREF_KEY = 'biometricLock';
const OFFERED_KEY = 'biometricLockOffered';
/** Re-lock after the app has been in the background this long. */
const RELOCK_AFTER_MS = 10_000;

interface AppLockState {
  enabled: boolean;
  locked: boolean;
  /** Prompts for Face ID / fingerprint and turns the lock on if it passes. */
  enable(): Promise<boolean>;
  disable(): Promise<void>;
  unlock(): Promise<boolean>;
  /** Whether this device has enrolled biometrics at all. */
  available(): Promise<boolean>;
  /** What the phone calls its biometrics: Face ID, Touch ID or fingerprint. */
  name(): Promise<string>;
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

  const name = useCallback(async () => {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync().catch((): LocalAuthentication.AuthenticationType[] => []);
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return Platform.OS === 'ios' ? 'Face ID' : 'face unlock';
    return Platform.OS === 'ios' ? 'Touch ID' : 'fingerprint';
  }, []);

  const authenticate = useCallback(async (promptMessage: string) => {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel: 'Cancel' });
    return result.success;
  }, []);

  const enable = useCallback(async () => {
    if (!(await available())) return false;
    if (!(await authenticate(`Turn on ${await name()} for Raco`))) return false;
    await devicePrefs.set(PREF_KEY, 'on');
    setEnabled(true);
    return true;
  }, [available, authenticate, name]);

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
    () => ({ enabled, locked, enable, disable, unlock, available, name }),
    [enabled, locked, enable, disable, unlock, available, name],
  );
  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}

/**
 * Offers the lock once, the first time the app opens on a phone with Face ID
 * or a fingerprint set up. Turning it on checks Face ID straight away;
 * Settings can change it later.
 */
export function useOfferAppLock() {
  const lock = useAppLock();
  useEffect(() => {
    if (Platform.OS === 'web' || lock.enabled) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled || (await devicePrefs.get(OFFERED_KEY)) || !(await lock.available())) return;
      await devicePrefs.set(OFFERED_KEY, 'yes');
      const label = await lock.name();
      Alert.alert(`Lock Raco with ${label}?`, `Your chats stay private: Raco asks for ${label} when you open it. You can change this in Settings.`, [
        { text: 'Not now', style: 'cancel' },
        { text: `Use ${label}`, onPress: () => void lock.enable() },
      ]);
    }, 800);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // Once per launch; `enabled` is read when the app opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function useAppLock(): AppLockState {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error('useAppLock must be used inside AppLockProvider');
  return ctx;
}
