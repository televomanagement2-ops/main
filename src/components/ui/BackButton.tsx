import { useNavigate } from 'react-router-dom';

interface Props {
  to?: string;
  label?: string;
}

export function BackButton({ to, label = 'Back' }: Props) {
  const navigate = useNavigate();
  const handleClick = () => (to ? navigate(to) : navigate(-1));
  return (
    <button
      onClick={handleClick}
      className="back-btn"
      aria-label={label}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6"/>
      </svg>
      <span>{label}</span>
    </button>
  );
}
