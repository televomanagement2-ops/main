import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { useI18n } from '../../../lib/i18n';
import { Wordmark } from '../../../components/ui/Wordmark';
import { Spinner } from '../../../components/ui/Spinner';
import { IconAlert, IconCheck } from '../../../components/ui/icons';

const RECOVERY_WAIT_MS = 6000;

/**
 * Landing page for the password-recovery email link
 * (supabase.auth.resetPasswordForEmail → redirectTo /auth/reset).
 * The link signs the user in with a recovery session; we then let them set a
 * new password via updateUser().
 */
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { t } = useI18n();

  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY' || session) {
        setReady(true);
      }
    });

    // The recovery session may already be established when the page mounts.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled && session) setReady(true);
    });

    const timeout = setTimeout(() => {
      if (!cancelled) setExpired(true);
    }, RECOVERY_WAIT_MS);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => navigate('/', { replace: true }), 1500);
  };

  return (
    <div className="auth">
      <div className="auth__panel">
        <div className="auth__brand">
          <Wordmark />
        </div>

        <p className="t-label">{t('auth.label')}</p>
        <h1 className="t-h1 auth__title" style={{ marginTop: 'var(--s-3)' }}>{t('auth.resetPassword')}</h1>

        {done ? (
          <div className="notice notice--positive">
            <IconCheck size={15} />
            <div className="notice__body">{t('auth.passwordUpdated')}</div>
          </div>
        ) : !ready && expired ? (
          <>
            <div className="notice notice--critical">
              <IconAlert size={15} />
              <div className="notice__body">{t('auth.resetInvalid')}</div>
            </div>
            <Link to="/login" className="btn btn--secondary btn--lg btn--block" style={{ marginTop: 'var(--s-5)' }}>
              {t('auth.signIn')}
            </Link>
          </>
        ) : !ready ? (
          <p className="t-body auth__sub">{t('auth.pleaseWait')}</p>
        ) : (
          <form onSubmit={handleSubmit} className="auth__form" style={{ marginTop: 'var(--s-6)' }}>
            {error && (
              <div className="notice notice--critical">
                <IconAlert size={15} />
                <div className="notice__body">{error}</div>
              </div>
            )}
            <div className="field">
              <label htmlFor="new-password" className="field__label">{t('auth.newPassword')}</label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="field">
              <label htmlFor="confirm-password" className="field__label">{t('auth.confirmPassword')}</label>
              <input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="input"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <button type="submit" disabled={isLoading} className="btn btn--primary btn--lg btn--block">
              {isLoading ? (
                <>
                  <Spinner onAction />
                  {t('auth.pleaseWait')}
                </>
              ) : (
                t('auth.updatePassword')
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
