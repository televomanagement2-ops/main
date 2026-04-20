import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { Spinner } from '../../../components/ui/Spinner';

export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      navigate(session ? '/' : '/login', { replace: true });
    });
  }, [navigate]);

  return (
    <div className="page-loading">
      <Spinner size="lg" />
    </div>
  );
}
