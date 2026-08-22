import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../lib/i18n';
import { IconArrowLeft } from './icons';

interface Props {
  to?: string;
  label?: string;
}

export function BackButton({ to, label }: Props) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const resolved = label ?? t('common.back');

  return (
    <button
      type="button"
      onClick={() => (to ? navigate(to) : navigate(-1))}
      className="back-link"
    >
      <IconArrowLeft size={15} />
      <span>{resolved}</span>
    </button>
  );
}
