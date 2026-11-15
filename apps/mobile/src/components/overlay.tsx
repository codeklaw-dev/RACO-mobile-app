import type { ReactNode } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { FullWindowOverlay } from 'react-native-screens';

/**
 * Draws its children over everything, including pages presented as native
 * modals (the left panel, voice mode, sheets).
 *
 * On iOS a React Native Modal is presented by the root view controller,
 * which refuses while another page is already presented modally, so the
 * overlay goes in its own window instead. Android's Modal is a dialog above
 * everything already. On web a modal would attach to the whole window,
 * outside the preview's phone frame, so it's drawn over the app instead.
 */
export function Overlay({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  if (!visible) return null;
  if (Platform.OS === 'web') return <View style={StyleSheet.absoluteFill}>{children}</View>;
  if (Platform.OS === 'ios') {
    return (
      <FullWindowOverlay unstable_accessibilityContainerViewIsModal>
        <Animated.View entering={FadeIn.duration(180)} style={StyleSheet.absoluteFill}>
          {children}
        </Animated.View>
      </FullWindowOverlay>
    );
  }
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1 }}>{children}</View>
    </Modal>
  );
}
