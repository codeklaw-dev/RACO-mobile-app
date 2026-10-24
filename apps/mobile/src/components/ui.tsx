import { TASK_TITLE_MAX } from '@raco/shared';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { accent, fonts, noWebOutline, useTheme } from '@/theme';
import { IconButton } from './button';
import { BackIcon, CheckIcon, CloseIcon, ICONS, PathIcon, PlusIcon } from './icons';
import { surfaceStyle, useSurface } from './surface';

/** Large page title with optional actions on the right. */
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, gap: 12 }}>
      <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1, fontFamily: fonts.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.6, color: t.text }}>
        {title}
      </Text>
      {children ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>{children}</View> : null}
    </View>
  );
}

/** Rounded search input with a clear button. */
export function SearchField({ value, onChangeText, placeholder = 'Search', ...rest }: TextInputProps & { value: string; onChangeText: (v: string) => void }) {
  const t = useTheme();
  const field = useSurface('field');
  return (
    <View style={[surfaceStyle(field), { height: 44, borderRadius: 22, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 8 }]}>
      <PathIcon d={ICONS.search} color={t.faint} size={18} strokeWidth={1.8} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.faint}
        selectionColor={accent}
        accessibilityLabel={placeholder}
        returnKeyType="search"
        autoCorrect={false}
        style={[{ flex: 1, height: 42, backgroundColor: 'transparent', borderWidth: 0, fontFamily: fonts.body, fontSize: 16, color: t.text }, noWebOutline]}
        {...rest}
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10} onPress={() => onChangeText('')}>
          <CloseIcon color={t.faint} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** One plain tappable row: title, optional detail line, leading and trailing views. */
export function ListRow({
  title,
  detail,
  leading,
  trailing,
  onPress,
  onLongPress,
  accessibilityHint,
  muted,
}: {
  title: string;
  detail?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityHint?: string;
  muted?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({
        minHeight: 52,
        borderRadius: 26,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: pressed ? t.tile : 'transparent',
      })}>
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          numberOfLines={2}
          style={{ fontFamily: fonts.bodyMedium, fontSize: 17, lineHeight: 22, color: muted ? t.faint : t.text, textDecorationLine: muted ? 'line-through' : 'none' }}>
          {title}
        </Text>
        {detail ? (
          <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 13, color: t.faint }}>
            {detail}
          </Text>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  );
}

/** Round checkbox for tasks. */
export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      hitSlop={10}
      onPress={() => {
        void Haptics.selectionAsync();
        onChange(!checked);
      }}
      style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: checked ? 0 : 1.6,
        borderColor: t.faint,
        backgroundColor: checked ? accent : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {checked ? <CheckIcon color="#2A2A2B" size={14} /> : null}
    </Pressable>
  );
}

export function SectionTitle({ children, action }: { children: string; action?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 4 }}>
      <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 13, letterSpacing: 0.3, textTransform: 'uppercase', color: t.faint }}>{children}</Text>
      {action}
    </View>
  );
}

/** Centered message for an empty list or no search results. */
export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 8 }}>
      <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 17, color: t.text, textAlign: 'center' }}>{title}</Text>
      {body ? <Text style={{ fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: t.sub, textAlign: 'center' }}>{body}</Text> : null}
      {action ? <View style={{ marginTop: 8 }}>{action}</View> : null}
    </View>
  );
}

/** Small text button, e.g. "New" next to a section title. */
export function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={10}>
      <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 16, color: t.text }}>{label}</Text>
    </Pressable>
  );
}

/** Inline "Add a task" field at the top of a task list. */
export function AddTask({ onAdd, placeholder = 'Add a task' }: { onAdd: (title: string) => Promise<void>; placeholder?: string }) {
  const t = useTheme();
  const field = useSurface('field');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const title = text.trim();
    if (!title || saving) return;
    setSaving(true);
    try {
      await onAdd(title);
      setText('');
    } catch {
      Alert.alert("Couldn't add the task", 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[surfaceStyle(field), { minHeight: 52, borderRadius: 26, flexDirection: 'row', alignItems: 'center', paddingLeft: 18, paddingRight: 8, gap: 10, marginBottom: 8 }]}>
      <PlusIcon color={t.faint} />
      <TextInput
        value={text}
        onChangeText={setText}
        onSubmitEditing={() => void submit()}
        placeholder={placeholder}
        placeholderTextColor={t.faint}
        selectionColor={accent}
        accessibilityLabel={placeholder}
        returnKeyType="done"
        submitBehavior="submit"
        maxLength={TASK_TITLE_MAX}
        style={[{ flex: 1, minHeight: 50, fontFamily: fonts.body, fontSize: 16, color: t.text }, noWebOutline]}
      />
      {text.trim() ? (
        <Pressable accessibilityRole="button" onPress={() => void submit()} style={{ paddingHorizontal: 10, paddingVertical: 8 }}>
          <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 15, color: t.accentText }}>Add</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[] }) {
  const t = useTheme();
  const glass = useSurface('glass');
  const primary = useSurface('primary');
  return (
    <View accessibilityRole="tablist" style={[surfaceStyle(glass), { flexDirection: 'row', borderRadius: 20, padding: 3, gap: 3 }]}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.id)}
            style={[on ? surfaceStyle(primary) : null, { flex: 1, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontFamily: fonts.bodySemibold, fontSize: 14, color: on ? primary.color : t.text }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Goes back, or home when there's nothing to go back to (a deep link or a reload on web). */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/home');
}

/** Header for pushed screens: back on the left, a title, optional actions on the right. */
export function NavBar({ title, children }: { title?: string; children?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <IconButton label="Back" onPress={goBack}>
        <BackIcon color={t.text} />
      </IconButton>
      <Text numberOfLines={1} style={{ flex: 1, textAlign: 'center', fontFamily: fonts.bodySemibold, fontSize: 17, color: t.text }}>
        {title ?? ''}
      </Text>
      <View style={{ minWidth: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>{children}</View>
    </View>
  );
}
