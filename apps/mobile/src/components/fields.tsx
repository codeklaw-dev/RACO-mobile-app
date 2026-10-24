import * as Haptics from 'expo-haptics';
import { forwardRef, useState } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { accent, fonts, noWebOutline, useTheme } from '@/theme';
import { Caption } from './text';
import { surfaceStyle, useSurface } from './surface';

interface FieldProps extends TextInputProps {
  label: string;
  hint?: string;
  error?: string | null;
}

/** Labelled 54pt input with the accent focus ring from the design. */
export const TextField = forwardRef<TextInput, FieldProps>(function TextField(
  { label, hint, error, style, onFocus, onBlur, ...rest },
  ref,
) {
  const t = useTheme();
  const s = useSurface('field');
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ gap: 8 }}>
      <Caption tone="sub" style={{ paddingLeft: 4 }} nativeID={`${label}-label`}>
        {label}
      </Caption>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityLabelledBy={`${label}-label`}
        placeholderTextColor={t.faint}
        selectionColor={accent}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          surfaceStyle(s),
          {
            height: 54,
            borderRadius: rest.multiline ? 22 : 27,
            paddingHorizontal: 16,
            fontSize: 17,
            fontFamily: fonts.body,
            color: t.text,
          },
          noWebOutline,
          focused || error
            ? { borderColor: error ? '#E5484D' : accent, borderWidth: 1.5, boxShadow: '0 0 0 4px rgba(252,121,101,0.18)' }
            : null,
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: t.scheme === 'light' ? '#B42318' : '#FF8A80', fontFamily: fonts.bodyMedium, fontSize: 13, paddingLeft: 4 }}>
          {error}
        </Text>
      ) : hint ? (
        <Caption style={{ fontFamily: fonts.body, paddingLeft: 4 }}>{hint}</Caption>
      ) : null}
    </View>
  );
});

/** iOS-style switch in the accent colour (51x31). */
export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      hitSlop={8}
      onPress={() => {
        void Haptics.selectionAsync();
        onChange(!value);
      }}
      style={{
        width: 51,
        height: 31,
        borderRadius: 16,
        padding: 2,
        backgroundColor: value ? accent : t.switchTrackOff,
        alignItems: value ? 'flex-end' : 'flex-start',
        justifyContent: 'center',
      }}>
      <View style={{ width: 27, height: 27, borderRadius: 14, backgroundColor: '#FFFFFF', boxShadow: '0 2px 6px rgba(0,0,0,0.18)' }} />
    </Pressable>
  );
}

/** Selectable chip used for interests (filled when on). */
export function Chip({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  const s = useSurface(selected ? 'primary' : 'glass');
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={() => {
        void Haptics.selectionAsync();
        onToggle();
      }}
      style={({ pressed }) => [
        surfaceStyle(s),
        { height: 40, paddingHorizontal: 16, borderRadius: 20, justifyContent: 'center', opacity: pressed ? 0.8 : 1 },
      ]}>
      <Text style={{ color: s.color, fontFamily: fonts.bodyMedium, fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}
