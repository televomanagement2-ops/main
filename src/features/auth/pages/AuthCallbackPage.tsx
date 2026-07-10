import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { Spinner } from '../../../components/ui/Spinner';

const CALLBACK_TIMEOUT_MS = 5000;

/** Only allow same-app relative paths as post-login destinations. */
function sanitizeNext(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const next = sanitizeNext(searchParams.get('next'));
    let done = false;

    const finish = (target: string) => {
      if (done) return;
      done = true;
      navigate(target, { replace: true });
    };

    // Subscribe instead of a one-shot getSession(): the OAuth code exchange
    // may still be in flight when this page mounts, and getSession() returning
    // null at that instant used to bounce freshly signed-in users to /login.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')) {
        finish(next);
      }
    });

    // A session may already exist (e.g. the exchange completed before mount).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) finish(next);
    });

    const timeout = setTimeout(() => finish('/login'), CALLBACK_TIMEOUT_MS);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate, searchParams]);

  return (
    <div className="page-loading">
      <Spinner size="lg" />
    </div>
  );
}
