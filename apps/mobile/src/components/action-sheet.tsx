import * as Haptics from 'expo-haptics';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, useTheme } from '@/theme';
import { PathIcon } from './icons';

export interface SheetOption {
  label: string;
  icon?: string;
  destructive?: boolean;
  onPress: () => void;
}

interface SheetRequest {
  title?: string;
  message?: string;
  options: SheetOption[];
}

const SheetContext = createContext<(req: SheetRequest) => void>(() => {});

/**
 * An in-app action sheet, the same on iOS, Android and web. (Android's alert
 * fits only three buttons, and web previews block browser dialogs.)
 */
export function ActionSheetProvider({ children }: { children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [req, setReq] = useState<SheetRequest | null>(null);

  const show = useCallback((next: SheetRequest) => {
    void Haptics.selectionAsync();
    setReq(next);
  }, []);
  const close = () => setReq(null);

  return (
    <SheetContext.Provider value={show}>
      {children}
      <Layer visible={!!req} onClose={close}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={close}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }}
        />
        {req ? (
          <View
            accessibilityViewIsModal
            style={{
              position: 'absolute',
              left: 8,
              right: 8,
              bottom: Math.max(insets.bottom, 8),
              borderRadius: 28,
              backgroundColor: t.background,
              paddingVertical: 8,
              boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
            }}>
            {req.title || req.message ? (
              <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8, gap: 2 }}>
                {req.title ? (
                  <Text numberOfLines={2} style={{ fontFamily: fonts.bodySemibold, fontSize: 15, color: t.text }}>
                    {req.title}
                  </Text>
                ) : null}
                {req.message ? <Text style={{ fontFamily: fonts.body, fontSize: 14, color: t.faint }}>{req.message}</Text> : null}
              </View>
            ) : null}
            {req.options.map((o) => {
              const color = o.destructive ? (t.scheme === 'light' ? '#B42318' : '#FF8A80') : t.text;
              return (
                <Pressable
                  key={o.label}
                  accessibilityRole="button"
                  onPress={() => {
                    close();
                    o.onPress();
                  }}
                  style={({ pressed }) => ({
                    minHeight: 52,
                    marginHorizontal: 8,
                    paddingHorizontal: 12,
                    borderRadius: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                    backgroundColor: pressed ? t.tile : 'transparent',
                  })}>
                  {o.icon ? <PathIcon d={o.icon} color={color} size={20} /> : null}
                  <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 17, color }}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </Layer>
    </SheetContext.Provider>
  );
}

export const useActionSheet = () => useContext(SheetContext);

/**
 * A native modal on phones. On web a modal attaches to the whole window,
 * outside the preview's phone frame, so it's drawn over the app instead.
 */
function Layer({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  if (Platform.OS === 'web') {
    return visible ? <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>{children}</View> : null;
  }
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1 }}>{children}</View>
    </Modal>
  );
}
