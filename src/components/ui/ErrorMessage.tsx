import { useI18n } from '../../lib/i18n';
import { IconAlert } from './icons';

interface Props {
  message?: string;
  action?: React.ReactNode;
}

export function ErrorMessage({ message, action }: Props) {
  const { t } = useI18n();
  return (
    <div className="notice notice--critical" role="alert">
      <IconAlert size={16} />
      <div className="notice__body">{message ?? t('common.error')}</div>
      {action}
    </div>
  );
}
