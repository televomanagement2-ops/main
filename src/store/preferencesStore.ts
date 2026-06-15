import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type AppLanguageCode = 'it' | 'en' | 'es' | 'fr';

export const LANGUAGE_OPTIONS: Record<AppLanguageCode, { label: string; flag: string; country: string }> = {
  it: { label: 'Italiano', flag: '🇮🇹', country: 'Italy' },
  en: { label: 'English', flag: '🇬🇧', country: 'United Kingdom' },
  es: { label: 'Espanol', flag: '🇪🇸', country: 'Spain' },
  fr: { label: 'Francais', flag: '🇫🇷', country: 'France' },
};

interface PreferencesState {
  language: AppLanguageCode;
  setLanguage: (language: AppLanguageCode) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      language: 'it',
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'commercejet-preferences',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ language: state.language }),
    }
  )
);
