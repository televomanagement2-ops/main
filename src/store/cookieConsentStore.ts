import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ConsentStatus = 'pending' | 'given' | 'rejected';

interface CookieConsentState {
  status: ConsentStatus;
  setStatus: (status: ConsentStatus) => void;
}

export const useCookieConsentStore = create<CookieConsentState>()(
  persist(
    (set) => ({
      status: 'pending',
      setStatus: (status) => set({ status }),
    }),
    {
      name: 'shopbase-cookie-consent',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ status: state.status }),
    }
  )
);

// Ascolta gli eventi Iubenda CMP e sincronizza lo store
if (typeof window !== 'undefined') {
  window.addEventListener('iubenda:consent:given', () => {
    useCookieConsentStore.getState().setStatus('given');
  });
  window.addEventListener('iubenda:consent:rejected', () => {
    useCookieConsentStore.getState().setStatus('rejected');
  });
}
