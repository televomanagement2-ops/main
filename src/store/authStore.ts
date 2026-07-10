import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import type { Profile } from '../types';

/**
 * Lifecycle of the profile fetch. AdminRoute needs to distinguish "profile not
 * loaded yet" (show a spinner) from "loaded and not an admin" (redirect) —
 * otherwise a hard refresh on /admin bounces the admin to the home page.
 */
export type ProfileStatus = 'idle' | 'loading' | 'loaded' | 'error';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  profileStatus: ProfileStatus;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setProfileStatus: (status: ProfileStatus) => void;
  setIsLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  profile: null,
  profileStatus: 'idle',
  isLoading: true,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setProfileStatus: (profileStatus) => set({ profileStatus }),
  setIsLoading: (isLoading) => set({ isLoading }),

  reset: () => set({ user: null, session: null, profile: null, profileStatus: 'idle', isLoading: false }),
}));
