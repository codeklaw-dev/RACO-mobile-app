import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';
import { secureStorage } from '@/lib/secure-storage';
import { applyFontSet, FONT_SETS, type FontSetId } from '@/theme/tokens';
import { HUE_PALETTES, type HuePalette } from '@/vendor/voice-glow-native';

export type AppearanceChoice = 'system' | 'light' | 'dark';

export type HueChoice = 'off' | HuePalette;

interface Preferences {
  appearance: AppearanceChoice;
  font: FontSetId;
  /** The coloured glow behind Home, or off. */
  hue: HueChoice;
}

interface PreferencesState extends Preferences {
  /** False until the saved choices have been read, so the app doesn't flash the defaults. */
  ready: boolean;
  setAppearance(choice: AppearanceChoice): void;
  setFont(id: FontSetId): void;
  setHue(hue: HueChoice): void;
}

const KEY = 'raco.preferences';
const DEFAULTS: Preferences = { appearance: 'system', font: 'raco', hue: 'off' };

const PreferencesContext = createContext<PreferencesState>({ ...DEFAULTS, ready: true, setAppearance: () => {}, setFont: () => {}, setHue: () => {} });

/** Light/dark and font choices, kept on this device. */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    secureStorage
      .getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as Partial<Preferences>;
        setPrefs({
          appearance: saved.appearance && ['system', 'light', 'dark'].includes(saved.appearance) ? saved.appearance : 'system',
          font: saved.font && saved.font in FONT_SETS ? saved.font : 'raco',
          hue: saved.hue && (HUE_PALETTES as string[]).includes(saved.hue) ? saved.hue : 'off',
        });
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  // Fonts are read while rendering, so swap them before the next render.
  applyFontSet(prefs.font);

  useEffect(() => {
    // Keeps system UI (keyboard, alerts, date pickers) in step on iOS and Android.
    Appearance.setColorScheme?.(prefs.appearance === 'system' ? 'unspecified' : prefs.appearance);
  }, [prefs.appearance]);

  const update = useCallback((patch: Partial<Preferences>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      void secureStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      ...prefs,
      ready,
      setAppearance: (appearance: AppearanceChoice) => update({ appearance }),
      setFont: (font: FontSetId) => update({ font }),
      setHue: (hue: HueChoice) => update({ hue }),
    }),
    [prefs, ready, update],
  );
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesState {
  return useContext(PreferencesContext);
}
