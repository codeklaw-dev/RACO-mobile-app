import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signOut } from '@/lib/auth';
import { useAppLock } from '@/state/app-lock';
import { accent, useTheme } from '@/theme';
import { Button } from './button';
import { FaceIdIcon, Logo } from './icons';
import { Surface } from './surface';
import { Body } from './text';

/** Covers the app until Face ID succeeds, so chats are never shown unlocked. */
export function LockScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const lock = useAppLock();

  useEffect(() => {
    void lock.unlock();
    // Prompt once when the lock appears; the button retries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View
      accessibilityViewIsModal
      style={[StyleSheet.absoluteFill, { backgroundColor: t.background, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, paddingHorizontal: 24 }]}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 }}>
        <Logo color={t.text} width={110} />
        <Surface radius={32} style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
          <FaceIdIcon color={accent} size={60} strokeWidth={1.3} />
        </Surface>
        <Body tone="sub" style={{ textAlign: 'center' }}>
          Raco is locked.
        </Body>
      </View>
      <View style={{ gap: 12 }}>
        <Button label="Unlock" onPress={() => void lock.unlock()} />
        <Button kind="glass" label="Sign out" onPress={() => void lock.disable().then(signOut)} />
      </View>
    </View>
  );
}
