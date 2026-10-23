import type { NotificationPrefs } from '@raco/shared';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Button } from '@/components/button';
import { Toggle } from '@/components/fields';
import { PathIcon, PHONE_PATH } from '@/components/icons';
import { Screen } from '@/components/screen';
import { Surface, surfaceStyle, useSurface } from '@/components/surface';
import { Body, Caption, Title } from '@/components/text';
import { formatTime } from '@/lib/greeting';
import { useOnboarding } from '@/state/onboarding';
import { accentSurface, fonts, useTheme } from '@/theme';

/** Times offered for the daily check-in call; tapping cycles through them, then Off. */
const CHECK_IN_TIMES = ['07:00', '08:00', '09:00', '10:00', '12:00', '18:00'];


/** 10 Notifications & calls. */
export default function NotificationsStep() {
  const t = useTheme();
  const glass = useSurface('glass');
  const { draft, set } = useOnboarding();
  const [prefs, setPrefs] = useState<NotificationPrefs>(draft.notificationPrefs);
  const [busy, setBusy] = useState(false);
  const name = draft.agentName;

  const update = (patch: Partial<NotificationPrefs>) => setPrefs((p) => ({ ...p, ...patch }));
  const cycleTime = () => {
    const { enabled, time } = prefs.dailyCheckIn;
    if (!enabled) return update({ dailyCheckIn: { enabled: true, time: CHECK_IN_TIMES[0]! } });
    const next = CHECK_IN_TIMES[CHECK_IN_TIMES.indexOf(time) + 1];
    update({ dailyCheckIn: next ? { enabled: true, time: next } : { enabled: false, time } });
  };
  const checkInLabel = prefs.dailyCheckIn.enabled ? formatTime(prefs.dailyCheckIn.time) : 'Off';

  async function finish(requestPermission: boolean) {
    setBusy(true);
    try {
      if (requestPermission && Platform.OS !== 'web') await Notifications.requestPermissionsAsync();
    } finally {
      set({ notificationPrefs: prefs });
      setBusy(false);
      router.push('/start');
    }
  }

  const rows: { key: string; title: string; body: string; icon: string; control: ReactNode }[] = [
    {
      key: 'urgent',
      title: 'Urgent reminders',
      body: 'Call me when a deadline is close',
      icon: 'M10 6v4l2.5 2.5M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15z',
      control: <Toggle label="Urgent reminders" value={prefs.urgentCalls} onChange={(v) => update({ urgentCalls: v })} />,
    },
    {
      key: 'checkin',
      title: 'Daily task check-in',
      body: 'A short call to plan my day',
      icon: 'M3.5 5h13M3.5 10h13M3.5 15h8',
      control: (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Check-in time, ${checkInLabel}`}
          accessibilityHint="Changes the time, or turns the check-in off"
          onPress={cycleTime}
          style={[surfaceStyle(glass), { height: 34, minWidth: 52, paddingHorizontal: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 14, color: t.text }}>{checkInLabel}</Text>
        </Pressable>
      ),
    },
    {
      key: 'input',
      title: `When ${name} needs my input`,
      body: 'Call if a task is waiting on me',
      icon: 'M3 4.5h14v9H8l-4 3v-3H3zM10 7v2.5M10 11.5v.5',
      control: <Toggle label={`When ${name} needs my input`} value={prefs.inputNeededCalls} onChange={(v) => update({ inputNeededCalls: v })} />,
    },
    {
      key: 'everyday',
      title: 'Everyday reminders',
      body: 'Send these as notifications',
      icon: 'M5 13V9a5 5 0 0 1 10 0v4l1.5 2h-13zM8.5 17.5h3',
      control: <Toggle label="Everyday reminders" value={prefs.everydayReminders} onChange={(v) => update({ everydayReminders: v })} />,
    },
  ];

  return (
    <Screen
      padding={20}
      footer={
        <>
          <Button label="Allow notifications and calls" loading={busy} onPress={() => finish(true)} />
          <Button kind="glass" label="Maybe later" disabled={busy} onPress={() => finish(false)} />
        </>
      }>
      <View style={{ gap: 8, paddingTop: 8, paddingHorizontal: 4 }}>
        <Title style={{ fontSize: 30, lineHeight: 36, letterSpacing: -0.5 }}>Stay on top of things</Title>
        <Body tone="sub" style={{ fontSize: 16, lineHeight: 23 }}>
          {name} can send you notifications, or call you when something can’t wait.
        </Body>
      </View>

      {/* Preview of what an urgent call looks like. */}
      <Surface radius={22} style={{ marginTop: 22, padding: 16, gap: 14 }} accessibilityLabel={`Example: ${name} is calling about a report due at 5 PM`}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Surface kind="primary" radius={12} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <PathIcon d={PHONE_PATH} color={t.primary.color} strokeWidth={1.7} />
          </Surface>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 16, color: t.text }}>{name} is calling</Text>
              <Caption style={{ fontFamily: fonts.body, fontSize: 12 }}>Urgent</Caption>
            </View>
            <Text style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: t.sub }}>
              Your report is due at 5:00 PM. Want to go through it now?
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <View style={[surfaceStyle(glass), { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 15, color: t.text }}>Remind me later</Text>
          </View>
          <View style={[surfaceStyle(accentSurface), { flex: 1, height: 44, borderRadius: 12, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }]}>
            <PathIcon d={PHONE_PATH} color={accentSurface.color} size={16} strokeWidth={2} />
            <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 15, color: accentSurface.color }}>Answer</Text>
          </View>
        </View>
      </Surface>

      <Caption style={{ marginTop: 22, marginBottom: 8, marginHorizontal: 4 }}>When should {name} call you?</Caption>
      <Surface radius={18} style={{ paddingHorizontal: 14 }}>
        {rows.map((r, i) => (
          <View
            key={r.key}
            style={{
              minHeight: 64,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderBottomWidth: i < rows.length - 1 ? 1 : 0,
              borderBottomColor: t.hairline,
            }}>
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: t.tile, alignItems: 'center', justifyContent: 'center' }}>
              <PathIcon d={r.icon} color={t.text} size={18} strokeWidth={1.7} />
            </View>
            <View style={{ flex: 1, gap: 2, paddingVertical: 10 }}>
              <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 15, color: t.text }}>{r.title}</Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 13, lineHeight: 17, color: t.faint }}>{r.body}</Text>
            </View>
            {r.control}
          </View>
        ))}
      </Surface>
    </Screen>
  );
}
