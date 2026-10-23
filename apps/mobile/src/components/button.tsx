import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { fonts } from '@/theme';
import { surfaceStyle, useSurface, type SurfaceKind } from './surface';

interface Props {
  label: string;
  onPress?: () => void;
  kind?: Exclude<SurfaceKind, 'field'>;
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

/** Full-width 54pt button from the design. */
export function Button({ label, onPress, kind = 'primary', icon, loading, disabled, style, accessibilityHint }: Props) {
  const s = useSurface(kind);
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress?.();
      }}
      style={({ pressed }) => [
        surfaceStyle(s),
        {
          height: 54,
          borderRadius: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          paddingHorizontal: 16,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={s.color} />
      ) : (
        <>
          {icon ? <View accessibilityElementsHidden>{icon}</View> : null}
          <Text style={{ color: s.color, fontFamily: fonts.bodySemibold, fontSize: 17 }}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

interface IconButtonProps {
  label: string;
  onPress?: () => void;
  children: ReactNode;
  kind?: 'glass' | 'accent' | 'plain';
  size?: number;
  radius?: number;
  disabled?: boolean;
}

/** Square icon-only button (back, menu, new chat, composer actions). */
export function IconButton({ label, onPress, children, kind = 'glass', size = 44, radius = 12, disabled }: IconButtonProps) {
  const s = useSurface(kind === 'plain' ? 'glass' : kind);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={size < 44 ? (44 - size) / 2 : 0}
      onPress={onPress}
      style={({ pressed }) => [
        kind === 'plain' ? null : surfaceStyle(s),
        {
          width: size,
          height: size,
          borderRadius: radius,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
      ]}>
      {children}
    </Pressable>
  );
}
