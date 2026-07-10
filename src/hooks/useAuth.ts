import { useEffect } from 'react';
import { useShallow } from 'zustand/shallow';
import { supabase } from '../lib/supabaseClient';
import { fetchProfile } from '../lib/api';
import { useAuthStore } from '../store/authStore';

const PROFILE_FETCH_TIMEOUT_MS = 8000;

async function fetchProfileWithTimeout(userId: string) {
  return Promise.race([
    fetchProfile(userId),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Profile fetch timed out')), PROFILE_FETCH_TIMEOUT_MS);
    }),
  ]);
}

function loadProfile(userId: string) {
  const { setProfile, setProfileStatus } = useAuthStore.getState();
  setProfileStatus('loading');
  return fetchProfileWithTimeout(userId)
    .then((profile) => {
      setProfile(profile);
      setProfileStatus('loaded');
    })
    .catch((err) => {
      console.error('Profile fetch error:', err);
      setProfileStatus('error');
    });
}

export function useAuthListener() {
  useEffect(() => {
    const { setUser, setSession, setIsLoading, reset } = useAuthStore.getState();

    // Initialise from existing session (runs once on mount)
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);

        if (session?.user) {
          // Profile loading is best-effort and must never block app bootstrap.
          void loadProfile(session.user.id);
        }
      })
      .catch((err) => {
        console.error('Initial auth session error:', err);
        // Prevent global spinner lock if session bootstrap fails.
        reset();
        setIsLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const { setUser, setSession, setIsLoading, reset } = useAuthStore.getState();

      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);

      if (session?.user) {
        // Avoid awaiting async work inside the onAuthStateChange callback.
        void loadProfile(session.user.id);
      } else {
        reset();
      }
    });

    return () => subscription.unsubscribe();
  }, []); // runs once on mount; uses getState() to avoid stale closures
}

export function useAuth() {
  return useAuthStore(
    useShallow((s) => ({
      user: s.user,
      profile: s.profile,
      profileStatus: s.profileStatus,
      session: s.session,
      isLoading: s.isLoading,
      isAuthenticated: Boolean(s.user),
      isAdmin: s.profile?.role === 'admin',
    }))
  );
}
