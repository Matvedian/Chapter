import { create } from 'zustand'

export interface Toast {
  id: string
  type: 'match' | 'message'
  title: string
  body: string
  matchId: string
  photo: string | null
}

interface NotificationStore {
  toasts: Toast[]
  unreadCount: number
  addToast: (toast: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
  incrementUnread: () => void
  clearUnread: () => void
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  toasts: [],
  unreadCount: 0,
  addToast: (toast) =>
    set((s) => ({ toasts: [...s.toasts, { ...toast, id: crypto.randomUUID() }] })),
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  incrementUnread: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),
  clearUnread: () => set({ unreadCount: 0 }),
}))
