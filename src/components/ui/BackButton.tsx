import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../lib/i18n';

interface Props {
  to?: string;
  label?: string;
}

export function BackButton({ to, label }: Props) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const resolvedLabel = label ?? t('common.back');
  const handleClick = () => (to ? navigate(to) : navigate(-1));
  return (
    <button
      onClick={handleClick}
      className="back-btn"
      aria-label={resolvedLabel}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6"/>
      </svg>
      <span>{resolvedLabel}</span>
    </button>
  );
}
