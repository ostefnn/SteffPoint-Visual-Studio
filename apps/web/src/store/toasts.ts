import { create } from 'zustand';

interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'error';
}

interface ToastState {
  toasts: Toast[];
  notify(message: string, tone?: Toast['tone']): void;
  dismiss(id: number): void;
}

let next = 1;

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  notify(message, tone = 'info') {
    const id = next++;
    set({ toasts: [...get().toasts, { id, message, tone }].slice(-4) });
    setTimeout(() => get().dismiss(id), tone === 'error' ? 7000 : 3500);
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

export const notify = (message: string, tone?: Toast['tone']) => useToasts.getState().notify(message, tone);
