import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
  requestOtp: (phone: string) => Promise<string | null>
  verifyOtp: (phone: string, token: string) => Promise<string | null>
  signOut: () => Promise<void>
  initialize: () => () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  loading: true,

  requestOtp: async (phone) => {
    const { error } = await supabase.auth.signInWithOtp({ phone })
    return error?.message ?? null
  },

  verifyOtp: async (phone, token) => {
    const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
    return error?.message ?? null
  },

  signOut: async () => {
    await supabase.auth.signOut()
  },

  initialize: () => {
    supabase.auth.getSession()
      .then(({ data }) => {
        set({ session: data.session, user: data.session?.user ?? null, loading: false })
      })
      .catch(() => {
        set({ loading: false })
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null, loading: false })
    })

    return () => subscription.unsubscribe()
  },
}))
