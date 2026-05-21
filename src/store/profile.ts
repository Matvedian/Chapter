import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export interface Profile {
  id: string
  name: string | null
  birth_date: string | null
  photos: string[]
  gender: string | null
  looking_for: string[]
  onboarding_complete: boolean
}

interface ProfileState {
  profile: Profile | null
  loading: boolean
  fetch: (userId: string) => Promise<void>
  clear: () => void
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  loading: true,

  fetch: async (userId) => {
    set({ loading: true })
    const { data } = await supabase
      .from('profiles')
      .select('id, name, birth_date, photos, gender, looking_for, onboarding_complete')
      .eq('id', userId)
      .single()
    set({ profile: data ?? null, loading: false })
  },

  clear: () => set({ profile: null, loading: true }),
}))
