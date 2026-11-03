import { create } from 'zustand';

/** App-wide transient messages (e.g. "Couldn't save your rating"). Rendered by RetroGamingPCToastHost. */
export type ToastTone = 'error' | 'info' | 'success';
export type Toast = { id: number; message: string; tone: ToastTone };

const TOAST_MS = 4500;
const MAX_TOASTS = 3;

type ToastState = {
  toasts: Toast[];
  show: (message: string, tone?: ToastTone) => void;
  dismiss: (id: number) => void;
};

let nextId = 1;

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  show: (message, tone = 'info') => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts.filter((t) => t.message !== message), { id, message, tone }].slice(-MAX_TOASTS) }));
    setTimeout(() => get().dismiss(id), TOAST_MS);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helper for non-React code (mutation callbacks). */
export const showToast = (message: string, tone?: ToastTone) => useToastStore.getState().show(message, tone);
