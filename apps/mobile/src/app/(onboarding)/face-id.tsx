import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { Button } from '@/components/button';
import { FaceIdIcon } from '@/components/icons';
import { Screen } from '@/components/screen';
import { Surface } from '@/components/surface';
import { Body, Title } from '@/components/text';
import { useAppLock } from '@/state/app-lock';
import { accent } from '@/theme';

/** 05 Face ID. Skipped automatically on devices without biometrics. */
export default function FaceId() {
  const lock = useAppLock();
  const [busy, setBusy] = useState(false);
  const next = () => router.replace('/name');

  useEffect(() => {
    void lock.available().then((ok) => {
      if (!ok) next();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function turnOn() {
    setBusy(true);
    try {
      if (await lock.enable()) next();
      else Alert.alert("Face ID wasn't turned on", 'You can turn it on later in Settings.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      scroll={false}
      footer={
        <>
          <Button label="Turn on Face ID" loading={busy} onPress={turnOn} />
          <Button kind="glass" label="Not now" disabled={busy} onPress={next} />
        </>
      }>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 }}>
        <Surface radius={32} style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
          <FaceIdIcon color={accent} size={60} strokeWidth={1.3} />
        </Surface>
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Title style={{ fontSize: 30, lineHeight: 36, textAlign: 'center' }}>Unlock with Face ID</Title>
          <Body tone="sub" style={{ textAlign: 'center', maxWidth: 300 }}>
            Keep your chats private. Raco will ask for Face ID each time you open the app.
          </Body>
        </View>
      </View>
    </Screen>
  );
}
