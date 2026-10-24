import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';

const openMenu = (current?: string) => router.push({ pathname: '/menu', params: current ? { current } : {} });

/** Swipe right from the left edge to open the menu, like ChatGPT. */
export function EdgeSwipe({ children, current }: { children: ReactNode; current?: string | null }) {
  const pan = Gesture.Pan()
    .activeOffsetX(24)
    .failOffsetY([-16, 16])
    .onEnd((e) => {
      if (e.translationX > 70 || e.velocityX > 700) scheduleOnRN(openMenu, current ?? undefined);
    });
  return (
    <View style={{ flex: 1 }}>
      {children}
      <GestureDetector gesture={pan}>
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 24 }} />
      </GestureDetector>
    </View>
  );
}
