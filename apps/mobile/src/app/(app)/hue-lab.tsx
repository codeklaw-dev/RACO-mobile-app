import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { ICONS, PathIcon, PlusIcon, VoiceIcon } from '@/components/icons';
import { NavBar, SectionTitle, Segmented } from '@/components/ui';
import { usePreferences } from '@/state/preferences';
import { fonts, useTheme } from '@/theme';
import { HUE_PALETTES, HueGlow, paletteColors, type HuePalette } from '@/vendor/voice-glow-native';

type Activity = 'calm' | 'thinking' | 'voice';

const LABELS: Record<HuePalette, string> = {
  colorful: 'Colorful',
  mono: 'Mono',
  ocean: 'Ocean',
  sunset: 'Sunset',
  forest: 'Forest',
  candy: 'Candy',
  ice: 'Ice',
  gold: 'Gold',
};

/**
 * Try the background hues live: pick a palette and an activity, and see the
 * glow move behind real text and buttons. "Use this" applies it to Home,
 * chats and voice mode.
 */
export default function HueLab() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const prefs = usePreferences();
  const [palette, setPalette] = useState<HuePalette>(prefs.hue === 'off' ? 'ocean' : prefs.hue);
  const [activity, setActivity] = useState<Activity>('voice');
  const level = useSharedValue(0);

  // Stand-ins for what the app will feed the glow: nothing, a steady pulse while
  // a reply is written, and the uneven rise and fall of someone talking.
  useEffect(() => {
    if (activity === 'calm') {
      level.set(withTiming(0, { duration: 600 }));
      return;
    }
    let tick = 0;
    const timer = setInterval(() => {
      tick += 1;
      const next = activity === 'thinking' ? 0.35 + 0.2 * Math.sin(tick / 4) : Math.random() < 0.2 ? 0.05 : 0.3 + Math.random() * 0.7;
      level.set(withTiming(next, { duration: activity === 'voice' ? 140 : 400 }));
    }, activity === 'voice' ? 160 : 200);
    return () => clearInterval(timer);
  }, [activity, level]);

  const inUse = prefs.hue === palette;

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <HueGlow palette={palette} scheme={t.scheme} level={level} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: insets.bottom + 24, gap: 12 }}>
        <NavBar title="Hue lab" />

        <SectionTitle>Palette</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {HUE_PALETTES.map((p) => {
            const on = p === palette;
            return (
              <Pressable
                key={p}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => setPalette(p)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  height: 36,
                  paddingHorizontal: 12,
                  borderRadius: 18,
                  borderWidth: 1.5,
                  borderColor: on ? t.text : 'transparent',
                  backgroundColor: t.tile,
                }}>
                <View style={{ flexDirection: 'row' }}>
                  {paletteColors(p, t.scheme)
                    .slice(0, 3)
                    .map((c, i) => (
                      <View key={i} style={{ width: 12, height: 12, borderRadius: 6, marginLeft: i ? -4 : 0, backgroundColor: c }} />
                    ))}
                </View>
                <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 14, color: t.text }}>{LABELS[p]}</Text>
              </Pressable>
            );
          })}
        </View>

        <SectionTitle>Activity</SectionTitle>
        <Segmented<Activity>
          value={activity}
          onChange={setActivity}
          options={[
            { id: 'calm', label: 'Calm' },
            { id: 'thinking', label: 'Thinking' },
            { id: 'voice', label: 'Talking' },
          ]}
        />

        {/* Sample content, to judge contrast of text and buttons over the glow. */}
        <View style={{ marginTop: 28, gap: 10 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 28, lineHeight: 34, color: t.text }}>Good evening.</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 17, lineHeight: 25, color: t.sub }}>
            Here is how a reply reads with the glow behind it. Body text, secondary text and buttons should all stay easy to read.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
            <Button kind="glass" label="Secondary" onPress={() => {}} style={{ flex: 1 }} />
            <Button label="Primary" onPress={() => {}} style={{ flex: 1 }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 120, padding: 8, borderRadius: 28, backgroundColor: t.scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)' }}>
            <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <PlusIcon color={t.text} />
            </View>
            <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 17, color: t.faint }}>Ask anything</Text>
            <PathIcon d={ICONS.mic} color={t.text} />
            <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FC7965' }}>
              <VoiceIcon color="#2A2A2B" />
            </View>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          <Button kind="glass" label="Turn off" disabled={prefs.hue === 'off'} onPress={() => prefs.setHue('off')} style={{ flex: 1 }} />
          <Button label={inUse ? 'In use ✓' : 'Use this'} disabled={inUse} onPress={() => prefs.setHue(palette)} style={{ flex: 1 }} />
        </View>
      </ScrollView>
    </View>
  );
}
