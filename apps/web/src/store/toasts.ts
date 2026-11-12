import { create } from 'zustand';

export interface ToastAction {
  label: string;
  run(): void;
}

interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'error';
  /** Optional button in the toast (e.g. Undo). Toasts with an action stay longer. */
  action?: ToastAction;
}

interface ToastState {
  toasts: Toast[];
  notify(message: string, tone?: Toast['tone'], action?: ToastAction): void;
  dismiss(id: number): void;
}

let next = 1;

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  notify(message, tone = 'info', action) {
    const id = next++;
    set({ toasts: [...get().toasts, { id, message, tone, action }].slice(-4) });
    setTimeout(() => get().dismiss(id), action ? 8000 : tone === 'error' ? 7000 : 3500);
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

export const notify = (message: string, tone?: Toast['tone'], action?: ToastAction) => useToasts.getState().notify(message, tone, action);
