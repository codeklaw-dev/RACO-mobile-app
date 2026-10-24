import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import type { OrbState as DottedState } from '@/vendor/thinking-orbs-native';
import { ThinkingOrb } from '@/vendor/thinking-orbs-native';
import { useTheme } from '@/theme';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'muted';

const SIZE = 200;

/** Each voice state as one of the thinking-orbs animations. */
const ANIMATION: Record<OrbState, DottedState> = {
  idle: 'breathing',
  listening: 'listening',
  thinking: 'solving',
  speaking: 'composing',
  muted: 'breathing',
};

/**
 * Voice mode's orb: a dotted thinking-orb that changes with the conversation,
 * and swells with your voice while listening (`level`, 0-1).
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
  const listening = state === 'listening';
  const swell = useAnimatedStyle(() => ({ transform: [{ scale: listening ? 1 + level.value * 0.18 : 1 }] }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ width: SIZE * 1.3, height: SIZE * 1.3, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ opacity: state === 'muted' ? 0.35 : 1 }, swell]}>
        <ThinkingOrb
          state={ANIMATION[state]}
          size={64}
          displaySize={SIZE}
          theme={t.scheme}
          paused={state === 'muted'}
          accessibilityLabel={label}
        />
      </Animated.View>
    </Pressable>
  );
}
