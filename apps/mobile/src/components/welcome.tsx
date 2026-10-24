import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { greeting } from '@/lib/greeting';
import { useSession } from '@/state/session';
import { fonts, gradient, useTheme } from '@/theme';

/** What Raco can do today. Only list things the app really does (App Review 2.3.1). */
const LINES = [
  'write that email.',
  'research anything.',
  'get ready for your exam.',
  'plan your week.',
  'explain anything simply.',
  'brainstorm ideas with you.',
];

const LINE = 42;
const HOLD_MS = 2000;
const ROLL_MS = 540;
// The design's easing: a quick, decisive roll.
const ROLL = Easing.bezier(0.7, 0, 0.2, 1);

/**
 * Design 12b, "Welcome home, rotating line": the greeting, then "Let's" and
 * a line that rolls through what Raco can do.
 */
export function Welcome({ note }: { note?: string }) {
  const t = useTheme();
  const { profile } = useSession();
  const display = { fontFamily: fonts.display, fontSize: 34, lineHeight: LINE, letterSpacing: -0.6 } as const;

  return (
    <View style={{ paddingHorizontal: 8, gap: 6 }}>
      <Text accessibilityRole="header" style={[display, { color: t.text }]}>
        {greeting(profile?.displayName)}
      </Text>
      <Text style={[display, { color: t.faint }]}>Let’s</Text>
      <RollingLine style={display} />
      {note ? <Text style={{ marginTop: 10, fontFamily: fonts.body, fontSize: 15, color: t.faint }}>{note}</Text> : null}
    </View>
  );
}

function RollingLine({ style }: { style: object }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const y = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      if (step < LINES.length) {
        y.set(withTiming(-step * LINE, { duration: ROLL_MS, easing: ROLL }));
      } else {
        // The list ends with a copy of the first line: roll onto it, then jump back unseen.
        step = 0;
        y.set(withSequence(withTiming(-LINES.length * LINE, { duration: ROLL_MS, easing: ROLL }), withTiming(0, { duration: 0 })));
      }
    }, HOLD_MS + ROLL_MS);
    return () => clearInterval(timer);
  }, [reduced, y]);

  const roll = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const fade = (to: 'top' | 'bottom') =>
    gradient(`linear-gradient(${to === 'top' ? '180deg' : '0deg'}, ${t.background} 0%, ${t.background}00 100%)`);

  return (
    <View accessible accessibilityLabel={`Let’s ${LINES.join(' Or ')}`} style={{ height: LINE, overflow: 'hidden' }}>
      <Animated.View style={roll}>
        {[...LINES, LINES[0]!].map((line, i) => (
          <Text key={i} numberOfLines={1} style={[style, { height: LINE, color: t.accentText }]}>
            {line}
          </Text>
        ))}
      </Animated.View>
      <View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: 9 }, fade('top')]} />
      <View pointerEvents="none" style={[{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 9 }, fade('bottom')]} />
    </View>
  );
}
