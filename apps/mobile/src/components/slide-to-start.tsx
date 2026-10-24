import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { AccessibilityInfo, Text, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { accentSurface, fonts, useTheme } from '@/theme';
import { ArrowRightIcon } from './icons';
import { surfaceStyle, useSurface } from './surface';

const KNOB_W = 64;
const INSET = 4;
/** Fraction of the track that counts as "slid all the way". */
const THRESHOLD = 0.92;

interface Props {
  label: string;
  onComplete: () => void;
  disabled?: boolean;
}

/** 11 Slide to start: drag the accent knob across the glass track. */
export function SlideToStart({ label, onComplete, disabled }: Props) {
  const t = useTheme();
  const glass = useSurface('glass');
  const x = useSharedValue(0);
  const [max, setMax] = useState(0);
  const maxShared = useSharedValue(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const m = e.nativeEvent.layout.width - KNOB_W - INSET * 2;
    setMax(m);
    maxShared.value = m;
  };

  const complete = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete();
  };

  const pan = usePanGesture({
    enabled: !disabled,
    onUpdate: (e) => {
      'worklet';
      x.value = Math.min(Math.max(e.translationX, 0), maxShared.value);
    },
    onDeactivate: () => {
      'worklet';
      if (maxShared.value > 0 && x.value >= maxShared.value * THRESHOLD) {
        x.value = withTiming(maxShared.value, { duration: 120 });
        scheduleOnRN(complete);
      } else {
        x.value = withSpring(0, { damping: 18, stiffness: 220 });
      }
    },
  });

  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: maxShared.value ? interpolate(x.value, [0, maxShared.value * 0.55], [1, 0], 'clamp') : 1,
  }));

  return (
    <View
      onLayout={onLayout}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityHint="Swipe up or down, or double tap, to start"
      accessibilityActions={[{ name: 'activate' }, { name: 'increment' }]}
      onAccessibilityAction={() => {
        if (disabled) return;
        x.set(withTiming(max, { duration: 200 }));
        void AccessibilityInfo.announceForAccessibility('Starting');
        complete();
      }}
      style={[surfaceStyle(glass), { height: 64, borderRadius: 18, justifyContent: 'center' }]}>
      <Animated.View style={[{ position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingLeft: 56 }, labelStyle]}>
        <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 18, letterSpacing: 0.2, color: t.shimmer }}>{label}</Text>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            surfaceStyle(accentSurface),
            { position: 'absolute', top: INSET - 1, left: INSET - 1, width: KNOB_W, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
            knob,
          ]}>
          <ArrowRightIcon color={accentSurface.color} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
