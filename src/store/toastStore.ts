import { create } from 'zustand';

export type ToastTone = 'default' | 'critical';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, tone?: ToastTone) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;
const VISIBLE_MS = 3200;

/**
 * Toasts confirm that something happened — they never carry information the
 * user must read. Small, brief, one at a time in practice.
 */
export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  push: (message, tone = 'default') => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { id, message, tone }] }));
    setTimeout(() => get().dismiss(id), VISIBLE_MS);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helper for callbacks outside React components. */
export const toast = (message: string, tone: ToastTone = 'default') =>
  useToastStore.getState().push(message, tone);
