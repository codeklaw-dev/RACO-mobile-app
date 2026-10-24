import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gutter, useTheme } from '@/theme';
import { IconButton } from './button';
import { BackIcon } from './icons';

interface Props {
  children: ReactNode;
  /** Pinned to the bottom, above the keyboard (primary actions). */
  footer?: ReactNode;
  /** Top bar content; `back` renders the design's glass back button. */
  header?: ReactNode | 'back';
  padding?: number;
  scroll?: boolean;
  contentStyle?: ViewStyle;
}

/**
 * Standard screen frame: safe areas, the design's 24pt gutters, an optional
 * 44pt header row, scrolling body and a footer that rides above the keyboard.
 */
export function Screen({ children, footer, header, padding = gutter, scroll = true, contentStyle }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const Body = scroll ? ScrollView : View;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: t.background }}>
      <View style={{ flex: 1, paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
        {header ? (
          <View style={{ height: 44, paddingHorizontal: padding, flexDirection: 'row', alignItems: 'center' }}>
            {header === 'back' ? <BackButton /> : header}
          </View>
        ) : null}
        <Body
          style={{ flex: 1 }}
          {...(scroll
            ? {
                contentContainerStyle: [{ flexGrow: 1, paddingHorizontal: padding }, contentStyle],
                keyboardShouldPersistTaps: 'handled' as const,
                showsVerticalScrollIndicator: false,
              }
            : { style: [{ flex: 1, paddingHorizontal: padding }, contentStyle] })}>
          {children}
        </Body>
        {footer ? <View style={{ paddingHorizontal: padding, paddingTop: 12, gap: 12 }}>{footer}</View> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

export function BackButton({ onPress }: { onPress?: () => void }) {
  const t = useTheme();
  return (
    <IconButton label="Back" onPress={onPress ?? (() => router.back())}>
      <BackIcon color={t.text} />
    </IconButton>
  );
}
