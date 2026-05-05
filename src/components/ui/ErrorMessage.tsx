import { useI18n } from '../../lib/i18n';

interface Props {
  message?: string;
}

export function ErrorMessage({ message }: Props) {
  const { t } = useI18n();
  const resolvedMessage = message ?? t('common.error');
  return (
    <div className="error-message" role="alert">
      <p>{resolvedMessage}</p>
    </div>
  );
}
