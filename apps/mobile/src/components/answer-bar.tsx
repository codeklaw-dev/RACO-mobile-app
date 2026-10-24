import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { speechRecognitionAvailable } from '@/lib/voice';
import { accent, fonts, noWebOutline, useTheme } from '@/theme';
import { IconButton } from './button';
import { MicIcon, SendIcon } from './icons';
import { surfaceStyle, useSurface } from './surface';

export interface AnswerBarProps {
  typing: boolean;
  micUnavailable: boolean;
  onType: () => void;
  listening: boolean;
  disabled: boolean;
  onPressIn: () => void;
  onPressOut: () => void;
  onSubmit: (text: string) => void;
  placeholder: string;
  /** On steps that already have buttons, show only a quiet "Type instead" link. */
  compact?: boolean;
}

/** "Hold to talk", with a keyboard toggle for typing the answer instead. */
export function AnswerBar({
  typing,
  micUnavailable,
  onType,
  listening,
  disabled,
  onPressIn,
  onPressOut,
  onSubmit,
  placeholder,
  compact,
}: AnswerBarProps) {
  const t = useTheme();
  const primary = useSurface('primary');
  const field = useSurface('field');
  const [text, setText] = useState('');
  const canTalk = speechRecognitionAvailable() && !micUnavailable;

  const submit = () => {
    if (!text.trim() || disabled) return;
    onSubmit(text.trim());
    setText('');
  };

  const link = (label: string) => (
    <Pressable accessibilityRole="button" onPress={onType} hitSlop={8} style={{ alignSelf: 'center', padding: 4 }}>
      <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 14, color: t.faint }}>{label}</Text>
    </Pressable>
  );

  if (typing) {
    return (
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={t.faint}
            accessibilityLabel="Your answer"
            autoFocus
            returnKeyType="send"
            onSubmitEditing={submit}
            selectionColor={accent}
            style={[
              surfaceStyle(field),
              { flex: 1, height: 56, borderRadius: 16, paddingHorizontal: 16, fontSize: 17, fontFamily: fonts.body, color: t.text },
              noWebOutline,
            ]}
          />
          <IconButton kind="accent" size={56} radius={16} label="Send" disabled={!text.trim() || disabled} onPress={submit}>
            <SendIcon color="#2A2A2B" />
          </IconButton>
        </View>
        {canTalk ? link('Talk instead') : null}
      </View>
    );
  }

  if (compact && !canTalk) return null;

  return (
    <View style={{ gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={listening ? 'Listening. Release to send' : 'Hold to talk'}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[
          surfaceStyle(primary),
          {
            height: 56,
            borderRadius: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            opacity: disabled ? 0.6 : 1,
          },
          listening ? { backgroundColor: accent, borderColor: 'rgba(255,255,255,0.35)' } : null,
        ]}>
        <MicIcon color={listening ? '#2A2A2B' : primary.color} />
        <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 17, color: listening ? '#2A2A2B' : primary.color }}>
          {listening ? 'Listening… release to send' : 'Hold to talk'}
        </Text>
      </Pressable>
      {link('Type instead')}
    </View>
  );
}
