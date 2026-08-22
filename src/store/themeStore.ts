import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

/**
 * Light is the store's default and is deliberately not derived from the OS:
 * a visitor who has never chosen gets the light store even on a device set to
 * dark. Dark is available, but only as an explicit choice — either 'dark', or
 * 'system' picked on purpose from Settings.
 */
export const DEFAULT_THEME: Theme = 'light';

/** Browser chrome colours — kept in step with --paper in tokens.css. */
const CHROME_LIGHT = '#F7F5F1';
const CHROME_DARK = '#0E0D0B';

function isDarkTheme(theme: Theme): boolean {
  return (
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  );
}

export function applyTheme(theme: Theme): void {
  const dark = isDarkTheme(theme);
  document.documentElement.classList.toggle('dark', dark);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? CHROME_DARK : CHROME_LIGHT);
}

export function initTheme(): void {
  const stored = localStorage.getItem('aurum-theme');
  let theme: Theme = DEFAULT_THEME;
  if (stored) {
    try {
      theme = (JSON.parse(stored) as { state?: { theme?: Theme } }).state?.theme ?? DEFAULT_THEME;
    } catch {
      theme = DEFAULT_THEME;
    }
  }
  applyTheme(theme);

  // Follow the OS only for a visitor who explicitly chose 'system'.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const current = useThemeStore.getState().theme;
    if (current === 'system') applyTheme('system');
  });
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: DEFAULT_THEME,
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
    }),
    {
      name: 'aurum-theme',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);
