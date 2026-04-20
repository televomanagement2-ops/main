import { useEffect } from 'react';
import { useShallow } from 'zustand/shallow';
import { supabase } from '../lib/supabaseClient';
import { fetchProfile } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { mergeGuestCartIntoDbCart } from '../lib/cartMerge';
import { useCartStore } from '../store/cartStore';

const PROFILE_FETCH_TIMEOUT_MS = 8000;

async function fetchProfileWithTimeout(userId: string) {
  return Promise.race([
    fetchProfile(userId),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Profile fetch timed out')), PROFILE_FETCH_TIMEOUT_MS);
    }),
  ]);
}

export function useAuthListener() {
  useEffect(() => {
    const { setUser, setSession, setProfile, setIsLoading, reset } =
      useAuthStore.getState();

    // Initialise from existing session (runs once on mount)
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);

        if (session?.user) {
          // Profile loading is best-effort and must never block app bootstrap.
          void fetchProfileWithTimeout(session.user.id)
            .then((profile) => setProfile(profile))
            .catch((err) => {
              console.error('Initial auth profile fetch error:', err);
            });
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
    } = supabase.auth.onAuthStateChange((event, session) => {
      const { setUser, setSession, setProfile, reset } =
        useAuthStore.getState();

      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);

      if (session?.user) {
        // Avoid awaiting async work inside onAuthStateChange callback.
        void (async () => {
          try {
            const profile = await fetchProfileWithTimeout(session.user.id);
            setProfile(profile);

            // Merge guest cart only once right after explicit sign-in.
            // Do not call refreshSession() inside onAuthStateChange because it can
            // race with Supabase internal refresh handling and trigger sign-out loops.
            if (event === 'SIGNED_IN' && session.access_token) {
              const guestItems = useCartStore.getState().items;
              if (guestItems.length > 0) {
                await mergeGuestCartIntoDbCart(
                  session.user.id,
                  guestItems,
                  () => useCartStore.getState().clearCart(),
                ).catch((mergeErr: unknown) => {
                  console.error('Guest cart merge failed:', mergeErr);
                });
              }
            }
          } catch (err) {
            console.error('Auth state change error:', err);
          }
        })();
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
      session: s.session,
      isLoading: s.isLoading,
      isAuthenticated: Boolean(s.user),
      isAdmin: s.profile?.role === 'admin',
    }))
  );
}
