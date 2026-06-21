import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ConsentStatus = 'pending' | 'given' | 'rejected';

export interface ConsentCategories {
  /** Strictly necessary cookies — always on, cannot be disabled. */
  necessary: true;
  /** First-party analytics — off until the user opts in. */
  analytics: boolean;
}

// Re-prompt for consent after 12 months (Garante / EDPB guidance).
const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

interface CookieConsentState {
  status: ConsentStatus;
  categories: ConsentCategories;
  decidedAt: number | null;
  /** Whether the preferences panel is open on top of the page. */
  isPanelOpen: boolean;

  acceptAll: () => void;
  rejectAll: () => void;
  /** Save a granular choice (necessary is implicitly always granted). */
  savePreferences: (analytics: boolean) => void;
  /** Re-open the preferences panel at any time (e.g. from the Cookie page). */
  openPreferences: () => void;
  closePanel: () => void;
}

export const useCookieConsentStore = create<CookieConsentState>()(
  persist(
    (set) => ({
      status: 'pending',
      categories: { necessary: true, analytics: false },
      decidedAt: null,
      isPanelOpen: false,

      acceptAll: () =>
        set({
          status: 'given',
          categories: { necessary: true, analytics: true },
          decidedAt: Date.now(),
          isPanelOpen: false,
        }),

      rejectAll: () =>
        set({
          status: 'rejected',
          categories: { necessary: true, analytics: false },
          decidedAt: Date.now(),
          isPanelOpen: false,
        }),

      savePreferences: (analytics) =>
        set({
          // "given" only when at least one optional category is granted.
          status: analytics ? 'given' : 'rejected',
          categories: { necessary: true, analytics },
          decidedAt: Date.now(),
          isPanelOpen: false,
        }),

      openPreferences: () => set({ isPanelOpen: true }),
      closePanel: () => set({ isPanelOpen: false }),
    }),
    {
      name: 'commercejet-cookie-consent',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        status: state.status,
        categories: state.categories,
        decidedAt: state.decidedAt,
      }),
      // When a stored decision is older than 12 months, reset to pending so the
      // banner re-appears and consent is collected again.
      onRehydrateStorage: () => (state) => {
        if (
          state &&
          state.status !== 'pending' &&
          state.decidedAt &&
          Date.now() - state.decidedAt > CONSENT_MAX_AGE_MS
        ) {
          state.status = 'pending';
          state.categories = { necessary: true, analytics: false };
          state.decidedAt = null;
        }
      },
    }
  )
);

/** Convenience selector: has the user actively granted analytics consent? */
export function hasAnalyticsConsent(): boolean {
  const { status, categories } = useCookieConsentStore.getState();
  return status === 'given' && categories.analytics;
}
