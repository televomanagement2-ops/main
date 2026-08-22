import { create } from 'zustand';

type Surface = 'search' | 'cart' | 'menu' | null;

interface UiState {
  /** Only one full-surface overlay is ever open at a time. */
  surface: Surface;
  open: (surface: Exclude<Surface, null>) => void;
  close: () => void;
  toggle: (surface: Exclude<Surface, null>) => void;
}

export const useUiStore = create<UiState>()((set, get) => ({
  surface: null,
  open: (surface) => set({ surface }),
  close: () => set({ surface: null }),
  toggle: (surface) => set({ surface: get().surface === surface ? null : surface }),
}));
