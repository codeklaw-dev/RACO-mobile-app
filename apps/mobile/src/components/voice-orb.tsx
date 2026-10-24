import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { accent, gradient, useTheme } from '@/theme';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'muted';

const SIZE = 210;

/**
 * Voice mode's orb. It breathes when idle, follows your voice while
 * listening (`level`, 0-1), swirls while thinking and pulses while speaking.
 */
export function VoiceOrb({
  state,
  level,
  onPress,
  label,
}: {
  state: OrbState;
  level: SharedValue<number>;
  onPress?: () => void;
  label: string;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const pulse = useSharedValue(1);
  const spin = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(pulse);
    cancelAnimation(spin);
    if (reduced) {
      pulse.set(1);
      return;
    }
    const ease = Easing.inOut(Easing.sin);
    switch (state) {
      case 'speaking':
        pulse.set(
          withRepeat(
            withSequence(withTiming(1.08, { duration: 260, easing: ease }), withTiming(0.98, { duration: 320, easing: ease })),
            -1,
          ),
        );
        break;
      case 'thinking':
        pulse.set(withRepeat(withTiming(0.9, { duration: 900, easing: ease }), -1, true));
        spin.set(withRepeat(withTiming(1, { duration: 2400, easing: Easing.linear }), -1));
        break;
      case 'muted':
        pulse.set(withTiming(0.86, { duration: 300 }));
        break;
      default:
        pulse.set(withRepeat(withTiming(1.04, { duration: 1800, easing: ease }), -1, true));
    }
  }, [state, reduced, pulse, spin]);

  const listening = state === 'listening';
  const orb = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value * (listening ? 1 + level.value * 0.28 : 1) }],
  }));
  const swirl = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));

  const fill =
    state === 'muted'
      ? t.scheme === 'light'
        ? 'linear-gradient(160deg, #D9D9DC 0%, #BDBDC2 100%)'
        : 'linear-gradient(160deg, #4A4A4E 0%, #38383B 100%)'
      : 'linear-gradient(160deg, #FFD0C6 0%, #FC7965 55%, #E0533F 100%)';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ width: SIZE * 1.4, height: SIZE * 1.4, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          {
            width: SIZE,
            height: SIZE,
            borderRadius: SIZE / 2,
            overflow: 'hidden',
            boxShadow: state === 'muted' ? 'none' : `0 20px 60px ${accent}55`,
          },
          gradient(fill),
          orb,
        ]}>
        {/* A soft highlight that turns while Raco is thinking. */}
        <Animated.View style={[{ position: 'absolute', top: 0, left: 0, width: SIZE, height: SIZE }, swirl]}>
          <View
            style={[
              { position: 'absolute', top: SIZE * 0.08, left: SIZE * 0.14, width: SIZE * 0.5, height: SIZE * 0.36, borderRadius: SIZE },
              gradient('linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 100%)'),
            ]}
          />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}
