/**
 * A React Native take on voice-glow by Jakub Antalik (MIT, see LICENSE):
 * soft coloured light rising from the bottom edge of the screen. Seven lobes
 * flow slowly sideways around a ring, so the colours keep passing through
 * the centre and fade out at the edges; each one breathes and rises with
 * `level` (0–1), the centre most, the sides less.
 *
 * Drawn with radial gradients on plain views, so it runs in Expo Go, on the
 * web and on any React Native 0.80+ build, and stays behind the content
 * (pointerEvents none).
 */
import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { voiceLobes, voicePalettes, type HuePalette } from './palettes';

/** One turn of the ring the lobes flow around, in reference px. */
const SPAN = 36 * voiceLobes.length;
/** Reference px per second the lobes flow at; faster while active. */
const FLOW = 9;

export type { HuePalette } from './palettes';
export const HUE_PALETTES = Object.keys(voicePalettes) as HuePalette[];

/** The palette's colours, for swatches. */
export function paletteColors(palette: HuePalette, scheme: 'light' | 'dark'): string[] {
  return voicePalettes[palette][scheme];
}

// React Native reads experimental_backgroundImage, the web reads backgroundImage.
const bg = (css: string) => ({ experimental_backgroundImage: css, backgroundImage: css }) as object;

const withAlpha = (rgb: string, a: number) => rgb.replace('rgb(', 'rgba(').replace(')', `, ${a})`);

interface Props {
  palette: HuePalette;
  scheme: 'light' | 'dark';
  /** Voice or activity level, 0–1. Without it the glow just breathes. */
  level?: SharedValue<number>;
  /** Overall strength, 0–1. */
  intensity?: number;
  /** The level to rest at when no `level` is given: a calm, visible glow. */
  restLevel?: number;
}

export function HueGlow({ palette, scheme, level, intensity = 1, restLevel = 0.45 }: Props) {
  // Sized to its own box, not the window: on the web the app can sit in a phone frame.
  const window = useWindowDimensions();
  const [width, setWidth] = useState(Math.min(window.width, 430));
  const reduced = useReducedMotion();
  const time = useSharedValue(0);
  const idle = useSharedValue(restLevel);
  useFrameCallback((frame) => {
    time.value = (frame.timeSinceFirstFrame ?? 0) / 1000;
  }, !reduced);

  const colors = voicePalettes[palette][scheme];
  // The reference geometry is a ~350px element; the "mobile" preset scales it up.
  const k = (width / 350) * 1.25;
  const strength = (scheme === 'dark' ? 0.9 : 0.7) * intensity;

  return (
    <View
      pointerEvents="none"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden' }}>
      {/* The wide bloom that tints the lower part of the screen. */}
      <Bloom color={colors[0]!} second={colors[1]!} k={k} strength={strength} time={time} level={level ?? idle} />
      {voiceLobes.map((lobe, i) => (
        <LobeView key={i} index={i} lobe={lobe} color={colors[i % colors.length]!} k={k} strength={strength} time={time} level={level ?? idle} />
      ))}
    </View>
  );
}

function Bloom({ color, second, k, strength, time, level }: { color: string; second: string; k: number; strength: number; time: SharedValue<number>; level: SharedValue<number> }) {
  const w = 520 * k;
  const h = 820 * k;
  const style = useAnimatedStyle(() => {
    const breathe = 0.9 + 0.1 * Math.sin(time.value * 0.9);
    const sway = Math.sin(time.value * 0.21) * 30 * k;
    return {
      opacity: strength * (0.5 + 0.5 * level.value),
      transform: [{ translateX: sway }, { scaleY: breathe * (0.8 + 0.55 * level.value) }],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: w,
          height: h,
          bottom: -h / 2,
          left: '50%',
          marginLeft: -w / 2,
          transformOrigin: 'bottom',
          ...bg(`radial-gradient(ellipse closest-side, ${withAlpha(color, 0.55)} 0%, ${withAlpha(second, 0.25)} 45%, ${withAlpha(second, 0)} 100%)`),
        },
        style,
      ]}
    />
  );
}

function LobeView({
  index,
  lobe,
  color,
  k,
  strength,
  time,
  level,
}: {
  index: number;
  lobe: (typeof voiceLobes)[number];
  color: string;
  k: number;
  strength: number;
  time: SharedValue<number>;
  level: SharedValue<number>;
}) {
  // Wider and much taller than the reference lobes: this glow fills a phone screen.
  const w = lobe.w * k * 3.2;
  const h = lobe.h * k * 10;
  const phase = index * 1.7;
  const style = useAnimatedStyle(() => {
    const t = time.value;
    // The centre follows the lows, the sides the mids and highs: a voice ripples outward.
    const bandLevel = level.value * (lobe.band === 0 ? 1 : lobe.band === 1 ? 0.8 : 0.65);
    const breathe = 0.8 + 0.2 * Math.sin(t * 0.8 + phase);
    // Flow around the ring: wrap to -SPAN/2..SPAN/2 and fade out near the ends, so a
    // lobe leaving one side is invisible before it comes back in on the other.
    const travelled = lobe.x + t * FLOW * (1 + level.value);
    const x = ((((travelled + SPAN / 2) % SPAN) + SPAN) % SPAN) - SPAN / 2;
    const edge = Math.abs(x) / (SPAN / 2);
    const presence = 1 - edge * edge * edge;
    return {
      opacity: strength * presence * (0.6 + 0.4 * bandLevel),
      transform: [{ translateX: x * k * 1.6 * (1 + 0.35 * level.value) }, { scaleY: breathe * (0.75 + 0.9 * bandLevel) }],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: w,
          height: h,
          bottom: -h / 2,
          left: '50%',
          marginLeft: -w / 2,
          transformOrigin: 'bottom',
          ...bg(`radial-gradient(ellipse closest-side, ${withAlpha(color, 0.9)} 0%, ${withAlpha(color, 0.35)} 45%, ${withAlpha(color, 0)} 100%)`),
        },
        style,
      ]}
    />
  );
}
