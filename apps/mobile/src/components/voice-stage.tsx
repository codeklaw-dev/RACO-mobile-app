import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { accent, fonts, useTheme } from '@/theme';

export type VoiceStatus = 'idle' | 'speaking' | 'listening' | 'thinking';

const STATUS_LABEL: Record<VoiceStatus, string> = {
  idle: '',
  speaking: 'Raco is speaking',
  listening: 'Listening…',
  thinking: 'Thinking…',
};

/**
 * The rounded stage from the voice designs (V1-V6): Raco's last line in the
 * middle, an equaliser while speaking or listening, and an accent glow
 * around the edges while the mic is open.
 */
export function VoiceStage({ status, said, footnote, top }: { status: VoiceStatus; said: string; footnote?: ReactNode; top: number }) {
  const t = useTheme();
  const glow = useSharedValue(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (status === 'listening' && !reduced) {
      glow.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
    } else {
      cancelAnimation(glow);
      glow.value = withTiming(status === 'listening' ? 1 : 0, { duration: 250 });
    }
  }, [status, reduced, glow]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.35 + glow.value * 0.65 }));

  return (
    <View
      style={{
        flex: 1,
        minHeight: 0,
        marginTop: top,
        marginHorizontal: 8,
        borderRadius: 38,
        overflow: 'hidden',
        padding: 22,
        backgroundImage: t.stageGradient,
        boxShadow:
          t.scheme === 'light'
            ? 'inset 0 0 0 1px rgba(255,255,255,0.55), 0 18px 40px rgba(42,42,43,0.14)'
            : 'inset 0 0 0 1px rgba(255,255,255,0.08), 0 18px 40px rgba(0,0,0,0.35)',
      }}>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: 38, boxShadow: 'inset 0 0 70px 6px rgba(252,121,101,0.75)' },
          status === 'listening' ? glowStyle : { opacity: 0 },
        ]}
      />
      <View style={{ height: 34, alignItems: 'center', justifyContent: 'center' }}>
        {status === 'speaking' || status === 'listening' ? <Equaliser label={STATUS_LABEL[status]} /> : null}
        {status === 'thinking' ? (
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 14, color: t.faint }}>{STATUS_LABEL.thinking}</Text>
        ) : null}
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text
          accessibilityLiveRegion="polite"
          style={{
            fontFamily: fonts.display,
            fontSize: 30,
            lineHeight: 38,
            letterSpacing: -0.6,
            color: t.text,
            textAlign: 'center',
            maxWidth: 310,
          }}>
          {said}
        </Text>
      </View>
      {footnote ? <View style={{ alignItems: 'center', marginBottom: 4 }}>{footnote}</View> : null}
    </View>
  );
}

const BAR_HEIGHTS = [6, 12, 18, 9, 22, 14, 8, 18, 11, 6, 13];

function Equaliser({ label }: { label: string }) {
  return (
    <View accessibilityRole="text" accessibilityLabel={label} style={{ height: 26, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {BAR_HEIGHTS.map((h, i) => (
        <Bar key={i} height={h} duration={[700, 500, 900, 600][i % 4]!} />
      ))}
    </View>
  );
}

function Bar({ height, duration }: { height: number; duration: number }) {
  const scale = useSharedValue(0.4);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!reduced) scale.value = withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [scale, duration, reduced]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: scale.value }] }));
  return <Animated.View style={[{ width: 3, height, borderRadius: 2, backgroundColor: accent }, style]} />;
}
